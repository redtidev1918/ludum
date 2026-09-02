// stateSprite.ts - 状态驱动精灵系统
// 移植自 state_sprite.lua。剔除 LÖVE 渲染:图像加载/绘制退化为"纹理键记录"与空操作,
// 状态/条件/过渡/临时状态/缓动逻辑原样保留,渲染交由 Phaser 上层负责。

export type EasingFunction = (t: number) => number;

export interface StateSpriteState {
  sprite?: string;
  priority?: number;
  offset?: { x: number; y: number };
  scale?: { x: number; y: number };
  rotation?: number;
  color?: number[];
}

export interface StateSpriteCondition {
  state: string;
  when: (ctx: Record<string, any>) => boolean;
  priority?: number;
}

export interface StateSpriteTransition {
  duration?: number;
  easing?: string | EasingFunction;
}

export interface StateSpriteConfig {
  states: Record<string, StateSpriteState>;
  conditions?: StateSpriteCondition[];
  transitions?: Record<string, StateSpriteTransition>;
  defaultState?: string;
}

export interface StateSpriteDrawOptions {
  scale?: { x?: number; y?: number } | number;
  rotation?: number;
  color?: number[];
}

// 缓动函数表(Lua 幂运算符 ^ 移植为 ** / Math.pow)
export const Easing = {
  linear: (t: number) => t,
  inQuad: (t: number) => t * t,
  outQuad: (t: number) => t * (2 - t),
  inOutQuad: (t: number) => {
    if (t < 0.5) return 2 * t * t;
    return -1 + (4 - 2 * t) * t;
  },
  inCubic: (t: number) => t * t * t,
  outCubic: (t: number) => 1 + (t - 1) ** 3,
  inOutCubic: (t: number) => {
    if (t < 0.5) return 4 * t * t * t;
    return 1 + (t - 1) ** 3 * 4;
  },
  inElastic: (t: number) => {
    if (t === 0 || t === 1) return t;
    return -Math.pow(2, 10 * (t - 1)) * Math.sin((t - 1.1) * 5 * Math.PI);
  },
  outElastic: (t: number) => {
    if (t === 0 || t === 1) return t;
    return Math.pow(2, -10 * t) * Math.sin((t - 0.1) * 5 * Math.PI) + 1;
  },
  outBounce: (t: number) => {
    if (t < 1 / 2.75) {
      return 7.5625 * t * t;
    } else if (t < 2 / 2.75) {
      t = t - 1.5 / 2.75;
      return 7.5625 * t * t + 0.75;
    } else if (t < 2.5 / 2.75) {
      t = t - 2.25 / 2.75;
      return 7.5625 * t * t + 0.9375;
    } else {
      t = t - 2.625 / 2.75;
      return 7.5625 * t * t + 0.984375;
    }
  },
};

// 获取缓动函数(支持函数或名字)
function getEasing(name: string | EasingFunction): EasingFunction {
  if (typeof name === "function") return name;
  return (Easing as Record<string, EasingFunction>)[name] ?? Easing.linear;
}

export class StateSprite {
  static Easing: typeof Easing;
  static LayeredStateSprite: typeof LayeredStateSprite;

  states: Record<string, StateSpriteState>;
  conditions: StateSpriteCondition[];
  transitions: Record<string, StateSpriteTransition>;
  defaultTransition: StateSpriteTransition;
  currentState: string | null;
  previousState: string | null;
  context: Record<string, any>;
  transitionProgress: number;
  transitionDuration: number;
  transitionEasing: EasingFunction;
  temporaryState: string | null;
  temporaryDuration: number;
  images: Record<string, string>;
  listeners: { stateChange: Array<(oldState: string, newState: string) => void> };

  constructor(config: StateSpriteConfig) {
    this.states = config.states ?? {};
    this.conditions = config.conditions ?? [];
    this.transitions = config.transitions ?? {};
    this.defaultTransition = { duration: 0.3, easing: "outQuad" };

    // 设置默认状态
    this.currentState = config.defaultState ?? null;
    if (this.currentState == null) {
      for (const name of Object.keys(this.states)) {
        this.currentState = name;
        break;
      }
    }

    this.previousState = null;
    this.context = {};
    this.transitionProgress = 1.0; // 1.0 = 过渡完成
    this.transitionDuration = 0;
    this.transitionEasing = Easing.linear;

    this.temporaryState = null;
    this.temporaryDuration = 0;

    this.images = {};
    this.listeners = { stateChange: [] };

    // 排序条件(按优先级降序)
    this.conditions.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
  }

