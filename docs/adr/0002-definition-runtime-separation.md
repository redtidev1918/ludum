# ADR 0002 — Definition != Runtime State

**Status:** Accepted

## Context

The v1 modules (DialogueTree, WeightedEventPool, StateSprite) mixed static definitions
with per-session mutable state in a single class, making them hard to reason about,
snapshot, and reuse.

## Decision

Every gameplay concept is split into a **Definition** (static, shareable, ideally
immutable — "what a thing *is*") and a **Runtime instance** (per-game/per-session state
— "what it *is now*").

Examples:

- DialogueDefinition + DialogueSession
- WeightedTable + WeightedSession
- StateMachineDefinition + StateMachine instance
- ShapeDefinition (geometry) + InteractionRegion (pointer state)

## Consequences

- Definitions are reusable and serializable; runtime instances hold only session state.
- Snapshots capture runtime state only, never definitions.
- A Definition may carry static filters/metadata; it holds no mutable run state.

## Rejected Alternatives

- Keeping combined God classes with all state. Rejected: unbounded coupling.
