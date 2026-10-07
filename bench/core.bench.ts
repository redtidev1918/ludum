// bench/core.bench.ts — lightweight regression benchmarks. Run with: npm run bench
import { test, describe } from 'vitest';
import { World, defineComponent } from '../src/gamelib/ecs';
import { Resource } from '../src/gamelib/resource';
import { createWeightedSession } from '../src/gamelib/weighted/session';
import { SeededRandom } from '../src/gamelib/runtime/random';
import { ProceduralShape } from '../src/gamelib/geometry/procedural-shape';
import { containsPoint, type Shape2D } from '../src/gamelib/geometry/shape';

describe('benchmark', () => {
    const Position = defineComponent({ name: 'Position', defaults: { x: 0, y: 0 } });
    const Velocity = defineComponent({ name: 'Velocity', defaults: { vx: 0, vy: 0 } });

    const world = new World();
    world.addSystem({
        name: 'Move',
        requires: [Position, Velocity],
        run: (e, dt) => {
            const p = e.get(Position)!;
            const v = e.get(Velocity)!;
            p.x += v.vx * dt;
        },
    });
    for (let i = 0; i < 1000; i++) world.createEntity().add(Position).add(Velocity);

    test('ECS update over 1000 entities', async ({ bench }) => {
        await bench('ECS update over 1000 entities', () => world.update(1 / 60)).run();
    });

    const hp = new Resource({ id: 'hp', value: 100, max: 100, regenPerSecond: 2 });
    test('Resource update', async ({ bench }) => {
        await bench('Resource update', () => hp.update(1 / 60)).run();
    });

    const session = createWeightedSession(
        { entries: [{ id: 'a', weight: 1 }, { id: 'b', weight: 2 }, { id: 'c', weight: 3 }] },
        new SeededRandom(42),
    );
    test('Weighted selection', async ({ bench }) => {
        await bench('Weighted selection', () => session.roll()).run();
    });

    const shape = new ProceduralShape({ kind: 'ellipse', baseWidth: 100, baseHeight: 50, sides: 64 });
    test('Procedural shape generation (64 points)', async ({ bench }) => {
        await bench('Procedural shape generation (64 points)', () => shape.generate()).run();
    });

    const circle: Shape2D = { kind: 'circle', center: { x: 0, y: 0 }, radius: 50 };
    test('Hit testing (circle)', async ({ bench }) => {
        await bench('Hit testing (circle)', () => containsPoint(circle, { x: 25, y: 25 })).run();
    });
});
