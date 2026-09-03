/** A 2D damped spring simulation (see docs/adr/0002). Pure logic, no renderer. */
import type { Vec2 } from './shape.js';

export class Spring2D {
    private displacement: Vec2 = { x: 0, y: 0 };
    private velocity: Vec2 = { x: 0, y: 0 };

    constructor(
        private readonly stiffness: number,
        private readonly damping: number,
    ) {
        if (!Number.isFinite(stiffness) || stiffness < 0) {
            throw new Error(`Spring2D: stiffness must be a finite number >= 0, got ${stiffness}`);
        }
        if (!Number.isFinite(damping) || damping < 0) {
            throw new Error(`Spring2D: damping must be a finite number >= 0, got ${damping}`);
        }
    }

    /** Current displacement (read-only view). Feed this to a ProceduralShape. */
    get position(): Readonly<Vec2> {
        return this.displacement;
    }

    applyImpulse(x: number, y: number): void {
        this.velocity.x += x;
        this.velocity.y += y;
    }

    update(dtSeconds: number): void {
        if (!Number.isFinite(dtSeconds) || dtSeconds < 0) {
            throw new Error(`Spring2D.update: dtSeconds must be a finite number >= 0, got ${dtSeconds}`);
        }
        this.displacement.x += this.velocity.x * dtSeconds;
        this.displacement.y += this.velocity.y * dtSeconds;
        const ax = -this.stiffness * this.displacement.x - this.damping * this.velocity.x;
        const ay = -this.stiffness * this.displacement.y - this.damping * this.velocity.y;
        this.velocity.x += ax * dtSeconds;
        this.velocity.y += ay * dtSeconds;
        // Kill residual jitter below the noise floor.
        if (Math.abs(this.displacement.x) < 0.1 && Math.abs(this.velocity.x) < 1) {
            this.displacement.x = 0;
            this.velocity.x = 0;
        }
        if (Math.abs(this.displacement.y) < 0.1 && Math.abs(this.velocity.y) < 1) {
            this.displacement.y = 0;
            this.velocity.y = 0;
        }
    }

    reset(): void {
        this.displacement = { x: 0, y: 0 };
        this.velocity = { x: 0, y: 0 };
    }
}
