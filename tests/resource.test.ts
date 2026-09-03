// tests/resource.test.ts
// Resource System 单元测试

import { describe, it, expect } from 'vitest';
import { Resource, DerivedResource, ResourceManager } from '../src/gamelib/resource';

describe('Resource', () => {
    // ------------------------------------------------------------------
    // Basic Resource Tests
    // ------------------------------------------------------------------

    it('Resource.new creates resource with defaults', () => {
        const res = new Resource({ id: 'test' });
        expect(res.id).toBe('test');
        expect(res.value).toBe(0);
        expect(res.min).toBe(0);
        expect(res.max).toBe(100);
    });

    it('Resource.new respects config values', () => {
        const res = new Resource({
            id: 'hp',
            value: 50,
            min: 10,
            max: 200,
            regen: 5,
            decay: 2,
        });
        expect(res.id).toBe('hp');
        expect(res.value).toBe(50);
        expect(res.min).toBe(10);
        expect(res.max).toBe(200);
        expect(res.baseRegen).toBe(5);
        expect(res.baseDecay).toBe(2);
    });

    it('Resource:get returns current value', () => {
        const res = new Resource({ value: 75 });
        expect(res.get()).toBe(75);
    });

    it('Resource:getPercent returns correct percentage', () => {
        const res = new Resource({ value: 50, min: 0, max: 100 });
        expect(res.getPercent()).toBeCloseTo(0.5, 6);

        res.set(25);
        expect(res.getPercent()).toBeCloseTo(0.25, 6);

        res.set(100);
        expect(res.getPercent()).toBeCloseTo(1.0, 6);
    });

    it('Resource:set clamps value to min/max', () => {
        const res = new Resource({ value: 50, min: 0, max: 100 });

        res.set(150);
        expect(res.get()).toBe(100);

        res.set(-50);
        expect(res.get()).toBe(0);
    });

    it('Resource:add increases value', () => {
        const res = new Resource({ value: 50 });
        res.add(20);
        expect(res.get()).toBe(70);
    });

    it('Resource:subtract decreases value', () => {
        const res = new Resource({ value: 50 });
        res.subtract(20);
        expect(res.get()).toBe(30);
    });

    it('Resource:setMax updates max and clamps value', () => {
        const res = new Resource({ value: 80, max: 100 });
        res.setMax(50);
        expect(res.max).toBe(50);
        expect(res.get()).toBe(50);
    });

    it('Resource:setMin updates min and clamps value', () => {
        const res = new Resource({ value: 20, min: 0 });
        res.setMin(30);
        expect(res.min).toBe(30);
        expect(res.get()).toBe(30);
    });

    // ------------------------------------------------------------------
    // Modifier Tests
    // ------------------------------------------------------------------

    it('Resource:addModifier adds modifier', () => {
        const res = new Resource({ value: 50 });
        res.addModifier({ id: 'buff', type: 'regen', value: 10 });
        expect(res.hasModifier('buff')).toBe(true);
    });

    it('Resource:removeModifier removes modifier', () => {
        const res = new Resource({ value: 50 });
        res.addModifier({ id: 'buff', type: 'regen', value: 10 });
        res.removeModifier('buff');
        expect(res.hasModifier('buff')).toBe(false);
    });

    it('Resource:getEffectiveRegen includes modifiers', () => {
        const res = new Resource({ value: 50, regen: 5 });
        res.addModifier({ id: 'buff1', type: 'regen', value: 10 });
        res.addModifier({ id: 'buff2', type: 'regen', value: 3 });
        expect(res.getEffectiveRegen()).toBe(18);
    });

    it('Resource:getEffectiveDecay includes modifiers', () => {
        const res = new Resource({ value: 50, decay: 2 });
        res.addModifier({ id: 'poison', type: 'decay', value: 5 });
        expect(res.getEffectiveDecay()).toBe(7);
    });

    it('Resource:update applies regen/decay', () => {
        let res = new Resource({ value: 50, regen: 10, decay: 0 });
        res.update(1.0); // 1 second
        expect(res.get()).toBe(60);

        res = new Resource({ value: 50, regen: 0, decay: 10 });
        res.update(1.0);
        expect(res.get()).toBe(40);
    });

    it('Resource:update removes expired modifiers', () => {
        const res = new Resource({ value: 50 });
        res.addModifier({ id: 'temp', type: 'regen', value: 10, duration: 1.0 });
        expect(res.hasModifier('temp')).toBe(true);

        res.update(0.5);
        expect(res.hasModifier('temp')).toBe(true);

        res.update(0.6);
        expect(res.hasModifier('temp')).toBe(false);
    });

    // ------------------------------------------------------------------
    // Threshold Tests
    // ------------------------------------------------------------------

    it("Resource:onThreshold triggers on 'below'", () => {
        const res = new Resource({ value: 50 });
        let triggered = false;
        res.onThreshold(30, 'below', () => { triggered = true; });

        res.set(40);
        expect(triggered).toBe(false);

        res.set(25);
        expect(triggered).toBe(true);
    });

    it("Resource:onThreshold triggers on 'above'", () => {
        const res = new Resource({ value: 50 });
        let triggered = false;
        res.onThreshold(70, 'above', () => { triggered = true; });

        res.set(60);
        expect(triggered).toBe(false);

        res.set(75);
        expect(triggered).toBe(true);
    });

    it("Resource:onThreshold triggers on 'equal'", () => {
        const res = new Resource({ value: 50 });
        let triggered = false;
        res.onThreshold(0, 'equal', () => { triggered = true; });

        res.set(10);
        expect(triggered).toBe(false);

        res.set(0);
        expect(triggered).toBe(true);
    });

    it("Resource:onThreshold triggers on 'cross'", () => {
        const res = new Resource({ value: 50 });
        let triggerCount = 0;
        res.onThreshold(30, 'cross', () => { triggerCount = triggerCount + 1; });

        res.set(25); // cross below
        expect(triggerCount).toBe(1);

        res.set(35); // cross above
        expect(triggerCount).toBe(2);
    });

    // ------------------------------------------------------------------
    // Listener Tests
    // ------------------------------------------------------------------

    it('Resource:onChange fires on value change', () => {
        const res = new Resource({ value: 50 });
        const changes: { old: number; new: number }[] = [];
        res.onChange((old, newVal) => {
            changes.push({ old, new: newVal });
        });

        res.set(60);
        res.set(40);

        expect(changes.length).toBe(2);
        expect(changes[0].old).toBe(50);
        expect(changes[0].new).toBe(60);
        expect(changes[1].old).toBe(60);
        expect(changes[1].new).toBe(40);
    });

    it('Resource:onMin fires when reaching minimum', () => {
        const res = new Resource({ value: 50, min: 0 });
        let triggered = false;
        res.onMin(() => { triggered = true; });

        res.set(10);
        expect(triggered).toBe(false);

        res.set(0);
        expect(triggered).toBe(true);
    });

    it('Resource:onMax fires when reaching maximum', () => {
        const res = new Resource({ value: 50, max: 100 });
        let triggered = false;
        res.onMax(() => { triggered = true; });

        res.set(90);
        expect(triggered).toBe(false);

        res.set(100);
        expect(triggered).toBe(true);
    });

    // ------------------------------------------------------------------
    // Serialization Tests
    // ------------------------------------------------------------------

    it('Resource:serialize returns correct data', () => {
        const res = new Resource({
            id: 'hp',
            value: 75,
            min: 0,
            max: 100,
            regen: 5,
            decay: 2,
        });
        res.addModifier({ id: 'buff', type: 'regen', value: 10 });

        const data = res.serialize();
        expect(data.id).toBe('hp');
        expect(data.value).toBe(75);
        expect(data.min).toBe(0);
        expect(data.max).toBe(100);
        expect(data.baseRegen).toBe(5);
        expect(data.baseDecay).toBe(2);
        expect(data.modifiers['buff']).toBeDefined();
    });

    it('Resource.deserialize restores resource', () => {
        const data = {
            id: 'hp',
            value: 75,
            min: 0,
            max: 100,
            baseRegen: 5,
            baseDecay: 2,
            modifiers: {},
        };

        const res = Resource.deserialize(data);
        expect(res.id).toBe('hp');
        expect(res.get()).toBe(75);
        expect(res.min).toBe(0);
        expect(res.max).toBe(100);
    });

    // ------------------------------------------------------------------
    // DerivedResource Tests
    // ------------------------------------------------------------------

    it('DerivedResource computes value from dependencies', () => {
        const volume = new Resource({ id: 'volume', value: 500, max: 1000 });
        const capacity = new Resource({ id: 'capacity', value: 1000, max: 2000 });

        const tension = new DerivedResource({
            id: 'tension',
            dependencies: { volume: volume, capacity: capacity },
            formula: (deps) => (deps.volume / deps.capacity) * 100,
            min: 0,
            max: 100,
        });

        expect(tension.get()).toBeCloseTo(50, 6);

        volume.set(750);
        expect(tension.get()).toBeCloseTo(75, 6);
    });

    it('DerivedResource:getPercent works correctly', () => {
        const a = new Resource({ id: 'a', value: 50, max: 100 });

        const derived = new DerivedResource({
            id: 'derived',
            dependencies: { a: a },
            formula: (deps) => deps.a * 2,
            min: 0,
            max: 200,
        });

        expect(derived.getPercent()).toBeCloseTo(0.5, 6);
    });

    it('DerivedResource:onChange fires on computed value change', () => {
        const a = new Resource({ id: 'a', value: 50, max: 100 });
        const changes: { old: number; new: number }[] = [];

        const derived = new DerivedResource({
            id: 'derived',
            dependencies: { a: a },
            formula: (deps) => deps.a,
        });

        derived.onChange((old, newVal) => {
            changes.push({ old, new: newVal });
        });

        derived.get(); // initial: cachedValue goes from 0 to 50
        a.set(60);
        derived.get(); // should trigger change: 50 to 60

        // First change: 0 -> 50 (initial), Second change: 50 -> 60
        expect(changes.length).toBe(2);
        expect(changes[0].old).toBe(0);
        expect(changes[0].new).toBe(50);
        expect(changes[1].old).toBe(50);
        expect(changes[1].new).toBe(60);
    });

    // ------------------------------------------------------------------
    // ResourceManager Tests
    // ------------------------------------------------------------------

    it('ResourceManager:register and get work', () => {
        const manager = new ResourceManager();
        const hp = new Resource({ id: 'hp', value: 100 });
        const mp = new Resource({ id: 'mp', value: 50 });

        manager.register(hp).register(mp);

        expect(manager.get('hp')).toBe(hp);
        expect(manager.get('mp')).toBe(mp);
        expect(manager.get('nonexistent')).toBeUndefined();
    });

    it('ResourceManager:update updates all resources', () => {
        const manager = new ResourceManager();
        const hp = new Resource({ id: 'hp', value: 50, regen: 10 });
        const mp = new Resource({ id: 'mp', value: 50, decay: 5 });

        manager.register(hp).register(mp);
        manager.update(1.0);

        expect(hp.get()).toBe(60);
        expect(mp.get()).toBe(45);
    });

    it('ResourceManager serialization round-trip', () => {
        const manager = new ResourceManager();
        const hp = new Resource({ id: 'hp', value: 75, max: 100 });
        manager.register(hp);

        const data = manager.serialize();

        // Create new manager and restore
        const manager2 = new ResourceManager();
        const hp2 = new Resource({ id: 'hp', value: 0, max: 100 });
        manager2.register(hp2);
        manager2.deserialize(data);

        expect((manager2.get('hp') as Resource).get()).toBe(75);
    });

    // ------------------------------------------------------------------
    // Reset Test
    // ------------------------------------------------------------------

    it('Resource:reset clears modifiers and resets value', () => {
        const res = new Resource({ id: 'hp', value: 50, max: 100 });
        res.addModifier({ id: 'buff', type: 'regen', value: 10 });
        res.set(30);

        res.reset();

        expect(res.get()).toBe(100);
        expect(res.hasModifier('buff')).toBe(false);

        res.reset(50);
        expect(res.get()).toBe(50);
    });
});
