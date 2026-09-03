// tests/interaction.test.ts — InteractionRegion / InteractionRouter
import { describe, it, expect } from 'vitest';
import { InteractionRegion, type InteractionEvent } from '../src/gamelib/interaction/region';
import { InteractionRouter } from '../src/gamelib/interaction/router';
import type { Shape2D } from '../src/gamelib/geometry/shape';

const rect: Shape2D = { kind: 'rect', x: 0, y: 0, width: 100, height: 100 };

describe('InteractionRegion', () => {
    it('contains points accounting for offset', () => {
        const region = new InteractionRegion(rect);
        expect(region.contains({ x: 50, y: 50 })).toBe(true);
        region.setOffset(100, 100);
        expect(region.contains({ x: 50, y: 50 })).toBe(false);
        expect(region.contains({ x: 150, y: 150 })).toBe(true);
    });

    it('emits click on down+up inside', () => {
        const region = new InteractionRegion(rect);
        const events: InteractionEvent[] = [];
        region.events.subscribe((e) => events.push(e));
        region.pointerDown({ position: { x: 50, y: 50 } });
        region.pointerUp({ position: { x: 50, y: 50 } });
        expect(events.some((e) => e.type === 'click')).toBe(true);
    });

    it('does not emit click when released outside', () => {
        const region = new InteractionRegion(rect);
        let clicked = false;
        region.events.subscribe((e) => { if (e.type === 'click') clicked = true; });
        region.pointerDown({ position: { x: 50, y: 50 } });
        region.pointerUp({ position: { x: 150, y: 150 } });
        expect(clicked).toBe(false);
    });

    it('emits hover enter/leave', () => {
        const region = new InteractionRegion(rect);
        const entered: boolean[] = [];
        region.events.subscribe((e) => { if (e.type === 'hover') entered.push(e.entered); });
        region.pointerMove({ position: { x: 50, y: 50 } });
        region.pointerMove({ position: { x: 150, y: 150 } });
        expect(entered).toEqual([true, false]);
    });

    it('emits drag start/move/end', () => {
        const region = new InteractionRegion(rect);
        const phases: string[] = [];
        region.events.subscribe((e) => { if (e.type === 'drag') phases.push(e.phase); });
        region.pointerDown({ position: { x: 50, y: 50 } });
        region.pointerMove({ position: { x: 60, y: 50 } });
        region.pointerMove({ position: { x: 70, y: 50 } });
        region.pointerUp({ position: { x: 70, y: 50 } });
        expect(phases).toContain('start');
        expect(phases).toContain('move');
        expect(phases).toContain('end');
    });

    it('emits hold while pressed', () => {
        const region = new InteractionRegion(rect);
        let holdDuration = 0;
        region.events.subscribe((e) => { if (e.type === 'hold') holdDuration = e.durationSeconds; });
        region.pointerDown({ position: { x: 50, y: 50 } });
        region.update(0.5);
        region.update(0.5);
        expect(holdDuration).toBeGreaterThanOrEqual(1);
    });

    it('setEnabled(false) blocks input', () => {
        const region = new InteractionRegion(rect);
        region.setEnabled(false);
        expect(region.contains({ x: 50, y: 50 })).toBe(false);
        expect(region.pointerDown({ position: { x: 50, y: 50 } })).toBe(false);
    });
});

describe('InteractionRouter', () => {
    it('dispatches pointerDown to the topmost region', () => {
        const router = new InteractionRouter();
        router.register('a', new InteractionRegion({ kind: 'rect', x: 0, y: 0, width: 50, height: 50 }));
        router.register('b', new InteractionRegion({ kind: 'rect', x: 50, y: 50, width: 50, height: 50 }));
        expect(router.pointerDown({ position: { x: 25, y: 25 } })).toBe('a');
        expect(router.pointerDown({ position: { x: 75, y: 75 } })).toBe('b');
        expect(router.pointerDown({ position: { x: 200, y: 200 } })).toBeNull();
    });

    it('remove unregisters a region', () => {
        const router = new InteractionRouter();
        router.register('a', new InteractionRegion(rect));
        router.remove('a');
        expect(router.get('a')).toBeUndefined();
        expect(router.pointerDown({ position: { x: 50, y: 50 } })).toBeNull();
    });
});
