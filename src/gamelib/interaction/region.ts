/**
 * InteractionRegion — a single pointer-interactive shape (see docs/adr/0002, 0007).
 * Emits typed InteractionEvents via a local Signal. Engine-neutral pointer API.
 */
import type { Vec2, Shape2D } from '../geometry/shape.js';
import { containsPoint } from '../geometry/shape.js';
import { Signal } from '../signal.js';

export interface PointerInput {
    pointerId?: number | string;
    position: Vec2;
    button?: number;
}

export type InteractionEvent =
    | { type: 'click'; position: Vec2 }
    | { type: 'hover'; position: Vec2; entered: boolean }
    | { type: 'drag'; position: Vec2; phase: 'start' | 'move' | 'end'; delta: Vec2 }
    | { type: 'hold'; position: Vec2; durationSeconds: number }
    | { type: 'release'; position: Vec2 };

export class InteractionRegion {
    readonly events = new Signal<InteractionEvent>();
    private shape: Shape2D;
    private offset: Vec2 = { x: 0, y: 0 };
    private enabled = true;
    private hovered = false;
    private pressed = false;
    private dragging = false;
    private holdSeconds = 0;
    private dragStart: Vec2 | null = null;
    private lastPosition: Vec2 | null = null;

    constructor(shape: Shape2D) {
        this.shape = shape;
    }

    setShape(shape: Shape2D): this {
        this.shape = shape;
        return this;
    }

    getShape(): Shape2D {
        return this.shape;
    }

    setOffset(x: number, y: number): this {
        this.offset = { x, y };
        return this;
    }

    getOffset(): Vec2 {
        return this.offset;
    }

    setEnabled(enabled: boolean): this {
        this.enabled = enabled;
        if (!enabled) this.resetState();
        return this;
    }

    contains(point: Vec2): boolean {
        if (!this.enabled) return false;
        return containsPoint(this.shape, { x: point.x - this.offset.x, y: point.y - this.offset.y });
    }

    pointerDown(input: PointerInput): boolean {
        if (!this.enabled || !this.contains(input.position)) return false;
        this.pressed = true;
        this.holdSeconds = 0;
        this.dragStart = { ...input.position };
        this.lastPosition = { ...input.position };
        return true;
    }

    pointerUp(input: PointerInput): boolean {
        if (!this.enabled) return false;
        const wasPressed = this.pressed;
        const wasDragging = this.dragging;
        if (wasPressed) {
            if (wasDragging) {
                this.events.emit({ type: 'drag', position: input.position, phase: 'end', delta: { x: 0, y: 0 } });
            } else if (this.contains(input.position)) {
                this.events.emit({ type: 'click', position: input.position });
            }
            this.events.emit({ type: 'release', position: input.position });
        }
        this.pressed = false;
        this.dragging = false;
        this.dragStart = null;
        return wasPressed;
    }

    pointerMove(input: PointerInput): void {
        if (!this.enabled) return;
        const wasHovered = this.hovered;
        const isHovered = this.contains(input.position);
        if (isHovered && !wasHovered) {
            this.hovered = true;
            this.events.emit({ type: 'hover', position: input.position, entered: true });
        } else if (!isHovered && wasHovered) {
            this.hovered = false;
            this.events.emit({ type: 'hover', position: input.position, entered: false });
        }

        if (this.pressed && this.dragStart) {
            const dx = input.position.x - this.dragStart.x;
            const dy = input.position.y - this.dragStart.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (!this.dragging && dist > 5) {
                this.dragging = true;
                this.events.emit({ type: 'drag', position: input.position, phase: 'start', delta: { x: dx, y: dy } });
            } else if (this.dragging && this.lastPosition) {
                this.events.emit({
                    type: 'drag',
                    position: input.position,
                    phase: 'move',
                    delta: { x: input.position.x - this.lastPosition.x, y: input.position.y - this.lastPosition.y },
                });
            }
        }
        this.lastPosition = { ...input.position };
    }

    update(dtSeconds: number): void {
        if (!this.enabled || !this.pressed) return;
        this.holdSeconds += dtSeconds;
        if (this.lastPosition) {
            this.events.emit({ type: 'hold', position: this.lastPosition, durationSeconds: this.holdSeconds });
        }
    }

    get isHovered(): boolean {
        return this.hovered;
    }

    get isPressed(): boolean {
        return this.pressed;
    }

    get isDragging(): boolean {
        return this.dragging;
    }

    private resetState(): void {
        this.hovered = false;
        this.pressed = false;
        this.dragging = false;
        this.holdSeconds = 0;
        this.dragStart = null;
        this.lastPosition = null;
    }
}
