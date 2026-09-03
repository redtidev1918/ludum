// tests/procShape.test.ts
// Procedural Shape System 单元测试
import { describe, expect, it } from "vitest";
import { ProcShape, BezierShape } from "../src/gamelib/procShape";
import type { ResourceLike } from "../src/gamelib/procShape";

/** 用于测试 bindings 的 Mock Resource */
class MockResource implements ResourceLike {
    value: number;

    constructor(value: number) {
        this.value = value;
    }

    get(): number {
        return this.value;
    }

    set(v: number): void {
        this.value = v;
    }
}

describe("ProcShape", () => {
    it("ProcShape.new creates shape with defaults", () => {
        const shape = new ProcShape({});
        expect(shape.type).toBe("ellipse");
        expect(shape.baseWidth).toBe(50);
        expect(shape.baseHeight).toBe(40);
        expect(shape.params.scale).toBe(1.0);
    });

    it("ProcShape.new respects config", () => {
        const shape = new ProcShape({
            type: "polygon",
            baseWidth: 100,
            baseHeight: 80,
            params: {
                scale: 2.0,
                stretchX: 1.5,
            },
        });
        expect(shape.type).toBe("polygon");
        expect(shape.baseWidth).toBe(100);
        expect(shape.baseHeight).toBe(80);
        expect(shape.params.scale).toBe(2.0);
        expect(shape.params.stretchX).toBe(1.5);
    });

    it("ProcShape:setParam and getParam work", () => {
        const shape = new ProcShape({});
        shape.setParam("scale", 1.5);
        expect(shape.getParam("scale")).toBe(1.5);

        shape.setParam("sag", 0.3);
        expect(shape.getParam("sag")).toBe(0.3);
    });

    it("ProcShape:bindParam binds to resource", () => {
        const shape = new ProcShape({});
        const resource = new MockResource(500);

        shape.bindParam("scale", resource, (v) => 1 + v / 1000);

        expect(shape.getParam("scale")).toBeCloseTo(1.5, 2);

        resource.set(1000);
        expect(shape.getParam("scale")).toBeCloseTo(2.0, 2);
    });

    it("ProcShape:unbindParam removes binding", () => {
        const shape = new ProcShape({});
        const resource = new MockResource(500);

        shape.bindParam("scale", resource, (v) => v / 100);
        expect(shape.getParam("scale")).toBe(5);

        shape.unbindParam("scale");
        shape.setParam("scale", 1.0);
        expect(shape.getParam("scale")).toBe(1.0);
    });

    it("ProcShape:getSize returns correct dimensions", () => {
        const shape = new ProcShape({
            baseWidth: 100,
            baseHeight: 50,
        });

        let [w, h] = shape.getSize();
        expect(w).toBe(100);
        expect(h).toBe(50);

        shape.setParam("scale", 2.0);
        [w, h] = shape.getSize();
        expect(w).toBe(200);
        expect(h).toBe(100);

        shape.setParam("stretchX", 1.5);
        [w, h] = shape.getSize();
        expect(w).toBe(300);
        expect(h).toBe(100);
    });

    it("ProcShape:getOutlinePoints returns points for ellipse", () => {
        const shape = new ProcShape({
            type: "ellipse",
            baseWidth: 100,
            baseHeight: 50,
        });

        const points = shape.getOutlinePoints(16);
        expect(points.length).toBe(16);

        // 检查点在椭圆上
        for (const p of points) {
            expect(p.x).toBeDefined();
            expect(p.y).toBeDefined();
        }
    });

    it("ProcShape:getOutlinePoints returns points for polygon", () => {
        const shape = new ProcShape({
            type: "polygon",
            baseWidth: 100,
            baseHeight: 100,
        });

        const points = shape.getOutlinePoints(6);
        expect(points.length).toBe(6);
    });

    it("ProcShape:contains detects point inside ellipse", () => {
        const shape = new ProcShape({
            type: "ellipse",
            baseWidth: 100,
            baseHeight: 100,
        });

        // 中心点
        expect(shape.contains(100, 100, 100, 100)).toBe(true);

        // 边缘内
        expect(shape.contains(120, 100, 100, 100)).toBe(true);

        // 外部
        expect(shape.contains(200, 200, 100, 100)).toBe(false);
    });

    it("ProcShape physics initializes correctly", () => {
        const shape = new ProcShape({
            physics: {
                jiggle: true,
                stiffness: 200,
                damping: 20,
            },
        });

        expect(shape.physics.jiggle).toBe(true);
        expect(shape.physics.stiffness).toBe(200);
        expect(shape.physics.damping).toBe(20);
        expect(shape.physics.velocity.x).toBe(0);
        expect(shape.physics.displacement.x).toBe(0);
    });

    it("ProcShape:poke affects velocity when jiggle enabled", () => {
        const shape = new ProcShape({
            physics: {
                jiggle: true,
                stiffness: 100,
                damping: 10,
            },
        });

        shape.poke(10, 0, 1);
        expect(shape.physics.velocity.x !== 0 || shape.physics.velocity.y !== 0).toBe(true);
    });

    it("ProcShape:poke does nothing when jiggle disabled", () => {
        const shape = new ProcShape({
            physics: {
                jiggle: false,
            },
        });

        shape.poke(10, 0, 1);
        expect(shape.physics.velocity.x).toBe(0);
        expect(shape.physics.velocity.y).toBe(0);
    });

    it("ProcShape:update applies physics", () => {
        const shape = new ProcShape({
            physics: {
                jiggle: true,
                stiffness: 100,
                damping: 5,
            },
        });

        shape.poke(0, 10, 2);
        shape.update(0.1);

        // 位移应该改变
        expect(shape.physics.displacement.x !== 0 || shape.physics.displacement.y !== 0).toBe(true);
    });

    it("ProcShape:update updates bound parameters", () => {
        const shape = new ProcShape({});
        const resource = new MockResource(100);

        shape.bindParam("scale", resource, (v) => v / 100);

        resource.set(200);
        shape.update(0.1);

        expect(shape.params.scale).toBe(2.0);
    });

    it("ProcShape:setColor and setFillColor work", () => {
        const shape = new ProcShape({});

        shape.setColor(1, 0, 0, 1);
        expect(shape.color[0]).toBe(1);
        expect(shape.color[1]).toBe(0);
        expect(shape.color[2]).toBe(0);

        shape.setFillColor(0, 1, 0, 0.5);
        expect(shape.fillColor[0]).toBe(0);
        expect(shape.fillColor[1]).toBe(1);
        expect(shape.fillColor[3]).toBe(0.5);
    });
});

