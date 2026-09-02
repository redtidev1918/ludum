// src/gamelib/dialogue.ts
// Conditional Dialogue System —— 从 dialogue.lua 移植
// 对话库(条件/冷却/变量插值/历史/随机) + 对话树(节点/选择/事件)。

export type DialogueContext = Record<string, any>;
export type ConditionMap = Record<string, any>;

export interface DialogueEntry {
  id: string;             // 对话唯一标识
  text: string;           // 对话文本
  conditions?: ConditionMap; // 触发条件
  priority?: number;      // 优先级
  cooldown?: number;      // 冷却时间(秒)
  tags?: string[];        // 标签
  speaker?: string;       // 说话者
}

export interface DialogueLibraryConfig {
  entries?: DialogueEntry[];
  variables?: Record<string, (context: DialogueContext) => any>;
}

export interface DialogueChoice {
  text: string;
  next?: string;
  action?: (context: DialogueContext, tree: DialogueTree) => void;
  conditions?: ConditionMap;
  disabled?: boolean;
}

export interface DialogueTreeNode {
  id?: string;
  text: string;
  speaker?: string;
  choices?: DialogueChoice[];
  next?: string;
  action?: (context: DialogueContext, tree: DialogueTree) => void;
  conditions?: ConditionMap;
}

export interface DialogueTreeConfig {
  nodes?: Record<string, DialogueTreeNode>;
}

// Lua 中仅 nil/false 为假(0、空串均为真)
function luaTruthy(v: unknown): boolean {
  return v !== null && v !== undefined && v !== false;
}

// os.time() 返回秒,Date.now() 返回毫秒;冷却/历史单位为秒,这里换算保持语义一致
function osTime(): number {
  return Math.floor(Date.now() / 1000);
}

export class DialogueLibrary {
  entries: DialogueEntry[];
  variables: Record<string, (context: DialogueContext) => any>;
  cooldowns: Record<string, number>;
  history: { id: string; time: number; context: DialogueContext }[];

  constructor(config: DialogueLibraryConfig) {
    this.entries = [];
    this.variables = config.variables ?? {};
    this.cooldowns = {};
    this.history = [];

    for (const entry of config.entries ?? []) {
      this.addEntry(entry);
    }
  }

  /** 添加对话条目(按优先级降序排序) */
  addEntry(entry: DialogueEntry): this {
    entry.priority = entry.priority ?? 0;
    entry.conditions = entry.conditions ?? {};
    this.entries.push(entry);
    this.entries.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
    return this;
  }

  /** 移除对话条目 */
  removeEntry(id: string): this {
    for (let i = this.entries.length - 1; i >= 0; i--) {
      if (this.entries[i].id === id) {
        this.entries.splice(i, 1);
      }
    }
    return this;
  }

  /** 检查条件是否满足(表匹配/比较符字符串/range/函数等) */
  _checkConditions(conditions: ConditionMap, context: DialogueContext): boolean {
    for (const key of Object.keys(conditions)) {
      const actual = context[key];
      const expected = conditions[key];

      if (Array.isArray(expected)) {
        // 比较操作符: {">", 100}, {"<", 50}, {">=", 10}, {"<=", 20}, {"==", "value"}, {"~=", "value"}
        const op = expected[0];
        const value = expected[1];

        if (op === '>') {
          if (!(luaTruthy(actual) && (actual as number) > (value as number))) return false;
        } else if (op === '<') {
          if (!(luaTruthy(actual) && (actual as number) < (value as number))) return false;
        } else if (op === '>=') {
          if (!(luaTruthy(actual) && (actual as number) >= (value as number))) return false;
        } else if (op === '<=') {
          if (!(luaTruthy(actual) && (actual as number) <= (value as number))) return false;
        } else if (op === '==') {
          if (actual !== value) return false;
        } else if (op === '~=') {
          if (actual === value) return false;
        } else if (op === 'in') {
          // 检查值是否在列表中
          let found = false;
          for (const v of value as unknown[]) {
            if (actual === v) { found = true; break; }
          }
          if (!found) return false;
        } else if (op === 'between') {
          // 范围检查: {"between", {10, 50}}
          const range = value as unknown[];
          if (!(luaTruthy(actual) && (actual as number) >= (range[0] as number) && (actual as number) <= (range[1] as number))) return false;
        }
      } else if (typeof expected === 'function') {
        // 自定义条件函数
        if (!expected(actual, context)) return false;
      } else {
        // 简单相等检查
        if (actual !== expected) return false;
      }
    }
    return true;
  }

  /** 检查冷却是否已结束 */
  _checkCooldown(id: string): boolean {
    const cooldownEnd = this.cooldowns[id];
    if (cooldownEnd != null && osTime() < cooldownEnd) {
      return false;
    }
    return true;
  }

  /** 设置冷却 */
  _setCooldown(id: string, duration?: number): void {
    if (duration != null && duration > 0) {
      this.cooldowns[id] = osTime() + duration;
    }
  }

