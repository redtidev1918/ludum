# GameLib

> A small, engine-agnostic, strongly-typed TypeScript toolkit for reusable gameplay systems.

GameLib provides composable building blocks for gameplay logic — ECS, resources &
attributes, modifiers, state machines, dialogue, weighted random selection, pity
systems, gameplay conditions, geometry, and interaction hit-testing — that run in any
JS/TS host (browser, Node, Deno, Bun) with **zero runtime dependencies**.

GameLib is **not** a game engine, renderer, scene framework, physics engine, asset
pipeline, UI framework, audio framework, networking layer, or service framework.

## Status: v3 migration in progress

This repository is being refactored from a Lua/TS port (v1) into the v3 architecture.
The table below maps current modules to their v3 target. Docs under `docs/` still
describe the v1 API and are updated per phase; the binding architecture decisions live in
`docs/adr/`.

| v1 module | v3 target |
|---|---|
| `ecs.ts` (singleton) | instance-based `World` + typed components |
| `resource.ts` | `Resource` / `DerivedResource` / `ResourceRegistry` + `ValueSource` |
| `stateSprite.ts` | `StateMachine` + `VisualStateMap` |
| `procShape.ts` | `ProceduralShape` + `Spring2D` + typed `Shape2D` |
| `interactRegion.ts` | `Shape2D` + `InteractionRegion` + `InteractionRouter` |
| `dialogue.ts` | `DialogueDefinition` / `DialogueSelector` / `DialogueSession` |
| `weightedEvent.ts` | `WeightedTable` / `WeightedSelector` / `WeightedSession` / `PityState` |
| `eventBus.ts` | removed → typed local `Signal<T>` |

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
| `npm run test:ecs` / `test:resource` / `test:dialogue` / `test:weighted` | targeted subsystem tests |
| `npm run dev` | run the Phaser 4 demo (dev only) |

Targeted tests → `npm run check` is the required agent workflow.

## Repository layout

```text
src/gamelib/          # the library core (engine-independent, zero runtime deps)
types/host.d.ts       # minimal host globals (console) allowed in the core
src/demo/             # Phaser 4 example (dev-only)
src/main.ts           # example entry
tests/                # Vitest unit tests
docs/                 # architecture + module docs (v1; being migrated)
docs/adr/             # binding architecture decisions
tsconfig.{base,lib,test,example,build}.json  # split TypeScript configs
AGENTS.md             # repository operating contract for agents
```

## Engine independence is enforced, not just documented

The core is compiled against `lib: ["ES2022"]` only (`tsconfig.lib.json`). Using
`window`, `document`, `process`, `HTMLElement`, or `Phaser` in the core fails
typecheck. See `docs/adr/0001-engine-independent-core.md`.

## License

[MIT](LICENSE) — Copyright (c) 2026 GameLib Team.
