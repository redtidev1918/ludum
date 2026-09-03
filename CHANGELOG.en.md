# Changelog

> 中文：[CHANGELOG.md](./CHANGELOG.md)

## 3.0.0

First stable release of the v3 rewrite. No breaking changes since 3.0.0-alpha.2.

- Publish automation finalized: classic `NPM_TOKEN` auth, tag-gated dist-tags.

## 3.0.0-alpha.2

- Add `ShuffleBag<T>` (random draw without replacement) + subpath export.
- Portable spec (`spec/conventions.md`), `ARCHITECTURE_MAP`, `PORTABILITY`.
- `examples/headless` deterministic vertical slice; Phaser demo moved to `examples/phaser/`.
- ECS: mutations on a destroyed entity now throw (was idempotent no-op).
- Strict TS: `strictPropertyInitialization`, `useUnknownInCatchVariables`, `noUncheckedIndexedAccess`.

## 3.0.0-alpha.1

- Complete v3 rewrite: engine-independent core (ES2022-only), **zero runtime dependencies**.
- Kernel primitives: `Clock` / `RandomSource` / `IdGenerator` / `ValueSource<T>` /
  `Predicate<T>` / `Signal<T>` / `Countdown` / `ConditionExpression` /
  `Definition` + `DefinitionRegistry` / validation types.
- ECS v3: instance-based `World` + typed `ComponentType<T>` + deferred structural mutation.
- `Resource` / `DerivedResource` / `ResourceRegistry`.
- `StateMachine` + `VisualStateMap` (removed legacy `StateSprite` and fake draw APIs).
- `WeightedTable` / `selectWeighted` / `WeightedSession` / `ShuffleBag`.
- `DialogueDefinition` / `DialogueSession` / `selectLine` (choice ids, typed context).
- `Shape2D` / `containsPoint` / `Spring2D` / `ProceduralShape`; `InteractionRegion` /
  `InteractionRouter`.
- `npm run check` gate, subpath exports, lightweight benchmark.
