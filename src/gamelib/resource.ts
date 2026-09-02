/**
 * Resource System - 资源/数值系统
 *
 * 从 Lua resource.lua 移植。提供三种数值容器:
 *  - Resource 基础资源(带修改器/阈值/监听器/序列化)
 *  - DerivedResource 派生资源(依赖其他资源按公式计算)
 *  - ResourceManager 资源管理器(注册/批量更新/批量序列化)
 *
 * 零运行时依赖,纯 TypeScript。
 */

/** 修改器类型 */
export type ModifierType = "flat" | "percent" | "decay" | "regen";

/** 修改器 */
export interface ResourceModifier {
  /** 修改器唯一标识(缺省时自动生成) */
  id?: string;
  /** 修改器类型 */
  type: ModifierType;
  /** 修改值 */
  value: number;
  /** 持续时间(秒),缺省表示永久 */
  duration?: number;
  /** 已经过时间(addModifier 时归零) */
  elapsed?: number;
  /** 优先级(越高越先应用) */
  priority?: number;
}

/** 基础资源配置 */
export interface ResourceConfig {
  id?: string;
  value?: number;
  min?: number;
  max?: number;
  regen?: number;
  decay?: number;
}

/** 阈值监听方向 */
export type ThresholdDirection = "above" | "below" | "equal" | "cross";

/** 阈值条目 */
interface ThresholdEntry {
  value: number;
  direction: ThresholdDirection;
  callback: (oldValue: number, newValue: number) => void;
  lastTriggered: boolean;
}

/** 序列化后的基础资源数据 */
export interface SerializedResource {
  id: string;
  value: number;
  min: number;
  max: number;
  baseRegen: number;
  baseDecay: number;
  modifiers: Record<string, ResourceModifier>;
}

/** 派生资源配置 */
export interface DerivedResourceConfig {
  id?: string;
  dependencies?: Record<string, Resource | number>;
  formula: (deps: Record<string, number>) => number;
  min?: number;
  max?: number;
}

/**
 * 基础资源:持有 value,带修改器(modifiers)、阈值(thresholds)与监听器(listeners)。
 */
export class Resource {
  id: string;
  value: number;
  min: number;
  max: number;
  baseRegen: number;
  baseDecay: number;
  modifiers: Record<string, ResourceModifier> = {};
  thresholds: ThresholdEntry[] = [];
  listeners: {
    change: ((oldValue: number, newValue: number) => void)[];
    min: (() => void)[];
    max: (() => void)[];
  };

  /** Lua 兼容:Resource.DerivedResource / Resource.ResourceManager */
  static DerivedResource: typeof DerivedResource;
  static ResourceManager: typeof ResourceManager;

  constructor(config: ResourceConfig = {}) {
    this.id = config.id ?? "unnamed";
    this.value = config.value ?? 0;
    this.min = config.min ?? 0;
    this.max = config.max ?? 100;
    this.baseRegen = config.regen ?? 0;
    this.baseDecay = config.decay ?? 0;
    this.modifiers = {};
    this.thresholds = [];
    this.listeners = {
      change: [],
      min: [],
      max: [],
    };

    // 确保初始值在范围内
    this.value = Math.max(this.min, Math.min(this.max, this.value));
  }

  /** 获取当前值 */
  get(): number {
    return this.value;
  }

  /** 获取百分比 (0-1) */
  getPercent(): number {
    if (this.max === this.min) {
      return 1;
    }
    return (this.value - this.min) / (this.max - this.min);
  }

  /** 设置值(钳制到 min/max) */
  set(newValue: number): this {
    const oldValue = this.value;
    this.value = Math.max(this.min, Math.min(this.max, newValue));

    if (oldValue !== this.value) {
      this._notifyChange(oldValue, this.value);
      this._checkThresholds(oldValue, this.value);
    }

    return this;
  }

  /** 增加值 */
  add(amount: number): this {
    return this.set(this.value + amount);
  }

  /** 减少值 */
  subtract(amount: number): this {
    return this.set(this.value - amount);
  }

  /** 设置最大值 */
  setMax(newMax: number): this {
    this.max = newMax;
    if (this.value > this.max) {
      this.set(this.max);
    }
    return this;
  }

  /** 设置最小值 */
  setMin(newMin: number): this {
    this.min = newMin;
    if (this.value < this.min) {
      this.set(this.min);
    }
    return this;
  }

