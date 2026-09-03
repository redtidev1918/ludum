# WeightedEvent —— 加权随机事件

> 源文件:`src/gamelib/weightedEvent.ts`。工厂 `newPool` 创建加权随机事件池。

## 概述

WeightedEventPool 是加权随机事件池:基础权重 + 修改器(multiply/add)+ 保底(pity)+ 过滤器 + 历史/统计。典型用途:掉落、抽卡、随机事件。

## 类型与配置接口

~~~ts
export type WeightedEventContext = Record<string, unknown>;

export interface WeightedEventItem {
    id: string;
    weight: number;      // 基础权重
    type?: string;       // 事件类型(用于过滤)
    data?: unknown;      // 附加数据
}

export interface WeightedEventModifier {
    condition: (ctx: WeightedEventContext) => boolean; // 生效条件
    filter?: Record<string, unknown>;                  // 过滤 { type: "positive" }
    multiply?: number;   // 权重乘数
    add?: number;        // 权重增量
}

export interface WeightedEventPity {
    threshold: number;                      // 保底触发次数
    guarantee?: Record<string, unknown>;    // 保底条件 { type: "rare" }(匹配事件字段)
    reset?: boolean;                        // 保留字段,逻辑中未使用
}

export interface WeightedEventPoolConfig {
    events: WeightedEventItem[];
    modifiers?: WeightedEventModifier[];
    pity?: WeightedEventPity;
}

export interface RollOptions {
    baseChance?: number;                    // 默认 1.0
    context?: WeightedEventContext;
    filter?: Record<string, unknown>;
}
~~~

> 事件 `weight` 缺省为 1(`event.weight ?? 1`);`filter` 按事件字段逐 key 相等比较(如 `{ type: 'rare' }` 匹配 `type` 字段)。

## WeightedEventPool 方法

| 方法 | 签名 | 说明 |
|---|---|---|
| `addEvent` | `(event: WeightedEventItem): this` | 加事件(并初始化统计) |
| `removeEvent` | `(id: string): this` | 移除事件 |
| `getEvent` | `(id: string): WeightedEventItem \| undefined` | 按 id 取事件 |
| `addModifier` | `(modifier: WeightedEventModifier): this` | 加修改器 |
| `roll` | `(options?): [boolean, WeightedEventItem \| undefined]` | 执行一次抽取 |
| `getHistory` | `(limit?): HistoryEntry[]` | 最近 N 条(默认 10) |
| `getStats` | `(): { totalRolls, totalTriggers, events }` | 统计信息 |
| `resetStats` | `(): this` | 重置统计与历史 |
| `getWeights` | `(context?): Record<string, number>` | 各事件当前有效权重 |
| `getProbabilities` | `(context?, filter?): Record<string, number>` | 各事件概率(权重/总权重) |
| `simulate` | `(count, options?): Record<string, number>` | 模拟 N 次,返回命中计数 |
| `serialize` | `(): { rollCount, lastTriggerRoll, stats, history }` | 序列化 |
| `deserialize` | `(data): this` | 反序列化 |

## 抽取流程(`roll`)

1. `rollCount++`。
2. **基础概率**:若 `baseChance < 1` 且随机数超过 `baseChance`,直接返回 `[false, undefined]`。
3. **保底**:若 `rollCount - lastTriggerRoll >= pity.threshold`,从满足 `pity.guarantee` 的事件中随机挑一个触发(优先于普通抽取)。
4. **加权随机**:过滤 + 应用修改器(先 `multiply` 后 `add`,`Math.max(0, weight)` 钳制),在权重 > 0 的候选里按累计权重随机选。

修改器生效条件:`modifier.condition(context)` 为真且事件匹配 `modifier.filter`。

## 示例

~~~ts
import { newPool } from './src/gamelib/weightedEvent';

const loot = newPool({
    events: [
        { id: 'common', weight: 75, type: 'item' },
        { id: 'rare', weight: 20, type: 'item' },
        { id: 'legendary', weight: 5, type: 'item' },
        { id: 'curse', weight: 10, type: 'curse' },
    ],
    modifiers: [
        { condition: (ctx) => !!ctx.lucky, filter: { type: 'item' }, multiply: 2 },
    ],
    pity: { threshold: 8, guarantee: { id: 'legendary' } },
});

const [ok, ev] = loot.roll({ baseChance: 1, context: { lucky: true } });
if (ok && ev) console.log('得到', ev.id, ev.type);

loot.getWeights({ lucky: true });         // { common: 150, rare: 40, legendary: 10, curse: 10 }
loot.getProbabilities({ lucky: true });   // 归一化概率
const stats = loot.getStats();            // { totalRolls, totalTriggers, events: { id: { count, rate, lastRoll } } }
const sim = loot.simulate(1000, { baseChance: 1 });   // 分布模拟
~~~

## 注意事项 / 行为细节

- **返回元组**:多返回值 `triggered, event` 在 TypeScript 里是数组 `[boolean, event | undefined]`。
- **`pity.reset` 未使用**:字段保留但逻辑中不读(以源码为准)。
- **时间单位**:历史条目 `time` 用 `Date.now()`(**毫秒**),与 DialogueLibrary 的秒不同。
- **`simulate` 的副作用**:`simulate` 会恢复 `rollCount`/`lastTriggerRoll` 与 `history` 长度,**但不会回滚 `stats` 计数** —— 模拟期间 `stats.events[id].count/lastRoll` 会被真实累加(以源码为准)。需要纯净统计时先 `resetStats()` 或在模拟前自行备份。
- **历史上限**:`history` 最多保留 1000 条,超出丢弃最旧。


## 权重与概率计算细节

- **有效权重** `_getEffectiveWeight(event, context)`:从 `event.weight` 出发,遍历所有修改器,对每个「条件为真且事件匹配 filter」的修改器,依次执行 `weight = weight * multiply`(若提供)与 `weight = weight + add`(若提供),最后 `Math.max(0, weight)` 钳制。
- **多个修改器叠加**:按数组顺序逐个生效(如 `*2` 后 `+5`,结果为 `10*2+5=25`)。
- **`getWeights` 不应用 `filter`**(返回全部事件有效权重);**`getProbabilities` 应用 `filter`** 并归一化(`权重/总权重`,总权重为 0 时返回 0)。
- **`getStats().events[id]`**:`count`(触发次数)、`rate`(`count / rollCount`,rollCount 为 0 时 0)、`lastRoll`(最近触发时的 rollCount)。

### 存档往返

~~~ts
const data = pool.serialize();     // { rollCount, lastTriggerRoll, stats, history }
const pool2 = newPool({ events: [{ id: 'test', weight: 10 }] });
pool2.deserialize(data);           // 恢复 rollCount / stats / history
~~~

### 过滤器示例

`filter` 匹配事件自身的字段(`id`/`weight`/`type`/`data` 等),用于「只在这些事件里抽」:

~~~ts
const pool = newPool({
    events: [
        { id: 'goodA', weight: 10, type: 'positive' },
        { id: 'goodB', weight: 10, type: 'positive' },
        { id: 'bad', weight: 10, type: 'negative' },
    ],
});
pool.simulate(100, { baseChance: 1, filter: { type: 'positive' } });
// 只命中 goodA / goodB,bad 不参与
~~~

## 渲染 / 集成提示

- 由点击触发 `roll()`,每帧只读 `getStats()` 刷新掉落统计面板(见 `DemoScene.buildLootPanel()`)。
- `getProbabilities` 适合做 UI 概率预览;注意它不含保底与 `baseChance` 的影响。
