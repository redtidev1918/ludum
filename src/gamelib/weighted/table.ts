/**
 * Weighted selection — definition + pure algorithm (see docs/adr/0002, 0004).
 * No runtime state, history, pity, or statistics live here.
 */
import type { RandomSource } from '../runtime/random.js';

export interface WeightedEntry {
    id: string;
    weight: number;
    type?: string;
    data?: unknown;
}

export interface WeightedModifier {
    /** Is this modifier active for the current roll? */
    active: (context: Record<string, unknown>) => boolean;
    /** Restrict the modifier to entries matching this predicate (default: all). */
    matches?: (entry: WeightedEntry) => boolean;
    multiply?: number;
    add?: number;
}

export interface WeightedTableConfig {
    entries: readonly WeightedEntry[];
    modifiers?: readonly WeightedModifier[];
}

/** Static definition of a weighted selection table. Treat as immutable. */
export class WeightedTable {
    readonly entries: readonly WeightedEntry[];
    readonly modifiers: readonly WeightedModifier[];

    constructor(config: WeightedTableConfig) {
        if (config.entries.length === 0) {
            throw new Error('WeightedTable: entries must not be empty');
        }
        const seen = new Set<string>();
        for (const entry of config.entries) {
            if (!Number.isFinite(entry.weight) || entry.weight < 0) {
                throw new Error(`WeightedTable: entry "${entry.id}" has invalid weight ${entry.weight}`);
            }
            if (seen.has(entry.id)) {
                throw new Error(`WeightedTable: duplicate entry id "${entry.id}"`);
            }
            seen.add(entry.id);
        }
        this.entries = [...config.entries];
        this.modifiers = [...(config.modifiers ?? [])];
    }
}

/** Effective weight of an entry after applying active modifiers (clamped to >= 0). */
export function effectiveWeight(
    entry: WeightedEntry,
    context: Record<string, unknown>,
    modifiers: readonly WeightedModifier[],
): number {
    let weight = entry.weight;
    for (const modifier of modifiers) {
        if (modifier.active(context) && (modifier.matches?.(entry) ?? true)) {
            if (modifier.multiply != null) weight *= modifier.multiply;
            if (modifier.add != null) weight += modifier.add;
        }
    }
    return Math.max(0, weight);
}

/** Pure weighted selection. Returns undefined when nothing has positive weight. */
export function selectWeighted<T>(
    entries: readonly T[],
    getWeight: (entry: T) => number,
    random: RandomSource,
): T | undefined {
    const weights = entries.map((entry) => Math.max(0, getWeight(entry)));
    let total = 0;
    for (const weight of weights) total += weight;
    if (total <= 0) return undefined;

    const roll = random.next() * total;
    let cumulative = 0;
    for (let i = 0; i < entries.length; i++) {
        cumulative += weights[i]!;
        if (roll < cumulative) return entries[i];
    }
    // Unreachable when total > 0 (roll ∈ [0, total)); kept as a safe fallback.
    return entries[entries.length - 1];
}

/** Select an entry from a table using effective weights and an optional entry filter. */
export function selectFromTable(
    table: WeightedTable,
    context: Record<string, unknown>,
    random: RandomSource,
    filter?: (entry: WeightedEntry) => boolean,
): WeightedEntry | undefined {
    const candidates = filter ? table.entries.filter(filter) : [...table.entries];
    return selectWeighted(candidates, (e) => effectiveWeight(e, context, table.modifiers), random);
}