  /** 记录状态对应的纹理键(原 LÖVE 版加载图像,TS 版仅存键字符串) */
  loadImage(stateName: string, imagePath: string): this {
    this.images[stateName] = imagePath;
    return this;
  }

  /** 预加载:把 states 中 sprite 为 string 的映射写入 images */
  preloadImages(): this {
    for (const name of Object.keys(this.states)) {
      const sprite = this.states[name].sprite;
      if (typeof sprite === "string") {
        this.images[name] = sprite;
      }
    }
    return this;
  }

  /** 更新上下文(用于条件判断),合并而非替换 */
  updateContext(ctx: Record<string, any>): this {
    for (const k of Object.keys(ctx)) {
      this.context[k] = ctx[k];
    }
    this._evaluateConditions();
    return this;
  }

  /** 设置上下文(替换) */
  setContext(ctx: Record<string, any>): this {
    this.context = ctx;
    this._evaluateConditions();
    return this;
  }

  /** 手动设置状态;options.duration 存在时为临时状态 */
  setState(stateName: string, options?: { duration?: number }): this {
    if (!this.states[stateName]) {
      return this;
    }

    options = options ?? {};

    if (options.duration != null) {
      // 临时状态
      this.temporaryState = stateName;
      this.temporaryDuration = options.duration;
    } else {
      // 永久切换
      this._transitionTo(stateName);
    }

    return this;
  }

  /** 获取当前状态名 */
  getState(): string | null {
    if (this.temporaryState != null) {
      return this.temporaryState;
    }
    return this.currentState;
  }

  /** 获取当前状态数据 */
  getStateData(): StateSpriteState | undefined {
    const stateName = this.getState();
    return stateName != null ? this.states[stateName] : undefined;
  }

  /** 是否在过渡中 */
  isTransitioning(): boolean {
    return this.transitionProgress < 1.0;
  }

  /** 更新(每帧调用) */
  update(dt: number): this {
    // 更新临时状态
    if (this.temporaryState != null) {
      this.temporaryDuration -= dt;
      if (this.temporaryDuration <= 0) {
        this.temporaryState = null;
        this.temporaryDuration = 0;
      }
    }

    // 更新过渡
    if (this.transitionProgress < 1.0) {
      this.transitionProgress += dt / this.transitionDuration;
      if (this.transitionProgress >= 1.0) {
        this.transitionProgress = 1.0;
        this.previousState = null;
      }
    }

    return this;
  }

  /** 绘制:无 LÖVE 环境,渲染由 Phaser 上层负责,保留空操作以兼容原 API。 */
  draw(_x: number, _y: number, _options?: StateSpriteDrawOptions): void {
    // 空操作
  }

  /** 注册状态变化监听器 */
  onStateChange(callback: (oldState: string, newState: string) => void): this {
    this.listeners.stateChange.push(callback);
    return this;
  }

  /** @private 切换到新状态并触发监听器 */
  _transitionTo(newState: string): void {
    if (newState === this.currentState) {
      return;
    }

    const oldState = this.currentState as string;
    this.previousState = oldState;
    this.currentState = newState;

    // 获取过渡配置
    const transKey = oldState + "->" + newState;
    const trans =
      this.transitions[transKey] ?? this.transitions.default ?? this.defaultTransition;

    this.transitionDuration = trans.duration ?? 0.3;
    this.transitionEasing = getEasing(trans.easing ?? "outQuad");
    this.transitionProgress = 0;

    if (this.transitionDuration <= 0) {
      this.transitionProgress = 1.0;
      this.previousState = null;
    }

    // 触发监听器
    for (const callback of this.listeners.stateChange) {
      callback(oldState, newState);
    }
  }

  /** @private 按优先级检查条件 */
  _evaluateConditions(): void {
    for (const cond of this.conditions) {
      if (cond.when(this.context)) {
        if (this.states[cond.state]) {
          // Lua 原实现还计算了 currentPriority/newPriority 但未真正用于分支判断,
          // 此处仅保留"状态不同即切换"的行为。
          if (cond.state !== this.currentState) {
            this._transitionTo(cond.state);
          }
        }
        return;
      }
    }
  }

  /** 添加状态 */
  addState(name: string, state: StateSpriteState): this {
    this.states[name] = state;
    return this;
  }

  /** 添加条件(并重新按优先级排序) */
  addCondition(condition: StateSpriteCondition): this {
    this.conditions.push(condition);
    this.conditions.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
    return this;
  }

  /** 设置过渡 */
  setTransition(key: string, transition: StateSpriteTransition): this {
    this.transitions[key] = transition;
    return this;
  }
}

