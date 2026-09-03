# StateSprite —— 状态精灵

> 源文件:`src/gamelib/stateSprite.ts`。图像加载/绘制退化为「纹理键记录」与空操作,状态机逻辑独立,渲染交由 Phaser 上层。

## 概述

StateSprite 是一个**状态机**:按条件或手动在状态间切换,支持过渡进度、缓动、临时状态、状态变化监听;LayeredStateSprite 是「多层合成」的变体(每层各自有状态),用于身体/表情/服装等分层绘制。缓动函数集中在 `Easing` 常量表。

`StateSprite` 挂载静态兼容属性 `StateSprite.Easing`、`StateSprite.LayeredStateSprite`。

## 类型与配置接口

~~~ts
export type EasingFunction = (t: number) => number;

export interface StateSpriteState {
    sprite?: string;                 // 纹理键(记录用)
    priority?: number;               // 注意:仅存储,不参与条件分支判定
    offset?: { x: number; y: number };
    scale?: { x: number; y: number };
    rotation?: number;
    color?: number[];                // [r,g,b,a] 0-1
}

export interface StateSpriteCondition {
    state: string;
    when: (ctx: Record<string, any>) => boolean;
    priority?: number;               // 条件判定顺序(降序)
}

export interface StateSpriteTransition {
    duration?: number;               // 秒
    easing?: string | EasingFunction;
}

export interface StateSpriteConfig {
    states: Record<string, StateSpriteState>;
    conditions?: StateSpriteCondition[];
    transitions?: Record<string, StateSpriteTransition>; // 键如 "a->b"、"default"
    defaultState?: string;
}
~~~

### Easing 缓动函数

`Easing` 提供 `linear`、`inQuad`、`outQuad`、`inOutQuad`、`inCubic`、`outCubic`、`inOutCubic`、`inElastic`、`outElastic`、`outBounce`,签名统一 `(t: number) => number`(`t` 取 0-1)。

## StateSprite 方法

| 方法 | 签名 | 说明 |
|---|---|---|
| `loadImage` | `(stateName: string, imagePath: string): this` | 记录状态纹理键(不加载) |
| `preloadImages` | `(): this` | 把 states 中 `sprite` 为字符串的写入 `images` |
| `updateContext` | `(ctx: Record<string, any>): this` | **合并**上下文并立即评估条件 |
| `setContext` | `(ctx: Record<string, any>): this` | **替换**上下文并评估条件 |
| `setState` | `(stateName: string, options?: { duration?: number }): this` | 设状态;带 `duration` 时为临时状态 |
| `getState` | `(): string \| null` | 当前状态名(临时状态优先) |
| `getStateData` | `(): StateSpriteState \| undefined` | 当前状态数据 |
| `isTransitioning` | `(): boolean` | 是否在过渡中 |
| `update` | `(dt: number): this` | 临时状态倒计时 + 过渡进度推进 |
| `draw` | `(x: number, y: number, options?): void` | **空操作** |
| `onStateChange` | `(cb: (oldState, newState) => void): this` | 状态变化监听 |
| `addState` | `(name: string, state: StateSpriteState): this` | 新增状态 |
| `addCondition` | `(condition: StateSpriteCondition): this` | 新增条件并重排序 |
| `setTransition` | `(key: string, transition: StateSpriteTransition): this` | 设过渡配置 |

## 行为要点

- **默认状态**:`config.defaultState`,缺省取 `states` 的第一个键。
- **条件判定**:`_evaluateConditions()` 按 `condition.priority` **降序**遍历,**第一个 `when()` 为真的条件生效**;仅当 `cond.state !== currentState` 时才切换,随后立即返回。
- **临时状态**:`setState(name, { duration })` 只写 `temporaryState`/`temporaryDuration`,**不走过渡、不触发 `stateChange`**;`getState()` 优先返回临时状态,到期后回落到 `currentState`。
- **过渡**:`_transitionTo` 中 `newState === currentState` 时直接返回(不触发);过渡键查找顺序为 `"old->new"` → `transitions.default` → 内置默认 `{ duration: 0.3, easing: "outQuad" }`;未知缓动名回退 `Easing.linear`。
- **过渡进度**:`transitionProgress` 初值 `1.0`(完成);切换时置 `0`,每帧 `+= dt / duration`,到 `1.0` 后 `previousState = null`。

