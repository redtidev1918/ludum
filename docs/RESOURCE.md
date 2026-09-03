# Resource —— 数值资源系统

> 源文件:`src/gamelib/resource.ts`。零运行时依赖。

## 概述

Resource 模块管理 HP、金币、能量等**数值资源**,提供三种容器:

| 类 | 用途 | 是否可 `update` | 是否可 `serialize` |
|---|---|---|---|
| `Resource` | 基础资源:值 + 修改器 + 阈值 + 监听器 | 是 | 是 |
| `DerivedResource` | 派生资源:依赖其他资源按公式计算 | 否 | 否 |
| `ResourceManager` | 管理器:注册 / 批量更新 / 批量序列化 | 是(分发) | 是 |

`Resource` 挂载了静态兼容属性 `Resource.DerivedResource`、`Resource.ResourceManager`。

## 类型与配置接口

~~~ts
export type ModifierType = "flat" | "percent" | "decay" | "regen";

export interface ResourceModifier {
    id?: string;      // 唯一标识,缺省时自动生成
    type: ModifierType;
    value: number;
    duration?: number; // 持续时间(秒),缺省永久
    elapsed?: number;  // 已过时间(addModifier 时归零)
    priority?: number; // 优先级(越高越先应用)
}

export interface ResourceConfig {
    id?: string;
    value?: number;
    min?: number;
    max?: number;
    regen?: number;    // 基础恢复率,存入 baseRegen
    decay?: number;    // 基础衰减率,存入 baseDecay
}

export type ThresholdDirection = "above" | "below" | "equal" | "cross";

export interface SerializedResource {
    id: string; value: number; min: number; max: number;
    baseRegen: number; baseDecay: number;
    modifiers: Record<string, ResourceModifier>;
}

export interface DerivedResourceConfig {
    id?: string;
    dependencies?: Record<string, Resource | number>;
    formula: (deps: Record<string, number>) => number;
    min?: number;   // 缺省 -Infinity
    max?: number;   // 缺省 Infinity
}
~~~

构造默认值:`id` 为 `"unnamed"`,`value=0`,`min=0`,`max=100`,`regen/decay=0`;构造后会把 `value` 钳制到 `[min, max]`。

## Resource 方法

| 方法 | 签名 | 说明 |
|---|---|---|
| `get` | `(): number` | 返回当前值 |
| `getPercent` | `(): number` | 百分比 0-1;若 `max === min` 返回 1 |
| `set` | `(newValue: number): this` | 设值(钳制到 min/max),值变化时触发 change 监听与阈值 |
| `add` | `(amount: number): this` | 加值(等价 `set(value + amount)`) |
| `subtract` | `(amount: number): this` | 减值 |
| `setMax` | `(newMax: number): this` | 设上限,若当前值越界则钳制 |
| `setMin` | `(newMin: number): this` | 设下限,若当前值越界则钳制 |
| `addModifier` | `(modifier: ResourceModifier): this` | 添加修改器(缺 id 自动生成,`elapsed` 归零,`priority` 默认 0) |
| `removeModifier` | `(modifierId: string): this` | 移除修改器 |
| `hasModifier` | `(modifierId: string): boolean` | 是否存在该修改器 |
| `getModifiers` | `(): Record<string, ResourceModifier>` | 返回全部修改器 |
| `getEffectiveRegen` | `(): number` | 有效恢复率 = baseRegen + 所有 `regen` 修改器 |
| `getEffectiveDecay` | `(): number` | 有效衰减率 = baseDecay + 所有 `decay` 修改器 |
| `update` | `(dt: number): this` | 每帧调用:过期修改器移除 + 应用 `(regen - decay) * dt` |
| `onThreshold` | `(threshold: number, direction: ThresholdDirection, cb: (old, new) => void): this` | 注册阈值事件 |
| `onChange` | `(cb: (old, new) => void): this` | 注册值变化监听 |
| `onMin` | `(cb: () => void): this` | 到达/低于最小值时触发 |
| `onMax` | `(cb: () => void): this` | 到达/高于最大值时触发 |
| `reset` | `(initialValue?: number): this` | 清空修改器,值重置为 `initialValue ?? max` |
| `serialize` | `(): SerializedResource` | 序列化(存档) |
| `deserialize`(静态) | `(data): Resource` | 从数据还原一个 Resource |

