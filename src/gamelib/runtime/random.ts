/**
 * Randomness capability (see docs/adr/0004-deterministic-randomness.md).
 * Gameplay modules depend on `RandomSource`, never `Math.random()`.
 */

export interface RandomSource {
    /** Return a uniform random number in [0, 1). */
    next(): number;
}

/**
 * Optional capability for a deterministic RandomSource that can capture and restore
 * its state for save/load. SystemRandom intentionally does not implement this.
 */
export interface StatefulRandomSource extends RandomSource {
    snapshot(): unknown;
    restore(snapshot: unknown): void;
}

/** Uses `Math.random()`. The default for non-deterministic games. */
export class SystemRandom implements RandomSource {
    next(): number {
        return Math.random();
    }
}

/** Deterministic PRNG (mulberry32). The same seed produces the same sequence. */
export class SeededRandom implements StatefulRandomSource {
    private state: number;

    constructor(seed: number) {
        this.state = seed >>> 0;
    }

    next(): number {
        let t = (this.state += 0x6d2b79f5);
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }

    snapshot(): unknown {
        return this.state;
    }

    restore(snapshot: unknown): void {
        this.state = snapshot as number;
    }
}

/** Returns a fixed sequence of numbers, repeating the last value once exhausted. For tests. */
export class SequenceRandom implements RandomSource {
    private readonly values: number[];
    private index = 0;

    constructor(values: readonly number[]) {
        if (values.length === 0) {
            throw new Error('SequenceRandom: values must not be empty');
        }
        this.values = [...values];
    }

    next(): number {
        const value = this.values[Math.min(this.index, this.values.length - 1)];
        if (this.index < this.values.length) this.index += 1;
        return value;
    }
}
