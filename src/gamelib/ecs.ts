/**
 * Entity-Component System (ECS) — v3 instance-based core.
 *
 * Invariants:
 * - World is the single owner of all entity state. Entity is a value handle
 *   (identity by `id`) that delegates to its World.
 * - Multiple Worlds are fully isolated (no module-level mutable state).
 * - During `World.update()`, structural mutations (create/destroy/add/remove/tag)
 *   are deferred to a command queue and applied at the end of the tick, so queries
 *   and iteration observe a stable topology within a tick.
 * - Outside `update()`, structural mutations apply immediately.
 * - Mutations (add/remove/tag/untag) on a destroyed entity throw; reads return
 *   `undefined` / `false`; destroy is idempotent.
 *
 * Deliberately out of scope (see docs/adr/0003-instance-based-ecs-world.md):
 * archetype/SOA storage, parallel scheduling, job systems, and component
 * add/remove callbacks (onAdd/onRemove).
 */

/** A typed component definition. Treat as immutable and shareable across Worlds. */
export interface ComponentType<T> {
  readonly name: string;
  readonly defaults: T;
}

/** Define a typed component. `T` is inferred from `defaults`. */
export function defineComponent<T>(def: { name: string; defaults: T }): ComponentType<T> {
    if (typeof def.name !== 'string' || def.name.trim().length === 0) {
        throw new Error('defineComponent: name must be a non-empty string');
    }
    return { name: def.name, defaults: def.defaults };
}

/** A lightweight handle to an entity owned by a World. Identity is by `id`. */
export class Entity {
    readonly id: number;
    private readonly world: World;

    constructor(world: World, id: number) {
        this.world = world;
        this.id = id;
    }

    /** Add (or replace) a component. During a tick this is deferred to tick end. */
    add<T>(component: ComponentType<T>, data?: Partial<T>): this {
        this.world.addComponent(this.id, component, data);
        return this;
    }

    /** Remove a component. No-op if absent. */
    remove(component: ComponentType<unknown>): this {
        this.world.removeComponent(this.id, component);
        return this;
    }

    /** Get component data, or `undefined` if absent. */
    get<T>(component: ComponentType<T>): T | undefined {
        return this.world.getComponent(this.id, component);
    }

    has(component: ComponentType<unknown>): boolean {
        return this.world.hasComponent(this.id, component);
    }

    tag(tag: string): this {
        this.world.addTag(this.id, tag);
        return this;
    }

    untag(tag: string): this {
        this.world.removeTag(this.id, tag);
        return this;
    }

    hasTag(tag: string): boolean {
        return this.world.hasTag(this.id, tag);
    }

    /** Destroy the entity at the end of the current tick (or immediately outside one). */
    destroy(): void {
        this.world.destroyEntity(this.id);
    }

    isAlive(): boolean {
        return this.world.isAlive(this.id);
    }
}

export type SystemPhase = 'preUpdate' | 'update' | 'postUpdate';

export interface SystemConfig {
    name: string;
    requires: readonly ComponentType<unknown>[];
    /** When the system runs within a tick. Defaults to `'update'`. */
    phase?: SystemPhase;
    /** Relative order within a phase (higher runs first). Defaults to 0. */
    order?: number;
    run: (entity: Entity, dtSeconds: number) => void;
}

interface System {
    name: string;
    requires: ComponentType<unknown>[];
    phase: SystemPhase;
    order: number;
    run: (entity: Entity, dtSeconds: number) => void;
}

const PHASE_INDEX: Record<SystemPhase, number> = {
    preUpdate: 0,
    update: 1,
    postUpdate: 2,
};

function compareSystems(a: System, b: System): number {
    const pa = PHASE_INDEX[a.phase];
    const pb = PHASE_INDEX[b.phase];
    if (pa !== pb) return pa - pb;
    return b.order - a.order;
}

interface EntityStore {
    components: Map<ComponentType<unknown>, unknown>;
    tags: Set<string>;
}

type Command =
    | { kind: 'create'; id: number }
    | { kind: 'destroy'; id: number }
    | { kind: 'add'; id: number; component: ComponentType<unknown>; data: unknown }
    | { kind: 'remove'; id: number; component: ComponentType<unknown> }
    | { kind: 'addTag'; id: number; tag: string }
    | { kind: 'removeTag'; id: number; tag: string };

