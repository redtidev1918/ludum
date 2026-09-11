# Geometry

**Language / 语言:** [中文](/docs/GEOMETRY.md) · English

ludum v3's geometry layer: typed `Shape2D` + pure hit testing + `Spring2D` + `ProceduralShape`.
v1's `ProcShape` / `BezierShape` (geometry + spring + colour blending) are removed.

## Core concepts

- `Shape2D`: a rect / circle / ellipse / polygon discriminated union (strongly typed — no
  `shape: string` plus `bounds: number[]`).
- `containsPoint(shape, point)`: pure hit testing.
- `Spring2D`: a standalone spring simulation (`applyImpulse` + `update(dtSeconds)` → `position`).
- `ProceduralShape`: parameters → outline points. Pure computation; unaware of Resource, Spring
  or any renderer.

## Quick start

```ts
import { containsPoint, Spring2D, ProceduralShape } from './gamelib';

containsPoint({ kind: 'circle', center: { x: 0, y: 0 }, radius: 10 }, { x: 5, y: 5 }); // true

const spring = new Spring2D(90, 12);
spring.applyImpulse(10, 0);
spring.update(1 / 60);

const blob = new ProceduralShape({ kind: 'ellipse', baseWidth: 100, baseHeight: 80, sides: 40 });
const points = blob.generate({ scale: 1.2, displacement: spring.position });
```

## Key semantics

- Geometry and springs are decoupled: `ProceduralShape` takes `spring.position` as an ordinary
  input.
- Rendering metadata (colour, line width) is not part of the geometry core; it belongs to the
  layer above (see `VisualState`).
