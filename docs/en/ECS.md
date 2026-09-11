# ECS (entity component system)

**Language / 语言:** [中文](/docs/ECS.md) · English

ludum 3.0's ECS is an **instance-based, type-safe** entity component system. v1's module-level
singleton (`ECS.xxx`) has been removed.

## Core concepts

- **`World`**: the **sole owner** of entities and components. One `World` is one fully isolated
  runtime. Multiple worlds can coexist (for example a combat simulation and a preview).
- **`Entity`**: a lightweight handle identified by `id`; every operation delegates back to its
  `World`. An `Entity` holds no authoritative data itself.
- **`ComponentType<T>`**: a typed component definition (name + defaults). Definitions can be
  shared across worlds.

## Quick start

```ts
import { World, defineComponent } from './gamelib';

const Position = defineComponent({ name: 'Position', defaults: { x: 0, y: 0 } });
const Velocity = defineComponent({ name: 'Velocity', defaults: { vx: 0, vy: 0 } });

const world = new World();

world.addSystem({
    name: 'Move',
    requires: [Position, Velocity],
    run: (entity, dtSeconds) => {
        const p = entity.get(Position)!;
        const v = entity.get(Velocity)!;
        p.x += v.vx * dtSeconds;
        p.y += v.vy * dtSeconds;
    },
});

const e = world.createEntity()
    .add(Position, { x: 10, y: 20 })
    .add(Velocity, { vx: 1, vy: 0 })
    .tag('player');

world.update(1 / 60); // 60 frames per second
```

## API

### `defineComponent`

```ts
const Health = defineComponent({ name: 'Health', defaults: { value: 100, max: 100 } });
```

- `T` is inferred from `defaults`; `entity.get(Health)` returns
  `{ value: number; max: number } | undefined`.
- `name` must be unique within a world (it is used for snapshot serialisation).

### `World`

| Method | Description |
|---|---|
| `createEntity()` | Create an entity, returning a handle |
| `getEntity(id)` | Get a handle by id, or `undefined` |
| `destroyEntity(entity\|id)` | Destroy an entity (idempotent) |
| `isAlive(id)` | Whether it is alive |
| `clear()` | Remove all entities and reset the id counter (systems are kept) |
| `query(...components)` | Alive entities having all given components; no arguments returns all alive entities |
| `queryByTag(tag)` | Alive entities carrying that tag |
| `count(...components)` | Number of matching entities |
| `addSystem(config)` | Register a system |
| `update(dtSeconds)` | Run all systems (by phase + order) |
| `serialize()` / `deserialize(snapshot, components)` | Snapshot save/load |

### `Entity` (handle)

| Method | Description |
|---|---|
| `add(component, data?)` | Add/replace a component (`data` is a `Partial<T>` overriding defaults) |
| `remove(component)` | Remove a component (throws if the entity is destroyed) |
| `get(component)` | Component data, or `undefined` |
| `has(component)` | Whether the component is present |
| `tag/untag/hasTag` | Tags |
| `destroy()` / `isAlive()` | Lifecycle |

> Read semantics: when missing, `get` returns `undefined` and `has` / `hasTag` / `isAlive`
> return `false`.
> Write semantics: `add` / `remove` / `tag` / `untag` on a **destroyed** entity **throw** (a
> searchable error); `destroy()` is idempotent (repeated calls do not throw).

## System scheduling

Systems run by **phase** (`preUpdate` → `update` → `postUpdate`); within a phase, by **order**
descending (larger first, default 0).

```ts
world.addSystem({ name: 'Input', phase: 'preUpdate', run: ... });
world.addSystem({ name: 'Simulate', run: ... });        // phase defaults to 'update'
world.addSystem({ name: 'Render', phase: 'postUpdate', run: ... });
```

- `requires: []` means the system runs once per **alive** entity (same as v1).

## Structural change semantics (important)

- **Outside `update()`**: create / destroy / add / remove / tag take effect **immediately**.
- **Inside `update()`** (while systems run): all structural changes enter a **deferred command
  queue** and are **applied together at the end of the tick**. Therefore:
  - within one tick, queries and iteration see a **stable** topology;
  - whatever system A creates / removes / destroys in the same tick is **invisible** to system B
    until the tick ends.

```ts
world.addSystem({ name: 'Kill', requires: [], run: (e) => {
    e.destroy();
    e.isAlive(); // true — the destroy is deferred; still alive this tick
} });
world.update(dt);
e.isAlive(); // false — actually removed after the tick
```

## Snapshots

```ts
const snapshot = world.serialize();           // { schemaVersion: 1, nextEntityId, entities: [...] }
const other = new World();
other.deserialize(snapshot, [Position, Velocity]); // component definitions are not serialised; the caller supplies them
```

- A snapshot is **plain JSON data** (including `schemaVersion`), with component data keyed by
  `name`.
- `deserialize` validates `schemaVersion` and rejects unknown or duplicate component names.

## Deliberately not implemented

(see `docs/adr/0003-instance-based-ecs-world.md`) No archetypes / SOA, no parallel scheduling,
no job system, and no component add/remove callbacks (`onAdd` / `onRemove`).
