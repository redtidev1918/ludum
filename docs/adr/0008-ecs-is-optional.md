# ADR 0008 — ECS is Optional Composition, not the Framework Root

**Status:** Accepted

## Context

A common failure mode is to make ECS the center of a library, forcing every subsystem
(Resource, Dialogue, State, Weighted) to be expressed as components/systems. That couples
independent concerns to ECS and prevents standalone use.

## Decision

ECS is **one composition option** among several, not the framework root. Resource,
Dialogue, Weighted, State, and Interaction are all usable standalone, with their own
instances and lifecycles. ECS does not depend on any of them. Consumers may attach a
`Resource` (or any value) to an entity as component data, but ECS itself is unaware of it.

## Consequences

- `src/gamelib/ecs.ts` has zero imports from resource/dialogue/state/weighted.
- Each subsystem is independently importable and testable.
- No "everything is a component" coercion.

## Rejected Alternatives

- Making ECS the framework root with all systems as components. Rejected: couples
  orthogonal concerns and blocks standalone use.
