/**
 * Deck — definition/instance-separated card draw (see docs/adr/0002, 0004,
 * and docs/architecture-study/ludum-cultist-gap-analysis.md, gap G4).
 *
 * A `DeckSpec` is a static, shareable definition of a card pool (starting cards,
 * draws, reset-on-exhaustion, plus a fallback default card). A `DeckInstance`
 * owns the live draw state (a stack of card ids + eliminated set) and draws by
 * id without modifying the spec. Drawing uses an injected `RandomSource`, so it
 * is deterministic under `SeededRandom` and never calls `Math.random()`.
 *
 * No runtime dependencies, no global state.
 */

import type { RandomSource } from './runtime/random.js';

/** One unique card identifier in a deck. */
export type CardId = string;

/** Static definition of a deck. Treat as immutable and shareable. */
export interface DeckSpec {
    id: string;
    /** Card ids that make up the initial pool. */
    startingCards: readonly CardId[];
    /** Card dealt when the pool is exhausted and it must not reset. Optional. */
    defaultCard?: CardId;
    /** Whether withdrawing from an empty pool re-fills from `startingCards`. */
    resetOnExhaustion?: boolean;
}

/** Snapshot of a deck instance's runtime state. */
export interface DeckSnapshot {
    schemaVersion: 1;
    specId: string;
    /** Remaining cards in draw order (front = next drawn). */
    cards: CardId[];
    /** Cards that have been drawn and not returned (eliminated). */
    eliminated: CardId[];
}

export class DeckInstance {
    readonly spec: DeckSpec;
    private readonly random: RandomSource;
    private cards: CardId[];
    private eliminated: CardId[];

    constructor(spec: DeckSpec, random: RandomSource) {
        if (typeof spec.id !== 'string' || spec.id.trim().length === 0) {
            throw new Error('DeckInstance: spec.id must be a non-empty string');
        }
        if (spec.startingCards.length === 0) {
            throw new Error(`DeckInstance: spec "${spec.id}" has no startingCards`);
        }
        this.spec = spec;
        this.random = random;
        this.cards = [...spec.startingCards];
        this.eliminated = [];
    }

    get size(): number {
        return this.cards.length;
    }

    get remaining(): ReadonlyArray<CardId> {
        return this.cards;
    }

    /** Draw one card. When empty: reset (if enabled) or return the default card (if any) else undefined. */
    draw(): CardId | undefined {
        if (this.cards.length === 0) {
            if (this.spec.resetOnExhaustion) {
                this.reset();
            } else if (this.spec.defaultCard != null) {
                return this.spec.defaultCard;
            } else {
                return undefined;
            }
        }
        // Draw a uniformly-random index.
        const index = Math.floor(this.random.next() * this.cards.length);
        const [drawn] = this.cards.splice(index, 1);
        // A drawn card is removed from the live pool but tracked as "in play".
        this.eliminated.push(drawn!);
        return drawn;
    }

    /** Refill the pool from `startingCards` and clear the eliminated set. */
    reset(): void {
        this.cards = [...this.spec.startingCards];
        this.eliminated = [];
    }

    /** Remove a specific card id from the pool wherever it is. Returns true when found. */
    removeCard(id: CardId): boolean {
        const i = this.cards.indexOf(id);
        if (i >= 0) {
            this.cards.splice(i, 1);
            if (!this.eliminated.includes(id)) this.eliminated.push(id);
            return true;
        }
        return false;
    }

    serialize(): DeckSnapshot {
        return {
            schemaVersion: 1,
            specId: this.spec.id,
            cards: [...this.cards],
            eliminated: [...this.eliminated],
        };
    }
}

/** Convenience factory for a deck instance from inline cards. */
export function createDeck(
    spec: DeckSpec,
    random: RandomSource,
): DeckInstance {
    return new DeckInstance(spec, random);
}