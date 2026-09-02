# ProcShape —— 程序化形状

> 源文件:`src/gamelib/procShape.ts`(移植自 `proc_shape.lua`)。零运行时依赖,纯几何计算 + 弹簧阻尼物理,不渲染。

## 概述

ProcShape 用参数化方式生成椭圆/多边形的轮廓点与命中检测,并带弹簧-阻尼「晃动」物理;BezierShape 用控制点 + 三次贝塞尔曲线生成轮廓。二者都能把参数**绑定到资源**(`ResourceLike`,即任何 `get(): number` 对象),让形状随游戏数值变形。TS 版不渲染,由上层拿轮廓点画。

## 类型与配置接口

~~~ts
export interface Point { x: number; y: number; }
export interface Vec2 { x: number; y: number; }
export interface ResourceLike { get(): number; }
export interface Binding { resource: ResourceLike; transform: (value: number) => number; }

export interface ProcShapeConfig {
    type?: string;              // "ellipse"(默认) | "polygon"
    baseWidth?: number;         // 默认 50
    baseHeight?: number;        // 默认 40
    params?: Record<string, number>;   // 可覆盖 scale/stretchX/... 等
    physics?: Record<string, unknown>; // jiggle/stiffness/damping/velocity/displacement
    color?: number[];           // 描边 [r,g,b,a] 0-1,默认 [1,1,1,1]
    fillColor?: number[];       // 填充,默认 [0.8,0.8,0.8,1]
    lineWidth?: number;         // 默认 2
}

export interface BezierShapeConfig {
    controlPoints?: BezierControlPointConfig[];  // { x?, y?, fixed? }
    deformRules?: BezierDeformRule[];            // point 为 1-based 索引
    params?: Record<string, number>;
    physics?: Record<string, unknown>;
    color?: number[]; fillColor?: number[]; lineWidth?: number;
    segments?: number;          // 默认 32
}

export interface BezierDeformRule {
    point: number;              // 控制点索引(1-based)
    axis: "x" | "y";
    param: string;
    formula: (value: number) => number;
}
~~~

### 默认参数

`ProcShape` 的 `params` 内置 `scale=1.0`、`stretchX=1.0`、`stretchY=1.0`、`sag=0`(下垂)、`bulge=0`(凸起)、`rotation=0`(弧度);`physics` 内置 `jiggle=false`、`stiffness=100`、`damping=10`、`velocity/displacement = {0,0}`。

## ProcShape 方法

| 方法 | 签名 | 说明 |
|---|---|---|
| `bindParam` | `(paramName, resource: ResourceLike, transform?: (v) => number): this` | 参数绑定到资源,`transform` 默认恒等 |
| `unbindParam` | `(paramName: string): this` | 解绑参数 |
| `setParam` | `(paramName: string, value: number): this` | 设参数 |
| `getParam` | `(paramName: string): number` | 取参数(有绑定则走 `resource.get()+transform`) |
| `poke` | `(x: number, y: number, force?: number): this` | 戳一下(仅 `jiggle` 时生效,`force` 默认 1) |
| `update` | `(dt: number): this` | 同步绑定参数 + 弹簧阻尼物理 |
| `getSize` | `(): [number, number]` | 当前尺寸 `[baseWidth*scale*stretchX, baseHeight*scale*stretchY]` |
| `getOutlinePoints` | `(segments?: number): Point[]` | 轮廓点(默认 32;polygon 下 segments 即边数) |
| `contains` | `(px, py, cx, cy): boolean` | 点 `(px,py)` 是否在中心 `(cx,cy)` 的形状内 |
| `draw` | `(cx, cy, options?): void` | **空操作** |
| `setColor` | `(r, g, b, a?): this` | 设描边色(缺省 `a=1`) |
| `setFillColor` | `(r, g, b, a?): this` | 设填充色 |

### 几何要点

- **椭圆**:`getOutlinePoints` 先算 `w=baseWidth*scale*stretchX/2`、`h=baseHeight*scale*stretchY/2`,然后对 `y>0`(下半)施加 `sag`(下垂),对 `x` 施加 `bulge`(中部凸起),再叠加物理位移,最后应用 `rotation`。
- **多边形**:`getOutlinePoints(segments)` 直接以 `segments` 为边数生成正多边形(注意:不是固定三角形,默认 32 边形),应用 `rotation`,不应用 `sag/bulge/位移`。
- **`contains` 简化**:椭圆命中只用 `(x/a)^2 + (y/b)^2 <= 1`,**不考虑 sag/bulge/rotation/物理位移**;多边形命中用射线法(基于含 rotation 的轮廓点)。故「精确命中」请以 `getOutlinePoints` 为准。

