/**
 * InteractionRouter — dispatches pointer input to multiple InteractionRegions.
 * Regions are hit-tested in reverse registration order (topmost first).
 */
import { InteractionRegion, type PointerInput } from './region.js';

export class InteractionRouter {
    private readonly regions = new Map<string, InteractionRegion>();
    private readonly order: string[] = [];

    register(id: string, region: InteractionRegion): this {
        if (!this.regions.has(id)) this.order.push(id);
        this.regions.set(id, region);
        return this;
    }

    get(id: string): InteractionRegion | undefined {
        return this.regions.get(id);
    }

    remove(id: string): void {
        this.regions.delete(id);
        const i = this.order.indexOf(id);
        if (i >= 0) this.order.splice(i, 1);
    }

    pointerDown(input: PointerInput): string | null {
        for (let i = this.order.length - 1; i >= 0; i--) {
            const id = this.order[i];
            const region = this.regions.get(id);
            if (region && region.pointerDown(input)) return id;
        }
        return null;
    }

    pointerUp(input: PointerInput): string | null {
        let handled: string | null = null;
        for (let i = this.order.length - 1; i >= 0; i--) {
            const id = this.order[i];
            const region = this.regions.get(id);
            if (region && region.pointerUp(input)) handled = id;
        }
        return handled;
    }

    pointerMove(input: PointerInput): void {
        for (const id of this.order) {
            this.regions.get(id)?.pointerMove(input);
        }
    }

    update(dtSeconds: number): void {
        for (const region of this.regions.values()) {
            region.update(dtSeconds);
        }
    }
}