/** Plain-JSON snapshot of a World's runtime state (see docs/adr/0002). */
export interface WorldSnapshot {
    schemaVersion: 1;
    nextEntityId: number;
    entities: Array<{
        id: number;
        components: Record<string, unknown>;
        tags: string[];
    }>;
}

export class World {
    private entities = new Map<number, EntityStore>();
    private nextEntityId = 1;
    private componentByName = new Map<string, ComponentType<unknown>>();
    private systems: System[] = [];
    private executing = false;
    private pending: Command[] = [];
    private destroyedIds = new Set<number>();

    // ------------------------------------------------------------------ Entities

    createEntity(): Entity {
        const id = this.nextEntityId++;
        this.mutate({ kind: 'create', id });
        return new Entity(this, id);
    }

    getEntity(id: number): Entity | undefined {
        return this.entities.has(id) ? new Entity(this, id) : undefined;
    }

    destroyEntity(entity: Entity | number): void {
        const id = typeof entity === 'number' ? entity : entity.id;
        this.mutate({ kind: 'destroy', id });
    }

    isAlive(id: number): boolean {
        return this.entities.has(id);
    }

    /** Remove all entities and reset the id counter. Systems are retained. */
    clear(): void {
        this.entities.clear();
        this.nextEntityId = 1;
        this.pending = [];
        this.destroyedIds.clear();
    }

    // ------------------------------------------------------------------ Components

    addComponent<T>(id: number, component: ComponentType<T>, data?: Partial<T>): void {
        this.assertAlive(id, 'addComponent');
        this.registerComponent(component);
        const merged = { ...component.defaults, ...(data ?? {}) } as T;
        this.mutate({ kind: 'add', id, component, data: merged });
    }

    removeComponent(id: number, component: ComponentType<unknown>): void {
        this.assertAlive(id, 'removeComponent');
        this.mutate({ kind: 'remove', id, component });
    }

    getComponent<T>(id: number, component: ComponentType<T>): T | undefined {
        return this.entities.get(id)?.components.get(component) as T | undefined;
    }

    hasComponent(id: number, component: ComponentType<unknown>): boolean {
        return this.entities.get(id)?.components.has(component) ?? false;
    }

    // ------------------------------------------------------------------ Tags

    addTag(id: number, tag: string): void {
        this.assertAlive(id, 'addTag');
        this.mutate({ kind: 'addTag', id, tag });
    }

    removeTag(id: number, tag: string): void {
        this.assertAlive(id, 'removeTag');
        this.mutate({ kind: 'removeTag', id, tag });
    }

    hasTag(id: number, tag: string): boolean {
        return this.entities.get(id)?.tags.has(tag) ?? false;
    }

    // ------------------------------------------------------------------ Queries

    /** All alive entities that have every given component. With no arguments, all alive entities. */
    query(...components: ComponentType<unknown>[]): Entity[] {
        const result: Entity[] = [];
        for (const id of this.entities.keys()) {
            if (this.storeMatches(id, components)) {
                result.push(new Entity(this, id));
            }
        }
        return result;
    }

    /** All alive entities carrying the given tag. */
    queryByTag(tag: string): Entity[] {
        const result: Entity[] = [];
        for (const [id, store] of this.entities) {
            if (store.tags.has(tag)) result.push(new Entity(this, id));
        }
        return result;
    }

    /** Number of alive entities that have every given component. */
    count(...components: ComponentType<unknown>[]): number {
        return this.query(...components).length;
    }

    // ------------------------------------------------------------------ Systems

    addSystem(config: SystemConfig): this {
        if (typeof config.name !== 'string' || config.name.trim().length === 0) {
            throw new Error('World.addSystem: name must be a non-empty string');
        }
        if (typeof config.run !== 'function') {
            throw new Error(`World.addSystem: system "${config.name}" requires a run function`);
        }
        if (this.systems.some((s) => s.name === config.name)) {
            throw new Error(`World.addSystem: duplicate system name "${config.name}"`);
        }
        this.systems.push({
            name: config.name,
            requires: [...config.requires],
            phase: config.phase ?? 'update',
            order: config.order ?? 0,
            run: config.run,
        });
        this.systems.sort(compareSystems);
        return this;
    }

