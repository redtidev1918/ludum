# Resource — numeric resources

**Language / 语言:** [中文](/docs/RESOURCE.md) · English

ludum v3's Resource only serves "mutable numeric gameplay values with range semantics"
(HP / MP / stamina / heat / morale). v1's `ResourceManager` / `onChange` / `getModifiers` have
been removed or renamed.

## Core concepts

- `Resource implements ValueSource<number>`: downstream code depends on the capability, not on
  this subsystem.
- `DerivedResource implements ValueSource<number>`: computed from other `ValueSource<number>`s.
- `ResourceRegistry`: register / lookup / enumerate only — it holds no update or serialisation.

## Quick start

```ts
import { Resource } from './gamelib';

const hp = new Resource({ id: 'hp', value: 100, max: 100, regenPerSecond: 2 });
hp.subtract(15);
hp.addModifier({ id: 'poison', kind: 'decay', amountPerSecond: 4, durationSeconds: 8 });
const unsub = hp.subscribeChange((oldV, newV) => { /* … */ });
hp.update(1 / 60);
```

## Key semantics

- **Ownership**: `addModifier` copies its input and **never mutates the caller's object**.
- **Unsubscribe**: `subscribeChange` / `onThreshold` return an unsubscribe function.
- **Validation**: `min > max`, `NaN`, `Infinity`, negative `dt` and invalid modifiers all throw.
- **Modifiers**: only `regen` / `decay` (per-second); the dead `flat` / `percent` API is gone.
- **Snapshots**: `serialize()` / `Resource.deserialize()`, with `schemaVersion: 1`.
