# ADR 0010 — Headless First

**Status:** Accepted

## Context

Engine independence must be verified, not assumed. If the core only works inside a
Phaser scene, the engine boundary has failed.

## Decision

The core library must run fully with **no** game engine, DOM, renderer, scene, audio,
or input. Headless execution is an architectural acceptance criterion, not an extra
feature. `examples/headless` demonstrates a deterministic vertical slice.

## Consequences

- Core compiles against `lib: ["ES2022"]` only (enforced by `tsconfig.lib.json`).
- All subsystem tests run in Node with no DOM.

## Rejected Alternatives

- Documenting "engine-agnostic" without a headless reference. Rejected: not executable.
