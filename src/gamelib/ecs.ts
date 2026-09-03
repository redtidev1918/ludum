/**
 * Entity-Component System (ECS)
 * 模块级单例:所有函数操作模块级私有状态。
 */

interface ComponentDefinition {
  _name: string;
  _defaults: Record<string, any>;
}

interface System {
  name: string;
  requires: string[];
  update?: (entity: Entity, dt: number) => void;
  onAdd?: (entity: Entity) => void;
  onRemove?: (entity: Entity) => void;
  priority: number;
  enabled: boolean;
}

interface SerializedEntity {
  id: number;
  components: Record<string, any>;
  tags: Record<string, boolean>;
}

interface SerializedData {
  entities: Record<string, SerializedEntity>;
  nextId: number;
}

// 组件注册表
let componentRegistry: Record<string, ComponentDefinition> = {};

// 系统注册表
let systemRegistry: Record<string, System> = {};

// 实体存储
let entities: Record<number, Entity> = {};
let entityIdCounter = 0;

// 系统缓存(按组件需求缓存实体列表)
let systemEntityCache: Record<string, Entity[]> = {};
let cacheValid: Record<string, boolean> = {};

// ---------------------------------------------------------------------------
// Entity
// ---------------------------------------------------------------------------

class Entity {
  id: number;
  components: Record<string, any> = {};
  tags: Record<string, boolean> = {};
  _alive = true;

  constructor(id: number) {
    this.id = id;
  }

  /** 添加组件 */
  add(componentName: string, data?: Record<string, any>): this {
    const compDef = componentRegistry[componentName];
    if (!compDef) {
      throw new Error("Component not defined: " + componentName);
    }

    const compData: Record<string, any> = {};
    for (const k of Object.keys(compDef._defaults)) {
      compData[k] = compDef._defaults[k];
    }
    if (data != null) {
      for (const k of Object.keys(data)) {
        compData[k] = data[k];
      }
    }

    this.components[componentName] = compData;
    _invalidateCache();
    _notifySystemsAdd(this, componentName);

    return this;
  }

  /** 移除组件 */
  remove(componentName: string): this {
    if (this.components[componentName] != null) {
      _notifySystemsRemove(this, componentName);
      delete this.components[componentName];
      _invalidateCache();
    }
    return this;
  }

  /** 获取组件数据 */
  get(componentName: string): any {
    return this.components[componentName];
  }

  /** 检查是否有组件 */
  has(componentName: string): boolean {
    return this.components[componentName] != null;
  }

  /** 添加标签 */
  tag(tagName: string): this {
    this.tags[tagName] = true;
    return this;
  }

  /** 移除标签 */
  untag(tagName: string): this {
    delete this.tags[tagName];
    return this;
  }

  /** 检查是否有标签 */
  hasTag(tagName: string): boolean {
    return this.tags[tagName] === true;
  }

  /** 销毁实体 */
  destroy(): void {
    this._alive = false;
    _invalidateCache();
  }

  /** 检查实体是否存活 */
  isAlive(): boolean {
    return this._alive;
  }
}

// ---------------------------------------------------------------------------
// Component API
// ---------------------------------------------------------------------------

/** 定义组件 */
export function defineComponent(name: string, defaults?: Record<string, any>): ComponentDefinition {
  componentRegistry[name] = {
    _name: name,
    _defaults: defaults ?? {},
  };
  return componentRegistry[name];
}

/** 获取组件定义 */
export function getComponent(name: string): ComponentDefinition | undefined {
  return componentRegistry[name];
}

/** 检查组件是否已定义 */
export function hasComponent(name: string): boolean {
  return componentRegistry[name] != null;
}

// ---------------------------------------------------------------------------
// Entity API
// ---------------------------------------------------------------------------

/** 创建实体 */
export function createEntity(): Entity {
  entityIdCounter = entityIdCounter + 1;

  const entity = new Entity(entityIdCounter);
  entities[entity.id] = entity;
  return entity;
}

/** 获取实体 */
export function getEntity(id: number): Entity | undefined {
  return entities[id];
}

/** 销毁实体 */
export function destroyEntity(entity: Entity | number): void {
  const id = typeof entity === "number" ? entity : entity.id;
  const e = entities[id];
  if (e) {
    // 通知系统
    for (const compName of Object.keys(e.components)) {
      _notifySystemsRemove(e, compName);
    }
    e._alive = false;
    delete entities[id];
    _invalidateCache();
  }
}

