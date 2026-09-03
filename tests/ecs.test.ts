// tests/ecs.test.ts — ECS v3 (instance-based World) specification
import { describe, it, expect } from 'vitest';
import { defineComponent, World, type WorldSnapshot } from '../src/gamelib/ecs';

describe('defineComponent', () => {
    it('returns a typed component handle', () => {
        const Position = defineComponent({ name: 'Position', defaults: { x: 0, y: 0 } });
        expect(Position.name).toBe('Position');
        expect(Position.defaults).toEqual({ x: 0, y: 0 });
    });

    it('rejects an empty name', () => {
        expect(() => defineComponent({ name: '', defaults: {} })).toThrow(/non-empty/);
    });
});

describe('World — entities', () => {
    it('assigns sequential, unique ids', () => {
        const world = new World();
        const a = world.createEntity();
        const b = world.createEntity();
        expect(a.id).toBe(1);
        expect(b.id).toBe(2);
    });

    it('isolates entities across worlds', () => {
        const w1 = new World();
        const w2 = new World();
        w1.createEntity();
        w1.createEntity();
        expect(w1.query().length).toBe(2);
        expect(w2.query().length).toBe(0);
    });

    it('getEntity returns a handle for a live entity and undefined otherwise', () => {
        const world = new World();
        const e = world.createEntity();
        expect(world.getEntity(e.id)!.id).toBe(e.id);
        expect(world.getEntity(999)).toBeUndefined();
    });

    it('destroy is idempotent and removes the entity', () => {
        const world = new World();
        const e = world.createEntity();
        e.destroy();
        e.destroy();
        expect(e.isAlive()).toBe(false);
        expect(world.query().length).toBe(0);
    });
});

describe('World — typed components', () => {
    const Position = defineComponent({ name: 'Position', defaults: { x: 0, y: 0 } });

    it('adds a component using its defaults', () => {
        const world = new World();
        const e = world.createEntity().add(Position);
        expect(e.get(Position)).toEqual({ x: 0, y: 0 });
    });

    it('merges partial data over defaults', () => {
        const world = new World();
        const e = world.createEntity().add(Position, { x: 10 });
        expect(e.get(Position)).toEqual({ x: 10, y: 0 });
    });

    it('get returns undefined for an absent component', () => {
        const world = new World();
        const e = world.createEntity();
        expect(e.get(Position)).toBeUndefined();
        expect(e.has(Position)).toBe(false);
    });

    it('remove deletes a component', () => {
        const world = new World();
        const e = world.createEntity().add(Position);
        e.remove(Position);
        expect(e.has(Position)).toBe(false);
        expect(e.get(Position)).toBeUndefined();
    });

    it('add does not mutate the shared defaults object', () => {
        const world = new World();
        const a = world.createEntity().add(Position, { x: 5 });
        const b = world.createEntity().add(Position);
        expect(a.get(Position)).toEqual({ x: 5, y: 0 });
        expect(b.get(Position)).toEqual({ x: 0, y: 0 });
    });
});

describe('World — tags', () => {
    it('tag/untag/hasTag work', () => {
        const world = new World();
        const e = world.createEntity().tag('player');
        expect(e.hasTag('player')).toBe(true);
        e.untag('player');
        expect(e.hasTag('player')).toBe(false);
    });

    it('queryByTag returns matching entities', () => {
        const world = new World();
        world.createEntity().tag('enemy');
        world.createEntity().tag('enemy');
        world.createEntity().tag('player');
        expect(world.queryByTag('enemy').length).toBe(2);
        expect(world.queryByTag('player').length).toBe(1);
    });
});

