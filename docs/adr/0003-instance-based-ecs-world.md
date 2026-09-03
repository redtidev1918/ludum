# ADR 0003 — Instance-Based ECS World

**Status:** Accepted

## Context

The v1 ECS was a module-level singleton (`ECS.createEntity()`), preventing multiple
isolated worlds (e.g. a battle simulation alongside a preview).

## Decision

ECS is instance-based: `const world = new World()`. **World owns all entities and
components**; `Entity` is a lightweight handle that delegates to its World. Multiple
Worlds are fully isolated. The v1 singleton is removed (not merely deprecated) to avoid
maintaining two parallel APIs.

## Consequences

- No global mutable ECS state.
- Entity no longer holds authoritative data; World storage is the single owner and the
  single authority enforcing all ECS invariants.
- `entity.add(Position)` / `entity.get(Position)` use typed component handles.

## Rejected Alternatives

- Keeping the singleton with a deprecated alias. Rejected: leaves two parallel APIs.
- Archetype/SOA storage. Rejected: premature; revisit only if a benchmark demands it.
