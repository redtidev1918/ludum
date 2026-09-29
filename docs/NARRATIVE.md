# Aspect · Narrative · Deck —— 卡牌叙事玩法系统

**语言 / Language:** 中文

这三个模块是从对《密教模拟器》(Cultist Simulator) 玩法规格的研究中提炼、独立实现的
引擎无关能力，用于支撑「卡牌叙事 + 剧情选择 + 数值管理」类玩法。它们各自独立、可单独
使用，全部零运行时依赖、注入 `RandomSource` / `Clock`、无全局状态，遵循 ludum 的
AGENTS 架构纪律。设计动机见
`docs/architecture-study/ludum-cultist-gap-analysis.md`。

---

## Aspects —— 标签 + 等级数值模型

`Aspects = Record<string, number>`（aspectId -> 等级）。把"数值字段"收敛成一组"标签带
等级"，便于公共服务、求总、条件复用和 UI 驱动。

```ts
import { satisfiesAspects, combineAspects, totalAspects, applyAspectDelta } from 'ludum/aspect';

const have = { lantern: 3, grail: 2 };
satisfiesAspects(have, { lantern: 2 });        // true — 门槛判定
satisfiesAspects(have, { lantern: 4 });        // false
combineAspects({ a: 1 }, { b: 2 }, { a: 2 }); // { a: 3, b: 2 }
totalAspects({ a: 2, b: 1 });                 // 3
applyAspectDelta({ a: 5 }, { a: -2, c: 3 });  // { a: 3, c: 3 }
```

**关键语义**：`satisfiesAspects` 逐项比较 `>=`；`applyAspectDelta` 有下限钳制（默认 0）；
纯函数、无状态。

---

## Narrative —— Situation + Heartbeat（并行叙事脚手架）

单个 `Situation` 是一个"地点/事件"：有若干插槽(`slots`)要填、一个独立的模拟倒计时
(`Countdown`) 和生命周期。多个 Situation 并行推进，各走各的时钟 —— 这正是"多个平行
事件同时发生"的骨架。

```ts
import { Situation, Heartbeat } from 'ludum/narrative';

const ritual = new Situation({
  id: 'ritual',
  slots: [{ id: 'main', requiredAspects: { lantern: 2 } }],
  durationSeconds: 20,
});
ritual.fill('main', { lantern: 2 });  // 填充插槽(满足 requiredAspects 才算填满)
ritual.start();

const heart = new Heartbeat();
heart.add(ritual);
// 每帧/sim tick 推进所有 running situation
const becameReady = heart.advance(1 / 60);
```

**生命周期**：`idle → running → ready → complete`（`SituationState`）。倒计时只在
`running` 且 `isReadyInput`（所有槽已填满）时推进；到界触发 `onReady` 并置 `ready`。
`serialize()` 产出可存档快照。

**设计要点**
- `Situation` 有状态外壳 + 纯倒计时；不碰渲染/输入/牌身份。
- `Heartbeat` 统一 tick，返回本拍 `ready` 的 situation 列表。
- 事件未填满时不推进 → 天然的"等玩家输入"停顿（对应 `HeartbeatResponse.SlotsToFill` 思想）。

---

## Deck —— 定义/实例分离的卡牌抽取

`DeckSpec`（静态、可共享）定义卡池；`DeckInstance` 持有抽取的实时状态，从注入的
`RandomSource` 抽牌。

```ts
import { createDeck } from 'ludum/deck';
import { SeededRandom } from 'ludum/runtime';

const spec = {
  id: 'heritage',
  startingCards: ['old_book', 'lantern', 'gold', 'whisper'],
  defaultCard: 'nothing',     // 空池且不重置时的兜底卡
  resetOnExhaustion: true,    // 抽空后重填
};
const deck = createDeck(spec, new SeededRandom(2024)); // 种子 → 确定性抽牌
const card = deck.draw();      // 抽走一张并计入 eliminated
deck.removeCard('gold');       // 定点移除
```

**关键语义**
- `DeckInstance.draw()` 抽移一张；空池 → 重置 / 兜底卡 / `undefined`。
- `removeCard` / `reset` / `serialize()` 支持定点编辑、清空重填与存档。
- 用 `SeededRandom` 即可确定性回放；绝不直接 `Math.random()`。
- 抽取历史/保底(pity)由 `WeightedSession` 承担，Deck 专注"洗牌/抽取/淘汰"本身。

---

## 设计来源与边界

- 这是**基于架构观察的独立实现**，不包含《密教模拟器》的受版权代码/文案/数据结构。
- 借鉴的是抽象形态（aspect 字典、situation+clock+state、deck spec/inst），实现完全是
  ludum 自己的 TS。
- 每模块独立可 review、向后兼容；符合 ludum 的 `Definition != Runtime`、纯算法 +
  有状态外壳、注入能力依赖（`RandomSource` / `Clock`）等原则。