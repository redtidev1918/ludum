# ADR 0007 — Local Signals over Global Event Bus

**Status:** Accepted

## Context

v1 shipped a stringly-typed `EventBus` (`on(event: string, cb: (...args: any[]) => void)`).
It works, but string event names plus `any` payloads defeat type safety and encourage
cross-module implicit coupling.

## Decision

Use a typed, instance-local `Signal<T>` for object-local events
(subscribe / emit / clear, returning an unsubscribe function). Cross-module communication
uses explicit calls or typed discriminated-union events — not a global or stringly-typed
bus. The v1 `EventBus` is removed.

## Consequences

- Event payloads are statically typed and narrowable via discriminated unions.
- No hidden stringly-typed protocol for agents to rediscover.

## Rejected Alternatives

- Keeping the stringly-typed `EventBus`. Rejected: violates typed-API and agent-friendly goals.
- RxJS or Node's `EventEmitter`. Rejected: unnecessary dependency and global coupling.