  /** 添加修改器 */
  addModifier(modifier: ResourceModifier): this {
    if (modifier.id == null) {
      modifier.id = "mod_" + Date.now() + "_" + (Math.floor(Math.random() * 1000) + 1);
    }
    modifier.elapsed = 0;
    modifier.priority = modifier.priority ?? 0;
    this.modifiers[modifier.id] = modifier;
    return this;
  }

  /** 移除修改器 */
  removeModifier(modifierId: string): this {
    delete this.modifiers[modifierId];
    return this;
  }

  /** 检查是否有指定修改器 */
  hasModifier(modifierId: string): boolean {
    return this.modifiers[modifierId] != null;
  }

  /** 获取所有修改器 */
  getModifiers(): Record<string, ResourceModifier> {
    return this.modifiers;
  }

  /** 计算有效恢复率(基础 + 修改器) */
  getEffectiveRegen(): number {
    let regen = this.baseRegen;
    for (const mod of Object.values(this.modifiers)) {
      if (mod.type === "regen") {
        regen = regen + mod.value;
      }
    }
    return regen;
  }

  /** 计算有效衰减率(基础 + 修改器) */
  getEffectiveDecay(): number {
    let decay = this.baseDecay;
    for (const mod of Object.values(this.modifiers)) {
      if (mod.type === "decay") {
        decay = decay + mod.value;
      }
    }
    return decay;
  }

  /** 更新资源(每帧调用) */
  update(dt: number): this {
    // 更新修改器计时并移除过期的
    const toRemove: string[] = [];
    for (const id of Object.keys(this.modifiers)) {
      const mod = this.modifiers[id];
      if (mod.duration != null) {
        mod.elapsed = (mod.elapsed ?? 0) + dt;
        if (mod.elapsed >= mod.duration) {
          toRemove.push(id);
        }
      }
    }
    for (const id of toRemove) {
      delete this.modifiers[id];
    }

    // 应用恢复和衰减
    const regen = this.getEffectiveRegen();
    const decay = this.getEffectiveDecay();
    const delta = (regen - decay) * dt;

    if (delta !== 0) {
      this.add(delta);
    }

    return this;
  }

  /** 注册阈值事件 */
  onThreshold(threshold: number, direction: ThresholdDirection, callback: (oldValue: number, newValue: number) => void): this {
    this.thresholds.push({
      value: threshold,
      direction: direction,
      callback: callback,
      lastTriggered: false,
    });
    return this;
  }

  /** 注册变化监听器 */
  onChange(callback: (oldValue: number, newValue: number) => void): this {
    this.listeners.change.push(callback);
    return this;
  }

  /** 注册到达最小值监听器 */
  onMin(callback: () => void): this {
    this.listeners.min.push(callback);
    return this;
  }

  /** 注册到达最大值监听器 */
  onMax(callback: () => void): this {
    this.listeners.max.push(callback);
    return this;
  }

  /** @private 通知变化与 min/max 监听器 */
  private _notifyChange(oldValue: number, newValue: number): void {
    for (const callback of this.listeners.change) {
      callback(oldValue, newValue);
    }

    if (newValue <= this.min) {
      for (const callback of this.listeners.min) {
        callback();
      }
    }

    if (newValue >= this.max) {
      for (const callback of this.listeners.max) {
        callback();
      }
    }
  }

  /** @private 检查阈值触发 */
  private _checkThresholds(oldValue: number, newValue: number): void {
    for (const t of this.thresholds) {
      let shouldTrigger = false;

      if (t.direction === "below") {
        shouldTrigger = oldValue >= t.value && newValue < t.value;
      } else if (t.direction === "above") {
        shouldTrigger = oldValue <= t.value && newValue > t.value;
      } else if (t.direction === "equal") {
        shouldTrigger = newValue === t.value && oldValue !== t.value;
      } else if (t.direction === "cross") {
        shouldTrigger =
          (oldValue < t.value && newValue >= t.value) ||
          (oldValue > t.value && newValue <= t.value);
      }

      if (shouldTrigger) {
        t.callback(oldValue, newValue);
      }
    }
  }

  /** 重置到初始状态 */
  reset(initialValue?: number): this {
    this.modifiers = {};
    this.value = initialValue ?? this.max;
    this.value = Math.max(this.min, Math.min(this.max, this.value));
    return this;
  }

  /** 序列化为表(用于存档) */
  serialize(): SerializedResource {
    return {
      id: this.id,
      value: this.value,
      min: this.min,
      max: this.max,
      baseRegen: this.baseRegen,
      baseDecay: this.baseDecay,
      modifiers: this.modifiers,
    };
  }

