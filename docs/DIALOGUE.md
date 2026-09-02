# Dialogue —— 对话系统

> 源文件:`src/gamelib/dialogue.ts`(移植自 `dialogue.lua`)。分两部分:条件对话库(DialogueLibrary)与对话树(DialogueTree)。工厂 `newLibrary` / `newTree` 对应 Lua 的 `Dialogue.newLibrary` / `Dialogue.newTree`。

## 概述

- **DialogueLibrary**:带条件的对话条目集合,支持优先级、标签、说话者、冷却、`{var}` 插值、随机抽取与历史。
- **DialogueTree**:节点图(选项/动作/事件),驱动分支对话。

## 类型与配置接口

~~~ts
export type DialogueContext = Record<string, any>;
export type ConditionMap = Record<string, any>;

export interface DialogueEntry {
    id: string;
    text: string;
    conditions?: ConditionMap;
    priority?: number;   // 降序匹配
    cooldown?: number;   // 秒
    tags?: string[];
    speaker?: string;
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

export interface DialogueTreeConfig { nodes?: Record<string, DialogueTreeNode>; }
~~~

## 条件语法

条件是一个映射 `{ 键: 期望 }`,多条条件之间是 **AND**。期望值有三种写法:

| 写法 | 语义 |
|---|---|
| `{ key: value }` | 简单相等(`actual !== expected` 则失败) |
| `{ key: [op, operand] }` | 比较操作符(见下) |
| `{ key: (actual, context) => boolean }` | 自定义函数(仅 Library 支持) |

操作符 `op`:`'>'`、`'<'`、`'>='`、`'<='`、`'=='`、`'~='`、`'in'`(值在列表中)、`'between'`(值在 `[lo, hi]` 闭区间内)。

> 差异:Library 的 `_checkConditions` 支持**全部**操作符 + 函数 + `in`/`between`;而 DialogueTree 的 `_checkConditions` 只支持 `> < >= <= == ~=` 与简单相等(**不支持函数与 in/between**)。

> 真值语义:沿用 Lua —— 仅 `null`/`undefined`/`false` 为假,0、空串均为真(`luaTruthy`)。

## DialogueLibrary 方法

| 方法 | 签名 | 说明 |
|---|---|---|
| `addEntry` | `(entry: DialogueEntry): this` | 加条目并降序排序(缺省 priority=0、conditions={}) |
| `removeEntry` | `(id: string): this` | 按 id 移除 |
| `query` | `(context, options?): DialogueEntry \| null` | 按优先级返回第一个匹配条目 |
| `queryAll` | `(context, options?): DialogueEntry[]` | 返回全部匹配(默认上限 100) |
| `get` | `(context, options?): [DialogueEntry \| null, string \| null]` | 查询 + 应用冷却 + 记历史 + 格式化,返回 `[entry, text]` |
| `getRandom` | `(context, options?): [entry \| null, text \| null]` | 从匹配集中随机一条 |
| `format` | `(entry, context): string` | `{var}` 插值 |
| `addVariable` | `(name, fn: (context) => any): this` | 注册插值变量函数 |
| `getHistory` | `(limit?): { id, time, context }[]` | 最近 N 条(默认 10) |
| `clearCooldown` | `(id?: string): this` | 清除单个/全部冷却 |

`options` 形如 `{ tags?: string[]; speaker?: string; limit?: number }`。匹配时依次过滤:标签(任一命中)、说话者、冷却、条件。

### `{var}` 插值

`format` 对文本中的 `{name}` 依次尝试:`variables[name](context)` → `context[name]` → 原样保留 `{name}`。

## DialogueTree 方法

| 方法 | 签名 | 说明 |
|---|---|---|
| `start` | `(startNode?: string, context?): this` | 开始(默认节点 `"start"`) |
| `getCurrentNode` | `(): DialogueTreeNode \| null` | 当前节点 |
| `getText` | `(): string \| null` | 当前文本 |
| `getChoices` | `(): { index: number; text: string; disabled?: boolean }[] \| null` | 可选选项(过滤条件不符者),无选项返回 null |
| `choose` | `(choiceIndex: number): boolean` | 选选项(**1-based**);推进到 next 或结束 |
| `continue` | `(): boolean` | 无选项节点推进(有选项时返回 false) |
| `isEnded` | `(): boolean` | 是否结束 |
| `setContext` | `(key: string, value: any): this` | 设上下文 |
| `getContext` | `(key: string): any` | 取上下文 |
| `on` | `(event, callback): this` | 注册事件 |
| `goTo` | `(nodeId: string): this` | 跳转节点 |
| `addNode` | `(id: string, node: DialogueTreeNode): this` | 加节点 |

### 事件

| 事件 | 参数 |
|---|---|
| `nodeEnter` | `(nodeId, node)` |
| `nodeExit` | `(nodeId, node)` |
| `choiceMade` | `(choiceIndex, choice)` |
| `treeEnd` | `(history)` |

## 示例

~~~ts
import { newLibrary, newTree } from './src/gamelib/dialogue';

const lib = newLibrary({
    entries: [
        { id: 'warn', speaker: 'npc', priority: 10, cooldown: 3,
          text: '喂,{name}!血量只剩 {hp},快治疗!', conditions: { hp: ['<', 30] } },
        { id: 'greet', speaker: 'npc', priority: 1,
          text: '你好,{name}!今天心情{mood}!', conditions: { mood: 'happy' } },
        { id: 'idle', speaker: 'npc', priority: 0, text: '空气不错。' },
    ],
    variables: { name: () => '玩家', mood: (ctx) => (ctx.money > 120 ? '很好' : '一般') },
});

const [entry, text] = lib.get({ hp: 10, money: 50 });  // -> warn 文本
const rand = lib.getRandom({ hp: 50, money: 200 });    // 随机一条满足条件者

const tree = newTree({
    nodes: {
        start: {
            text: '你想做什么?',
            choices: [
                { text: '战斗!', next: 'fight' },
                { text: '休息', next: 'rest' },
                { text: '离开' },
            ],
        },
        fight: { text: '受伤 -20', action: () => console.log('-20 HP'), next: 'start' },
        rest:  { text: '回血 +15', action: () => console.log('+15 HP'), next: 'start' },
    },
});
tree.on('choiceMade', (idx) => console.log('选了 #' + idx));
tree.start('start', {});
tree.getChoices();   // [{ index: 1, ... }, ...]
tree.choose(1);      // -> fight
~~~

## Lua 迁移 / 行为差异

- **构造**:`Dialogue.newLibrary(cfg)` → `newLibrary(cfg)`;`Dialogue.newTree(cfg)` → `newTree(cfg)`。
- **`get`/`getRandom` 返回元组**:Lua 多返回值 `entry, text` 在 TS 里是数组 `[entry, text]`(无匹配时 `[null, null]`)。
- **索引 1-based**:`choose(n)` 与 `getChoices()` 的 `index` 保持 Lua 的 1 起始。
- **时间**:冷却/历史用 `osTime()`(秒,`Math.floor(Date.now()/1000)`),与 Lua `os.time()` 语义一致。
- **条件真值**:0 与空串为真(仅 null/undefined/false 为假)。

## 渲染 / 集成提示

- `getChoices()` 返回纯数据,上层把每个选项映射成一个 `InteractRegion` 按钮,点击调 `tree.choose(choice.index)` 后刷新 UI(见 `DemoScene.refreshTree()`)。
- 无选项节点渲染一个「继续」按钮调 `tree.continue()`。
- Library 由定时器触发(`getRandom`),Tree 由点击事件驱动,二者可独立使用。
