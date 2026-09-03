# EventBus —— 已移除（v3）

v1 的 stringly-typed `EventBus`（`on(event: string, cb: (...args: any[]) => void)`）已在 v3 移除。

替代方案：类型化、实例局部的 `Signal<T>`（见 `src/gamelib/signal.ts`）。

跨模块通信应使用显式调用或类型化判别联合事件，而非字符串事件总线。
决策记录见 `docs/adr/0007-local-signals-over-global-event-bus.md`。
