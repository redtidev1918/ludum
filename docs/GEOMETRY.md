# Geometry —— 几何

ludum v3 的几何层：typed `Shape2D` + 纯命中检测 + `Spring2D` + `ProceduralShape`。v1 的 `ProcShape` / `BezierShape`（几何 + 弹簧 + 颜色混合）已删除。

## 核心概念

- `Shape2D`：rect / circle / ellipse / polygon 判别联合（强类型，无 `shape: string` + `bounds: number[]`）。
- `containsPoint(shape, point)`：纯命中检测。
- `Spring2D`：独立弹簧仿真（`applyImpulse` + `update(dtSeconds)` → `position`）。
- `ProceduralShape`：参数 → outline points，纯计算，不知道 Resource/Spring/renderer。

## 快速上手

```ts
import { containsPoint, Spring2D, ProceduralShape } from './gamelib';

containsPoint({ kind: 'circle', center: { x: 0, y: 0 }, radius: 10 }, { x: 5, y: 5 }); // true

const spring = new Spring2D(90, 12);
spring.applyImpulse(10, 0);
spring.update(1 / 60);

const blob = new ProceduralShape({ kind: 'ellipse', baseWidth: 100, baseHeight: 80, sides: 40 });
const points = blob.generate({ scale: 1.2, displacement: spring.position });
```

## 关键语义

- 几何与弹簧解耦：`ProceduralShape` 接收 `spring.position` 作为普通输入。
- 渲染元数据（颜色/线宽）不在 geometry core，交给上层（见 `VisualState`）。