describe('World — queries', () => {
    const A = defineComponent({ name: 'A', defaults: {} });
    const B = defineComponent({ name: 'B', defaults: {} });

    it('query returns entities with all given components', () => {
        const world = new World();
        world.createEntity().add(A).add(B);
        world.createEntity().add(A);
        world.createEntity().add(B);
        expect(world.query(A, B).length).toBe(1);
        expect(world.query(A).length).toBe(2);
        expect(world.query(B).length).toBe(2);
    });

    it('query with no arguments returns all alive entities', () => {
        const world = new World();
        world.createEntity();
        const dead = world.createEntity();
        dead.destroy();
        expect(world.query().length).toBe(1);
    });

    it('does not return destroyed entities from queries', () => {
        const world = new World();
        world.createEntity().add(A);
        const e = world.createEntity().add(A);
        e.destroy();
        expect(world.query(A).length).toBe(1);
    });

    it('count returns the number of matching entities', () => {
        const world = new World();
        world.createEntity().add(A);
        world.createEntity().add(A);
        world.createEntity();
        expect(world.count(A)).toBe(2);
    });
});

describe('World — systems', () => {
    const Counter = defineComponent({ name: 'Counter', defaults: { value: 0 } });

    it('runs a system against matching entities only', () => {
        const world = new World();
        const e = world.createEntity().add(Counter);
        world.createEntity(); // no Counter
        world.addSystem({
            name: 'Increment',
            requires: [Counter],
            run: (entity) => {
                entity.get(Counter)!.value += 1;
            },
        });
        world.update(0.1);
        expect(e.get(Counter)!.value).toBe(1);
    });

    it('runs phases in order preUpdate → update → postUpdate', () => {
        const world = new World();
        world.createEntity();
        const order: string[] = [];
        world.addSystem({ name: 'u', requires: [], phase: 'update', run: () => order.push('update') });
        world.addSystem({ name: 'pre', requires: [], phase: 'preUpdate', run: () => order.push('pre') });
        world.addSystem({ name: 'post', requires: [], phase: 'postUpdate', run: () => order.push('post') });
        world.update(0.1);
        expect(order).toEqual(['pre', 'update', 'post']);
    });

    it('runs higher order first within a phase', () => {
        const world = new World();
        world.createEntity();
        const order: string[] = [];
        world.addSystem({ name: 'low', requires: [], order: 0, run: () => order.push('low') });
        world.addSystem({ name: 'high', requires: [], order: 10, run: () => order.push('high') });
        world.update(0.1);
        expect(order).toEqual(['high', 'low']);
    });
});

describe('World — structural mutation policy', () => {
    const Position = defineComponent({ name: 'Position', defaults: { x: 0, y: 0 } });

    it('applies mutations immediately outside update()', () => {
        const world = new World();
        const e = world.createEntity();
        e.add(Position);
        expect(world.count(Position)).toBe(1);
    });

    it('defers component removal until the end of the tick', () => {
        const world = new World();
        const e = world.createEntity().add(Position);
        let pre = 0;
        let post = 0;
        world.addSystem({ name: 'Remove', requires: [], phase: 'preUpdate', run: () => {
            e.remove(Position);
            pre = world.count(Position);
        } });
        world.addSystem({ name: 'Observe', requires: [], phase: 'postUpdate', run: () => {
            post = world.count(Position);
        } });
        world.update(0.1);
        // Removal is deferred, so the component stays visible for the whole tick…
        expect(pre).toBe(1);
        expect(post).toBe(1);
        // …and applies at the end.
        expect(e.has(Position)).toBe(false);
    });

    it('defers entity destruction until the end of the tick', () => {
        const world = new World();
        const e = world.createEntity();
        let stillAlive = false;
        world.addSystem({ name: 'Kill', requires: [], run: () => {
            e.destroy();
            stillAlive = e.isAlive();
        } });
        world.update(0.1);
        expect(stillAlive).toBe(true);
        expect(e.isAlive()).toBe(false);
    });

    it('defers entity creation until the end of the tick', () => {
        const world = new World();
        const Driver = defineComponent({ name: 'Driver', defaults: {} });
        world.createEntity().add(Driver);
        let seenDuringTick = 0;
        world.addSystem({ name: 'Spawn', requires: [Driver], order: 10, run: () => { world.createEntity(); } });
        world.addSystem({ name: 'Count', requires: [Driver], order: 0, run: () => { seenDuringTick = world.query().length; } });
        world.update(0.1);
        // The spawned entity is not visible until the tick ends…
        expect(seenDuringTick).toBe(1);
        // …then it appears.
        expect(world.query().length).toBe(2);
    });

    it('create-then-destroy within one tick leaves no entity behind', () => {
        const world = new World();
        const Driver = defineComponent({ name: 'Driver', defaults: {} });
        world.createEntity().add(Driver);
        let spawnedId = 0;
        world.addSystem({ name: 'SpawnAndKill', requires: [Driver], run: () => {
            const e = world.createEntity();
            spawnedId = e.id;
            e.destroy();
        } });
        world.update(0.1);
        expect(world.getEntity(spawnedId)).toBeUndefined();
        expect(world.query().length).toBe(1); // only the Driver remains
    });
});

