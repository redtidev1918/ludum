# ludum

> A small, engine-agnostic, strongly-typed TypeScript toolkit for reusable gameplay systems.

ludum provides composable building blocks for gameplay logic — ECS, resources &
attributes, modifiers, state machines, dialogue, weighted random selection, pity
systems, gameplay conditions, geometry, and interaction hit-testing — that run in any
JS/TS host (browser, Node, Deno, Bun) with **zero runtime dependencies**.

ludum is **not** a game engine, renderer, scene framework, physics engine, asset
pipeline, UI framework, audio framework, networking layer, or service framework.

## Architecture

The library is organized into four layers. Breaking changes from v1 are in
`docs/migration-v3.md`; binding decisions live in `docs/adr/`.

**Core primitives** — small reusable capabilities:
`Clock` · `RandomSource` · `IdGenerator` · `ValueSource<T>` · `Predicate<T>` ·
`Signal<T>` · `Countdown` · `ConditionExpression` · `DefinitionRegistry` · snapshots.

**Gameplay systems** — composable and standalone (no ECS required):
`World` (ECS) · `Resource` / `DerivedResource` · `StateMachine` · `WeightedTable` /
`WeightedSession`.

**Optional systems** — higher-level, engine-agnostic:
`DialogueSession` · `Shape2D` / `ProceduralShape` / `Spring2D` · `InteractionRegion` /
`InteractionRouter`.

**Examples** — consumers of the library:
Phaser 4 demo (`src/demo/`).

## Design principles

- **Definition != Runtime state** — static definitions are separated from per-session state.
- **Pure algorithms + stateful shell** — logic is pure where possible.
- **Capability dependencies** — modules depend on minimal interfaces (`RandomSource`,
  `Clock`, `ValueSource<T>`, `ContainsPoint`), not concrete subsystems.
- **Composition over inheritance**; **explicit over magic**; **instance-local over global**.
- **Deterministic over implicit randomness** — no `Math.random()` / `Date.now()` in
  gameplay code.
- **ECS is optional composition, not the framework root** — Resource / Dialogue /
  Weighted / Interaction work standalone.

## Commands

| command | what it does |
|---|---|
| `npm run check` | typecheck (core + tests + example) + tests + `build:lib` — the full gate |
| `npm run typecheck` | typecheck core (no-DOM enforced), tests, and the Phaser example |
| `npm test` | run all unit tests (Vitest) |
| `npm run build:lib` | build the library (ESM + `.d.ts`) into `dist/` |
| `npm run bench` | run the lightweight benchmark (regression guard) |
| `npm run test:ecs` / `test:resource` / `test:dialogue` / `test:weighted` / `test:state` / `test:geometry` / `test:runtime` / `test:rules` | targeted subsystem tests |
| `npm run dev` | run the Phaser 4 demo (dev only) |

Targeted tests → `npm run check` is the required agent workflow.

## Repository layout

```text
src/gamelib/          # the library core (engine-independent, zero runtime deps)
  ecs.ts · resource.ts · state-machine.ts · visual-state.ts · dialogue.ts
  weighted/           # WeightedTable / WeightedSession
  geometry/           # Shape2D / Spring2D / ProceduralShape
  interaction/        # InteractionRegion / InteractionRouter
  runtime/            # Clock / RandomSource / IdGenerator / ValueSource / Countdown
types/host.d.ts       # minimal host globals (console) allowed in the core
src/demo/             # Phaser 4 example (dev-only)
src/main.ts           # example entry
tests/                # Vitest unit + integration tests
bench/                # lightweight benchmarks
docs/                 # module docs + ADRs + migration-v3.md
tsconfig.{base,lib,test,example,build}.json  # split TypeScript configs
AGENTS.md             # repository operating contract for agents
```

## Engine independence is enforced, not just documented

The core is compiled against `lib: ["ES2022"]` only (`tsconfig.lib.json`). Using
`window`, `document`, `process`, `HTMLElement`, or `Phaser` in the core fails
typecheck. See `docs/adr/0001-engine-independent-core.md`.

## License

[MIT](LICENSE) — Copyright (c) 2026 ludum Team.
