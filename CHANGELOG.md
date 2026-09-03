# 更新日志 (Changelog)

> English: [CHANGELOG.en.md](./CHANGELOG.en.md)

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
