# ECS（实体组件系统）

ludus 3.0 的 ECS 是**实例化、类型安全**的实体组件系统。v1 的模块级单例（`ECS.xxx`）已被删除。

## 核心概念

- **`World`**：实体与组件的**唯一所有者**。一个 World 即一个完全隔离的运行时。可同时存在多个 World（例如战斗模拟与预览）。
- **`Entity`**：轻量 handle，按 `id` 标识，所有操作委托回其 World。Entity 自身不保存权威数据。
- **`ComponentType<T>`**：类型化的组件定义（名称 + 默认值）。定义可跨 World 共享。

## 快速上手

```ts
import { World, defineComponent } from './gamelib';

const Position = defineComponent({ name: 'Position', defaults: { x: 0, y: 0 } });
const Velocity = defineComponent({ name: 'Velocity', defaults: { vx: 0, vy: 0 } });

const world = new World();

world.addSystem({
    name: 'Move',
    requires: [Position, Velocity],
    run: (entity, dtSeconds) => {
        const p = entity.get(Position)!;
        const v = entity.get(Velocity)!;
        p.x += v.vx * dtSeconds;
        p.y += v.vy * dtSeconds;
    },
});

const e = world.createEntity()
    .add(Position, { x: 10, y: 20 })
    .add(Velocity, { vx: 1, vy: 0 })
    .tag('player');

world.update(1 / 60); // 一秒 60 帧
```

## API

### `defineComponent`

```ts
const Health = defineComponent({ name: 'Health', defaults: { value: 100, max: 100 } });
```

- `T` 由 `defaults` 推断；`entity.get(Health)` 返回 `{ value: number; max: number } | undefined`。
- `name` 在同一 World 内必须唯一（用于快照序列化）。

### `World`

| 方法 | 说明 |
|---|---|
| `createEntity()` | 创建实体，返回 handle |
| `getEntity(id)` | 按 id 取 handle，不存在返回 `undefined` |
| `destroyEntity(entity|id)` | 销毁实体（幂等） |
| `isAlive(id)` | 是否存活 |
| `clear()` | 清除全部实体并重置 id 计数器（保留系统） |
| `query(...components)` | 拥有所有给定组件的存活实体；无参返回全部存活实体 |
| `queryByTag(tag)` | 拥有该标签的存活实体 |
| `count(...components)` | 匹配实体数量 |
| `addSystem(config)` | 注册系统 |
| `update(dtSeconds)` | 运行所有系统（按 phase + order） |
| `serialize()` / `deserialize(snapshot, components)` | 快照存取 |

### `Entity`（handle）

| 方法 | 说明 |
|---|---|
| `add(component, data?)` | 添加/替换组件（`data` 为 `Partial<T>`，覆盖默认值） |
| `remove(component)` | 移除组件（不存在则 no-op） |
| `get(component)` | 取组件数据，不存在返回 `undefined` |
| `has(component)` | 是否拥有组件 |
| `tag/untag/hasTag` | 标签 |
| `destroy()` / `isAlive()` | 生命周期 |

> 读取语义统一：缺失时 `get` 返回 `undefined`，`has` / `hasTag` / `isAlive` 返回 `false`；对已销毁/未知实体的写操作是**幂等 no-op**。

## 系统调度

系统按 **phase**（`preUpdate` → `update` → `postUpdate`）运行；同一 phase 内按 **order** 降序（大的先跑，默认 0）。

```ts
world.addSystem({ name: 'Input', phase: 'preUpdate', run: ... });
world.addSystem({ name: 'Simulate', run: ... });        // phase 默认 'update'
world.addSystem({ name: 'Render', phase: 'postUpdate', run: ... });
```

- `requires: []` 表示该系统对**每个**存活实体运行一次（与 v1 一致）。

## 结构变更语义（重要）

- **`update()` 之外**：create / destroy / add / remove / tag **立即生效**。
- **`update()` 之内**（系统运行期间）：所有结构变更进入**延迟命令队列**，**tick 结束时统一应用**。因此：
  - 一个 tick 内，查询与迭代看到的拓扑是**稳定**的；
  - 系统 A 在同一 tick 里 create / remove / destroy 的结果，系统 B **看不到**，直到 tick 结束。

```ts
world.addSystem({ name: 'Kill', requires: [], run: (e) => {
    e.destroy();
    e.isAlive(); // true —— 销毁被延迟,当前 tick 内仍存活
} });
world.update(dt);
e.isAlive(); // false —— tick 结束后才真正移除
```

## 快照

```ts
const snapshot = world.serialize();           // { schemaVersion: 1, nextEntityId, entities: [...] }
const other = new World();
other.deserialize(snapshot, [Position, Velocity]); // 组件定义不序列化,由调用方传入
```

- 快照为**纯 JSON 数据**（含 `schemaVersion`），组件数据按 `name` 键存储。
- `deserialize` 会校验 `schemaVersion` 与未知/重复组件名。

## 刻意不做

（见 `docs/adr/0003-instance-based-ecs-world.md`）不实现 archetype / SOA、并行调度、job system，也没有组件 add/remove 回调（`onAdd` / `onRemove`）。
