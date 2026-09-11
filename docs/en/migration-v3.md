# Migration to v3

**Language / 语言:** [中文](/docs/migration-v3.md) · English

ludum v3 is a **backwards-incompatible** refactor: from a "Lua/TS port (v1)" into a small,
composable, engine-agnostic, deterministic, agent-friendly gameplay systems toolkit.

## Global

- Renamed: GameLib → ludus → **ludum**; the npm package name is the unscoped `ludum` (the
  scoped name `@redtidev1918/ludus` is deprecated).
- Runtime dependencies = 0 (Phaser moved to devDependencies).
- The core enforces ES2022-only (referencing `window` / `process` / `Phaser` fails typecheck).
- A single validation entry point, `npm run check`; library build via `npm run build:lib`
  (ESM + .d.ts).
- Every snapshot carries a `schemaVersion`.

## New core primitives

`Clock/ManualClock` · `RandomSource/SystemRandom/SeededRandom/SequenceRandom` ·
`StatefulRandomSource` · `IdGenerator/SequentialIdGenerator` · `ValueSource<T>` · `Predicate<T>` ·
`Signal<T>` · `Countdown` · `ConditionExpression`+`evaluateCondition` ·
`Definition`+`DefinitionRegistry` · `ValidationError`/`CompileResult`.

- EventBus (stringly) → `Signal<T>` (typed).
- `Math.random()` / `Date.now()` → injected `RandomSource` / `Clock`.

## ECS

| v1 | v3 |
|---|---|
| `ECS.xxx` module-level singleton | `new World()` instances |
| `entity.add("Position")` / `get("Position")` (string + any) | `entity.add(Position)` / `get(Position)` (typed `ComponentType<T>`) |
| `defineSystem(name, requires[], fn)` | `world.addSystem({ name, requires, phase, order, run })` |
| `setSystemPriority` / `setSystemEnabled` / `setSystemCallback` | `order` (enabled/callback/onAdd/onRemove removed) |
| Structural changes apply immediately | Deferred within a tick, applied together at the end |

## Resource

| v1 | v3 |
|---|---|
| `addModifier` mutated the caller's object | Copies the input (caller untouched) |
| `onChange` / `onThreshold` returned `this` | Returns an unsubscribe function |
| `ResourceManager` | `ResourceRegistry` |
| `{type, value, duration}` (including the dead flat/percent API) | `{kind: 'regen'\|'decay', amountPerSecond, durationSeconds}` |
| `getModifiers()` (live reference) | Removed; use `getEffectiveRegen/Decay` + `modifierCount` |

## State

| v1 | v3 |
|---|---|
| `StateSprite` (state machine + texture + no-op draw) | `StateMachine<TContext>` + `VisualStateMap` |
| `LayeredStateSprite` | Removed (compose several StateMachines) |
| `draw()` / `loadImage()` / `preloadImages()` | Removed |
| Conditions were push-only | `updateContext` returns to the initial state when nothing matches |

## Dialogue

| v1 | v3 |
|---|---|
| `DialogueTree` / `DialogueLibrary` | `DialogueDefinition<TContext>` / `DialogueSession<TContext>` / `selectLine` / `formatDialogueText` |
| `choose(1)` 1-based | `choose("id")` + `chooseIndex(0)` |
| Lua truthiness / `['<', 20]` array DSL | `Predicate<TContext>` / `ConditionExpression` |
| `Record<string, any>` context | Generic `TContext` |

## Weighted

| v1 | v3 |
|---|---|
| `WeightedEventPool` / `newPool` | `WeightedTable` + `selectWeighted` + `WeightedSession` / `createWeightedSession` |
| `roll({baseChance})` | `roll(context?, filter?)` |
| `pity.guarantee` as an `{id}` map | A predicate `(e) => boolean` |
| `simulate` polluted stats / `totalTriggers` depended on `history.length` | Fixed |

## Geometry / Interaction

| v1 | v3 |
|---|---|
| `ProcShape` / `BezierShape` | `ProceduralShape` + `Spring2D` + `Shape2D` |
| `shape: string` + `bounds: number[]` | `Shape2D` discriminated union |
| `InteractRegion` / `InteractRegionManager` | `InteractionRegion` / `InteractionRouter` |
| `mousepressed/mousereleased/mousemoved` | `pointerDown/pointerUp/pointerMove` |
| `on('click', cb)` | `events.subscribe((e) => switch (e.type))` |
| `bindParam` / `color/fillColor/lineWidth` | Removed (rendering is the consumer's business) |
