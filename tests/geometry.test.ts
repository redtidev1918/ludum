// tests/geometry.test.ts — Shape2D / containsPoint / Spring2D / ProceduralShape
import { describe, it, expect } from 'vitest';
import { containsPoint, type Shape2D } from '../src/gamelib/geometry/shape';
import { Spring2D } from '../src/gamelib/geometry/spring';
import { ProceduralShape } from '../src/gamelib/geometry/procedural-shape';

describe('containsPoint', () => {
    it('rect: inside, edge, outside', () => {
        const rect: Shape2D = { kind: 'rect', x: 0, y: 0, width: 100, height: 100 };
        expect(containsPoint(rect, { x: 50, y: 50 })).toBe(true);
        expect(containsPoint(rect, { x: 0, y: 0 })).toBe(true);
        expect(containsPoint(rect, { x: 100, y: 100 })).toBe(true);
        expect(containsPoint(rect, { x: 101, y: 50 })).toBe(false);
    });

    it('circle: inside, edge, outside', () => {
        const circle: Shape2D = { kind: 'circle', center: { x: 50, y: 50 }, radius: 30 };
        expect(containsPoint(circle, { x: 50, y: 50 })).toBe(true);
        expect(containsPoint(circle, { x: 50, y: 80 })).toBe(true);
        expect(containsPoint(circle, { x: 0, y: 0 })).toBe(false);
    });

    it('ellipse: respects radii', () => {
        const ellipse: Shape2D = { kind: 'ellipse', center: { x: 50, y: 50 }, radiusX: 40, radiusY: 20 };
        expect(containsPoint(ellipse, { x: 90, y: 50 })).toBe(true);
        expect(containsPoint(ellipse, { x: 95, y: 50 })).toBe(false);
    });

    it('polygon: ray casting', () => {
        const polygon: Shape2D = { kind: 'polygon', points: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }] };
        expect(containsPoint(polygon, { x: 50, y: 50 })).toBe(true);
        expect(containsPoint(polygon, { x: 150, y: 50 })).toBe(false);
    });
});

describe('Spring2D', () => {
    it('applyImpulse + update changes displacement', () => {
        const spring = new Spring2D(100, 10);
        spring.applyImpulse(50, 0);
        spring.update(0.1);
        expect(spring.position.x).toBeGreaterThan(0);
    });

    it('reset clears displacement', () => {
        const spring = new Spring2D(100, 10);
        spring.applyImpulse(50, 50);
        spring.update(0.1);
        spring.reset();
        expect(spring.position).toEqual({ x: 0, y: 0 });
    });

    it('rejects invalid stiffness/damping/dt', () => {
        expect(() => new Spring2D(-1, 10)).toThrow(/stiffness/);
        expect(() => new Spring2D(100, -1)).toThrow(/damping/);
        const spring = new Spring2D(100, 10);
        expect(() => spring.update(-0.1)).toThrow(/dtSeconds/);
    });
});

describe('ProceduralShape', () => {
    it('generates ellipse points', () => {
        const shape = new ProceduralShape({ kind: 'ellipse', baseWidth: 100, baseHeight: 50, sides: 16 });
        const pts = shape.generate();
        expect(pts.length).toBe(16);
        expect(pts[0]).toHaveProperty('x');
        expect(pts[0]).toHaveProperty('y');
    });

    it('generates polygon points', () => {
        const shape = new ProceduralShape({ kind: 'polygon', baseWidth: 100, baseHeight: 100, sides: 6 });
        expect(shape.generate().length).toBe(6);
    });

    it('scale stretches getSize', () => {
        const shape = new ProceduralShape({ kind: 'ellipse', baseWidth: 100, baseHeight: 50 });
        const [w, h] = shape.getSize({ scale: 2 });
        expect(w).toBe(200);
        expect(h).toBe(100);
    });

    it('rejects negative base dimensions', () => {
        expect(() => new ProceduralShape({ kind: 'ellipse', baseWidth: -1, baseHeight: 50 })).toThrow(/baseWidth/);
    });
});
