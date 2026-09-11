# Dialogue — dialogue system

**Language / 语言:** [中文](/docs/DIALOGUE.md) · English

ludum v3's dialogue is data-driven branching dialogue. v1's `DialogueLibrary` / `DialogueTree` /
Lua array DSL / 1-based choices are removed.

## Core concepts

- `DialogueDefinition<TContext>`: static content (nodes + choices), serialisable.
- `DialogueSession<TContext>`: runtime traversal state (current node, history, context).
- `selectLine`: one-line conditional line selection (pure, replacing v1's `DialogueLibrary`).
- `formatDialogueText`: `{field}` interpolation.

## Quick start

```ts
import { DialogueSession, selectLine } from './gamelib';

const tree = new DialogueSession(
    {
        startNodeId: 'start',
        nodes: {
            start: { text: 'Choose:', choices: [
                { id: 'accept', text: 'Accept the quest', next: 'done' },
                { id: 'leave', text: 'Leave' },
            ] },
            done: { text: 'Quest accepted.' },
        },
    },
    { /* context */ },
);

tree.getChoices();      // available choices (filtered by conditions)
tree.choose('accept');  // by stable id, not 1-based
tree.chooseIndex(0);    // 0-based index
```

## Key semantics

- **Choices use stable IDs** (`choose("accept_quest")`), with `chooseIndex(0)` kept as a 0-based
  escape hatch.
- **Typed context**: `DialogueDefinition<TContext>` / `DialogueSession<TContext>`.
- **Conditions**: `Predicate<TContext>` at runtime; for data-driven cases use
  `ConditionExpression` + `evaluateCondition`.
- Removed: Lua truthiness, the `['<', 20]` array DSL, and 1-based compatibility.