  /** 从表反序列化 */
  static deserialize(data: {
    id: string;
    value: number;
    min: number;
    max: number;
    baseRegen: number;
    baseDecay: number;
    modifiers?: Record<string, ResourceModifier>;
  }): Resource {
    const res = new Resource({
      id: data.id,
      value: data.value,
      min: data.min,
      max: data.max,
      regen: data.baseRegen,
      decay: data.baseDecay,
    });
    res.modifiers = data.modifiers ?? {};
    return res;
  }
}

/**
 * 派生资源:依赖其他资源按公式计算值。
 * 无 update/serialize(供 ResourceManager 鸭子判断)。
 */
export class DerivedResource {
  id: string;
  dependencies: Record<string, Resource | number>;
  formula: (deps: Record<string, number>) => number;
  min: number;
  max: number;
  cachedValue: number;
  listeners: {
    change: ((oldValue: number, newValue: number) => void)[];
  };

  constructor(config: DerivedResourceConfig) {
    this.id = config.id ?? "derived";
    this.dependencies = config.dependencies ?? {};
    this.formula = config.formula;
    this.min = config.min ?? -Infinity;
    this.max = config.max ?? Infinity;
    this.cachedValue = 0;
    this.listeners = {
      change: [],
    };
  }

  /** 获取当前值(重新计算) */
  get(): number {
    const deps: Record<string, number> = {};
    for (const name of Object.keys(this.dependencies)) {
      const resource = this.dependencies[name];
      if (resource !== null && typeof resource === "object" && typeof resource.get === "function") {
        deps[name] = resource.get();
      } else {
        deps[name] = resource as number;
      }
    }

    let newValue = this.formula(deps);
    newValue = Math.max(this.min, Math.min(this.max, newValue));

    if (newValue !== this.cachedValue) {
      const oldValue = this.cachedValue;
      this.cachedValue = newValue;
      for (const callback of this.listeners.change) {
        callback(oldValue, newValue);
      }
    }

    return this.cachedValue;
  }

  /** 获取百分比 */
  getPercent(): number {
    if (this.max === this.min) {
      return 1;
    }
    const value = this.get();
    return (value - this.min) / (this.max - this.min);
  }

  /** 更新依赖 */
  setDependency(name: string, resource: Resource | number): this {
    this.dependencies[name] = resource;
    return this;
  }

  /** 注册变化监听器 */
  onChange(callback: (oldValue: number, newValue: number) => void): this {
    this.listeners.change.push(callback);
    return this;
  }
}

/**
 * 资源管理器:注册/获取/批量更新/批量序列化资源。
 */
export class ResourceManager {
  resources: Record<string, Resource | DerivedResource>;

  constructor() {
    this.resources = {};
  }

  /** 注册资源 */
  register(resource: Resource | DerivedResource): this {
    this.resources[resource.id] = resource;
    return this;
  }

  /** 获取资源 */
  get(id: string): Resource | DerivedResource | undefined {
    return this.resources[id];
  }

  /** 更新所有资源(鸭子判断:仅含 update 方法者) */
  update(dt: number): this {
    for (const resource of Object.values(this.resources)) {
      if (typeof (resource as Partial<Resource>).update === "function") {
        (resource as Resource).update(dt);
      }
    }
    return this;
  }

  /** 序列化所有资源(鸭子判断:仅含 serialize 方法者) */
  serialize(): Record<string, SerializedResource> {
    const data: Record<string, SerializedResource> = {};
    for (const id of Object.keys(this.resources)) {
      const resource = this.resources[id];
      if (typeof (resource as Partial<Resource>).serialize === "function") {
        data[id] = (resource as Resource).serialize();
      }
    }
    return data;
  }

  /** 反序列化资源(仅更新含 value 字段的资源) */
  deserialize(data: Record<string, SerializedResource>): this {
    for (const id of Object.keys(data)) {
      const resData = data[id];
      const existing = this.resources[id];
      if (existing && (existing as Resource).value != null) {
        // 更新现有资源
        const res = existing as Resource;
        res.value = resData.value;
        res.min = resData.min;
        res.max = resData.max;
        res.baseRegen = resData.baseRegen;
        res.baseDecay = resData.baseDecay;
        res.modifiers = resData.modifiers ?? {};
      }
    }
    return this;
  }
}

// Lua 兼容:Resource.DerivedResource / Resource.ResourceManager
Resource.DerivedResource = DerivedResource;
Resource.ResourceManager = ResourceManager;
