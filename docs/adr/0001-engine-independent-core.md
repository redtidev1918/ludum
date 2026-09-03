# ADR 0001 — Engine-Independent Core

**Status:** Accepted

## Context

GameLib's value is reusable gameplay logic. The core library must run in any JS/TS host
(browser, Node, Deno, Bun) and must not be tied to a specific engine.

## Decision

The core library (`src/gamelib`) compiles against `lib: ["ES2022"]` only. It must not
reference Phaser, DOM, browser, Node-specific APIs, or example code. Enforcement is
executable, not documentary: `tsconfig.lib.json` makes `window`, `document`,
`HTMLElement`, `process`, `Buffer`, and `Phaser` fail typecheck.

## Consequences

- The only host global the core assumes is `console`, declared minimally in
  `types/host.d.ts` (it exists in every host but is not part of the ES lib).
- Example code (the Phaser demo) lives outside the core and is typechecked separately by
  `tsconfig.example.json`.
- `npm run check` runs `tsc -p tsconfig.lib.json` to keep the constraint enforced.

## Rejected Alternatives

- Relying on documentation alone ("the README says no Phaser"). Rejected: not executable.
- Declaring `console` per file. Rejected: a single declaration is simpler to audit.
