# ADR 0004 — Deterministic Randomness

**Status:** Accepted

## Context

`Math.random()` was spread through dialogue and weighted modules, making behaviour
non-reproducible and untestable.

## Decision

Gameplay modules never call `Math.random()` directly. They depend on an injected
`RandomSource` (`next(): number`). Concrete sources: `SystemRandom`,
`SeededRandom`, `SequenceRandom` (tests).

## Consequences

- All randomness is injectable and reproducible.
- Tests use deterministic sources; statistical assertions on real randomness are avoided.

## Rejected Alternatives

- Monkey-patching `Math.random`. Rejected: hidden global state, thread-of-test risk.
