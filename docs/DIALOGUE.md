# Dialogue —— 对话系统

GameLib v3 的对话是数据驱动的分支对话。v1 的 `DialogueLibrary` / `DialogueTree` / Lua 数组 DSL / 1-based 选项已删除。

## 核心概念

- `DialogueDefinition<TContext>`：静态内容（nodes + choices），可序列化。
- `DialogueSession<TContext>`：运行时遍历状态（当前节点、历史、上下文）。
- `selectLine`：条件一行台词选择（纯，替代 v1 DialogueLibrary）。
- `formatDialogueText`：`{field}` 插值。

## 快速上手

```ts
import { DialogueSession, selectLine } from './gamelib';

const tree = new DialogueSession(
    {
        startNodeId: 'start',
        nodes: {
            start: { text: '选择:', choices: [
                { id: 'accept', text: '接受任务', next: 'done' },
                { id: 'leave', text: '离开' },
            ] },
            done: { text: '任务已接。' },
        },
    },
    { /* context */ },
);

tree.getChoices();      // 可用选项(按条件过滤)
tree.choose('accept');  // 用稳定 id,非 1-based
tree.chooseIndex(0);    // 0-based index
```

## 关键语义

- **choice 用稳定 ID**（`choose("accept_quest")`），保留 `chooseIndex(0)` 作 0-based 逃生舱。
- **typed context**：`DialogueDefinition<TContext>` / `DialogueSession<TContext>`。
- **条件**：`Predicate<TContext>`（运行时）；数据驱动用 `ConditionExpression` + `evaluateCondition`。
- 删除 Lua truthiness、`['<', 20]` 数组 DSL、1-based 兼容。
