/** Procedural shape: parameters -> outline points. Pure; no resource/spring/renderer. */
import type { Vec2 } from './shape.js';

export type ProceduralShapeKind = 'ellipse' | 'polygon';

export interface ProceduralShapeConfig {
    kind: ProceduralShapeKind;
    baseWidth: number;
    baseHeight: number;
    /** Vertex count. For ellipse this is the segment count; for polygon the side count. */
    sides?: number;
}

export interface OutlineParams {
    scale?: number;
    stretchX?: number;
    stretchY?: number;
    sag?: number;
    bulge?: number;
    rotation?: number;
    /** Optional translation applied before rotation (e.g. from a Spring2D). */
    displacement?: Vec2;
}

export class ProceduralShape {
    readonly kind: ProceduralShapeKind;
    readonly baseWidth: number;
    readonly baseHeight: number;
    readonly sides: number;

    constructor(config: ProceduralShapeConfig) {
        if (!Number.isFinite(config.baseWidth) || config.baseWidth < 0) {
            throw new Error(`ProceduralShape: baseWidth must be >= 0, got ${config.baseWidth}`);
        }
        if (!Number.isFinite(config.baseHeight) || config.baseHeight < 0) {
            throw new Error(`ProceduralShape: baseHeight must be >= 0, got ${config.baseHeight}`);
        }
        this.kind = config.kind;
        this.baseWidth = config.baseWidth;
        this.baseHeight = config.baseHeight;
        this.sides = config.sides ?? 32;
    }

    /** Generate outline points from parameters. Pure (no stored state is mutated). */
    generate(params: OutlineParams = {}): Vec2[] {
        const scale = params.scale ?? 1;
        const stretchX = params.stretchX ?? 1;
        const stretchY = params.stretchY ?? 1;
        const sag = params.sag ?? 0;
        const bulge = params.bulge ?? 0;
        const rotation = params.rotation ?? 0;
        const disp = params.displacement ?? { x: 0, y: 0 };

        const w = (this.baseWidth * scale * stretchX) / 2;
        const h = (this.baseHeight * scale * stretchY) / 2;

        const points: Vec2[] = [];
        for (let i = 0; i < this.sides; i++) {
            const angle = (i / this.sides) * Math.PI * 2 - (this.kind === 'polygon' ? Math.PI / 2 : 0);
            let x = Math.cos(angle) * w;
            let y = Math.sin(angle) * h;

            if (this.kind === 'ellipse') {
                if (y > 0) y += sag * (y / h);
                x *= 1 + bulge * (1 - Math.abs(y / h)) * 0.5;
                x += disp.x * (1 - Math.abs(y / h) * 0.5);
                y += disp.y * (1 - Math.abs(x / w) * 0.5);
            } else {
                x += disp.x;
                y += disp.y;
            }

            if (rotation !== 0) {
                const cos = Math.cos(rotation);
                const sin = Math.sin(rotation);
                const rx = x * cos - y * sin;
                const ry = x * sin + y * cos;
                x = rx;
                y = ry;
            }
            points.push({ x, y });
        }
        return points;
    }

    getSize(params: OutlineParams = {}): [number, number] {
        const scale = params.scale ?? 1;
        const stretchX = params.stretchX ?? 1;
        const stretchY = params.stretchY ?? 1;
        return [this.baseWidth * scale * stretchX, this.baseHeight * scale * stretchY];
    }
}
