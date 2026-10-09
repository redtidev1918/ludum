# 更新日志 (Changelog)

> English: [CHANGELOG.en.md](./CHANGELOG.en.md)

## [3.1.2](https://github.com/redtidev1918/ludum/compare/v3.1.1...v3.1.2) (2026-10-09)


### Bug Fixes

* **test:** migrate benchmarks to Vitest 5 fixtures ([a286459](https://github.com/redtidev1918/ludum/commit/a2864599815bc09012d8d3d13bab6adf8681596d))


### Reverts

* remove one-off deprecate workflow (done, 3.1.0 deprecated) ([9c4ad07](https://github.com/redtidev1918/ludum/commit/9c4ad077bf950d4c1c7cc4f8847439adf1a82c6e))

## [3.1.1](https://github.com/redtidev1918/ludum/compare/v3.1.0...v3.1.1) (2026-09-30)


### Bug Fixes

* **release:** build npm tarball before publish (dist was empty on npm) ([8ddf321](https://github.com/redtidev1918/ludum/commit/8ddf32167fddf40144ebbd1a8b39f19d2b2bd30a))

## [3.1.0](https://github.com/redtidev1918/ludum/compare/v3.0.3...v3.1.0) (2026-09-29)


### Features

* **arch:** add parallel narrative scaffolding (Situation/Heartbeat, Aspects, Deck) ([e50d1dc](https://github.com/redtidev1918/ludum/commit/e50d1dcb75400276dff7d579a50927aa594ed1c1))

## [3.0.3](https://github.com/redtidev1918/ludum/compare/v3.0.2...v3.0.3) (2026-09-09)


### Bug Fixes

* **ci:** follow releasegraph rename ([3fbedd2](https://github.com/redtidev1918/ludum/commit/3fbedd25571d4af3a9f74a0411dcf64f9e5d575a))

## [3.0.2](https://github.com/redtidev1918/ludum/compare/v3.0.1...v3.0.2) (2026-09-09)


### Bug Fixes

* harden runtime state handling ([3b13b33](https://github.com/redtidev1918/ludum/commit/3b13b334a5cb9ee9b700de5909001ec77c2da264))
* one-click demo actually opens the browser (npm start --open) ([50bdf92](https://github.com/redtidev1918/ludum/commit/50bdf92a524af1e3693677ac5d3991a647090390))

## 3.0.1

- 文档中文化（README / CHANGELOG / PORTABILITY / ARCHITECTURE_MAP / cocos README），并补充英文版 `*.en.md`。
- 一键运行演示：`npm start`（`prestart` 自动装依赖，跨平台）。

## 3.0.0

v3 重构后的首个稳定版。自 3.0.0-alpha.2 起无破坏性变更。

- 发布自动化定稿：经典 `NPM_TOKEN` 认证，按 tag 门控 dist-tag。

## 3.0.0-alpha.2

- 新增 `ShuffleBag<T>`（无放回随机抽取）+ 子路径导出。
- 可移植规范（`spec/conventions.md`）、`ARCHITECTURE_MAP`、`PORTABILITY`。
- `examples/headless` 确定性垂直切片；Phaser 演示移到 `examples/phaser/`。
- ECS：对已销毁实体的变更现在会抛错（此前是幂等空操作）。
- 严格 TS：`strictPropertyInitialization`、`useUnknownInCatchVariables`、`noUncheckedIndexedAccess`。

## 3.0.0-alpha.1

- 完整 v3 重写：引擎无关核心（仅 ES2022），**零运行时依赖**。
- 内核原语：`Clock` / `RandomSource` / `IdGenerator` / `ValueSource<T>` /
  `Predicate<T>` / `Signal<T>` / `Countdown` / `ConditionExpression` /
  `Definition` + `DefinitionRegistry` / 校验类型。
- ECS v3：实例化 `World` + 类型化 `ComponentType<T>` + 延迟结构变更。
- `Resource` / `DerivedResource` / `ResourceRegistry`。
- `StateMachine` + `VisualStateMap`（移除遗留 `StateSprite` 与假 draw API）。
- `WeightedTable` / `selectWeighted` / `WeightedSession` / `ShuffleBag`。
- `DialogueDefinition` / `DialogueSession` / `selectLine`（选择 id、类型化上下文）。
- `Shape2D` / `containsPoint` / `Spring2D` / `ProceduralShape`；`InteractionRegion` /
  `InteractionRouter`。
- `npm run check` 门禁、子路径导出、轻量基准测试。
