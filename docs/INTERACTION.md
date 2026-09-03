# Interaction —— 交互

ludus v3 的交互层：`Shape2D` + `InteractionRegion` + `InteractionRouter`。v1 的 `InteractRegion` / `InteractRegionManager`（`shape: string` + `bounds: number[]` + `mouse*` 命名 + `on(event, any[])`）已删除。

## 核心概念

- `InteractionRegion`：单个区域（`Shape2D` + offset），通过 `Signal<InteractionEvent>` 发出**强类型事件**。
- `InteractionRouter`：多区域 pointer 分发（逆序命中，topmost 优先）。
- Pointer API：`pointerDown` / `pointerUp` / `pointerMove`（engine-neutral，适配 mouse/touch/pen）。

## 快速上手

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

## 关键语义

- 事件用 discriminated union（`e.type` 收窄），不再 `on('click', (...args: any[]) => ...)`。
- `click` / `hover` / `drag` / `hold` / `release` 均为类型化事件。
- 几何（`Shape2D`）与 pointer 状态分离；`containsPoint` 是唯一命中依赖。
