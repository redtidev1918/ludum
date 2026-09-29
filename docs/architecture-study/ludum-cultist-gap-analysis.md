# ludum ×《密教模拟器》差距分析与改进提案

> 状态：**设计讨论稿**。仅记录分析结论与建议，未修改任何 ludum 源码。
> 依据：`~/code/.../cultist_inspect/ARCHITECTURE_NOTES.md`（codex 从反编译 dump 提取的架构观察）+ 对 ludum 现有源码（ecs/resource/state-machine/dialogue/weighted/condition-expression）的通读。
> 证据强度标注沿用：**证据**=反编译结构签名；**推测**=据此推断的行为。本提案中的"差距"指 ludum 缺失或不足以支撑类卡牌叙事玩法的能力。

> **实施状态（ADR 0013）**：G1/G2/G4 的三模块已实施（`narrative/situation.ts`、`aspect.ts`、`deck.ts`，见 `docs/NARRATIVE.md`），通过 `npm run check`；G3（Recipe 声明事件）、G5（Ending→Legacy 元进度）另行规划。

---

## 0. 结论先行

《密教模拟器》的玩法系统与 ludum 是**同一抽象层**（逻辑层玩法系统），但它有几个 ludum **尚未覆盖**的核心抽象，正是"卡牌叙事 + 剧情选择 + 数值管理"这类玩法的骨架。按优先级，ludum 最值得新增/强化的 5 项：

1. **Situation（情境）**：slots + clock + state + heartbeat —— 并行叙事的基础实体，ludum 缺失最多。
2. **Aspect 字典查询/聚合**：把数值从"固定字段"升为"标签字典 + 等级"，并作为条件求值的数据源。
3. **Recipe 式声明事件**：条件（三域）→ 时延 → 产物的统一声明结构，配套"先预测后执行"。
4. **Deck 定义/实例分离 + 可注入 RNG**：抽牌、兜底、耗尽重置、唯一性、回放。
5. **Ending → Legacy 元进度**：跨档继承，roguelike 式重开。

---

## 1. 差距明细（每条：现状 → 差距 → 建议改法）

### G1. Situation 情境实体（最高优先级）
**现状**：ludum 的 `state-machine.ts` 是单主线状态机（一个 currentState + 条件跳转）；`dialogue.ts` 是单节点→多选择的线性遍历。两者都**不能表达"多个并行事件同时推进、各自独立计时与结算"**。
**从 Cultist 学到的核心**（证据：`SituationState` 枚举 `Unstarted/FreshlyStarted/Ongoing/RequiringExecution/Complete`；`SituationController` 的 `ExecuteHeartbeat`/`StoreStacks`/`AddToResults`；`HeartbeatResponse.SlotsToFill` 表示"这拍还差什么输入"）。
**建议**：新增一个引擎无关 `Situation` 原语（或一个可选模块 `narrative/`）：
- 拥有 `slots`（若干需要填充牌/要素的位置）、独立 `clock`（warmup/remaining）、`state`（上述生命周期）。
- 由统一 `Heartbeat` 驱动：每 `tick(dt)` 各 situation 独立倒计时 → 到达边界迁移 state → 产出"需要玩家输入"的信号。
- 与 ludum 哲学一致：纯算法 + 有状态外壳；不依赖单例；`Clock` 注入。

### G2. Aspect 字典聚合
**现状**：ludum `resource.ts` 是"单资源 id → 0/100 数值"，`ResourceRegistry` 管集合；`condition-expression.ts` 求值针对 `Record<string, unknown>`。
**差距**：Cultist 的数值模型是 **`aspectId → 等级 int` 字典**（证据：`AspectsDictionary : Dictionary<string,int>`），并支持 `CombineAspects`（叠加）、`GetTotalAspects`（区内求和）、`GetStacksWithAspect`（按 `aspect>=N` 筛牌）。门槛判断是"若干 aspect 至少达某等级"，不是单数值比较。
**建议**：给 ludum 增加一个轻量 `Aspects`（`Record<string,number>`）工具（combine / total-of / satisfies），并把 `condition-expression.ts` 的解耦为"对一组 aspect 查询求值（query 注入）"，而非只对 flat record 比较。

