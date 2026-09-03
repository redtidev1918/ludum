# ADR 0009 — Simulation Time vs Wall Time

**Status:** Accepted

## Context

`Clock.nowMs()` is a **wall clock** (absolute, milliseconds). Gameplay simulation advances
by `dtSeconds` and must not be confused with wall time, or determinism breaks.

## Decision

- Wall clock: inject `Clock` (`nowMs(): number`). Absolute timestamps are named `*Ms`.
- Simulation time: durations and deltas use **seconds** — `dtSeconds`,
  `durationSeconds`, `remainingSeconds`.
- `Countdown` advances with simulation `dtSeconds`; it is not driven by the wall clock.

## Consequences

- Deterministic simulation via `ManualClock` and explicit `dtSeconds`.
- No implicit `Date.now()` inside gameplay logic.

## Rejected Alternatives

- Using a single `Clock` for both wall time and simulation time. Rejected: conflates two
  different notions of time and breaks determinism.
