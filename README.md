# ludum

[English](./README.en.md) · 中文

> 一个小型、引擎无关、强类型的 TypeScript 工具库，用于可复用的 gameplay 系统。

ludum 提供可组合的玩法逻辑构建块 —— ECS、资源与属性、修饰符、状态机、对话、加权
随机选择、保底(pity)系统、玩法条件、几何、以及交互命中检测 —— 可在任意 JS/TS 宿主
（浏览器、Node、Deno、Bun）中运行，**零运行时依赖**。

ludum **不是**游戏引擎、渲染器、场景框架、物理引擎、资源管线、UI 框架、音频框架、
网络层或服务框架。

## 安装

```bash
npm install ludum
```

```ts
import { World, Resource, SeededRandom } from "ludum";
import { World } from "ludum/ecs"; // 子路径导出，更好的 tree-shaking
```

## 架构

库分为四层。相对 v1 的破坏性变更见 `docs/migration-v3.md`；有约束力的决策记录在
`docs/adr/`。

**核心原语 (Core primitives)** —— 小型可复用能力：
`Clock` · `RandomSource` · `IdGenerator` · `ValueSource<T>` · `Predicate<T>` ·
`Signal<T>` · `Countdown` · `ConditionExpression` · `DefinitionRegistry` · 快照。

**玩法系统 (Gameplay systems)** —— 可组合、可独立使用（无需 ECS）：
`World`（ECS）· `Resource` / `DerivedResource` · `StateMachine` · `WeightedTable` /
`WeightedSession` · `ShuffleBag<T>`。

**可选系统 (Optional systems)** —— 更高层、引擎无关：
`DialogueSession` · `Shape2D` / `ProceduralShape` / `Spring2D` · `InteractionRegion` /
`InteractionRouter`。

**示例 (Examples)** —— 库的消费方：
Phaser 4 演示（`examples/phaser/`）· Cocos Creator 参考（`examples/cocos/`）·
headless 切片（`examples/headless/`）。

## 设计原则

- **Definition != Runtime 状态** —— 静态定义与每会话状态分离。
- **纯算法 + 有状态外壳** —— 逻辑尽量纯函数化。
- **能力依赖** —— 模块依赖最小接口（`RandomSource`、`Clock`、`ValueSource<T>`、
  `ContainsPoint`），而非具体子系统。
- **组合优于继承**；**显式优于魔法**；**实例局部优于全局**。
- **确定性优于隐式随机** —— gameplay 代码中不出现 `Math.random()` / `Date.now()`。
- **ECS 是可选组合，不是框架根** —— Resource / Dialogue / Weighted / Interaction 可独立使用。

## 命令

| 命令 | 作用 |
|---|---|
| `npm run check` | typecheck（核心 + 测试 + 示例）+ 测试 + `build:lib` —— 完整门禁 |
| `npm run typecheck` | typecheck 核心（强制无 DOM）、测试、Phaser 示例 |
| `npm test` | 运行全部单元测试（Vitest） |
| `npm run build:lib` | 构建库（ESM + `.d.ts`）到 `dist/` |
| `npm run bench` | 运行轻量基准测试（回归守卫） |
| `npm run example:headless` | 运行确定性 headless 垂直切片 |
| `npm run test:ecs` / `test:resource` / `test:dialogue` / `test:weighted` / `test:state` / `test:geometry` / `test:runtime` / `test:rules` | 按子系统定向测试 |
| `npm run dev` | 运行 Phaser 4 演示（仅开发） |

定向测试 → `npm run check` 是 agent 必跑的工作流。

## 仓库结构

```text
src/gamelib/          # 库核心（引擎无关，零运行时依赖）
  ecs.ts · resource.ts · state-machine.ts · visual-state.ts · dialogue.ts
  weighted/           # WeightedTable / WeightedSession
  geometry/           # Shape2D / Spring2D / ProceduralShape
  interaction/        # InteractionRegion / InteractionRouter
  runtime/            # Clock / RandomSource / IdGenerator / ValueSource / Countdown
types/host.d.ts       # 核心允许的最小宿主全局（console）
spec/                 # 可移植、语言无关的行为规范（conventions.md）
examples/headless/    # 确定性 headless 垂直切片
examples/phaser/      # Phaser 4 示例（仅开发）
examples/cocos/       # Cocos Creator 集成参考（类型层）
tests/                # Vitest 单元 + 集成测试
bench/                # 轻量基准测试
docs/                 # 模块文档 + ADR + ARCHITECTURE_MAP + PORTABILITY + migration-v3.md
CHANGELOG.md          # 发布说明
tsconfig.{base,lib,test,example,build}.json  # 拆分 TypeScript 配置
AGENTS.md             # 面向 agent 的仓库操作契约
```

## 引擎无关是被强制执行的，不只是文档声明

核心只针对 `lib: ["ES2022"]` 编译（`tsconfig.lib.json`）。在核心中使用 `window`、
`document`、`process`、`HTMLElement` 或 `Phaser` 会导致 typecheck 失败。见
`docs/adr/0001-engine-independent-core.md`。

## License

[MIT](LICENSE) — Copyright (c) 2026 ludum Team.