### G3. Recipe 声明式事件 + 先预测后执行
**现状**：ludum 的事件/条件逻辑都散在命令式节点（`state-machine`、`dialogue` 的 action）里，无"声明式规则表 + 副作用命令包"。
**差距**：Cultist 的 `Recipe`（证据：`Requirements`/`Effects`/`Warmup`/`MaxExecutions`/`AlternativeRecipes`/`SlotSpecifications`）+ `RecipeConductor`（`GetActualRecipesToExecute` 返回多条 `RecipeExecutionCommand`）+ `GetRecipePrediction`（先算后展示）。好处：所有事件收敛成纯数据、可审计、可本地化；执行 = 纯函数产出副作用命令。
**建议**：为 ludum 提供 `RecipeEngine`（可选）：声明条件三域（situation/table/extant）→ 匹配 → `execute()` 返回一个命令数组（加牌/减牌/改 aspect/生成新 situation）。强调**无副作用 + 命令回放**，正好契合 ludum 的"纯算法 + 有状态外壳"与确定性。

### G4. Deck 定义/实例分离 + 可注入 RNG
**现状**：ludum `weighted/`（`WeightedTable`/`WeightedSession`）做加权随机和保底，但**不是"牌组"抽象**——没有抽取历史、耗尽重置、兜底、唯一性、抽牌带消息。
**差距**：Cultist `DeckSpec`（`StartingCards`/`DefaultCardId`/`ResetOnExhaustion`）+ `DeckInstance`（`Stack<string> _cards`/`_eliminatedCards`/`Draw`）+ `Dealer`（`Deal`/`DealWithMessage`）+ `Dice`（`IRollOverride` 可注入）。抽牌还携带 `DrawWithMessage`（叙事反馈）。
**建议**：ludum 增加 `Deck` 原语（定义/实例分离，实例可 reset/eliminate/兜底/唯一性），`RandomSource` 已注入（契合）。可加"抽牌携带消息"作为可选增强。

### G5. Ending → Legacy 元进度
**现状**：ludum 快照可序列化/反序列化一局，但**无"跨局继承"**概念。
**差距**：Cultist `Ending`（`GivesLegacyId`）+ `Legacy`（`Effects`/`StartingVerbId`）+ `LegacySelector`（按结局选下一局开局）+ `Character.recipeExecutions`/`LegacyEventRecord`（跨档记录）。
**建议**：为 ludum 提供 `MetaSave`（可选）：`ending → unlocked Legacy → starting aspects/verb`。作为**纯数据链**，不侵入核心。

---

## 2. 落地原则（严格遵守 ludum AGENTS.md）

- **新增为可选模块**，不破坏现有 `ecs/resource/state-machine/dialogue/weighted` 的向后兼容。
- 核心 `src/gamelib`：零运行时依赖、引擎无关、仅 `ES2022`、不引 Phaser/DOM/Node。
- `Definition != Runtime`；纯算法 + 有状态外壳；注入 `Clock`/`RandomSource`，**不直接 `Math.random()`/`Date.now()`**。
- 无全局单例/DI/事件总线/反射/装饰器；组合优于继承。
- **只添加 ≥2 个真实使用才加抽象**（AGENTS 规则）。G1–G5 中，G5（MetaSave）若不急着用可不做，避免过度设计。

## 3. 建议的实施拆包（仅当批准后逐包做，每包过 `npm run check`）

| 包 | 内容 | 依赖 | 验证 |
|---|---|---|---|
| P1 | `narrative/` 新增 `Situation` + `Heartbeat` | `runtime/clock.ts` | `test:narrative` |
| P2 | `runtime/aspect.ts` 字典工具 | 无 | `test:aspect` |
| P3 | `narrative/recipe.ts` 声明事件引擎 | P1,P2 | `test:recipe` |
| P4 | `runtime/deck.ts`（DeckSpec/DeckInstance） | `weighted/` | `test:deck` |
| P5 | `meta/` MetaSave（可选，视需要） | 快照约定 | `test:meta` |

> 每个包都是独立可交付、向后兼容、可单独 review。P1(P2) 是并行叙事的根基，建议最先做。

---

## 4. 与现有计划的衔接

- 这是 **ludum 改进阶段（阶段3）** 的设计文档。
- 实施（阶段4）待你批准后逐包落地，每包走 `npm run check` 门禁。
- 最终（阶段5）用新增能力搭一个"类密教"最小可玩原型验证核心循环。

## 5. 风险与说明

- **证据基于结构签名**：Cultist 的行为细节是推测，但**抽象形态（slots+clock+state、aspect 字典、recipe 声明、deck spec/inst）是真实结构**，足够作为设计参考。
- **不复制代码**：所有实现都是 ludum 自己的 TS，仅借鉴设计思想。
- **不扩大范围**：G1–G4 是核心，G5 可选；每包独立，避免一次改太多。