/** 获取所有实体 */
export function getAllEntities(): Entity[] {
  const result: Entity[] = [];
  for (const entity of Object.values(entities)) {
    if (entity._alive) {
      result.push(entity);
    }
  }
  return result;
}

/** 清除所有实体 */
export function clearEntities(): void {
  entities = {};
  entityIdCounter = 0;
  _invalidateCache();
}

// ---------------------------------------------------------------------------
// System API
// ---------------------------------------------------------------------------

/** 定义系统 */
export function defineSystem(
  name: string,
  requires: string[],
  updateFn?: (entity: Entity, dt: number) => void,
): System {
  const system: System = {
    name,
    requires: requires ?? [],
    update: updateFn,
    onAdd: undefined,
    onRemove: undefined,
    priority: 0,
    enabled: true,
  };

  systemRegistry[name] = system;
  cacheValid[name] = false;

  return system;
}

/** 获取系统 */
export function getSystem(name: string): System | undefined {
  return systemRegistry[name];
}

/** 设置系统优先级 */
export function setSystemPriority(name: string, priority: number): void {
  const system = systemRegistry[name];
  if (system) {
    system.priority = priority;
  }
}

/** 启用/禁用系统 */
export function setSystemEnabled(name: string, enabled: boolean): void {
  const system = systemRegistry[name];
  if (system) {
    system.enabled = enabled;
  }
}

/** 设置系统回调 */
export function setSystemCallback(
  name: string,
  event: "onAdd" | "onRemove",
  callback: (entity: Entity) => void,
): void {
  const system = systemRegistry[name];
  if (system) {
    system[event] = callback;
  }
}

// ---------------------------------------------------------------------------
// Query API
// ---------------------------------------------------------------------------

/** 查询拥有指定组件的实体 */
export function query(componentNames: string[]): Entity[] {
  const result: Entity[] = [];

  for (const entity of Object.values(entities)) {
    if (entity._alive) {
      let hasAll = true;
      for (const compName of componentNames) {
        if (entity.components[compName] == null) {
          hasAll = false;
          break;
        }
      }
      if (hasAll) {
        result.push(entity);
      }
    }
  }

  return result;
}

/** 查询拥有指定标签的实体 */
export function queryByTag(tagName: string): Entity[] {
  const result: Entity[] = [];
  for (const entity of Object.values(entities)) {
    if (entity._alive && entity.tags[tagName]) {
      result.push(entity);
    }
  }
  return result;
}

/** 查询并执行操作 */
export function each(componentNames: string[], callback: (entity: Entity) => void): void {
  const ents = query(componentNames);
  for (const entity of ents) {
    callback(entity);
  }
}

/** 查询并归约 */
export function reduce<T>(
  componentNames: string[],
  callback: (accumulator: T, entity: Entity) => T,
  initial: T,
): T {
  let result = initial;
  const ents = query(componentNames);
  for (const entity of ents) {
    result = callback(result, entity);
  }
  return result;
}

/** 统计拥有指定组件的实体数量 */
export function count(componentNames: string[]): number {
  return query(componentNames).length;
}

// ---------------------------------------------------------------------------
// Update API
// ---------------------------------------------------------------------------

/** 更新所有系统 */
export function update(dt: number): void {
  // 按优先级排序系统
  const sortedSystems: System[] = [];
  for (const system of Object.values(systemRegistry)) {
    if (system.enabled && system.update) {
      sortedSystems.push(system);
    }
  }
  sortedSystems.sort((a, b) => b.priority - a.priority);

  // 执行系统更新
  for (const system of sortedSystems) {
    const ents = _getSystemEntities(system);
    for (const entity of ents) {
      if (entity._alive) {
        system.update!(entity, dt);
      }
    }
  }

  // 清理死亡实体
  _cleanupDeadEntities();
}

/** 更新指定系统 */
export function updateSystem(name: string, dt: number): void {
  const system = systemRegistry[name];
  if (!system || !system.enabled || !system.update) {
    return;
  }

  const ents = _getSystemEntities(system);
  for (const entity of ents) {
    if (entity._alive) {
      system.update(entity, dt);
    }
  }
}

// ---------------------------------------------------------------------------
// Internal Functions
// ---------------------------------------------------------------------------

