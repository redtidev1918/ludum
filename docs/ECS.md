# ECS —— 实体组件系统

> 源文件:`src/gamelib/ecs.ts`。模块级单例函数式 API。

## 概述

ECS 提供一套最小化的实体组件系统:组件(Component)、实体(Entity)、系统(System)三要素,外加查询、序列化与重置。所有函数操作模块级私有状态,**全局只有一个 ECS 世界**,通过 `reset()` / `clearRuntime()` 控制生命周期。

两种调用方式等价:

~~~ts
import { ECS } from './src/gamelib/ecs';        // 聚合对象
import { defineComponent, createEntity } from './src/gamelib/ecs'; // 具名导入
~~~

> `Entity`、`ComponentDefinition`、`System` 等**只作为类型导出**(`export type { Entity, ... }`),不能 `new Entity()`,实体实例一律通过 `createEntity()` 获得。

## 类型

~~~ts
export interface ComponentDefinition { _name: string; _defaults: Record<string, any>; }
export interface System {
    name: string;
    requires: string[];
    update?: (entity: Entity, dt: number) => void;
    onAdd?: (entity: Entity) => void;
    onRemove?: (entity: Entity) => void;
    priority: number;   // 越高越先执行
    enabled: boolean;
}
export interface SerializedEntity { id: number; components: Record<string, any>; tags: Record<string, boolean>; }
export interface SerializedData { entities: Record<string, SerializedEntity>; nextId: number; }
~~~

## 组件 API

| 方法 | 签名 | 说明 |
|---|---|---|
| `defineComponent` | `(name: string, defaults?: Record<string, any>): ComponentDefinition` | 注册组件(含默认值) |
| `getComponent` | `(name: string): ComponentDefinition \| undefined` | 取组件定义 |
| `hasComponent` | `(name: string): boolean` | 组件是否已定义 |

## 实体 API

| 方法 | 签名 | 说明 |
|---|---|---|
| `createEntity` | `(): Entity` | 创建实体(id 自增) |
| `getEntity` | `(id: number): Entity \| undefined` | 按 id 取实体 |
| `destroyEntity` | `(entity: Entity \| number): void` | 销毁实体并通知系统 |
| `getAllEntities` | `(): Entity[]` | 所有存活实体 |
| `clearEntities` | `(): void` | 清空实体并重置 id 计数 |

### 实体链式 API(`Entity` 实例)

| 方法 | 签名 | 说明 |
|---|---|---|
| `add` | `(componentName: string, data?: Record<string, any>): this` | 加组件(默认值 + data 合并);组件未定义时抛错 |
| `remove` | `(componentName: string): this` | 移除组件 |
| `get` | `(componentName: string): any` | 取组件数据(无则 `undefined`) |
| `has` | `(componentName: string): boolean` | 是否拥有组件 |
| `tag` | `(tagName: string): this` | 打标签 |
| `untag` | `(tagName: string): this` | 移除标签 |
| `hasTag` | `(tagName: string): boolean` | 是否有该标签 |
| `destroy` | `(): void` | 标记死亡(由 `update()` 统一清理) |
| `isAlive` | `(): boolean` | 是否存活 |

## 系统 API

| 方法 | 签名 | 说明 |
|---|---|---|
| `defineSystem` | `(name: string, requires: string[], updateFn?: (entity, dt) => void): System` | 注册系统;缺省 `priority=0`、`enabled=true` |
| `getSystem` | `(name: string): System \| undefined` | 取系统 |
| `setSystemPriority` | `(name: string, priority: number): void` | 设优先级 |
| `setSystemEnabled` | `(name: string, enabled: boolean): void` | 启用/禁用 |
| `setSystemCallback` | `(name: string, event: "onAdd" \| "onRemove", cb: (entity) => void): void` | 设回调 |

## 查询 API

| 方法 | 签名 | 说明 |
|---|---|---|
| `query` | `(componentNames: string[]): Entity[]` | 拥有**全部**指定组件的存活实体 |
| `queryByTag` | `(tagName: string): Entity[]` | 拥有指定标签的存活实体 |
| `each` | `(componentNames: string[], cb: (entity) => void): void` | 查询并遍历 |
| `reduce` | `(componentNames: string[], cb: (acc, entity) => T, initial: T): T` | 查询并归约 |
| `count` | `(componentNames: string[]): number` | 命中实体数量 |

