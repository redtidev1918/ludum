# Weighted —— 加权随机选择

GameLib v3 的加权选择系统。v1 的 `WeightedEventPool` / `newPool` 已删除。

## 核心概念

- **`WeightedTable`**：静态定义（entries + base weights + modifiers），immutable。
- **`selectWeighted` / `effectiveWeight`**：纯算法，无状态、无历史、无统计。
- **`WeightedSession`**：运行时状态（rollCount、totalTriggers、pity、按条目统计、有界历史）。

## 快速上手

```ts
import { createWeightedSession } from './gamelib';
import { SeededRandom } from './gamelib';

const loot = createWeightedSession({
    entries: [
        { id: 'common', weight: 75, type: 'item' },
        { id: 'legendary', weight: 5, type: 'item' },
    ],
}, new SeededRandom(42), {
    pity: { threshold: 8, guarantee: (e) => e.id === 'legendary' },
});

const entry = loot.roll();          // WeightedEntry | undefined
const stats = loot.getStats();      // { totalRolls, totalTriggers, events }
```

## API

### `WeightedTable`（定义）

```ts
new WeightedTable({ entries, modifiers? })
```

- `entries`：`{ id, weight, type?, data? }`，校验非空、无重复 id、weight >= 0。
- `modifiers`：`{ active(context), matches?(entry), multiply?, add? }`。

### 纯函数

```ts
effectiveWeight(entry, context, modifiers): number
selectWeighted(entries, getWeight, random): T | undefined
selectFromTable(table, context, random, filter?): WeightedEntry | undefined
```

### `WeightedSession`（运行时）

```ts
new WeightedSession(table, random, { pity?, historyLimit? })
createWeightedSession(tableConfig, random, { pity?, historyLimit? })
```

| 方法 | 说明 |
|---|---|
| `roll(context?, filter?)` | 抽取一次 |
| `simulate(count, context?, filter?)` | 在**独立状态**上模拟，不污染真实 session |
| `getStats()` | `{ totalRolls, totalTriggers, events: { [id]: { count, rate, lastRoll } } }` |
| `getHistory(limit?)` | 有界历史 |
| `resetStats()` | 清空运行时状态 |
| `serialize()` / `deserialize(snapshot)` | 版本化快照 |

## 语义要点

- **随机注入**：依赖 `RandomSource`，不直接 `Math.random()`。
- **保底（pity）**：连续 `threshold` 次未抽中 `guarantee` 匹配条目后，下一次强制抽中。
- **统计独立于历史**：`totalTriggers` 是独立计数，不依赖有界 history 长度。
- **simulate 不污染**：`simulate()` 在独立 session 状态上运行，真实统计/历史/pity 不受影响。

## 刻意不做

不实现完整 gacha / deck framework；`ShuffleBag` 等有真实消费方时再加。
