// tests/runtime.test.ts — runtime capability primitives specification
import { describe, it, expect } from 'vitest';
import { SystemClock, ManualClock } from '../src/gamelib/runtime/clock';
import { Countdown } from '../src/gamelib/runtime/countdown';
import { SystemRandom, SeededRandom, SequenceRandom } from '../src/gamelib/runtime/random';
import { SequentialIdGenerator } from '../src/gamelib/runtime/id-generator';
import type { ValueSource } from '../src/gamelib/runtime/value-source';
import type { Predicate } from '../src/gamelib/predicate';
import { Signal } from '../src/gamelib/signal';

describe('Clock', () => {
    it('ManualClock starts at a given time and advances', () => {
        const clock = new ManualClock(1000);
        expect(clock.nowMs()).toBe(1000);
        clock.advanceMs(500);
        expect(clock.nowMs()).toBe(1500);
    });

    it('ManualClock rejects negative or non-finite advances', () => {
        const clock = new ManualClock();
        expect(() => clock.advanceMs(-1)).toThrow(/deltaMs/);
        expect(() => clock.advanceMs(NaN)).toThrow(/deltaMs/);
    });

    it('SystemClock reports a finite positive time', () => {
        const clock = new SystemClock();
        const t = clock.nowMs();
        expect(Number.isFinite(t)).toBe(true);
        expect(t).toBeGreaterThan(0);
    });
});

describe('RandomSource', () => {
    it('SystemRandom returns values in [0, 1)', () => {
        const r = new SystemRandom();
        for (let i = 0; i < 1000; i++) {
            const v = r.next();
            expect(v).toBeGreaterThanOrEqual(0);
            expect(v).toBeLessThan(1);
        }
    });

    it('SeededRandom is deterministic for a given seed', () => {
        const a = new SeededRandom(42);
        const b = new SeededRandom(42);
        expect([a.next(), a.next(), a.next()]).toEqual([b.next(), b.next(), b.next()]);
    });

    it('SeededRandom values are in [0, 1)', () => {
        const r = new SeededRandom(1);
        for (let i = 0; i < 1000; i++) {
            const v = r.next();
            expect(v).toBeGreaterThanOrEqual(0);
            expect(v).toBeLessThan(1);
        }
    });

    it('different seeds produce different sequences', () => {
        const a = new SeededRandom(1);
        const b = new SeededRandom(2);
        expect([a.next(), a.next()]).not.toEqual([b.next(), b.next()]);
    });

    it('SequenceRandom returns values in order', () => {
        const r = new SequenceRandom([0.1, 0.9, 0.3]);
        expect(r.next()).toBe(0.1);
        expect(r.next()).toBe(0.9);
        expect(r.next()).toBe(0.3);
    });

    it('SequenceRandom repeats the last value when exhausted', () => {
        const r = new SequenceRandom([0.5]);
        expect(r.next()).toBe(0.5);
        expect(r.next()).toBe(0.5);
    });

    it('SequenceRandom rejects an empty sequence', () => {
        expect(() => new SequenceRandom([])).toThrow(/empty/);
    });
});

describe('IdGenerator', () => {
    it('SequentialIdGenerator yields increasing ids', () => {
        const g = new SequentialIdGenerator();
        expect(g.next()).toBe('1');
        expect(g.next()).toBe('2');
        expect(g.next()).toBe('3');
    });

    it('SequentialIdGenerator supports a prefix', () => {
        const g = new SequentialIdGenerator('e_');
        expect(g.next()).toBe('e_1');
        expect(g.next()).toBe('e_2');
    });
});

describe('ValueSource / Predicate', () => {
    it('ValueSource is a read-only value capability', () => {
        const source: ValueSource<number> = { get: () => 42 };
        expect(source.get()).toBe(42);
    });

    it('Predicate evaluates against a read-only context', () => {
        const lowHp: Predicate<{ hp: number }> = (ctx) => ctx.hp < 20;
        expect(lowHp({ hp: 15 })).toBe(true);
        expect(lowHp({ hp: 50 })).toBe(false);
    });
});

describe('Signal', () => {
    it('delivers events to subscribers and supports unsubscribe', () => {
        const s = new Signal<number>();
        const seen: number[] = [];
        const unsubscribe = s.subscribe((v) => seen.push(v));
        s.emit(1);
        unsubscribe();
        s.emit(2);
        expect(seen).toEqual([1]);
    });

    it('clear removes all listeners', () => {
        const s = new Signal<number>();
        let count = 0;
        s.subscribe(() => count++);
        s.clear();
        s.emit(1);
        expect(count).toBe(0);
    });

    it('size reports the listener count', () => {
        const s = new Signal<void>();
        const a = s.subscribe(() => {});
        const b = s.subscribe(() => {});
        expect(s.size).toBe(2);
        a();
        b();
        expect(s.size).toBe(0);
    });

    it('listener errors propagate', () => {
        const s = new Signal<void>();
        s.subscribe(() => { throw new Error('boom'); });
        expect(() => s.emit(undefined)).toThrow(/boom/);
    });

    it('a listener can unsubscribe itself during emit', () => {
        const s = new Signal<number>();
        const seen: number[] = [];
        let unsubscribeA: () => void;
        unsubscribeA = s.subscribe(() => { seen.push(1); unsubscribeA(); });
        s.subscribe(() => seen.push(2));
        s.emit(0);
        s.emit(0);
        // First emit: snapshot has [A, B] → both run. Second emit: A is gone.
        expect(seen).toEqual([1, 2, 2]);
    });
});

describe('StatefulRandomSource', () => {
    it('SeededRandom can snapshot and restore its state', () => {
        const a = new SeededRandom(7);
        a.next();
        a.next();
        a.next();
        const snapshot = a.snapshot();
        const expected = [a.next(), a.next()];

        const b = new SeededRandom(0);
        b.restore(snapshot);
        expect([b.next(), b.next()]).toEqual(expected);
    });
});

describe('Countdown', () => {
    it('counts down and reports remaining/finished', () => {
        const c = new Countdown(1.0);
        expect(c.remainingSeconds).toBe(1.0);
        expect(c.finished).toBe(false);
        expect(c.advance(0.4)).toBe(false);
        expect(c.remainingSeconds).toBeCloseTo(0.6, 10);
        expect(c.advance(0.6)).toBe(true); // transition to finished
        expect(c.finished).toBe(true);
    });

    it('does not re-fire once finished', () => {
        const c = new Countdown(0.5);
        c.advance(0.5);
        expect(c.finished).toBe(true);
        expect(c.advance(0.1)).toBe(false);
    });

    it('reset restarts the countdown', () => {
        const c = new Countdown(1.0);
        c.advance(1.0);
        expect(c.finished).toBe(true);
        c.reset(2.0);
        expect(c.finished).toBe(false);
        expect(c.remainingSeconds).toBe(2.0);
    });

    it('rejects invalid durations and advances', () => {
        expect(() => new Countdown(-1)).toThrow(/durationSeconds/);
        expect(() => new Countdown(NaN)).toThrow(/durationSeconds/);
        const c = new Countdown(1);
        expect(() => c.advance(-0.1)).toThrow(/dtSeconds/);
    });
});
