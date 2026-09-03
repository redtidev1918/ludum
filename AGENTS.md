# AGENTS.md

Repository operating contract for AI agents (Codex, Claude Code, Gemini CLI, Cursor, …).
Read this before modifying anything. It is a contract, not a tutorial.

## Mission

ludus is a small, engine-agnostic, strongly-typed TypeScript toolkit for reusable
gameplay systems (ECS, resources, modifiers, state machines, dialogue, weighted random,
pity, conditions, geometry, interaction hit-testing). It is **not** a game engine,
renderer, scene framework, physics engine, UI framework, audio framework, or service
framework.

## Architecture Rules

- The core library (`src/gamelib`) must not import Phaser, DOM, browser, Node-specific,
  or example code. It compiles against `lib: ["ES2022"]` only (`tsconfig.lib.json`).
- Runtime dependencies are zero. Phaser is a devDependency for the example only.
- Dependency direction: `examples → ludus`. Never the reverse.
- Separate Definitions (static, shareable) from Runtime instances (session state).
- Prefer pure algorithms; keep state in a small stateful shell.
- ECS is an optional composition option, not the framework root. Resource / Dialogue /
  Weighted / Interaction are usable standalone.

## Prefer

composition · explicit dependencies · instance-local state · deterministic logic ·
typed APIs · pure algorithms · small interfaces.

## Avoid

global mutable singletons · service locator · DI container · global event bus ·
reflection · decorators · framework magic · large inheritance hierarchies.

Do not add an abstraction unless it has at least two real users.

## Randomness

Gameplay modules must not call `Math.random()`. Inject a `RandomSource`.
Concrete sources: `SystemRandom`, `SeededRandom`, `SequenceRandom` (tests).

## Time

Gameplay modules must not call `Date.now()`. Inject a `Clock`.
Simulation durations use seconds (`dtSeconds`, `durationSeconds`, `elapsedSeconds`).
Absolute timestamps use milliseconds and are named `*Ms`.

## Validation

Every change must pass `npm run check` before completion:
typecheck (lib + test + example) + tests + `build:lib`.

Local, targeted iteration: `npm run test:ecs`, `test:resource`, `test:dialogue`,
`test:weighted`, `test:state`, `test:geometry`, `test:runtime`, `test:rules`.
Full gate: `npm run check`.

## Scope discipline

When modifying one subsystem, do not modify unrelated subsystems. If you notice a
problem elsewhere, record it in the audit/architecture notes; do not expand scope.

## ADR

Accepted ADRs under `docs/adr/` are binding. Do not silently overturn one. To change
an architecture decision, add a new superseding ADR.
