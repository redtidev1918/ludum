# Portability

> 中文：[PORTABILITY.md](./PORTABILITY.md)

ludum is portable at three levels.

## Tier 1 — Direct TypeScript runtime (first-class)

- **Phaser** — reference consumer (rendering / scene / input / audio).
- **Cocos Creator** — compatibility smoke-test consumer.
- **Node / headless** — architectural reference.
- **Browser** — any bundler.

## Tier 2 — JS runtime bridge

- GodotJS and similar JS bridges. Works if the bridge runs standard JS modules.

## Tier 3 — Specification port

- Godot C#, Unity, Unreal, Rust, etc.

Portability is achieved by conforming to `spec/conventions.md` (time / randomness /
snapshot / condition semantics), **not** by shipping engine adapters. A Tier 3 port
reuses the specification, not the TypeScript code.