### 弹簧阻尼物理

`physics.jiggle = true` 时,每帧按 `F = -stiffness * disp - damping * vel` 更新 `displacement`/`velocity`;位移/速度都小于阈值(0.1 / 1)时归零止振。`poke(x, y, force)` 朝戳击方向施加 `-normalized * force * 50` 的初速度(中心点则向上加 `force * 50`)。

## 示例

~~~ts
import { ProcShape } from './src/gamelib/procShape';
import { Resource } from './src/gamelib/resource';

const hp = new Resource({ id: 'hp', value: 100, max: 100 });
const blob = new ProcShape({
    type: 'ellipse', baseWidth: 124, baseHeight: 100,
    physics: { jiggle: true, stiffness: 90, damping: 12 },
});
blob.bindParam('scale', hp, (v) => 0.55 + (v / 100) * 0.95);  // 血量越低越小
blob.bindParam('bulge', hp, (v) => Math.max(0, (v - 100) / 500));
blob.poke(10, 0, 1);
blob.update(1 / 60);
const pts = blob.getOutlinePoints(40);   // 交给 Graphics
blob.contains(px, py, cx, cy);           // 命中检测
~~~

## BezierShape 方法

| 方法 | 签名 | 说明 |
|---|---|---|
| `bindParam` / `setParam` / `getParam` | 同 ProcShape | 参数绑定/读写 |
| `poke` | `(x, y, force?): this` | 影响距离 < 100 的非固定控制点(`influence = 1 - dist/100`) |
| `update` | `(dt: number): this` | 绑定参数 + 变形规则 + 每控制点弹簧物理 |
| `getControlPoints` | `(): (Point & { fixed: boolean })[]` | 控制点(含物理位移) |
| `getOutlinePoints` | `(segments?: number): Point[]` | 三次贝塞尔轮廓点(需 ≥ 4 个控制点) |
| `draw` | `(cx, cy, options?): void` | **空操作** |
| `setColor` / `setFillColor` | 同 ProcShape | 设颜色 |

要点:`deformRules` 的 `point` 是 **1-based** 索引,`formula` 的返回值**直接作为控制点坐标**(非相对 base);`getOutlinePoints` 每 3 个控制点一组 `(p0..p3)` 采样一段三次贝塞尔(`numCurves = floor(len/3)`,至少 1 段)。

~~~ts
import { BezierShape } from './src/gamelib/procShape';
const curve = new BezierShape({
    controlPoints: [
        { x: 0, y: -50, fixed: true },
        { x: 50, y: 0 }, { x: 0, y: 50 }, { x: -50, y: 0 },
    ],
    deformRules: [{ point: 2, axis: 'x', param: 'scale', formula: (s) => 50 * s }],
    segments: 32,
});
curve.setParam('scale', 2.0);
curve.update(1 / 60);
curve.getOutlinePoints();   // 采样后的曲线点
~~~

## Lua 迁移 / 行为差异

- **构造**:`ProcShape.new(cfg)` → `new ProcShape(cfg)`;`BezierShape.new(cfg)` → `new BezierShape(cfg)`。
- **渲染**:`draw()` 空操作;颜色为 `[r,g,b,a]` 0-1,上层换算 0-255 后填给 Phaser。
- **`config.physics` 的嵌套向量**按 Lua 语义复制成 `{x, y}` 形状;标量直接赋值。
- **`contains` 是简化命中**(椭圆不处理 sag/bulge/rotation),与 `getOutlinePoints` 的精确几何有差异,按需选择。

## 命中处理说明

- `rotation` 单位是**弧度**,不是角度。
- 由于 `contains` 是简化命中(椭圆忽略 sag/bulge/rotation),演示场景对 blob 的点击命中改用了一个独立的 `InteractRegion({ shape: 'circle' })` 区域,而非直接调 `ProcShape.contains`;需要「几何严格命中」时,建议用 `getOutlinePoints` + 射线法自己判断,或把 `ProcShape` 经 `bindToShape` 交给 `InteractRegion`。

## 渲染 / 集成提示

- `getOutlinePoints()` 返回以形状中心为原点的相对坐标;Phaser 层加中心偏移 `(cx + p.x, cy + p.y)` 转 `Phaser.Math.Vector2` 后 `fillPoints/strokePoints`(见 `DemoScene.drawBlob()`)。
- 动态区域可把 `ProcShape` `bindToShape` 给 `InteractRegion`(需 `contains(x,y,cx,cy)` 签名,正好匹配)。
