// tests/integration.test.ts — proves ludum is composable, not isolated silos
import { describe, it, expect } from 'vitest';
import { World, defineComponent } from '../src/gamelib/ecs';
import { Resource, DerivedResource } from '../src/gamelib/resource';
import { StateMachine } from '../src/gamelib/state-machine';
import { ProceduralShape } from '../src/gamelib/geometry/procedural-shape';
import { containsPoint, type Shape2D } from '../src/gamelib/geometry/shape';
import { InteractionRegion } from '../src/gamelib/interaction/region';
import { DialogueSession, selectLine } from '../src/gamelib/dialogue';
import { createWeightedSession } from '../src/gamelib/weighted/session';
import { SeededRandom, SequenceRandom } from '../src/gamelib/runtime/random';
import { Countdown } from '../src/gamelib/runtime/countdown';

describe('integration', () => {
    it('World + Resource (resource value as component data)', () => {
        const Health = defineComponent({ name: 'Health', defaults: { value: 0 } });
        const world = new World();
        const hp = new Resource({ id: 'hp', value: 100, max: 100 });
        const entity = world.createEntity().add(Health, { value: hp.get() });
        hp.subtract(30);
        entity.add(Health, { value: hp.get() });
        expect(entity.get(Health)!.value).toBe(70);
    });

    it('Resource + StateMachine (resource value drives state)', () => {
        const hp = new Resource({ id: 'hp', value: 100, max: 100 });
        const sm = new StateMachine<{ hp: number }>({
            states: ['alive', 'critical'],
            conditions: [{ state: 'critical', when: (c) => c.hp < 25 }],
        });
        sm.updateContext({ hp: hp.get() });
        expect(sm.getState()).toBe('alive');
        hp.set(10);
        sm.updateContext({ hp: hp.get() });
        expect(sm.getState()).toBe('critical');
    });

    it('Resource + ProceduralShape via a ValueSource', () => {
        const hp = new Resource({ id: 'hp', value: 100, max: 100 });
        const shape = new ProceduralShape({ kind: 'ellipse', baseWidth: 100, baseHeight: 50 });
        const scaleSource = { get: () => 1 + hp.get() / 100 };
        expect(shape.getSize({ scale: scaleSource.get() })[0]).toBeCloseTo(200, 5);
        hp.set(50);
        expect(shape.getSize({ scale: scaleSource.get() })[0]).toBeCloseTo(150, 5);
    });

    it('DerivedResource composes other Resources', () => {
        const volume = new Resource({ id: 'volume', value: 500, max: 1000 });
        const capacity = new Resource({ id: 'capacity', value: 1000, max: 2000 });
        const tension = new DerivedResource({
            dependencies: { volume, capacity },
            formula: (deps) => (deps.volume / deps.capacity) * 100,
            min: 0,
            max: 100,
        });
        expect(tension.get()).toBeCloseTo(50, 6);
        volume.set(750);
        expect(tension.get()).toBeCloseTo(75, 6);
    });

    it('Dialogue + Predicate (conditional line selection)', () => {
        const line = selectLine(
            [
                { id: 'warn', text: 'low', condition: (c) => c.hp < 20 },
                { id: 'ok', text: 'fine', condition: (c) => c.hp >= 20 },
            ],
            { hp: 10 },
            new SequenceRandom([0]),
        );
        expect(line!.id).toBe('warn');
    });

    it('Weighted + SeededRandom (deterministic across sessions)', () => {
        const a = createWeightedSession({ entries: [{ id: 'x', weight: 1 }] }, new SeededRandom(42));
        const b = createWeightedSession({ entries: [{ id: 'x', weight: 1 }] }, new SeededRandom(42));
        expect(a.roll()!.id).toBe(b.roll()!.id);
    });

    it('Interaction + Shape2D (hit-test through the region)', () => {
        const shape: Shape2D = { kind: 'circle', center: { x: 0, y: 0 }, radius: 10 };
        expect(containsPoint(shape, { x: 5, y: 5 })).toBe(true);
        const region = new InteractionRegion(shape);
        expect(region.contains({ x: 5, y: 5 })).toBe(true);
        expect(region.contains({ x: 20, y: 20 })).toBe(false);
    });

    it('serialization roundtrip across subsystems', () => {
        const hp = new Resource({ id: 'hp', value: 75, max: 100 });
        hp.addModifier({ id: 'buff', kind: 'regen', amountPerSecond: 5 });
        const restored = Resource.deserialize(hp.serialize());
        expect(restored.get()).toBe(75);
        expect(restored.getEffectiveRegen()).toBe(5);

        const session = createWeightedSession({ entries: [{ id: 'a', weight: 1 }] }, new SeededRandom(1));
        session.roll();
        const clone = createWeightedSession({ entries: [{ id: 'a', weight: 1 }] }, new SeededRandom(1));
        clone.deserialize(session.serialize());
        expect(clone.getStats().totalRolls).toBe(1);
    });

    it('Countdown drives a timed Resource effect', () => {
        const hp = new Resource({ id: 'hp', value: 50, max: 100 });
        const timer = new Countdown(1);
        expect(timer.advance(1)).toBe(true);
        if (timer.finished) hp.add(10);
        expect(hp.get()).toBe(60);
    });

    it('DialogueSession advances a StateMachine via an action', () => {
        const sm = new StateMachine({ states: ['idle', 'busy'] });
        const session = new DialogueSession(
            {
                startNodeId: 'start',
                nodes: {
                    start: { text: 'go', action: () => sm.setState('busy') },
                },
            },
            {},
        );
        session.continue();
        expect(sm.getState()).toBe('busy');
    });
});
