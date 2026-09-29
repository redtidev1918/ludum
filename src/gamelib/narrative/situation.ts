/**
 * Situation + Heartbeat — engine-agnostic parallel narrative scaffolding
 * (see docs/architecture-study/ludum-cultist-gap-analysis.md, gap G1).
 *
 * A `Situation` is an independent gameplay location with a set of slots, its own
 * simulation countdown, and a lifecycle state. Many situations can run in parallel,
 * each progressing on its own timer. A `Heartbeat` drives all situations forward
 * on a shared tick — the narrative equivalent of several things happening at once.
 *
 * Deliberately out of scope: rendering, input, "card" identity. Slots are just
 * string ids that something else (a card system, a resource, a predicate) fills.
 *
 * No runtime dependencies; `Math.random()`/`Date.now()` are never referenced.
 * Advances use simulation `dtSeconds` (see docs/adr/0005-time-units.md).
 */

import { Countdown } from '../runtime/countdown.js';
import { satisfiesAspects, type Aspects } from '../aspect.js';

/** Lifecycle of a Situation. `idle` -> `running` -> `ready` -> `complete`. */
export type SituationState = 'idle' | 'running' | 'ready' | 'complete';

/** A single fillable location within a situation. */
export interface SituationSlot {
    /** Stable id, e.g. `'main'`, `'power'`. */
    id: string;
    /** Aspects that must be present for this slot to count as filled. */
    requiredAspects?: Aspects;
}

/** Config for a situation instance. Definitions own this; instances own state. */
export interface SituationConfig {
    id: string;
    slots?: readonly SituationSlot[];
    /** Duration (seconds) the situation runs before it becomes `ready`. */
    durationSeconds?: number;
}

/** Snapshot of situation runtime state (see docs/adr/0011-snapshot-conventions.md). */
export interface SituationSnapshot {
    schemaVersion: 1;
    id: string;
    state: SituationState;
    /** Current slot fill: slotId -> aspects contributed. */
    fills: Record<string, Aspects>;
    remainingSeconds: number | null;
}

export class Situation {
    readonly id: string;
    readonly slots: readonly SituationSlot[];
    private stateSituation: SituationState = 'idle';
    private readonly fills: Map<string, Aspects> = new Map();
    private countdown: Countdown | null = null;
    private readonly durationSeconds: number;
    /** Called when the situation transitions to `ready`. */
    onReady: ((situation: Situation) => void) | null = null;

    constructor(config: SituationConfig) {
        if (typeof config.id !== 'string' || config.id.trim().length === 0) {
            throw new Error('Situation: id must be a non-empty string');
        }
        const duration = config.durationSeconds ?? 0;
        if (!Number.isFinite(duration) || duration < 0) {
            throw new Error(`Situation: durationSeconds must be a finite number >= 0, got ${duration}`);
        }
        this.durationSeconds = duration;
        this.id = config.id;
        this.slots = [...(config.slots ?? [])];
        // Validate unique slot ids.
        const seen = new Set<string>();
        for (const slot of this.slots) {
            if (seen.has(slot.id)) {
                throw new Error(`Situation "${config.id}": duplicate slot id "${slot.id}"`);
            }
            seen.add(slot.id);
        }
    }

    get state(): SituationState {
        return this.stateSituation;
    }

    get isRunning(): boolean {
        return this.stateSituation === 'running';
    }

    /** Start the countdown. No-op if already started or completed. */
    start(): this {
        if (this.stateSituation === 'idle') {
            this.stateSituation = 'running';
            this.countdown = new Countdown(this.durationSeconds);
        }
        return this;
    }

    /** Fill a slot with contributed aspects. Returns false if the slot is unknown or already filled. */
    fill(slotId: string, aspects: Aspects): boolean {
        if (this.stateSituation === 'complete') return false;
        const slot = this.slots.find((s) => s.id === slotId);
        if (!slot) return false;
        if (this.fills.has(slotId)) return false;
        this.fills.set(slotId, aspects);
        return true;
    }

    /** Whether the number of filled slots meets the situation's required slots. */
    get isReadyInput(): boolean {
        return this.slots.every((slot) => {
            const provided = this.fills.get(slot.id);
            if (provided === undefined) return false;
            return satisfiesAspects(provided, slot.requiredAspects ?? {});
        });
    }

    /** Advance this situation by `dtSeconds`. Returns true only on the ready transition. */
    advance(dtSeconds: number): boolean {
        if (this.stateSituation !== 'running') return false;
        if (!this.isReadyInput) return false; // wait for input before running
        const countdown = this.countdown;
        if (!countdown) return false;
        if (countdown.advance(dtSeconds)) {
            this.stateSituation = 'ready';
            this.onReady?.(this);
            return true;
        }
        return false;
    }

    /** Mark complete after a ready outcome is resolved. */
    complete(): void {
        if (this.stateSituation === 'ready') this.stateSituation = 'complete';
    }

    /** Reset to idle (keep config). */
    reset(): void {
        this.stateSituation = 'idle';
        this.fills.clear();
        this.countdown = null;
    }

    serialize(): SituationSnapshot {
        const fills: SituationSnapshot['fills'] = {};
        for (const [slot, aspects] of this.fills) fills[slot] = aspects;
        return {
            schemaVersion: 1,
            id: this.id,
            state: this.stateSituation,
            fills,
            remainingSeconds: this.countdown?.remainingSeconds ?? null,
        };
    }
}

/**
 * A roster of situations advanced together on a shared tick. Engine-agnostic;
 * drives each running situation, and reports which ones became ready this tick.
 */
export class Heartbeat {
    private readonly situations = new Map<string, Situation>();

    add(situation: Situation): this {
        if (this.situations.has(situation.id)) {
            throw new Error(`Heartbeat: duplicate situation id "${situation.id}"`);
        }
        this.situations.set(situation.id, situation);
        return this;
    }

    get(id: string): Situation | undefined {
        return this.situations.get(id);
    }

    has(id: string): boolean {
        return this.situations.has(id);
    }

    /** Advance all running situations by `dtSeconds`. Returns situations that became `ready`. */
    advance(dtSeconds: number): Situation[] {
        if (!Number.isFinite(dtSeconds) || dtSeconds < 0) {
            throw new Error(`Heartbeat.advance: dtSeconds must be a finite number >= 0, got ${dtSeconds}`);
        }
        const ready: Situation[] = [];
        for (const situation of this.situations.values()) {
            if (situation.advance(dtSeconds)) ready.push(situation);
        }
        return ready;
    }

    values(): IterableIterator<Situation> {
        return this.situations.values();
    }

    clear(): void {
        this.situations.clear();
    }
}