    /** Run all systems. Structural mutations made during the tick apply at its end. */
    update(dtSeconds: number): void {
        if (!Number.isFinite(dtSeconds) || dtSeconds < 0) {
            throw new Error(`World.update: dtSeconds must be a finite number >= 0, got ${dtSeconds}`);
        }
        if (this.executing) {
            throw new Error('World.update: re-entrant call detected (do not call update from within a system)');
        }

        this.executing = true;
        try {
            for (const phase of ['preUpdate', 'update', 'postUpdate'] as const) {
                for (const system of this.systems) {
                    if (system.phase !== phase) continue;
                    for (const entity of this.query(...system.requires)) {
                        system.run(entity, dtSeconds);
                    }
                }
            }
        } finally {
            this.executing = false;
        }

        this.applyPending();
    }

    // ------------------------------------------------------------------ Snapshot

    serialize(): WorldSnapshot {
        const entities: WorldSnapshot['entities'] = [];
        for (const [id, store] of this.entities) {
            const components: Record<string, unknown> = {};
            for (const [component, data] of store.components) {
                components[component.name] = data;
            }
            entities.push({ id, components, tags: [...store.tags] });
        }
        return { schemaVersion: 1, nextEntityId: this.nextEntityId, entities };
    }

    /**
     * Replace the World's contents from a snapshot. `components` maps names back to
     * their definitions (definitions are not serialized).
     */
    deserialize(snapshot: WorldSnapshot, components: readonly ComponentType<unknown>[]): void {
        if (snapshot.schemaVersion !== 1) {
            throw new Error(`World.deserialize: unsupported schemaVersion ${snapshot.schemaVersion}`);
        }
        const byName = new Map<string, ComponentType<unknown>>();
        for (const component of components) {
            if (byName.has(component.name)) {
                throw new Error(`World.deserialize: duplicate component name "${component.name}"`);
            }
            byName.set(component.name, component);
        }

        this.entities.clear();
        this.pending = [];
        this.destroyedIds.clear();
        this.componentByName = byName;

        let maxId = 0;
        for (const entity of snapshot.entities ?? []) {
            const store: EntityStore = { components: new Map(), tags: new Set(entity.tags ?? []) };
            for (const [name, data] of Object.entries(entity.components ?? {})) {
                const component = byName.get(name);
                if (!component) {
                    throw new Error(`World.deserialize: unknown component "${name}"`);
                }
                store.components.set(component, data);
            }
            this.entities.set(entity.id, store);
            if (entity.id > maxId) maxId = entity.id;
        }
        this.nextEntityId = Math.max(snapshot.nextEntityId ?? 1, maxId + 1);
    }

    // ------------------------------------------------------------------ Internals

    private registerComponent(component: ComponentType<unknown>): void {
        const existing = this.componentByName.get(component.name);
        if (existing === undefined) {
            this.componentByName.set(component.name, component);
        } else if (existing !== component) {
            throw new Error(`World: duplicate component name "${component.name}"`);
        }
    }

    private assertAlive(id: number, method: string): void {
        if (this.destroyedIds.has(id)) {
            throw new Error(`World.${method}: entity #${id} is destroyed`);
        }
    }

    private storeMatches(id: number, components: ComponentType<unknown>[]): boolean {
        const store = this.entities.get(id);
        if (!store) return false;
        for (const component of components) {
            if (!store.components.has(component)) return false;
        }
        return true;
    }

    private mutate(command: Command): void {
        if (this.executing) {
            this.pending.push(command);
        } else {
            this.apply(command);
        }
    }

    private apply(command: Command): void {
        switch (command.kind) {
            case 'create':
                this.entities.set(command.id, { components: new Map(), tags: new Set() });
                break;
            case 'destroy':
                this.entities.delete(command.id);
                this.destroyedIds.add(command.id);
                break;
            case 'add': {
                const store = this.entities.get(command.id);
                if (store) store.components.set(command.component, command.data);
                break;
            }
            case 'remove': {
                this.entities.get(command.id)?.components.delete(command.component);
                break;
            }
            case 'addTag':
                this.entities.get(command.id)?.tags.add(command.tag);
                break;
            case 'removeTag':
                this.entities.get(command.id)?.tags.delete(command.tag);
                break;
        }
    }

    private applyPending(): void {
        const commands = this.pending;
        this.pending = [];
        for (const command of commands) {
            this.apply(command);
        }
    }
}