## 更新与序列化 API

| 方法 | 签名 | 说明 |
|---|---|---|
| `update` | `(dt: number): void` | 按优先级(降序)更新所有启用系统,末尾清理死亡实体 |
| `updateSystem` | `(name: string, dt: number): void` | 仅更新指定系统 |
| `serialize` | `(): SerializedData` | 序列化所有存活实体 |
| `deserialize` | `(data: SerializedData): void` | 清空后按数据还原 |
| `reset` | `(): void` | 清空实体 + **组件定义 + 系统定义**(彻底重置) |
| `clearRuntime` | `(): void` | 仅清空运行时实体与缓存,**保留组件/系统定义** |

## 示例

~~~ts
import { ECS } from './src/gamelib/ecs';

ECS.defineComponent('Position', { x: 0, y: 0 });
ECS.defineComponent('Velocity', { vx: 0, vy: 0 });

// 系统:按优先级排序执行;缓存按 requires 匹配的实体
ECS.defineSystem('Move', ['Position', 'Velocity'], (e, dt) => {
    const p = e.get('Position'), v = e.get('Velocity');
    p.x += v.vx * dt; p.y += v.vy * dt;
});

// onAdd / onRemove:组件集从「不满足」变为「满足」时触发
ECS.setSystemCallback('Move', 'onAdd', (e) => console.log('加入移动系统', e.id));

// 链式创建实体
const e = ECS.createEntity()
    .add('Position', { x: 100, y: 100 })
    .add('Velocity', { vx: 50, vy: 0 })
    .tag('player');

ECS.update(1 / 60);              // 驱动 Move
const players = ECS.queryByTag('player');
const totalX = ECS.reduce(['Position', 'Velocity'], (acc, en) => acc + en.get('Position').x, 0);
const data = ECS.serialize();    // 存档
ECS.clearRuntime();              // 清实体,保留组件/系统定义
ECS.deserialize(data);           // 还原
~~~

## 注意事项 / 行为细节

- **调用方式**:模块级单例函数式 API(`ECS.xxx`),同时支持具名导入单个函数。
- **`update()` 末尾自动清理死亡实体**:`destroy()` 只是标记 `_alive=false`,真正的删除发生在下一次 `update()`(或 `destroyEntity()` 立即删除)。
- **系统缓存**:`_getSystemEntities` 按组件需求缓存实体列表,实体增删时失效;正常使用无需关心。
- **`onAdd`/`onRemove` 判定**:`onAdd` 在「新加的组件恰好是 requires 之一且现在满足全部要求」时触发;`onRemove` 在「移除的组件是 requires 之一」时触发(通知发生在组件真正删除之前,故此时仍能读到组件)。
- **`reset` vs `clearRuntime`**:前者连组件/系统定义一起清空(适合测试 `beforeEach`),后者只清运行时(适合关卡重开时保留 schema)。

## 系统执行顺序与缓存

- `update(dt)` 先收集「启用且有 `update` 回调」的系统,按 `priority` **降序**排序后逐个执行;同一系统内按其 `requires` 匹配的实体迭代。
- `_getSystemEntities` 对每个系统缓存匹配实体列表,`cacheValid` 在实体增/删/销毁时全局失效(`_invalidateCache`),保证查询结果新鲜。
- `updateSystem(name, dt)` 只跑单个系统,适合手动分阶段驱动;同样尊重 `enabled` 与 `update` 是否存在。

## 渲染 / 集成提示

- ECS 只管数据与逻辑,不持有任何渲染对象;上层每帧 `ECS.query([...])` 把组件位置同步到 Phaser `Image`(`DemoScene.ts` 的 `update()` 即如此)。
- `getAllEntities()` 与 `query()` 都只返回 `_alive === true` 的实体;被 `destroy()` 标记的死亡实体在 `update()` 的清理阶段才从存储移除(演示场景用 `query` 结果驱动图像同步)。
