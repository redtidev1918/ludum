/**
 * Aspects — a lightweight "tag + level" numeric model (see docs/adr/0002, 0004)
 * inspired by the aspect-dictionary pattern used in card/narrative games
 * (tags such as `lantern: 2`, `grail: 3` instead of fixed numeric fields).
 *
 * - `Aspects` is an ordered `Record<string, number>` (aspectId -> level).
 * - Pure helpers: combine (sum), total, present, satisfies (all >= required).
 * - No global state, no random access, no runtime dependencies.
 */
export type Aspects = Record<string, number>;

/** Sum the levels of every aspect in `a` across all keys. */
export function totalAspects(a: Aspects): number {
    let total = 0;
    for (const key of Object.keys(a)) total += a[key]!;
    return total;
}

/** Keys present with a level > 0. */
export function presentAspects(a: Aspects): string[] {
    return Object.keys(a).filter((key) => a[key]! > 0);
}

/** True when `a` has every required aspect at least at the required level. */
export function satisfiesAspects(a: Aspects, required: Aspects): boolean {
    for (const key of Object.keys(required)) {
        if ((a[key] ?? 0) < required[key]!) return false;
    }
    return true;
}

/**
 * Combine several aspect records into one by summing per-aspect levels.
 * Later records never override; levels add.
 */
export function combineAspects(...records: Aspects[]): Aspects {
    const out: Aspects = {};
    for (const record of records) {
        for (const key of Object.keys(record)) {
            out[key] = (out[key] ?? 0) + record[key]!;
        }
    }
    return out;
}

/** Apply an additive delta (`+n` / `-n`) to level of each aspect key in `delta`. */
export function applyAspectDelta(
    a: Aspects,
    delta: Aspects,
    minLevel = 0,
): Aspects {
    const out: Aspects = { ...a };
    for (const key of Object.keys(delta)) {
        const next = (out[key] ?? 0) + delta[key]!;
        out[key] = Math.max(minLevel, next);
    }
    return out;
}

/** The level of a single aspect, or `0` when absent. */
export function aspectLevel(a: Aspects, id: string): number {
    return a[id] ?? 0;
}