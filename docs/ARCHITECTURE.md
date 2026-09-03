# ludum — Architecture

ludum 是一个 portable、headless、deterministic、typed、composable、data-driven 的
TypeScript gameplay kernel + gameplay systems。**不是** game engine / renderer / scene
framework。

## Layer model

依赖方向自上而下，禁止反向污染：

```text
Examples (Phaser / headless)
        ↓
Optional Systems (dialogue · geometry · interaction)
        ↓
Gameplay Systems (ecs · resource · state · weighted)
        ↓
Kernel (runtime · predicate · condition-expression · definition · validation · signal · shuffle-bag)
        ↓
Portable Specification (spec/conventions.md)
```

## Core principles

- **Headless first**（ADR 0010）：core 在无引擎/DOM/renderer 下完整运行；由 `lib:["ES2022"]` 强制。
- **Definition != Runtime Instance**（ADR 0002）：静态定义与 session 状态分离。
- **Functional core + stateful shell**：`selectWeighted` / `containsPoint` / `evaluateCondition` 等纯函数下沉。
- **Capability dependency**：`ValueSource` / `RandomSource` / `Clock` / `Shape2D`，而非具体子系统。
- **Deterministic**：注入 RNG / clock，禁止 `Math.random()` / `Date.now()`。
- **ECS is optional composition**（ADR 0008），不是 framework root。

## Dependency map

见 `docs/ARCHITECTURE_MAP.md`。

## Portability

见 `docs/PORTABILITY.md` 与 `spec/conventions.md`（Tier 1 TS runtime / Tier 2 JS bridge / Tier 3 spec port）。

## Binding decisions

见 `docs/adr/`（0001–0012）。迁移破坏性变更见 `docs/migration-v3.md`。

## Validation

唯一验收入口：`npm run check`（typecheck ×3 + tests + build:lib）。
