# ADR 0006 — Zero Runtime Dependencies

**Status:** Accepted

## Context

`phaser` was listed under `dependencies`, forcing every consumer to install a game
engine to use a pure-logic library.

## Decision

GameLib has **zero runtime dependencies**. Phaser is a devDependency used only by the
example. The dependency direction is `examples → GameLib`, never `GameLib → Phaser`.
`npm run build:lib` emits ESM + `.d.ts` into `dist/` with no external imports.

## Consequences

- `package.json` has no `dependencies`.
- Consumers install only what they use.

## Rejected Alternatives

- Shipping Phaser as an optional peer dependency. Rejected: unnecessary coupling.
