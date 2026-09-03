# Resource —— 数值资源

ludum v3 的 Resource 只服务于「可变的数值游戏值 + 值域/范围语义」(HP / MP / 体力 / 热量 / 士气)。v1 的 `ResourceManager` / `onChange` / `getModifiers` 已删除或改名。

## 核心概念

- `Resource implements ValueSource<number>`：下游只依赖能力，不依赖本子系统。
- `DerivedResource implements ValueSource<number>`：从其他 `ValueSource<number>` 计算。
- `ResourceRegistry`：只做 register / lookup / enumerate，不持有 update / serialization。

## 快速上手

```ts
import { Resource } from './gamelib';

const hp = new Resource({ id: 'hp', value: 100, max: 100, regenPerSecond: 2 });
hp.subtract(15);
hp.addModifier({ id: 'poison', kind: 'decay', amountPerSecond: 4, durationSeconds: 8 });
const unsub = hp.subscribeChange((oldV, newV) => { /* … */ });
hp.update(1 / 60);
```

## 关键语义

- **所有权**：`addModifier` 复制输入，**不改写 caller 对象**。
- **退订**：`subscribeChange` / `onThreshold` 返回 unsubscribe 函数。
- **校验**：min > max、NaN、Infinity、负 dt、非法 modifier 均 throw。
- **modifier**：仅 `regen` / `decay` 两种（per-second）；`flat` / `percent` 死 API 已删除。
- **快照**：`serialize()` / `Resource.deserialize()`，`schemaVersion: 1`。