describe('World — validation', () => {
    it('throws on negative dtSeconds', () => {
        const world = new World();
        expect(() => world.update(-0.1)).toThrow(/dtSeconds/);
    });

    it('throws on non-finite dtSeconds', () => {
        const world = new World();
        expect(() => world.update(NaN)).toThrow(/dtSeconds/);
    });

    it('throws on duplicate component name', () => {
        const A = defineComponent({ name: 'Same', defaults: {} });
        const B = defineComponent({ name: 'Same', defaults: {} });
        const world = new World();
        const e = world.createEntity().add(A);
        expect(() => e.add(B)).toThrow(/duplicate component name/);
    });

    it('throws on duplicate system name', () => {
        const world = new World();
        world.addSystem({ name: 'S', requires: [], run: () => {} });
        expect(() => world.addSystem({ name: 'S', requires: [], run: () => {} })).toThrow(/duplicate system name/);
    });

    it('throws on a system without a run function', () => {
        const world = new World();
        expect(() => world.addSystem({ name: 'S', requires: [], run: undefined as unknown as () => void }))
            .toThrow(/run function/);
    });
});

describe('World — snapshot', () => {
    const Position = defineComponent({ name: 'Position', defaults: { x: 0, y: 0 } });
    const Velocity = defineComponent({ name: 'Velocity', defaults: { vx: 0, vy: 0 } });

    it('serialize/deserialize round-trips entities, components and tags', () => {
        const world = new World();
        world.createEntity().add(Position, { x: 10, y: 20 }).add(Velocity).tag('player');
        world.createEntity().add(Position, { x: 30, y: 40 });

        const snapshot = world.serialize();
        expect(snapshot.schemaVersion).toBe(1);
        expect(snapshot.entities.length).toBe(2);

        const restored = new World();
        restored.deserialize(snapshot, [Position, Velocity]);

        expect(restored.query(Position).length).toBe(2);
        const player = restored.queryByTag('player')[0];
        expect(player.get(Position)).toEqual({ x: 10, y: 20 });
        expect(player.get(Velocity)).toEqual({ vx: 0, vy: 0 });
    });

    it('continues id generation after deserialize', () => {
        const world = new World();
        world.createEntity();
        world.createEntity();
        const snapshot = world.serialize();

        const restored = new World();
        restored.deserialize(snapshot, []);
        expect(restored.createEntity().id).toBe(3);
    });

    it('is plain JSON data', () => {
        const world = new World();
        world.createEntity().add(Position, { x: 1, y: 2 }).tag('a');
        const snapshot = world.serialize();
        expect(() => JSON.stringify(snapshot)).not.toThrow();
        const reparsed = JSON.parse(JSON.stringify(snapshot)) as WorldSnapshot;
        expect(reparsed.entities[0].components.Position).toEqual({ x: 1, y: 2 });
    });

    it('rejects an unsupported schemaVersion', () => {
        const world = new World();
        const snapshot = { schemaVersion: 2, nextEntityId: 1, entities: [] } as unknown as WorldSnapshot;
        expect(() => world.deserialize(snapshot, [])).toThrow(/schemaVersion/);
    });

    it('rejects an unknown component name', () => {
        const world = new World();
        const snapshot: WorldSnapshot = {
            schemaVersion: 1,
            nextEntityId: 1,
            entities: [{ id: 1, components: { Nope: { x: 1 } }, tags: [] }],
        };
        expect(() => world.deserialize(snapshot, [])).toThrow(/unknown component/);
    });
});
