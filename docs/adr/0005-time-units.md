# ADR 0005 — Time Units

**Status:** Accepted

## Context

Time semantics were inconsistent: Dialogue used seconds via `Date.now()/1000`, while
WeightedEvent history stored raw `Date.now()` milliseconds.

## Decision

Gameplay modules never call `Date.now()` directly; they use an injected `Clock`
(`nowMs(): number`). Simulation durations use **seconds**:
`dtSeconds` / `durationSeconds` / `elapsedSeconds`. Absolute timestamps use
**milliseconds** and are named `*Ms`.

## Consequences

- Deterministic time via `ManualClock`.
- Explicit naming prevents ms/s confusion at public API boundaries.

## Rejected Alternatives

- A bare `time` / `duration` field. Rejected: ambiguous units.