  /** 查询单个匹配的对话(按优先级) */
  query(context: DialogueContext, options?: { tags?: string[]; speaker?: string; limit?: number }): DialogueEntry | null {
    options = options ?? {};

    for (const entry of this.entries) {
      // 标签过滤
      if (options.tags != null) {
        let hasTag = false;
        for (const tag of entry.tags ?? []) {
          for (const filterTag of options.tags) {
            if (tag === filterTag) { hasTag = true; break; }
          }
          if (hasTag) break;
        }
        if (!hasTag) continue;
      }

      // 说话者过滤
      if (options.speaker != null && entry.speaker !== options.speaker) {
        continue;
      }

      // 冷却
      if (!this._checkCooldown(entry.id)) {
        continue;
      }

      // 条件
      if (this._checkConditions(entry.conditions ?? {}, context)) {
        return entry;
      }
    }
    return null;
  }

  /** 查询所有匹配的对话 */
  queryAll(context: DialogueContext, options?: { tags?: string[]; speaker?: string; limit?: number }): DialogueEntry[] {
    options = options ?? {};
    const results: DialogueEntry[] = [];
    const limit = options.limit ?? 100;

    for (const entry of this.entries) {
      if (results.length >= limit) break;

      // 标签过滤
      if (options.tags != null) {
        let hasTag = false;
        for (const tag of entry.tags ?? []) {
          for (const filterTag of options.tags) {
            if (tag === filterTag) { hasTag = true; break; }
          }
          if (hasTag) break;
        }
        if (!hasTag) continue;
      }

      // 说话者过滤
      if (options.speaker != null && entry.speaker !== options.speaker) {
        continue;
      }

      // 冷却
      if (!this._checkCooldown(entry.id)) {
        continue;
      }

      // 条件
      if (this._checkConditions(entry.conditions ?? {}, context)) {
        results.push(entry);
      }
    }
    return results;
  }

  /** 获取对话并应用冷却 */
  get(context: DialogueContext, options?: { tags?: string[]; speaker?: string; limit?: number }): [DialogueEntry | null, string | null] {
    const entry = this.query(context, options);
    if (!entry) {
      return [null, null];
    }

    this._setCooldown(entry.id, entry.cooldown);
    this.history.push({
      id: entry.id,
      time: osTime(),
      context: context,
    });
    const text = this.format(entry, context);
    return [entry, text];
  }

  /** 格式化对话文本({变量} 插值) */
  format(entry: DialogueEntry, context: DialogueContext): string {
    let text = entry.text;

    text = text.replace(/\{(\w+)\}/g, (_match, varName: string) => {
      if (this.variables[varName]) {
        return String(this.variables[varName](context));
      }
      if (context[varName] != null) {
        return String(context[varName]);
      }
      return '{' + varName + '}';
    });

    return text;
  }

  /** 添加变量插值函数 */
  addVariable(name: string, fn: (context: DialogueContext) => any): this {
    this.variables[name] = fn;
    return this;
  }

  /** 获取历史记录 */
  getHistory(limit?: number): { id: string; time: number; context: DialogueContext }[] {
    limit = limit ?? 10;
    const n = this.history.length;
    const start = Math.max(0, n - limit);
    return this.history.slice(start);
  }

  /** 清除冷却(id 为 nil 时清除全部) */
  clearCooldown(id?: string): this {
    if (id != null) {
      delete this.cooldowns[id];
    } else {
      this.cooldowns = {};
    }
    return this;
  }

  /** 随机获取一个匹配的对话 */
  getRandom(context: DialogueContext, options?: { tags?: string[]; speaker?: string; limit?: number }): [DialogueEntry | null, string | null] {
    const matches = this.queryAll(context, options);
    if (matches.length === 0) {
      return [null, null];
    }

    const entry = matches[Math.floor(Math.random() * matches.length)];

    this._setCooldown(entry.id, entry.cooldown);
    this.history.push({
      id: entry.id,
      time: osTime(),
      context: context,
    });

    return [entry, this.format(entry, context)];
  }
}

export class DialogueTree {
  nodes: Record<string, DialogueTreeNode>;
  currentNode: string | null;
  context: DialogueContext;
  history: { nodeId: string; time: number }[];
  listeners: Record<string, ((...args: any[]) => void)[]>;

  constructor(config: DialogueTreeConfig) {
    this.nodes = config.nodes ?? {};
    this.currentNode = null;
    this.context = {};
    this.history = [];
    this.listeners = {
      nodeEnter: [],
      nodeExit: [],
      choiceMade: [],
      treeEnd: [],
    };
  }

  /** 开始对话(起始节点默认 "start") */
  start(startNode?: string, context?: DialogueContext): this {
    this.currentNode = startNode ?? 'start';
    this.context = context ?? {};
    this.history = [];
    this._enterNode(this.currentNode);
    return this;
  }

  /** 获取当前节点 */
  getCurrentNode(): DialogueTreeNode | null {
    if (this.currentNode == null) {
      return null;
    }
    return this.nodes[this.currentNode];
  }

