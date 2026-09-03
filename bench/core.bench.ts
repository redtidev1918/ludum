// bench/core.bench.ts — lightweight regression benchmarks. Run with: npm run bench
import { bench, describe } from 'vitest';
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

    bench('ECS update over 1000 entities', () => {
        world.update(1 / 60);
    });

    const hp = new Resource({ id: 'hp', value: 100, max: 100, regenPerSecond: 2 });
    bench('Resource update', () => {
        hp.update(1 / 60);
    });

    const session = createWeightedSession(
        { entries: [{ id: 'a', weight: 1 }, { id: 'b', weight: 2 }, { id: 'c', weight: 3 }] },
        new SeededRandom(42),
    );
    bench('Weighted selection', () => {
        session.roll();
    });

    const shape = new ProceduralShape({ kind: 'ellipse', baseWidth: 100, baseHeight: 50, sides: 64 });
    bench('Procedural shape generation (64 points)', () => {
        shape.generate();
    });

    const circle: Shape2D = { kind: 'circle', center: { x: 0, y: 0 }, radius: 50 };
    bench('Hit testing (circle)', () => {
        containsPoint(circle, { x: 25, y: 25 });
    });
});
