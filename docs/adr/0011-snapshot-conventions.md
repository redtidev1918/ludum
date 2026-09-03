# ADR 0011 — Snapshot Conventions

**Status:** Accepted

## Context

Save/load must be portable and future-proof.

## Decision

Snapshots are JSON-safe plain data and carry `schemaVersion`. They never contain
functions, `Clock`, `RandomSource`, or engine objects. `NaN`/`Infinity` are
excluded. Snapshots capture runtime state only, never definitions.

## Consequences

- A uniform convention, not a forced `Serializable<T>` interface.
- Each subsystem owns its snapshot schema.

## Rejected Alternatives

- A single `Serializable<T>` interface across all modules. Rejected: too rigid.
