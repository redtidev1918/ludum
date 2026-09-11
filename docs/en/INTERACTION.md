# Interaction

**Language / 语言:** [中文](/docs/INTERACTION.md) · English

ludum v3's interaction layer: `Shape2D` + `InteractionRegion` + `InteractionRouter`. v1's
`InteractRegion` / `InteractRegionManager` (`shape: string` + `bounds: number[]` + `mouse*`
naming + `on(event, any[])`) are removed.

## Core concepts

- `InteractionRegion`: a single region (`Shape2D` + offset) that emits **strongly typed events**
  through a `Signal<InteractionEvent>`.
- `InteractionRouter`: pointer dispatch across regions (reverse-order hit testing, topmost
  first).
- Pointer API: `pointerDown` / `pointerUp` / `pointerMove` (engine-neutral, spanning
  mouse/touch/pen).

## Quick start

```ts
import { InteractionRegion, InteractionRouter } from './gamelib';

const btn = new InteractionRegion({ kind: 'rect', x: 0, y: 0, width: 100, height: 40 });
btn.events.subscribe((e) => {
    switch (e.type) {
        case 'click': onButtonClick(); break;
        case 'hover': highlight(e.entered); break;
        case 'drag': if (e.phase === 'move') move(e.delta); break;
    }
});

const router = new InteractionRouter().register('btn', btn);
router.pointerDown({ pointerId: 1, position: { x: 10, y: 10 } });
router.pointerUp({ position: { x: 10, y: 10 } });
```

## Key semantics

- Events use a discriminated union (narrowed on `e.type`) instead of
  `on('click', (...args: any[]) => ...)`.
- `click` / `hover` / `drag` / `hold` / `release` are all typed events.
- Geometry (`Shape2D`) is separate from pointer state; `containsPoint` is the only hit-testing
  dependency.