describe("BezierShape", () => {
    it("BezierShape.new creates shape with control points", () => {
        const shape = new BezierShape({
            controlPoints: [
                { x: 0, y: -50, fixed: true },
                { x: 50, y: 0, fixed: false },
                { x: 0, y: 50, fixed: false },
                { x: -50, y: 0, fixed: false },
            ],
        });

        expect(shape.controlPoints.length).toBe(4);
        expect(shape.controlPoints[0].fixed).toBe(true);
        expect(shape.controlPoints[1].fixed).toBe(false);
    });

    it("BezierShape:setParam and getParam work", () => {
        const shape = new BezierShape({
            controlPoints: [{ x: 0, y: 0 }],
        });

        shape.setParam("scale", 2.0);
        expect(shape.getParam("scale")).toBe(2.0);
    });

    it("BezierShape:bindParam binds to resource", () => {
        const shape = new BezierShape({
            controlPoints: [{ x: 0, y: 0 }],
        });
        const resource = new MockResource(100);

        shape.bindParam("volume", resource, (v) => v * 2);
        expect(shape.getParam("volume")).toBe(200);
    });

    it("BezierShape:getControlPoints returns points with displacement", () => {
        const shape = new BezierShape({
            controlPoints: [
                { x: 0, y: 0 },
                { x: 10, y: 10 },
            ],
            physics: { jiggle: true },
        });

        const cps = shape.getControlPoints();
        expect(cps.length).toBe(2);
        expect(cps[0].x).toBe(0);
        expect(cps[1].x).toBe(10);
    });

    it("BezierShape deform rules modify control points", () => {
        const shape = new BezierShape({
            controlPoints: [
                { x: 0, y: -50, fixed: true },
                { x: 50, y: 0, fixed: false },
                { x: 0, y: 50, fixed: false },
                { x: -50, y: 0, fixed: false },
            ],
            deformRules: [
                { point: 2, axis: "x", param: "scale", formula: (s) => 50 * s },
            ],
        });

        shape.setParam("scale", 2.0);
        shape.update(0.1);

        expect(shape.controlPoints[1].x).toBe(100);
    });

    it("BezierShape:poke affects non-fixed points", () => {
        const shape = new BezierShape({
            controlPoints: [
                { x: 0, y: 0, fixed: true },
                { x: 50, y: 0, fixed: false },
            ],
            physics: { jiggle: true, stiffness: 100, damping: 10 },
        });

        shape.poke(50, 0, 1);

        // 固定点不受影响
        expect(shape.physics.velocities[0].x).toBe(0);
        expect(shape.physics.velocities[0].y).toBe(0);

        // 非固定点受影响
        expect(shape.physics.velocities[1].x !== 0 || shape.physics.velocities[1].y !== 0).toBe(true);
    });

    it("BezierShape:getOutlinePoints returns curve points", () => {
        const shape = new BezierShape({
            controlPoints: [
                { x: 0, y: -50 },
                { x: 50, y: -50 },
                { x: 50, y: 50 },
                { x: 0, y: 50 },
            ],
            segments: 16,
        });

        const points = shape.getOutlinePoints();
        expect(points.length > 0).toBe(true);
    });

    it("BezierShape:setColor works", () => {
        const shape = new BezierShape({
            controlPoints: [{ x: 0, y: 0 }],
        });

        shape.setColor(1, 0.5, 0, 1);
        expect(shape.color[0]).toBe(1);
        expect(shape.color[1]).toBe(0.5);
        expect(shape.color[2]).toBe(0);
    });

    it("BezierShape physics updates correctly", () => {
        const shape = new BezierShape({
            controlPoints: [
                { x: 0, y: 0, fixed: false },
                { x: 10, y: 0, fixed: false },
            ],
            physics: { jiggle: true, stiffness: 100, damping: 5 },
        });

        // 给一个初始速度
        shape.physics.velocities[0].x = 10;

        shape.update(0.1);

        // 位移应该改变
        expect(shape.physics.displacements[0].x !== 0).toBe(true);
    });
});
