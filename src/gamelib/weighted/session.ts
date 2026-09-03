/**
 * Weighted selection — runtime session (see docs/adr/0002, 0004).
 * Holds rollCount, pity, per-entry statistics, and optional bounded history.
 * Statistics are independent of history length, and `simulate()` runs on a
 * separate state so it never pollutes the real session.
 */
import type { RandomSource } from '../runtime/random.js';
import { WeightedTable, WeightedTableConfig, WeightedEntry, effectiveWeight, selectWeighted } from './table.js';

export interface PityConfig {
    /** Consecutive non-guarantee rolls before the guarantee is forced. Must be >= 1. */
    threshold: number;
    /** Which entries satisfy the guarantee (e.g. only legendary items). */
    guarantee: (entry: WeightedEntry) => boolean;
}

export interface WeightedSessionOptions {
    pity?: PityConfig;
    /** Maximum history entries retained (default 0 = no history). */
    historyLimit?: number;
}

export interface WeightedSessionSnapshotV1 {
    schemaVersion: 1;
    rollCount: number;
    totalTriggers: number;
    consecutiveWithoutGuarantee: number;
    perEntry: Record<string, { count: number; lastRoll: number }>;
    history: Array<{ id: string; roll: number }>;
}

interface EntryStats {
    count: number;
    lastRoll: number;
}

interface HistoryEntry {
    id: string;
    roll: number;
}

interface SessionState {
    rollCount: number;
    totalTriggers: number;
    consecutiveWithoutGuarantee: number;
    perEntry: Map<string, EntryStats>;
    history: HistoryEntry[];
}

export class WeightedSession {
    readonly table: WeightedTable;
    private readonly random: RandomSource;
    private readonly pity?: PityConfig;
    private readonly historyLimit: number;
    private state: SessionState;

    constructor(table: WeightedTable, random: RandomSource, options: WeightedSessionOptions = {}) {
        if (options.pity && (!Number.isInteger(options.pity.threshold) || options.pity.threshold < 1)) {
            throw new Error(`WeightedSession: pity.threshold must be a positive integer, got ${options.pity.threshold}`);
        }
        if (options.historyLimit != null && (!Number.isInteger(options.historyLimit) || options.historyLimit < 0)) {
            throw new Error(`WeightedSession: historyLimit must be a non-negative integer, got ${options.historyLimit}`);
        }
        this.table = table;
        this.random = random;
        this.pity = options.pity;
        this.historyLimit = options.historyLimit ?? 0;
        this.state = newSessionState();
    }

    /** Roll once. Returns the selected entry, or undefined if nothing has positive weight. */
    roll(context: Record<string, unknown> = {}, filter?: (entry: WeightedEntry) => boolean): WeightedEntry | undefined {
        return this.performRoll(this.state, context, filter);
    }

    /** Simulate `count` rolls without touching the real session (returns per-id trigger counts). */
    simulate(count: number, context: Record<string, unknown> = {}, filter?: (entry: WeightedEntry) => boolean): Record<string, number> {
        if (!Number.isInteger(count) || count < 0) {
            throw new Error(`WeightedSession.simulate: count must be a non-negative integer, got ${count}`);
        }
        const simState = newSessionState();
        const results: Record<string, number> = {};
        for (let i = 0; i < count; i++) {
            const entry = this.performRoll(simState, context, filter);
            if (entry) results[entry.id] = (results[entry.id] ?? 0) + 1;
        }
        return results;
    }

    getStats(): {
        totalRolls: number;
        totalTriggers: number;
        events: Record<string, { count: number; rate: number; lastRoll: number }>;
    } {
        const events: Record<string, { count: number; rate: number; lastRoll: number }> = {};
        for (const [id, stats] of this.state.perEntry) {
            events[id] = {
                count: stats.count,
                rate: this.state.rollCount > 0 ? stats.count / this.state.rollCount : 0,
                lastRoll: stats.lastRoll,
            };
        }
        return {
            totalRolls: this.state.rollCount,
            totalTriggers: this.state.totalTriggers,
            events,
        };
    }

    getHistory(limit?: number): HistoryEntry[] {
        const n = limit ?? this.state.history.length;
        return this.state.history.slice(Math.max(0, this.state.history.length - n));
    }

    resetStats(): this {
        this.state = newSessionState();
        return this;
    }

    serialize(): WeightedSessionSnapshotV1 {
        const perEntry: Record<string, EntryStats> = {};
        for (const [id, stats] of this.state.perEntry) {
            perEntry[id] = { ...stats };
        }
        return {
            schemaVersion: 1,
            rollCount: this.state.rollCount,
            totalTriggers: this.state.totalTriggers,
            consecutiveWithoutGuarantee: this.state.consecutiveWithoutGuarantee,
            perEntry,
            history: this.state.history.map((h) => ({ ...h })),
        };
    }

    deserialize(snapshot: WeightedSessionSnapshotV1): void {
        if (snapshot.schemaVersion !== 1) {
            throw new Error(`WeightedSession.deserialize: unsupported schemaVersion ${snapshot.schemaVersion}`);
        }
        this.state = {
            rollCount: snapshot.rollCount ?? 0,
            totalTriggers: snapshot.totalTriggers ?? 0,
            consecutiveWithoutGuarantee: snapshot.consecutiveWithoutGuarantee ?? 0,
            perEntry: new Map(Object.entries(snapshot.perEntry ?? {}).map(([id, s]) => [id, { ...s }])),
            history: (snapshot.history ?? []).map((h) => ({ ...h })),
        };
    }

    private performRoll(state: SessionState, context: Record<string, unknown>, filter?: (entry: WeightedEntry) => boolean): WeightedEntry | undefined {
        state.rollCount += 1;

        const candidates = filter ? this.table.entries.filter(filter) : [...this.table.entries];
        const getWeight = (entry: WeightedEntry): number => effectiveWeight(entry, context, this.table.modifiers);

        const pity = this.pity;
        let entry: WeightedEntry | undefined;
        if (pity && state.consecutiveWithoutGuarantee >= pity.threshold) {
            const guaranteed = candidates.filter(pity.guarantee);
            entry = selectWeighted(guaranteed, getWeight, this.random) ?? selectWeighted(candidates, getWeight, this.random);
        } else {
            entry = selectWeighted(candidates, getWeight, this.random);
        }

        if (entry == null) return undefined;

        if (pity && pity.guarantee(entry)) {
            state.consecutiveWithoutGuarantee = 0;
        } else {
            state.consecutiveWithoutGuarantee += 1;
        }

        this.recordTrigger(state, entry);
        return entry;
    }

    private recordTrigger(state: SessionState, entry: WeightedEntry): void {
        state.totalTriggers += 1;
        const stats = state.perEntry.get(entry.id) ?? { count: 0, lastRoll: 0 };
        stats.count += 1;
        stats.lastRoll = state.rollCount;
        state.perEntry.set(entry.id, stats);

        if (this.historyLimit > 0) {
            state.history.push({ id: entry.id, roll: state.rollCount });
            if (state.history.length > this.historyLimit) {
                state.history.shift();
            }
        }
    }
}

function newSessionState(): SessionState {
    return {
        rollCount: 0,
        totalTriggers: 0,
        consecutiveWithoutGuarantee: 0,
        perEntry: new Map(),
        history: [],
    };
}

/** Convenience factory: build a table and a session in one step. */
export function createWeightedSession(
    tableConfig: WeightedTableConfig,
    random: RandomSource,
    options?: WeightedSessionOptions,
): WeightedSession {
    return new WeightedSession(new WeightedTable(tableConfig), random, options);
}