export interface LayeredStateSpriteLayerConfig {
  name: string;
  z?: number;
  offset?: { x: number; y: number };
  scale?: { x: number; y: number };
  color?: number[];
}

export interface LayeredStateSpriteLayer {
  name: string;
  z: number;
  states: Record<string, string>;
  currentState: string | null;
  visible: boolean;
  offset?: { x: number; y: number };
  scale?: { x: number; y: number };
  color?: number[];
}

export interface LayeredStateSpriteCondition {
  layer: string;
  state: string;
  when: (ctx: Record<string, any>) => boolean;
  priority: number;
}

export interface LayeredStateSpriteConfig {
  layers?: LayeredStateSpriteLayerConfig[];
  layerStates?: Record<string, Record<string, string>>;
}

export class LayeredStateSprite {
  layers: LayeredStateSpriteLayer[];
  layersByName: Record<string, LayeredStateSpriteLayer>;
  images: Record<string, Record<string, string>>;
  context: Record<string, any>;
  conditions: LayeredStateSpriteCondition[];

  constructor(config: LayeredStateSpriteConfig) {
    this.layers = [];
    this.layersByName = {};
    this.images = {};
    this.context = {};
    this.conditions = [];

    // 初始化层
    for (const layerConfig of config.layers ?? []) {
      const layer: LayeredStateSpriteLayer = {
        name: layerConfig.name,
        z: layerConfig.z ?? 0,
        states: {},
        currentState: null,
        visible: true,
        offset: layerConfig.offset,
        scale: layerConfig.scale,
        color: layerConfig.color,
      };
      this.layers.push(layer);
      this.layersByName[layer.name] = layer;
      this.images[layer.name] = {};
    }

    // 按 z 升序排序
    this.layers.sort((a, b) => a.z - b.z);

    // 设置层状态
    if (config.layerStates != null) {
      for (const [layerName, states] of Object.entries(config.layerStates)) {
        const layer = this.layersByName[layerName];
        if (layer) {
          layer.states = states;
          // 设置默认状态(取第一个)
          for (const stateName of Object.keys(states)) {
            layer.currentState = stateName;
            break;
          }
        }
      }
    }
  }

  /** 设置层状态 */
  setLayerState(layerName: string, stateName: string): this {
    const layer = this.layersByName[layerName];
    if (layer && layer.states[stateName]) {
      layer.currentState = stateName;
    }
    return this;
  }

  /** 获取层状态 */
  getLayerState(layerName: string): string | null {
    const layer = this.layersByName[layerName];
    return layer ? layer.currentState : null;
  }

  /** 设置层可见性 */
  setLayerVisible(layerName: string, visible: boolean): this {
    const layer = this.layersByName[layerName];
    if (layer) {
      layer.visible = visible;
    }
    return this;
  }

  /** 记录层图像纹理键(原 LÖVE 版加载图像,TS 版仅存键字符串) */
  loadImage(layerName: string, stateName: string, imagePath: string): this {
    if (!this.images[layerName]) {
      this.images[layerName] = {};
    }
    this.images[layerName][stateName] = imagePath;
    return this;
  }

  /** 预加载所有层图像(字符串纹理键) */
  preloadImages(): this {
    for (const layer of this.layers) {
      for (const stateName of Object.keys(layer.states)) {
        const sprite = layer.states[stateName];
        if (typeof sprite === "string") {
          this.loadImage(layer.name, stateName, sprite);
        }
      }
    }
    return this;
  }

  /** 更新(层动画等可扩展点) */
  update(_dt: number): this {
    return this;
  }

  /** 绘制:无 LÖVE 环境,渲染由 Phaser 上层负责,保留空操作以兼容原 API。 */
  draw(_x: number, _y: number, _options?: StateSpriteDrawOptions): void {
    // 空操作
  }

  /** 添加层条件 */
  addCondition(
    layerName: string,
    condition: { state: string; when: (ctx: Record<string, any>) => boolean; priority?: number },
  ): this {
    this.conditions.push({
      layer: layerName,
      state: condition.state,
      when: condition.when,
      priority: condition.priority ?? 0,
    });
    return this;
  }

  /** 更新上下文并评估条件 */
  updateContext(ctx: Record<string, any>): this {
    for (const k of Object.keys(ctx)) {
      this.context[k] = ctx[k];
    }

    for (const cond of this.conditions) {
      if (cond.when(this.context)) {
        this.setLayerState(cond.layer, cond.state);
      }
    }

    return this;
  }
}

// 兼容挂载(与 Lua 的 StateSprite.Easing / StateSprite.LayeredStateSprite 一致)
StateSprite.Easing = Easing;
StateSprite.LayeredStateSprite = LayeredStateSprite;
