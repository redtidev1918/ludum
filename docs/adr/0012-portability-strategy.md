# ADR 0012 — Portability Strategy

**Status:** Accepted

## Context

The TypeScript runtime cannot serve every engine directly (Godot C#, Unity, Rust, …).

## Decision

Portability is tiered: Tier 1 = direct TS runtime (Phaser, Cocos, Node, browser);
Tier 2 = JS bridge (GodotJS); Tier 3 = specification port (C#, Rust, …). Portability is
achieved by conforming to `spec/conventions.md`, not by shipping engine adapters.

## Consequences

- `docs/PORTABILITY.md` sets honest expectations.
- No engine-adapter framework in the core.

## Rejected Alternatives

- Shipping per-engine adapters in the core. Rejected: coupling + bloat.
