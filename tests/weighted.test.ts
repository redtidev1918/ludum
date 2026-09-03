// tests/weighted.test.ts — Weighted v3 specification (definition + pure selector + session)
import { describe, it, expect } from 'vitest';
import {
    WeightedTable,
    WeightedModifier,
    effectiveWeight,
    selectWeighted,
    selectFromTable,
} from '../src/gamelib/weighted/table';
import { createWeightedSession } from '../src/gamelib/weighted/session';
import { SequenceRandom, SeededRandom } from '../src/gamelib/runtime/random';

describe('WeightedTable', () => {
    it('stores entries and modifiers immutably', () => {
        const table = new WeightedTable({ entries: [{ id: 'a', weight: 10 }, { id: 'b', weight: 5 }] });
        expect(table.entries.length).toBe(2);
        expect(table.modifiers.length).toBe(0);
    });

    it('rejects an empty table', () => {
        expect(() => new WeightedTable({ entries: [] })).toThrow(/empty/);
    });

    it('rejects duplicate entry ids', () => {
        expect(() => new WeightedTable({ entries: [{ id: 'a', weight: 1 }, { id: 'a', weight: 2 }] })).toThrow(/duplicate/);
    });

    it('rejects invalid weights', () => {
        expect(() => new WeightedTable({ entries: [{ id: 'a', weight: -1 }] })).toThrow(/weight/);
        expect(() => new WeightedTable({ entries: [{ id: 'a', weight: NaN }] })).toThrow(/weight/);
    });
});

describe('effectiveWeight', () => {
    it('returns the base weight with no modifiers', () => {
        expect(effectiveWeight({ id: 'a', weight: 10 }, {}, [])).toBe(10);
    });

    it('applies active multiply and add modifiers', () => {
        const mods: WeightedModifier[] = [
            { active: () => true, multiply: 2 },
            { active: () => true, add: 5 },
        ];
        expect(effectiveWeight({ id: 'a', weight: 10 }, {}, mods)).toBe(25); // 10 * 2 + 5
    });

    it('ignores inactive modifiers', () => {
        const mods: WeightedModifier[] = [{ active: () => false, multiply: 100 }];
        expect(effectiveWeight({ id: 'a', weight: 10 }, {}, mods)).toBe(10);
    });

    it('restricts modifiers by the matches predicate', () => {
        const mods: WeightedModifier[] = [{ active: () => true, matches: (e) => e.type === 'rare', multiply: 2 }];
        expect(effectiveWeight({ id: 'a', weight: 10, type: 'common' }, {}, mods)).toBe(10);
        expect(effectiveWeight({ id: 'a', weight: 10, type: 'rare' }, {}, mods)).toBe(20);
    });

    it('clamps the result to zero', () => {
        const mods: WeightedModifier[] = [{ active: () => true, multiply: -1 }];
        expect(effectiveWeight({ id: 'a', weight: 10 }, {}, mods)).toBe(0);
    });
});

describe('selectWeighted (pure)', () => {
    it('is deterministic with a SequenceRandom', () => {
        const entries = [{ id: 'a', weight: 3 }, { id: 'b', weight: 1 }];
        expect(selectWeighted(entries, (e) => e.weight, new SequenceRandom([0.9]))!.id).toBe('b');
        expect(selectWeighted(entries, (e) => e.weight, new SequenceRandom([0.1]))!.id).toBe('a');
    });

    it('returns undefined when every weight is zero', () => {
        const entries = [{ id: 'a', weight: 0 }];
        expect(selectWeighted(entries, (e) => e.weight, new SequenceRandom([0.5]))).toBeUndefined();
    });

    it('selectFromTable applies an entry filter', () => {
        const table = new WeightedTable({
            entries: [
                { id: 'a', weight: 10, type: 'positive' },
                { id: 'b', weight: 10, type: 'negative' },
            ],
        });
        const result = selectFromTable(table, {}, new SequenceRandom([0]), (e) => e.type === 'positive');
        expect(result!.id).toBe('a');
    });
});

describe('WeightedSession', () => {
    it('rolls and records statistics', () => {
        const session = createWeightedSession({ entries: [{ id: 'a', weight: 1 }] }, new SeededRandom(1));
        expect(session.roll()!.id).toBe('a');
        expect(session.roll()!.id).toBe('a');
        const stats = session.getStats();
        expect(stats.totalRolls).toBe(2);
        expect(stats.totalTriggers).toBe(2);
        expect(stats.events.a.count).toBe(2);
    });

    it('forces a guarantee after threshold consecutive misses', () => {
        const session = createWeightedSession({
            entries: [
                { id: 'common', weight: 100 },
                { id: 'rare', weight: 1 },
            ],
        }, new SequenceRandom([0, 0, 0]), {
            pity: { threshold: 3, guarantee: (e) => e.id === 'rare' },
        });
        expect(session.roll()!.id).toBe('common');
        expect(session.roll()!.id).toBe('common');
        expect(session.roll()!.id).toBe('common');
        expect(session.roll()!.id).toBe('rare'); // guaranteed on the 4th roll
    });

    it('keeps totalTriggers independent of bounded history (C2)', () => {
        const session = createWeightedSession({ entries: [{ id: 'a', weight: 1 }] }, new SeededRandom(1), { historyLimit: 3 });
        for (let i = 0; i < 10; i++) session.roll();
        expect(session.getStats().totalTriggers).toBe(10);
        expect(session.getHistory().length).toBe(3); // bounded, not 10
    });

    it('simulate does not pollute the real session (C1)', () => {
        const session = createWeightedSession({ entries: [{ id: 'a', weight: 1 }] }, new SeededRandom(1), { historyLimit: 5 });
        session.roll();
        session.roll();
        const before = session.serialize();
        session.simulate(100);
        expect(session.serialize()).toEqual(before);
    });

    it('serialize/deserialize round-trips', () => {
        const session = createWeightedSession({ entries: [{ id: 'a', weight: 1 }] }, new SeededRandom(1), { historyLimit: 5 });
        session.roll();
        session.roll();
        const snapshot = session.serialize();

        const restored = createWeightedSession({ entries: [{ id: 'a', weight: 1 }] }, new SeededRandom(1), { historyLimit: 5 });
        restored.deserialize(snapshot);
        expect(restored.serialize()).toEqual(snapshot);
    });

    it('resetStats clears runtime state', () => {
        const session = createWeightedSession({ entries: [{ id: 'a', weight: 1 }] }, new SeededRandom(1));
        session.roll();
        session.resetStats();
        expect(session.getStats().totalRolls).toBe(0);
        expect(session.getStats().totalTriggers).toBe(0);
    });

    it('validates pity threshold and history limit', () => {
        expect(() => createWeightedSession({ entries: [{ id: 'a', weight: 1 }] }, new SeededRandom(1), {
            pity: { threshold: 0, guarantee: () => true },
        })).toThrow(/threshold/);
        expect(() => createWeightedSession({ entries: [{ id: 'a', weight: 1 }] }, new SeededRandom(1), {
            historyLimit: -1,
        })).toThrow(/historyLimit/);
    });
});