/** @private */
export function _invalidateCache(): void {
  for (const name of Object.keys(cacheValid)) {
    cacheValid[name] = false;
  }
}

/** @private */
export function _getSystemEntities(system: System): Entity[] {
  const cached = systemEntityCache[system.name];
  if (cacheValid[system.name] && cached) {
    return cached;
  }

  const result = query(system.requires);
  systemEntityCache[system.name] = result;
  cacheValid[system.name] = true;

  return result;
}

/** @private */
export function _notifySystemsAdd(entity: Entity, componentName: string): void {
  for (const system of Object.values(systemRegistry)) {
    if (system.onAdd) {
      // 检查实体是否现在满足系统要求
      let hasAll = true;
      for (const req of system.requires) {
        if (entity.components[req] == null) {
          hasAll = false;
          break;
        }
      }
      if (hasAll) {
        // 检查是否刚刚满足(之前缺少这个组件)
        let wasJustAdded = false;
        for (const req of system.requires) {
          if (req === componentName) {
            wasJustAdded = true;
            break;
          }
        }
        if (wasJustAdded) {
          system.onAdd(entity);
        }
      }
    }
  }
}

/** @private */
export function _notifySystemsRemove(entity: Entity, componentName: string): void {
  for (const system of Object.values(systemRegistry)) {
    if (system.onRemove) {
      // 检查实体是否之前满足系统要求
      let hadAll = true;
      for (const req of system.requires) {
        if (entity.components[req] == null) {
          hadAll = false;
          break;
        }
      }
      if (hadAll) {
        // 检查是否因为移除这个组件而不再满足
        let willLose = false;
        for (const req of system.requires) {
          if (req === componentName) {
            willLose = true;
            break;
          }
        }
        if (willLose) {
          system.onRemove(entity);
        }
      }
    }
  }
}

/** @private */
export function _cleanupDeadEntities(): void {
  const toRemove: number[] = [];
  for (const id of Object.keys(entities)) {
    if (!entities[Number(id)]._alive) {
      toRemove.push(Number(id));
    }
  }
  for (const id of toRemove) {
    delete entities[id];
  }
}

// ---------------------------------------------------------------------------
// Serialization
// ---------------------------------------------------------------------------

/** 序列化所有实体 */
export function serialize(): SerializedData {
  const data: SerializedData = {
    entities: {},
    nextId: entityIdCounter,
  };

  for (const entity of Object.values(entities)) {
    if (entity._alive) {
      data.entities[String(entity.id)] = {
        id: entity.id,
        components: entity.components,
        tags: entity.tags,
      };
    }
  }

  return data;
}

/** 反序列化实体 */
export function deserialize(data: SerializedData): void {
  clearEntities();

  entityIdCounter = data.nextId ?? 0;

  for (const entityData of Object.values(data.entities ?? {})) {
    const entity = new Entity(entityData.id);
    entity.components = entityData.components ?? {};
    entity.tags = entityData.tags ?? {};
    entity._alive = true;
    entities[entity.id] = entity;
  }

  _invalidateCache();
}

// ---------------------------------------------------------------------------
// Reset
// ---------------------------------------------------------------------------

/** 重置 ECS(清除所有实体、组件定义和系统) */
export function reset(): void {
  entities = {};
  entityIdCounter = 0;
  componentRegistry = {};
  systemRegistry = {};
  systemEntityCache = {};
  cacheValid = {};
}

/** 仅清除运行时数据(保留定义) */
export function clearRuntime(): void {
  entities = {};
  entityIdCounter = 0;
  systemEntityCache = {};
  cacheValid = {};
}

/**
 * ECS 聚合对象:保持 "ECS.xxx" 的调用习惯,
 * 也支持直接具名导入单个函数。
 */
export const ECS = {
  defineComponent,
  getComponent,
  hasComponent,
  createEntity,
  getEntity,
  destroyEntity,
  getAllEntities,
  clearEntities,
  defineSystem,
  getSystem,
  setSystemPriority,
  setSystemEnabled,
  setSystemCallback,
  query,
  queryByTag,
  each,
  reduce,
  count,
  update,
  updateSystem,
  serialize,
  deserialize,
  reset,
  clearRuntime,
};

export type { Entity, ComponentDefinition, System, SerializedEntity, SerializedData };
