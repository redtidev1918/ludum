# ludum — Architecture

**Language / 语言:** [中文](/docs/ARCHITECTURE.md) · English

ludum is a portable, headless, deterministic, typed, composable, data-driven TypeScript
gameplay kernel plus gameplay systems. It is **not** a game engine, a renderer or a scene
framework.

## Layer model

Dependencies point downwards; reverse pollution is forbidden:

```text
Examples (Phaser / headless)
        ↓
Optional Systems (dialogue · geometry · interaction)
        ↓
Gameplay Systems (ecs · resource · state · weighted)
        ↓
Kernel (runtime · predicate · condition-expression · definition · validation · signal · shuffle-bag)
        ↓
Portable Specification (spec/conventions.md)
```

## Core principles

- **Headless first** (ADR 0010): the core runs fully without an engine, DOM or renderer,
  enforced by `lib:["ES2022"]`.
- **Definition != Runtime Instance** (ADR 0002): static definitions are separated from session
  state.
- **Functional core + stateful shell**: pure functions such as `selectWeighted` /
  `containsPoint` / `evaluateCondition` are pushed down.
- **Capability dependency**: `ValueSource` / `RandomSource` / `Clock` / `Shape2D` rather than
  concrete subsystems.
- **Deterministic**: inject RNG and clock; `Math.random()` / `Date.now()` are forbidden.
- **ECS is optional composition** (ADR 0008), not the framework root.

## Dependency map

See `docs/ARCHITECTURE_MAP.md`.

## Portability

See `docs/PORTABILITY.md` and `spec/conventions.md` (Tier 1 TS runtime / Tier 2 JS bridge /
Tier 3 spec port).

## Binding decisions

See `docs/adr/` (0001–0012). Breaking migrations are described in
`docs/migration-v3.md`.

## Validation

The single acceptance entry point is `npm run check` (typecheck ×3 + tests + build:lib).
