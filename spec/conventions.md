# ludum Portable Specification

Language-agnostic behavioral semantics. The TypeScript runtime is the reference
implementation; future ports (C#, Rust, …) conform to these rules.

## Time

- Simulation durations use **seconds**: `dtSeconds`, `durationSeconds`, `remainingSeconds`.
- Absolute (wall-clock) timestamps use **milliseconds**, named `*Ms`.
- Gameplay logic never reads wall clock directly. Inject `Clock` for wall time;
  advance `Countdown` / `update(dtSeconds)` for simulation time.
- Negative or non-finite `dtSeconds` → throw.

## Randomness

- Gameplay logic never calls `Math.random()`. Inject `RandomSource` (`next(): number` in [0,1)).
- `SeededRandom`: same seed → same sequence.
- `SequenceRandom`: fixed sequence, repeats the last value when exhausted.
- A stateful RNG may expose `snapshot()/restore()` (`StatefulRandomSource`).

## IDs

- Definition IDs are stable, non-empty strings. Never `Date.now()+Math.random()`.
- `SequentialIdGenerator` yields monotonically increasing string ids.

## Definitions

- `Definition` is `{ readonly id: string }`.
- Definitions are immutable-ish, shared, and serializable where appropriate.
- Runtime instances are separate, mutable, and snapshot-able. Definition != runtime.

## Conditions

- `Predicate<T>` = `(context: Readonly<T>) => boolean` (runtime).
- `ConditionExpression` is a JSON-serializable AST — `equals`, `notEquals`,
  `lessThan`, `lessOrEqual`, `greaterThan`, `greaterOrEqual`, `in`,
  `between`, `all`, `any`, `not` — evaluated by the pure `evaluateCondition`.

## Snapshots

- Snapshots are JSON-safe plain data: no functions, no Clock, no RandomSource, no engine objects.
- Public/persistent snapshots carry `schemaVersion`.
- `NaN` / `Infinity` must never appear in persistent snapshot data.
- Snapshots capture runtime state only, never definitions.

## Numbers

- Invalid inputs (NaN, Infinity, negative where invalid, min > max) → throw, never silent repair.

## ECS

- World is the single owner of entity/component state. Entity is a handle (identity by id).
- Structural mutations during system execution are deferred to tick end.

## Events

- Object-local events use typed `Signal<T>` (subscribe returns unsubscribe).
- No global or stringly-typed event bus.