  /** 获取当前文本 */
  getText(): string | null {
    const node = this.getCurrentNode();
    return node ? node.text : null;
  }

  /** 获取当前选项(过滤条件不满足的) */
  getChoices(): { index: number; text: string; disabled?: boolean }[] | null {
    const node = this.getCurrentNode();
    if (!node || !node.choices) {
      return null;
    }

    const available: { index: number; text: string; disabled?: boolean }[] = [];
    for (let i = 0; i < node.choices.length; i++) {
      const choice = node.choices[i];
      if (!choice.conditions || this._checkConditions(choice.conditions)) {
        available.push({
          index: i + 1,
          text: choice.text,
          disabled: choice.disabled,
        });
      }
    }
    return available;
  }

  /** 选择选项(choiceIndex 从 1 开始) */
  choose(choiceIndex: number): boolean {
    const node = this.getCurrentNode();
    if (!node || !node.choices) {
      return false;
    }

    const choice = node.choices[choiceIndex - 1];
    if (!choice) {
      return false;
    }

    if (choice.conditions && !this._checkConditions(choice.conditions)) {
      return false;
    }

    this._emit('choiceMade', choiceIndex, choice);

    if (choice.action) {
      choice.action(this.context, this);
    }

    const nextNode = choice.next;
    if (nextNode) {
      this._exitNode(this.currentNode!);
      this._enterNode(nextNode);
    } else {
      this._end();
    }

    return true;
  }

  /** 继续(无选项时) */
  continue(): boolean {
    const node = this.getCurrentNode();
    if (!node) {
      return false;
    }

    // 有选项时不能直接继续
    if (node.choices && node.choices.length > 0) {
      return false;
    }

    if (node.action) {
      node.action(this.context, this);
    }

    if (node.next) {
      this._exitNode(this.currentNode!);
      this._enterNode(node.next);
      return true;
    } else {
      this._end();
      return false;
    }
  }

  /** 检查对话是否结束 */
  isEnded(): boolean {
    return this.currentNode == null;
  }

  /** 设置上下文 */
  setContext(key: string, value: any): this {
    this.context[key] = value;
    return this;
  }

  /** 获取上下文 */
  getContext(key: string): any {
    return this.context[key];
  }

  /** 注册事件监听器 */
  on(event: string, callback: (...args: any[]) => void): this {
    if (this.listeners[event]) {
      this.listeners[event].push(callback);
    }
    return this;
  }

  /** @private 分发事件 */
  _emit(event: string, ...args: any[]): void {
    for (const callback of this.listeners[event] ?? []) {
      callback(...args);
    }
  }

  /** @private 检查条件(使用 self.context) */
  _checkConditions(conditions: ConditionMap): boolean {
    for (const key of Object.keys(conditions)) {
      const actual = this.context[key];
      const expected = conditions[key];

      if (Array.isArray(expected)) {
        const op = expected[0];
        const value = expected[1];
        if (op === '>' && !(luaTruthy(actual) && (actual as number) > (value as number))) return false;
        if (op === '<' && !(luaTruthy(actual) && (actual as number) < (value as number))) return false;
        if (op === '>=' && !(luaTruthy(actual) && (actual as number) >= (value as number))) return false;
        if (op === '<=' && !(luaTruthy(actual) && (actual as number) <= (value as number))) return false;
        if (op === '==' && actual !== value) return false;
        if (op === '~=' && actual === value) return false;
      } else {
        if (actual !== expected) return false;
      }
    }
    return true;
  }

  /** @private 进入节点 */
  _enterNode(nodeId: string): void {
    this.currentNode = nodeId;
    const node = this.nodes[nodeId];

    if (node) {
      this.history.push({
        nodeId: nodeId,
        time: osTime(),
      });
      this._emit('nodeEnter', nodeId, node);
    } else {
      // 节点不存在,结束对话
      this._end();
    }
  }

  /** @private 退出节点 */
  _exitNode(nodeId: string): void {
    this._emit('nodeExit', nodeId, this.nodes[nodeId]);
  }

  /** @private 结束对话 */
  _end(): void {
    this.currentNode = null;
    this._emit('treeEnd', this.history);
  }

  /** 跳转到指定节点 */
  goTo(nodeId: string): this {
    if (this.currentNode != null) {
      this._exitNode(this.currentNode);
    }
    this._enterNode(nodeId);
    return this;
  }

  /** 添加节点 */
  addNode(id: string, node: DialogueTreeNode): this {
    node.id = id;
    this.nodes[id] = node;
    return this;
  }
}

/** 工厂:创建对话库(兼容 Lua Dialogue.newLibrary) */
export function newLibrary(config: DialogueLibraryConfig): DialogueLibrary {
  return new DialogueLibrary(config);
}

/** 工厂:创建对话树(兼容 Lua Dialogue.newTree) */
export function newTree(config: DialogueTreeConfig): DialogueTree {
  return new DialogueTree(config);
}
