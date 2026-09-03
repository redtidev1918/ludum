# InteractRegion —— 交互区域

> 源文件:`src/gamelib/interactRegion.ts`。纯逻辑、引擎无关:只做命中检测与事件分发,指针坐标由上层喂入。

## 概述

InteractRegion 用几何形状描述一个可交互区域,处理 `click` / `hover` / `drag` / `hold` / `release` / `enter` / `leave` 事件;InteractRegionManager 统一把指针事件分发到多个区域。支持 rect / circle / ellipse / polygon 四种命中形状、子区域、偏移与启用开关。

## 类型与配置接口

~~~ts
export type RegionPoint = { x: number; y: number } | [number, number];

export interface SubRegionConfig {
    id?: string;
    shape?: string;     // rect | circle | ellipse | polygon
    bounds?: number[];
    points?: RegionPoint[];
}

export interface InteractRegionConfig {
    shape?: string;          // 默认 "rect"
    bounds?: number[];       // rect: [x,y,w,h];circle: [cx,cy,r];ellipse: [cx,cy,rx,ry]
    points?: RegionPoint[];  // polygon 用
    interactions?: string[]; // 默认 ["click"]
    subRegions?: SubRegionConfig[];
}
~~~

### 命中形状与 `bounds` 约定

| 形状 | `bounds` / `points` |
|---|---|
| `rect` | `[x, y, w, h]`(左上角 + 宽高) |
| `circle` | `[cx, cy, r]` |
| `ellipse` | `[cx, cy, rx, ry]` |
| `polygon` | `points`(支持 `{x,y}` 或 `[x,y]`) |

## InteractRegion 方法

| 方法 | 签名 | 说明 |
|---|---|---|
| `setOffset` | `(x: number, y: number): this` | 移动区域(命中时把坐标减去 offset) |
| `setEnabled` | `(enabled: boolean): this` | 启用/禁用;禁用时重置内部状态 |
| `contains` | `(x: number, y: number): boolean` | 点是否在区域内(禁用返回 false) |
| `getSubRegion` | `(x: number, y: number): string \| null` | 点所在子区域 id,无则 null |
| `on` | `(event: string, callback: (...args) => void): this` | 注册监听 |
| `off` | `(event: string, callback?): this` | 移除监听;缺省 callback 则清空该事件 |
| `mousepressed` | `(x, y, button?): boolean` | 按下;命中则置 `isPressed` 并返回 true |
| `mousereleased` | `(x, y, button?): boolean` | 释放;派发 click/drag-end/release |
| `mousemoved` | `(x, y): boolean` | 移动;派发 hover/enter/leave/drag,返回是否悬停 |
| `update` | `(dt: number): this` | 每帧调用,用于 hold 计时 |
| `debugDraw` | `(options?): void` | **空实现** |
| `bindToShape` | `(procShape: { contains(x,y,cx,cy): boolean }): this` | 绑定 ProcShape 作动态区域 |
| `containsWithShape` | `(x, y, cx, cy): boolean` | 绑定形状时用其命中,否则回退普通检测 |

## 事件与参数

| 事件 | 回调参数 | 门控 |
|---|---|---|
| `click` | `(x, y, subRegion)` | `interactions.click` |
| `hover` | `(x, y, entering)` | `interactions.hover` |
| `drag` | `(x, y, phase, subRegion, dx, dy)`,phase = `"start"\|"move"\|"end"` | `interactions.drag` |
| `hold` | `(x, y, holdTime, subRegion)` | `interactions.hold` |
| `release` | `(x, y, subRegion)` | `interactions.release` |
| `enter` | `(x, y, subRegion)` | 无(始终派发) |
| `leave` | `(x, y, subRegion)` | 无(始终派发) |

## 行为要点