## 示例

~~~ts
import { StateSprite, Easing } from './src/gamelib/stateSprite';

const ch = new StateSprite({
    states: {
        neutral:  { sprite: 'faceNeutral' },
        happy:    { sprite: 'faceHappy' },
        critical: { sprite: 'faceCritical', priority: 10 },  // 仅存储
    },
    conditions: [
        { state: 'critical', when: (ctx) => ctx.hp < 25, priority: 10 },
        { state: 'happy',    when: (ctx) => ctx.money > 120, priority: 1 },
    ],
    transitions: { default: { duration: 0.25, easing: 'outQuad' } },
    defaultState: 'neutral',
});

ch.updateContext({ hp: 10, money: 50 });  // -> critical
ch.update(1 / 60);
ch.setState('happy', { duration: 3 });    // 临时状态,3 秒后回落
ch.onStateChange((oldS, newS) => console.log(oldS, '->', newS));
ch.getState();                             // 'happy'(临时优先)

// 交叉淡入淡出:读 transitionProgress 并套用缓动
let eased = ch.transitionProgress;
if (typeof ch.transitionEasing === 'function') eased = ch.transitionEasing(eased);
~~~

## LayeredStateSprite

### 方法

| 方法 | 签名 | 说明 |
|---|---|---|
| `setLayerState` | `(layerName: string, stateName: string): this` | 设某层状态 |
| `getLayerState` | `(layerName: string): string \| null` | 取某层状态 |
| `setLayerVisible` | `(layerName: string, visible: boolean): this` | 设某层可见性 |
| `loadImage` | `(layerName: string, stateName: string, imagePath: string): this` | 记录层状态纹理键 |
| `preloadImages` | `(): this` | 预记录所有层纹理键 |
| `update` | `(dt: number): this` | 扩展点(现为空) |
| `draw` | `(x, y, options?): void` | **空操作** |
| `addCondition` | `(layerName, { state, when, priority? }): this` | 加层条件 |
| `updateContext` | `(ctx: Record<string, any>): this` | 合并上下文并**应用所有**命中条件 |

要点:层按 `z` **升序**排序;`layerStates` 中每层默认状态取第一个键;与 StateSprite 不同,**`updateContext` 会应用所有 `when` 为真的条件**(按插入顺序),而非「首个命中即返回」。

~~~ts
import { LayeredStateSprite } from './src/gamelib/stateSprite';
const layered = new LayeredStateSprite({
    layers: [{ name: 'body', z: 0 }, { name: 'face', z: 1 }],
    layerStates: { face: { neutral: 'faceN', blush: 'faceB' } },
});
layered.addCondition('face', { state: 'blush', when: (ctx) => ctx.embarrassed });
layered.updateContext({ embarrassed: true });   // face -> blush
layered.getLayerState('face');                   // 'blush'
~~~

## 注意事项 / 行为细节

- **渲染**:`draw()` 是空操作;`loadImage()`/`preloadImages()` 只记录纹理键字符串,不加载图像。
- **状态优先级 `state.priority` 不参与分支**:实现计算了 `currentPriority/newPriority` 但未真正用于条件判断,保留该「只存不用」的字段(以源码为准)。
- **缓动**:幂运算用 `**` / `Math.pow`;缓动名在 `Easing` 表中查找,查不到回退 `linear`。

## 临时状态与 `currentState` 的关系

- `getState()` 返回 `temporaryState ?? currentState`;而条件判定 `_evaluateConditions()` 比较的是 `currentState`。因此**临时状态存续期间,条件切换仍然基于底层 `currentState`**,不会与临时状态冲突。
- 临时状态到期只是把 `temporaryState` 置空,**不会**触发 `stateChange` 事件,也不会重置过渡进度。
- `getStateData()` 基于 `getState()`,故临时状态期间返回的是临时状态的数据。

## 渲染 / 集成提示

- Phaser 层按 `getState()` 决定显示哪张 `Image`,用 `transitionProgress`(经 `transitionEasing` 处理)与 `previousState` 做 alpha 交叉淡入淡出(见 `DemoScene.ts`)。
- 纹理键字符串需与 Phaser `TextureManager` 中已加载的 key 一致;本库不负责加载。
