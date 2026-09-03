/**
 * ShuffleBag — random draw *without* replacement (decks, encounter pools, loot bags).
 * Distinct from Weighted (weighted *with* replacement). Pure state + injected RandomSource.
 */
import type { RandomSource } from './runtime/random.js';

export class ShuffleBag<T> {
    private readonly items: readonly T[];
    private readonly random: RandomSource;
    private readonly reshuffleOnEmpty: boolean;
    private bag: T[];

    constructor(items: readonly T[], random: RandomSource, options: { reshuffleOnEmpty?: boolean } = {}) {
        if (items.length === 0) {
            throw new Error('ShuffleBag: items must not be empty');
        }
        this.items = [...items];
        this.random = random;
        this.reshuffleOnEmpty = options.reshuffleOnEmpty ?? true;
        this.bag = [...this.items];
    }

    /** Draw one item without replacement. Returns undefined when empty and reshuffleOnEmpty is false. */
    draw(): T | undefined {
        if (this.bag.length === 0) {
            if (!this.reshuffleOnEmpty) return undefined;
            this.bag = [...this.items];
        }
        const index = Math.floor(this.random.next() * this.bag.length);
        const [item] = this.bag.splice(index, 1);
        return item;
    }

    /** Number of items remaining before the next reshuffle. */
    get remaining(): number {
        return this.bag.length;
    }

    /** Refill the bag from the full item set. */
    reset(): void {
        this.bag = [...this.items];
    }

    /** Remaining items as a plain copy (for snapshot). */
    snapshot(): T[] {
        return [...this.bag];
    }

    /** Restore remaining items (no refill). Items must be a subset of the original set. */
    restore(remaining: readonly T[]): void {
        this.bag = [...remaining];
    }
}
