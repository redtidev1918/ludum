# StateMachine / VisualStateMap —— 状态

ludum v3 把 v1 的 `StateSprite` / `LayeredStateSprite` 拆分为 gameplay 与 presentation 两层；fake 渲染 API（`draw` / `loadImage` / `preloadImages`）已删除。

## 核心概念

- `StateMachine<TContext>`：纯 gameplay 状态（states / conditions / transitions / temporary state / events）。**不知道 texture / renderer**。
- `VisualStateMap`：state → 表现元数据（textureKey / scale / rotation / color）的普通数据。
- `Easing`：纯缓动函数。

## 快速上手

```ts
import { StateMachine } from './gamelib';

const sm = new StateMachine<{ hp: number }>({
    states: ['neutral', 'critical'],
    initialState: 'neutral',
    conditions: [
        { state: 'critical', when: (ctx) => ctx.hp < 20 },
    ],
});

sm.updateContext({ hp: 15 });  // -> critical
sm.updateContext({ hp: 80 });  // 无匹配 -> 回到 neutral
sm.setState('critical', { durationSeconds: 3 });  // 临时状态
sm.onStateChange((oldS, newS) => { /* … */ });    // 返回退订函数
```

## 关键语义

- `updateContext` 按优先级匹配条件；**无匹配时回到初始状态**（修复 v1「只推不归」的 quirk）。
- 表现层用 `VisualStateMap`：`visualStates[state].textureKey` 交给渲染器。
- `LayeredStateSprite` 已删除（无真实消费方；可用多个 StateMachine + VisualStateMap 组合）。
