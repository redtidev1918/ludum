// src/gamelib/weightedEvent.ts
// Weighted Event System —— 加权随机事件池
// 加权随机事件池:基础权重 + 修改器(multiply/add) + 保底(pity) + 历史/统计。

export type WeightedEventContext = Record<string, unknown>;

export interface WeightedEventItem {
  id: string;       // 事件唯一标识
  weight: number;   // 基础权重
  type?: string;    // 事件类型(用于过滤)
  data?: unknown;   // 附加数据
}

export interface WeightedEventModifier {
  condition: (ctx: WeightedEventContext) => boolean; // 条件函数
  filter?: Record<string, unknown>;                  // 过滤条件 {type = "positive"}
  multiply?: number;                                 // 权重乘数
  add?: number;                                      // 权重增量
}

export interface WeightedEventPity {
  threshold: number;                        // 保底触发次数
  guarantee?: Record<string, unknown>;      // 保底条件 {type = "positive"}
  reset?: boolean;                          // 触发后是否重置计数(保留字段,逻辑中未使用)
}

export interface WeightedEventPoolConfig {
  events: WeightedEventItem[];
  modifiers?: WeightedEventModifier[];
  pity?: WeightedEventPity;
}

export interface RollOptions {
  baseChance?: number;
  context?: WeightedEventContext;
  filter?: Record<string, unknown>;
}

interface EventStats {
  count: number;
  lastRoll: number;
}

interface HistoryEntry {
  id: string;
  roll: number;
  time: number;
}

// 检查事件是否匹配过滤器(逐 key 相等比较)
function matchesFilter(event: WeightedEventItem, filter?: Record<string, unknown>): boolean {
  if (!filter) return true;
  const record = event as unknown as Record<string, unknown>;
  for (const key of Object.keys(filter)) {
    if (record[key] !== filter[key]) return false;
  }
  return true;
}

export class WeightedEventPool {
  events: WeightedEventItem[];
  modifiers: WeightedEventModifier[];
  pity?: WeightedEventPity;
  history: HistoryEntry[];
  stats: Record<string, EventStats>;
  rollCount: number;
  lastTriggerRoll: number;

  constructor(config: WeightedEventPoolConfig) {
    this.events = [];
    for (const event of config.events ?? []) {
      this.events.push({
        id: event.id,
        weight: event.weight ?? 1,
        type: event.type,
        data: event.data,
      });
    }

    this.modifiers = config.modifiers ?? [];
    this.pity = config.pity;

    this.history = [];
    this.stats = {};
    this.rollCount = 0;
    this.lastTriggerRoll = 0;

    // 初始化统计
    for (const event of this.events) {
      this.stats[event.id] = { count: 0, lastRoll: 0 };
    }
  }

  // 添加事件
  addEvent(event: WeightedEventItem): WeightedEventPool {
    this.events.push({
      id: event.id,
      weight: event.weight ?? 1,
      type: event.type,
      data: event.data,
    });
    this.stats[event.id] = { count: 0, lastRoll: 0 };
    return this;
  }

  // 移除事件
  removeEvent(id: string): WeightedEventPool {
    for (let i = this.events.length - 1; i >= 0; i--) {
      if (this.events[i].id === id) {
        this.events.splice(i, 1);
      }
    }
    return this;
  }

  // 获取事件
  getEvent(id: string): WeightedEventItem | undefined {
    for (const event of this.events) {
      if (event.id === id) return event;
    }
    return undefined;
  }

  // 添加修改器
  addModifier(modifier: WeightedEventModifier): WeightedEventPool {
    this.modifiers.push(modifier);
    return this;
  }

  // 计算有效权重
  private _getEffectiveWeight(event: WeightedEventItem, context: WeightedEventContext): number {
    let weight = event.weight;

    for (const mod of this.modifiers) {
      // 检查条件
      if (mod.condition(context)) {
        // 检查过滤器
        if (matchesFilter(event, mod.filter)) {
          if (mod.multiply != null) {
            weight = weight * mod.multiply;
          }
          if (mod.add != null) {
            weight = weight + mod.add;
          }
        }
      }
    }

    return Math.max(0, weight);
  }

  // 检查保底
  private _checkPity(_context: WeightedEventContext): WeightedEventItem | undefined {
    if (!this.pity) return undefined;

    const rollsSinceLastTrigger = this.rollCount - this.lastTriggerRoll;

    if (rollsSinceLastTrigger >= this.pity.threshold) {
      // 找到符合保底条件的事件
      const candidates: WeightedEventItem[] = [];
      for (const event of this.events) {
        if (matchesFilter(event, this.pity.guarantee)) {
          candidates.push(event);
        }
      }

      if (candidates.length > 0) {
        return candidates[Math.floor(Math.random() * candidates.length)];
      }
    }

    return undefined;
  }

