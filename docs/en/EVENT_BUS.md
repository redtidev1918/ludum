# EventBus — removed (v3)

**Language / 语言:** [中文](/docs/EVENT_BUS.md) · English

v1's stringly-typed `EventBus` (`on(event: string, cb: (...args: any[]) => void)`) was removed
in v3.

Replacement: the typed, instance-local `Signal<T>` (see `src/gamelib/signal.ts`).

Cross-module communication should use explicit calls or typed discriminated-union events, not a
string event bus. The decision record is
`docs/adr/0007-local-signals-over-global-event-bus.md`.