- **默认交互**:不指定 `interactions` 时只启用 `click`。
- **点击 vs 拖拽**:按下后移动距离超过 5px 判定为拖拽(`drag` `"start"` → 多次 `"move"`),释放时派发 `drag` `"end"` **而非 click**;未拖拽且释放在区域内才派发 `click`。
- **hold**:按下期间每帧 `update(dt)` 都会派发一次 `hold`,累计 `holdTime`(秒)。
- **enter/leave 不受 `interactions` 门控**:即使未启用 `hover`,进入/离开仍会派发 `enter`/`leave`。
- **返回值**:`mousepressed` 返回是否命中;`mousereleased` 返回「按下期间是否曾处于 pressed」(`wasPressed`),而非是否产生了 click。

## InteractRegionManager

| 方法 | 签名 | 说明 |
|---|---|---|
| `register` | `(id: string, region: InteractRegion): this` | 注册区域(记入顺序) |
| `get` | `(id: string): InteractRegion \| null` | 取区域,不存在返回 `null` |
| `remove` | `(id: string): this` | 移除区域 |
| `mousepressed` | `(x, y, button?): string \| null` | 逆序检测,返回**第一个**命中区域 id |
| `mousereleased` | `(x, y, button?): string \| null` | 逆序检测,返回**最后一个**处理的区域 id |
| `mousemoved` | `(x, y): void` | 顺序分发到所有区域 |
| `update` | `(dt: number): void` | 更新所有区域(hold 计时) |
| `debugDraw` | `(options?): void` | **空实现** |

> 「逆序检测」意味着后注册的区域优先命中(叠放时上层在后)。

## 示例

~~~ts
import { InteractRegion, InteractRegionManager } from './src/gamelib/interactRegion';

const btn = new InteractRegion({
    shape: 'rect', bounds: [100, 100, 200, 50],
    interactions: ['click', 'hover'],
});
btn.on('click', (x, y) => console.log('clicked', x, y));
btn.on('hover', (_x, _y, entering) => console.log('hover', entering));

const tri = new InteractRegion({
    shape: 'polygon', points: [{ x: -30, y: 26 }, { x: 0, y: -28 }, { x: 30, y: 26 }],
    interactions: ['click'],
});
tri.setOffset(268, 156);

const mgr = new InteractRegionManager().register('btn', btn).register('tri', tri);

// Phaser 桥接(见 DemoScene.buildInput)
this.input.on('pointerdown', (p) => mgr.mousepressed(p.x, p.y, 0));
this.input.on('pointermove', (p) => mgr.mousemoved(p.x, p.y));
this.input.on('pointerup',   (p) => mgr.mousereleased(p.x, p.y, 0));
mgr.update(dt);   // hold 检测
~~~

## 注意事项 / 行为细节

- **渲染**:`debugDraw()` 为空实现(纯逻辑模块)。
- **多边形点格式**:同时支持 `{x,y}` 与 `[x,y]` 两种写法。
- **事件门控差异**:`enter`/`leave` 不受 `interactions` 配置影响,始终派发(以源码为准)。

## 子区域与事件细节

- `getSubRegion` 先判定是否在主区域内,再按声明顺序遍历子区域,返回**第一个**命中的子区域 id(否则 null)。
- 在子区域之间移动时会先 `leave` 旧子区域、再 `enter` 新子区域(`currentSubRegion` 记录当前所在子区域)。
- `drag` 的 `dx/dy` 是相对上一帧 `lastPosition` 的增量,可据此累加到 `offset` 实现拖拽移动(见 `DemoScene` 的可拖拽方块)。

## 渲染 / 集成提示

- 区域只有几何数据(`shape`/`bounds`/`points`/`offset`),可视化由上层自行绘制(`DemoScene` 依据 `region.state.isHovered/isPressed/isDragging` 上色)。
- `bindToShape(procShape)` + `containsWithShape(x, y, cx, cy)` 可让交互区域跟随一个程序化形状动态变形;注意需显式传入形状中心 `(cx, cy)`。