  // 执行一次抽取
  roll(options?: RollOptions): [boolean, WeightedEventItem | undefined] {
    options = options ?? {};
    const baseChance = options.baseChance ?? 1.0;
    const context = options.context ?? {};
    const filter = options.filter;

    this.rollCount = this.rollCount + 1;

    // 检查基础概率
    if (baseChance < 1.0 && Math.random() > baseChance) {
      return [false, undefined];
    }

    // 检查保底
    const pityEvent = this._checkPity(context);
    if (pityEvent) {
      this._recordTrigger(pityEvent);
      return [true, pityEvent];
    }

    // 收集候选事件和权重
    const candidates: { event: WeightedEventItem; weight: number }[] = [];
    let totalWeight = 0;

    for (const event of this.events) {
      // 应用过滤器
      if (matchesFilter(event, filter)) {
        const weight = this._getEffectiveWeight(event, context);
        if (weight > 0) {
          candidates.push({ event, weight });
          totalWeight = totalWeight + weight;
        }
      }
    }

    if (candidates.length === 0 || totalWeight <= 0) {
      return [false, undefined];
    }

    // 加权随机选择
    const roll = Math.random() * totalWeight;
    let cumulative = 0;

    for (const candidate of candidates) {
      cumulative = cumulative + candidate.weight;
      if (roll <= cumulative) {
        this._recordTrigger(candidate.event);
        return [true, candidate.event];
      }
    }

    // 兜底(理论上不会到这里)
    const lastEvent = candidates[candidates.length - 1].event;
    this._recordTrigger(lastEvent);
    return [true, lastEvent];
  }

  private _recordTrigger(event: WeightedEventItem): void {
    this.lastTriggerRoll = this.rollCount;

    // 更新统计
    if (this.stats[event.id]) {
      this.stats[event.id].count = this.stats[event.id].count + 1;
      this.stats[event.id].lastRoll = this.rollCount;
    }

    // 记录历史
    this.history.push({
      id: event.id,
      roll: this.rollCount,
      time: Date.now(),
    });

    // 限制历史长度
    while (this.history.length > 1000) {
      this.history.shift();
    }
  }

  // 获取历史记录
  getHistory(limit?: number): HistoryEntry[] {
    limit = limit ?? 10;
    const result: HistoryEntry[] = [];
    const start = Math.max(0, this.history.length - limit);
    for (let i = start; i < this.history.length; i++) {
      result.push(this.history[i]);
    }
    return result;
  }

  // 获取统计信息
  getStats(): {
    totalRolls: number;
    totalTriggers: number;
    events: Record<string, { count: number; rate: number; lastRoll: number }>;
  } {
    const result: {
      totalRolls: number;
      totalTriggers: number;
      events: Record<string, { count: number; rate: number; lastRoll: number }>;
    } = {
      totalRolls: this.rollCount,
      totalTriggers: this.history.length,
      events: {},
    };

    for (const id of Object.keys(this.stats)) {
      const stat = this.stats[id];
      result.events[id] = {
        count: stat.count,
        rate: this.rollCount > 0 ? stat.count / this.rollCount : 0,
        lastRoll: stat.lastRoll,
      };
    }

    return result;
  }

  // 重置统计
  resetStats(): WeightedEventPool {
    this.history = [];
    this.rollCount = 0;
    this.lastTriggerRoll = 0;
    for (const id of Object.keys(this.stats)) {
      this.stats[id] = { count: 0, lastRoll: 0 };
    }
    return this;
  }

  // 获取所有事件的当前权重
  getWeights(context?: WeightedEventContext): Record<string, number> {
    context = context ?? {};
    const result: Record<string, number> = {};
    for (const event of this.events) {
      result[event.id] = this._getEffectiveWeight(event, context);
    }
    return result;
  }

  // 获取事件概率
  getProbabilities(context?: WeightedEventContext, filter?: Record<string, unknown>): Record<string, number> {
    context = context ?? {};
    const weights: Record<string, number> = {};
    let totalWeight = 0;

    for (const event of this.events) {
      if (matchesFilter(event, filter)) {
        const weight = this._getEffectiveWeight(event, context);
        weights[event.id] = weight;
        totalWeight = totalWeight + weight;
      }
    }

    const result: Record<string, number> = {};
    for (const id of Object.keys(weights)) {
      result[id] = totalWeight > 0 ? weights[id] / totalWeight : 0;
    }

    return result;
  }

  // 模拟多次抽取
  simulate(count: number, options?: RollOptions): Record<string, number> {
    const results: Record<string, number> = {};
    const originalRollCount = this.rollCount;
    const originalLastTrigger = this.lastTriggerRoll;
    const originalHistory = this.history.length;

    for (let i = 0; i < count; i++) {
      const [triggered, event] = this.roll(options);
      if (triggered && event) {
        results[event.id] = (results[event.id] ?? 0) + 1;
      }
    }

    // 恢复状态(模拟不影响真实统计)
    this.rollCount = originalRollCount;
    this.lastTriggerRoll = originalLastTrigger;
    while (this.history.length > originalHistory) {
      this.history.pop();
    }

    return results;
  }

  // 序列化
  serialize(): {
    rollCount: number;
    lastTriggerRoll: number;
    stats: Record<string, EventStats>;
    history: HistoryEntry[];
  } {
    return {
      rollCount: this.rollCount,
      lastTriggerRoll: this.lastTriggerRoll,
      stats: this.stats,
      history: this.history,
    };
  }

  // 反序列化
  deserialize(data: {
    rollCount?: number;
    lastTriggerRoll?: number;
    stats?: Record<string, EventStats>;
    history?: HistoryEntry[];
  }): WeightedEventPool {
    this.rollCount = data.rollCount ?? 0;
    this.lastTriggerRoll = data.lastTriggerRoll ?? 0;
    this.stats = data.stats ?? {};
    this.history = data.history ?? [];
    return this;
  }
}

// 工厂函数(WeightedEvent.newPool)
export function newPool(config: WeightedEventPoolConfig): WeightedEventPool {
  return new WeightedEventPool(config);
}