### 阈值方向语义

| 方向 | 触发条件(`oldValue` → `newValue`) |
|---|---|
| `below` | `oldValue >= threshold && newValue < threshold`(向下穿过) |
| `above` | `oldValue <= threshold && newValue > threshold`(向上穿过) |
| `equal` | `newValue === threshold && oldValue !== threshold` |
| `cross` | 任意方向穿过(上穿或下穿均触发) |

## DerivedResource 方法

| 方法 | 签名 | 说明 |
|---|---|---|
| `get` | `(): number` | 重算公式(依赖为对象且有 `get` 则取其值,否则取数值),钳制到 min/max,变化时触发监听 |
| `getPercent` | `(): number` | 百分比;默认 `min=-Infinity,max=Infinity` 时可能为 `NaN`(需显式设 min/max) |
| `setDependency` | `(name: string, resource: Resource \| number): this` | 更新某个依赖 |
| `onChange` | `(cb: (old, new) => void): this` | 计算值变化时触发(含首次 `get()` 的 `0 → 首值`) |

## ResourceManager 方法

| 方法 | 签名 | 说明 |
|---|---|---|
| `register` | `(resource: Resource \| DerivedResource): this` | 按 `resource.id` 注册 |
| `get` | `(id: string): Resource \| DerivedResource \| undefined` | 取值,不存在返回 `undefined` |
| `update` | `(dt: number): this` | 鸭子判断:仅调用含 `update` 方法的资源 |
| `serialize` | `(): Record<string, SerializedResource>` | 仅序列化含 `serialize` 方法的资源 |
| `deserialize` | `(data): this` | 仅更新已存在且含 `value` 字段的资源 |

## 示例

~~~ts
import { Resource, DerivedResource, ResourceManager } from './src/gamelib/resource';

const hp = new Resource({ id: 'hp', value: 100, max: 100, regen: 2 });

// 修改器 + 阈值 + 监听器
hp.addModifier({ id: 'poison', type: 'decay', value: 4, duration: 8 });
hp.onThreshold(20, 'below', () => console.log('HP 危险!'));
hp.onChange((oldV, newV) => console.log('HP', oldV, '->', newV));
hp.onMax(() => console.log('HP 已回满'));

hp.update(1 / 60);   // 每秒 -4 HP,8 秒后 poison 自动移除

// 派生资源:压力 = 体积/容量 * 100
const volume = new Resource({ id: 'volume', value: 500, max: 1000 });
const capacity = new Resource({ id: 'capacity', value: 1000, max: 2000 });
const tension = new DerivedResource({
    id: 'tension',
    dependencies: { volume, capacity },
    formula: (d) => (d.volume / d.capacity) * 100,
    min: 0, max: 100,
});
tension.get();  // 50

// 管理器
const mgr = new ResourceManager().register(hp).register(tension);
mgr.update(1 / 60);
const save = mgr.serialize();   // 仅含 hp(有 serialize),不含 tension
~~~

## 注意事项 / 行为细节

- **静态兼容属性**:`Resource.DerivedResource`、`Resource.ResourceManager` 仍可用。
- **`reset()` 默认重置到 `max`**,不是构造时的初始值(测试锁定 `reset()` 后值为 `100`),如需指定值用 `reset(value)`。
- **`flat` / `percent` 修改器类型存在但未参与计算**:`getEffectiveRegen` 只累加 `regen`,`getEffectiveDecay` 只累加 `decay`;`flat`/`percent` 目前不影响任何数值(以源码为准)。
- **监听器仅在值实际变化时触发**:`set()` 用严格 `!==` 判断,值未变(如钳制到边界后重复 set 同值)不会触发。
- **`onMin`/`onMax` 用 `<=`/`>=`**:只要结果值停留在边界(含低于/高于后被钳制到边界),每次变更都会触发。

## 渲染 / 集成提示

- 每帧 `hp.update(dt)` 后读 `hp.getPercent()` 驱动血条宽度;`onChange`/`onThreshold` 负责副作用(播放音效、弹提示)。
- `DerivedResource` 无 `update`/`serialize`,故 `ResourceManager` 会自动跳过它的逐帧更新与存档;派生值在 `get()` 时按需重算。
- `Resource` 是 `ProcShape.bindParam` 期望的 `ResourceLike`(`get(): number`),可直接绑定驱动形状参数。
