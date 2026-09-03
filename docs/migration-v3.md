# Migration v3

ludum v3 是一次**不向后兼容**的重构：从「Lua/TS 移植(v1)」重写为「小型、可组合、引擎无关、确定性、Agent-friendly 的 gameplay systems toolkit」。

## 全局

- 项目改名：GameLib → ludus → **ludum**；npm 发布名为非 scope 的 `ludum`（scoped 名 `@redtidev1918/ludus` 已弃用）。
- runtime dependencies = 0（Phaser 移到 devDependencies）。
- 核心强制 ES2022-only（`window` / `process` / `Phaser` 直接 typecheck 失败）。
- 统一验证入口 `npm run check`；library build `npm run build:lib`（ESM + .d.ts）。
- 所有 snapshot 带 `schemaVersion`。

## 新增 Core Primitives

`Clock/ManualClock` · `RandomSource/SystemRandom/SeededRandom/SequenceRandom` · `StatefulRandomSource` · `IdGenerator/SequentialIdGenerator` · `ValueSource<T>` · `Predicate<T>` · `Signal<T>` · `Countdown` · `ConditionExpression`+`evaluateCondition` · `Definition`+`DefinitionRegistry` · `ValidationError`/`CompileResult`。

- EventBus（stringly）→ `Signal<T>`（typed）。
- `Math.random()` / `Date.now()` → 注入 `RandomSource` / `Clock`。

## ECS

| v1 | v3 |
|---|---|
| `ECS.xxx` 模块级单例 | `new World()` 实例化 |
| `entity.add("Position")` / `get("Position")`（string + any） | `entity.add(Position)` / `get(Position)`（类型化 `ComponentType<T>`） |
| `defineSystem(name, requires[], fn)` | `world.addSystem({ name, requires, phase, order, run })` |
| `setSystemPriority` / `setSystemEnabled` / `setSystemCallback` | `order`（删除 enabled/callback/onAdd/onRemove） |
| 结构变更立即生效 | tick 内延迟，tick 末统一 apply |

## Resource

| v1 | v3 |
|---|---|
| `addModifier` 改写 caller 对象 | 复制输入（caller 不被改写） |
| `onChange` / `onThreshold` 返回 `this` | 返回 unsubscribe 函数 |
| `ResourceManager` | `ResourceRegistry` |
| `{type, value, duration}`（含死 API flat/percent） | `{kind: 'regen'|'decay', amountPerSecond, durationSeconds}` |
| `getModifiers()`（活引用） | 删除；用 `getEffectiveRegen/Decay` + `modifierCount` |

## State

| v1 | v3 |
|---|---|
| `StateSprite`（状态机+纹理+draw no-op） | `StateMachine<TContext>` + `VisualStateMap` |
| `LayeredStateSprite` | 删除（用多个 StateMachine 组合） |
| `draw()` / `loadImage()` / `preloadImages()` | 删除 |
| conditions 只推不归 | `updateContext` 无匹配时回到初始状态 |

## Dialogue

| v1 | v3 |
|---|---|
| `DialogueTree` / `DialogueLibrary` | `DialogueDefinition<TContext>` / `DialogueSession<TContext>` / `selectLine` / `formatDialogueText` |
| `choose(1)` 1-based | `choose("id")` + `chooseIndex(0)` |
| Lua truthiness / `['<', 20]` 数组 DSL | `Predicate<TContext>` / `ConditionExpression` |
| `Record<string, any>` context | 泛型 `TContext` |

## Weighted

| v1 | v3 |
|---|---|
| `WeightedEventPool` / `newPool` | `WeightedTable` + `selectWeighted` + `WeightedSession` / `createWeightedSession` |
| `roll({baseChance})` | `roll(context?, filter?)` |
| `pity.guarantee` 为 `{id}` 映射 | 谓词 `(e) => boolean` |
| simulate 污染 stats / totalTriggers 依赖 history.length | 已修复 |

## Geometry / Interaction

| v1 | v3 |
|---|---|
| `ProcShape` / `BezierShape` | `ProceduralShape` + `Spring2D` + `Shape2D` |
| `shape: string` + `bounds: number[]` | `Shape2D` 判别联合 |
| `InteractRegion` / `InteractRegionManager` | `InteractionRegion` / `InteractionRouter` |
| `mousepressed/mousereleased/mousemoved` | `pointerDown/pointerUp/pointerMove` |
| `on('click', cb)` | `events.subscribe((e) => switch (e.type))` |
| `bindParam` / `color/fillColor/lineWidth` | 删除（渲染交给 consumer） |
