# ADR 0013 — Parallel Narrative Scaffolding (Situation / Heartbeat / Aspects / Deck)

**Status:** Accepted

## Context

The original ludum core (ECS, Resource, StateMachine, Dialogue) is single-focused: a
StateMachine runs one state line, a Dialogue runs one tree, ECS commands apply to one
world. Narrative games such as *Cultist Simulator* — which we studied only for
architecture, never copying code/writing/structures — run **multiple independent
progressions at once**: several locations/verbs ticking on their own clocks, card
pools with exhaustion, and a tag-based numeric model rather than fixed stat fields.

We wanted self-contained, engine-agnostic pieces for that without forcing ECS or a
renderer on authors, and without new runtime dependencies.

## Decision

Add three independent, convention-aligned modules (each usable alone):

- **`narrative/situation.ts`** — `Situation` (a location/event with fillable slots,
  its own `Countdown`, and a `SituationState` lifecycle) plus `Heartbeat` (advances
  every running situation on a shared tick, reports which became ready this frame).
  Enables the "parallel stories, each waiting on player input" shape.

- **`aspect.ts`** — `Aspects = Record<string, number>` with pure helpers
  (`satisfiesAspects`, `combineAspects`, `totalAspects`, `applyAspectDelta`). A
  tag+level numeric model shared across cards, verbs, and conditions, replacing rigid
  stat fields.

- **`deck.ts`** — `DeckSpec` (static, shareable) / `DeckInstance` (live state) for
  card draw. Injects `RandomSource` for deterministic draws; supports exhaustion reset,
  a fallback default card, point removal, and `serialize()`.

Following existing ADRs: zero runtime dependencies (0006), deterministic randomness
via injected `RandomSource` (0004), headless-first pure logic with an optional stateful
shell (0010), snapshot conventions (0011). No ECS coupling; ECS remains optional (0008).

## Consequences

- Authors compose narrative play without wiring a renderer or an ECS world.
- Determinism, portability, and snapshotting are preserved by reuse of existing runtime
  abilities (Clock/Countdown, RandomSource).
- The *Cultist Simulator* study informed the *shape* (aspect dict, situation+clock+
  state, deck spec/instance) but no proprietary code, text, or data structures were
  ported — all implementation is original ludum TypeScript.
- Future work (separate ADRs): a Recipe-style declarative event engine and an
  Ending→Legacy meta-progression chain remain open; not implemented here.

**Status:** Accepted (design and reference only — implementation proceeds in the next
release cycle under `npm run check`).