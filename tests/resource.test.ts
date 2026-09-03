// tests/resource.test.ts — Resource v3 specification
import { describe, it, expect } from 'vitest';
import { Resource, DerivedResource, ResourceRegistry } from '../src/gamelib/resource';

describe('Resource — value/range', () => {
    it('defaults to value 0, min 0, max 100', () => {
        const res = new Resource();
        expect(res.get()).toBe(0);
        expect(res.min).toBe(0);
        expect(res.max).toBe(100);
    });

    it('respects config values', () => {
        const res = new Resource({ id: 'hp', value: 50, min: 10, max: 200, regenPerSecond: 5, decayPerSecond: 2 });
        expect(res.id).toBe('hp');
        expect(res.get()).toBe(50);
        expect(res.min).toBe(10);
        expect(res.max).toBe(200);
        expect(res.regenPerSecond).toBe(5);
        expect(res.decayPerSecond).toBe(2);
    });

    it('clamps the initial value to the range', () => {
        expect(new Resource({ value: 150, min: 0, max: 100 }).get()).toBe(100);
        expect(new Resource({ value: -50, min: 0, max: 100 }).get()).toBe(0);
    });

    it('set/add/subtract clamp to the range', () => {
        const res = new Resource({ value: 50 });
        res.set(150);
        expect(res.get()).toBe(100);
        res.set(-50);
        expect(res.get()).toBe(0);
        res.add(200);
        expect(res.get()).toBe(100);
        res.subtract(999);
        expect(res.get()).toBe(0);
    });

    it('getPercent normalizes over the range', () => {
        const res = new Resource({ value: 50, min: 0, max: 100 });
        expect(res.getPercent()).toBeCloseTo(0.5, 6);
        res.set(100);
        expect(res.getPercent()).toBeCloseTo(1.0, 6);
    });

    it('setMin/setMax re-clamp and re-validate', () => {
        const res = new Resource({ value: 80, max: 100 });
        res.setMax(50);
        expect(res.get()).toBe(50);
        expect(() => res.setMin(200)).toThrow(/greater than max/);
    });

    it('rejects min > max and non-finite values', () => {
        expect(() => new Resource({ min: 100, max: 50 })).toThrow(/greater than max/);
        expect(() => new Resource({ value: NaN })).toThrow(/finite/);
        expect(() => new Resource({ max: Infinity })).toThrow(/finite/);
    });
});

describe('Resource — modifiers', () => {
    it('addModifier copies input and never mutates the caller object (C3)', () => {
        const res = new Resource({ value: 100 });
        const modifier = { id: 'poison', kind: 'decay' as const, amountPerSecond: 5, durationSeconds: 10 };
        res.addModifier(modifier);
        expect(res.hasModifier('poison')).toBe(true);
        expect(modifier).toEqual({ id: 'poison', kind: 'decay', amountPerSecond: 5, durationSeconds: 10 });
    });

    it('getEffectiveRegen/Decay include modifiers', () => {
        const res = new Resource({ regenPerSecond: 5 });
        res.addModifier({ id: 'buff', kind: 'regen', amountPerSecond: 10 });
        expect(res.getEffectiveRegen()).toBe(15);
        res.addModifier({ id: 'poison', kind: 'decay', amountPerSecond: 3 });
        expect(res.getEffectiveDecay()).toBe(3);
    });

    it('update applies regen/decay and expires timed modifiers', () => {
        const res = new Resource({ value: 50, regenPerSecond: 10 });
        res.update(1);
        expect(res.get()).toBe(60);

        res.addModifier({ id: 'temp', kind: 'regen', amountPerSecond: 5, durationSeconds: 1 });
        res.update(0.5);
        expect(res.hasModifier('temp')).toBe(true);
        res.update(0.6);
        expect(res.hasModifier('temp')).toBe(false);
    });

    it('update rejects negative dtSeconds', () => {
        const res = new Resource();
        expect(() => res.update(-0.1)).toThrow(/dtSeconds/);
    });

    it('rejects invalid modifier inputs', () => {
        const res = new Resource();
        expect(() => res.addModifier({ id: '', kind: 'regen', amountPerSecond: 1 })).toThrow(/id/);
        expect(() => res.addModifier({ id: 'x', kind: 'regen', amountPerSecond: NaN })).toThrow(/amountPerSecond/);
    });
});

describe('Resource — subscriptions', () => {
    it('subscribeChange fires and returns an unsubscribe', () => {
        const res = new Resource({ value: 50 });
        const changes: number[] = [];
        const unsubscribe = res.subscribeChange((_old, next) => changes.push(next));
        res.set(60);
        unsubscribe();
        res.set(40);
        expect(changes).toEqual([60]);
    });

    it('onThreshold fires on below/above/cross and supports unsubscribe', () => {
        const res = new Resource({ value: 50 });
        const events: string[] = [];
        const un1 = res.onThreshold(30, 'below', () => events.push('below'));
        const un2 = res.onThreshold(70, 'above', () => events.push('above'));
        res.set(25);
        res.set(75);
        un1();
        un2();
        res.set(10);
        res.set(90);
        expect(events).toEqual(['below', 'above']);
    });

    it('onThreshold cross fires in both directions', () => {
        const res = new Resource({ value: 50 });
        let count = 0;
        res.onThreshold(30, 'cross', () => count++);
        res.set(25);
        res.set(35);
        expect(count).toBe(2);
    });
});

describe('Resource — snapshot', () => {
    it('serialize/deserialize round-trips value, range, and modifiers', () => {
        const res = new Resource({ id: 'hp', value: 75, min: 0, max: 100, regenPerSecond: 5 });
        res.addModifier({ id: 'buff', kind: 'regen', amountPerSecond: 10, durationSeconds: 3 });
        res.update(1);

        const snapshot = res.serialize();
        expect(snapshot.schemaVersion).toBe(1);

        const restored = Resource.deserialize(snapshot);
        expect(restored.id).toBe('hp');
        expect(restored.get()).toBe(res.get());
        expect(restored.getEffectiveRegen()).toBe(15);
    });
});

describe('DerivedResource', () => {
    it('computes from ValueSource dependencies', () => {
        const volume = new Resource({ id: 'volume', value: 500, max: 1000 });
        const capacity = new Resource({ id: 'capacity', value: 1000, max: 2000 });
        const tension = new DerivedResource({
            id: 'tension',
            dependencies: { volume, capacity },
            formula: (deps) => (deps.volume! / deps.capacity!) * 100,
            min: 0,
            max: 100,
        });
        expect(tension.get()).toBeCloseTo(50, 6);
        volume.set(750);
        expect(tension.get()).toBeCloseTo(75, 6);
    });
});

describe('ResourceRegistry', () => {
    it('registers, looks up, and enumerates resources', () => {
        const registry = new ResourceRegistry();
        const hp = new Resource({ id: 'hp', value: 100 });
        registry.register(hp);
        expect(registry.get('hp')).toBe(hp);
        expect(registry.require('hp')).toBe(hp);
        expect(registry.has('hp')).toBe(true);
        expect([...registry.values()].length).toBe(1);
    });

    it('require throws for an unknown id', () => {
        const registry = new ResourceRegistry();
        expect(() => registry.require('nope')).toThrow(/unknown id/);
    });
});
