// tests/shuffle-bag.test.ts — ShuffleBag specification
import { describe, it, expect } from 'vitest';
import { ShuffleBag } from '../src/gamelib/shuffle-bag';
import { SequenceRandom, SeededRandom } from '../src/gamelib/runtime/random';

describe('ShuffleBag', () => {
    it('draws every item exactly once (without replacement)', () => {
        const bag = new ShuffleBag(['a', 'b', 'c'], new SequenceRandom([0, 0, 0]));
        const draws = [bag.draw(), bag.draw(), bag.draw()];
        expect(draws.sort()).toEqual(['a', 'b', 'c']);
        expect(bag.remaining).toBe(0);
    });

    it('reshuffles when empty by default', () => {
        const bag = new ShuffleBag(['a', 'b'], new SequenceRandom([0, 0, 0, 0]));
        bag.draw();
        bag.draw();
        expect(bag.remaining).toBe(0);
        expect(bag.draw()).toBeDefined();
        expect(bag.remaining).toBe(1);
    });

    it('returns undefined when empty and reshuffleOnEmpty is false', () => {
        const bag = new ShuffleBag(['a'], new SequenceRandom([0]), { reshuffleOnEmpty: false });
        bag.draw();
        expect(bag.draw()).toBeUndefined();
    });

    it('is deterministic with a SeededRandom', () => {
        const a = new ShuffleBag(['a', 'b', 'c', 'd'], new SeededRandom(7));
        const b = new ShuffleBag(['a', 'b', 'c', 'd'], new SeededRandom(7));
        const seqA = [a.draw(), a.draw(), a.draw(), a.draw()];
        const seqB = [b.draw(), b.draw(), b.draw(), b.draw()];
        expect(seqA).toEqual(seqB);
    });

    it('snapshot/restore round-trips remaining items', () => {
        const bag = new ShuffleBag(['a', 'b', 'c'], new SequenceRandom([0]));
        bag.draw();
        const snapshot = bag.snapshot();
        const restored = new ShuffleBag(['a', 'b', 'c'], new SequenceRandom([0]), { reshuffleOnEmpty: false });
        restored.restore(snapshot);
        expect(restored.snapshot()).toEqual(snapshot);
    });

    it('rejects an empty item set', () => {
        expect(() => new ShuffleBag([], new SequenceRandom([0]))).toThrow(/empty/);
    });
});
