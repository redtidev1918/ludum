# Changelog

> 中文：[CHANGELOG.md](./CHANGELOG.md)

## [3.1.1](https://github.com/redtidev1918/ludum/compare/v3.1.0...v3.1.1) (2026-09-30)


### Bug Fixes

* **release:** build npm tarball before publish (dist was empty on npm) ([8ddf321](https://github.com/redtidev1918/ludum/commit/8ddf32167fddf40144ebbd1a8b39f19d2b2bd30a))

## [3.1.0](https://github.com/redtidev1918/ludum/compare/v3.0.3...v3.1.0) (2026-09-29)


### Features

* **arch:** add parallel narrative scaffolding (Situation/Heartbeat, Aspects, Deck) ([e50d1dc](https://github.com/redtidev1918/ludum/commit/e50d1dcb75400276dff7d579a50927aa594ed1c1))

## [3.0.3](https://github.com/redtidev1918/ludum/compare/v3.0.2...v3.0.3) (2026-09-09)


### Bug Fixes

* **ci:** follow the releasegraph rename ([3fbedd2](https://github.com/redtidev1918/ludum/commit/3fbedd25571d4af3a9f74a0411dcf64f9e5d575a))

## [3.0.2](https://github.com/redtidev1918/ludum/compare/v3.0.1...v3.0.2) (2026-09-09)


### Bug Fixes

* harden runtime state handling ([3b13b33](https://github.com/redtidev1918/ludum/commit/3b13b334a5cb9ee9b700de5909001ec77c2da264))
* one-click demo actually opens the browser (`npm start --open`) ([50bdf92](https://github.com/redtidev1918/ludum/commit/50bdf92a524af1e3693677ac5d3991a647090390))

## 3.0.1

- Docs translated to Chinese (README / CHANGELOG / PORTABILITY / ARCHITECTURE_MAP / cocos README), with English `*.en.md` counterparts.
- One-command demo: `npm start` (`prestart` auto-installs, cross-platform).

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
