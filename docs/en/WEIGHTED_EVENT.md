# Weighted — weighted random selection

**Language / 语言:** [中文](/docs/WEIGHTED_EVENT.md) · English

ludum v3's weighted selection system. v1's `WeightedEventPool` / `newPool` are removed.

## Core concepts

- **`WeightedTable`**: a static definition (entries + base weights + modifiers), immutable.
- **`selectWeighted` / `effectiveWeight`**: pure algorithms with no state, history or statistics.
- **`WeightedSession`**: runtime state (rollCount, totalTriggers, pity, per-entry statistics, a
  bounded history).

## Quick start

```ts
import { createWeightedSession } from './gamelib';
import { SeededRandom } from './gamelib';

const loot = createWeightedSession({
    entries: [
        { id: 'common', weight: 75, type: 'item' },
        { id: 'legendary', weight: 5, type: 'item' },
    ],
}, new SeededRandom(42), {
    pity: { threshold: 8, guarantee: (e) => e.id === 'legendary' },
});

const entry = loot.roll();          // WeightedEntry | undefined
const stats = loot.getStats();      // { totalRolls, totalTriggers, events }
```

## API

### `WeightedTable` (definition)

```ts
new WeightedTable({ entries, modifiers? })
```

- `entries`: `{ id, weight, type?, data? }`; validates non-empty, no duplicate ids, `weight >= 0`.
- `modifiers`: `{ active(context), matches?(entry), multiply?, add? }`.

### Pure functions

```ts
effectiveWeight(entry, context, modifiers): number
selectWeighted(entries, getWeight, random): T | undefined
selectFromTable(table, context, random, filter?): WeightedEntry | undefined
```

### `WeightedSession` (runtime)

```ts
new WeightedSession(table, random, { pity?, historyLimit? })
createWeightedSession(tableConfig, random, { pity?, historyLimit? })
```

| Method | Description |
|---|---|
| `roll(context?, filter?)` | Roll once |
| `simulate(count, context?, filter?)` | Simulate on **separate state**, without polluting the real session |
| `getStats()` | `{ totalRolls, totalTriggers, events: { [id]: { count, rate, lastRoll } } }` |
| `getHistory(limit?)` | Bounded history |
| `resetStats()` | Clear the runtime state |
| `serialize()` / `deserialize(snapshot)` | Versioned snapshots |

## Semantic notes

- **Injected randomness**: depends on `RandomSource`, never calling `Math.random()` directly.
- **Pity**: after `threshold` consecutive rolls that did not hit a `guarantee`-matching entry,
  the next roll is forced to hit one.
- **Statistics are independent of history**: `totalTriggers` is a separate counter and does not
  depend on the bounded history length.
- **`simulate` does not pollute**: `simulate()` runs on separate session state, leaving the real
  statistics, history and pity untouched.

## Deliberately not implemented

No full gacha / deck framework; `ShuffleBag` and similar will be added when a real consumer
exists.
