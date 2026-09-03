/**
 * Resource — a mutable numeric gameplay value with value/range semantics
 * (see docs/adr/0002, 0004, 0009). HP, mana, heat, morale, etc.
 *
 * - Implements `ValueSource<number>` so downstream modules depend on the capability.
 * - addModifier copies caller input into internal runtime state (no caller mutation).
 * - subscriptions (change / threshold) return unsubscribe functions.
 */
import type { ValueSource } from './runtime/value-source.js';

export type ResourceModifierKind = 'regen' | 'decay';

/** Caller-owned modifier input. `id` is required and is the caller's source id. */
export interface ResourceModifier {
    id: string;
    kind: ResourceModifierKind;
    /** Rate, in units per second. */
    amountPerSecond: number;
    /** Duration in seconds. Omit for a permanent modifier. */
    durationSeconds?: number;
}

export interface ResourceConfig {
    id?: string;
    value?: number;
    min?: number;
    max?: number;
    regenPerSecond?: number;
    decayPerSecond?: number;
}

export type ThresholdDirection = 'above' | 'below' | 'cross';

interface RuntimeModifier {
    id: string;
    kind: ResourceModifierKind;
    amountPerSecond: number;
    durationSeconds?: number;
    elapsedSeconds: number;
}

interface Threshold {
    value: number;
    direction: ThresholdDirection;
    listener: (newValue: number) => void;
}

export interface ResourceSnapshotV1 {
    schemaVersion: 1;
    id: string;
    value: number;
    min: number;
    max: number;
    regenPerSecond: number;
    decayPerSecond: number;
    modifiers: Array<{
        id: string;
        kind: ResourceModifierKind;
        amountPerSecond: number;
        durationSeconds?: number;
        elapsedSeconds: number;
    }>;
}

export class Resource implements ValueSource<number> {
    readonly id: string;
    private _value: number;
    private _min: number;
    private _max: number;
    private baseRegenPerSecond: number;
    private baseDecayPerSecond: number;
    private modifiers = new Map<string, RuntimeModifier>();
    private changeListeners = new Set<(oldValue: number, newValue: number) => void>();
    private thresholds: Threshold[] = [];

    constructor(config: ResourceConfig = {}) {
        const min = config.min ?? 0;
        const max = config.max ?? 100;
        validateRange(min, max);
        this._min = min;
        this._max = max;
        this.baseRegenPerSecond = validateFinite(config.regenPerSecond ?? 0, 'regenPerSecond');
        this.baseDecayPerSecond = validateFinite(config.decayPerSecond ?? 0, 'decayPerSecond');
        this.id = config.id ?? 'unnamed';
        this._value = clamp(validateFinite(config.value ?? 0, 'value'), min, max);
    }

    // ------------------------------------------------------------------ Read

    get(): number {
        return this._value;
    }

    get min(): number {
        return this._min;
    }

    get max(): number {
        return this._max;
    }

    get regenPerSecond(): number {
        return this.baseRegenPerSecond;
    }

    get decayPerSecond(): number {
        return this.baseDecayPerSecond;
    }

    get modifierCount(): number {
        return this.modifiers.size;
    }

    /** Value normalized to [0, 1] over [min, max]. Returns 1 for a zero-width range. */
    getPercent(): number {
        if (this._max === this._min) return 1;
        return (this._value - this._min) / (this._max - this._min);
    }

    // ------------------------------------------------------------------ Mutate

    set(newValue: number): this {
        const clamped = clamp(validateFinite(newValue, 'value'), this._min, this._max);
        if (clamped !== this._value) {
            const oldValue = this._value;
            this._value = clamped;
            this.notifyChange(oldValue, clamped);
        }
        return this;
    }

    add(amount: number): this {
        return this.set(this._value + validateFinite(amount, 'amount'));
    }

    subtract(amount: number): this {
        return this.set(this._value - validateFinite(amount, 'amount'));
    }

    setMax(newMax: number): this {
        validateRange(this._min, newMax);
        this._max = newMax;
        if (this._value > newMax) this.set(newMax);
        return this;
    }

    setMin(newMin: number): this {
        validateRange(newMin, this._max);
        this._min = newMin;
        if (this._value < newMin) this.set(newMin);
        return this;
    }

    reset(initialValue?: number): this {
        this.modifiers.clear();
        this._value = clamp(initialValue ?? this._max, this._min, this._max);
        return this;
    }

    // ------------------------------------------------------------------ Modifiers

    /** Add a modifier. The input is copied; the caller's object is never mutated. */
    addModifier(modifier: ResourceModifier): this {
        if (typeof modifier.id !== 'string' || modifier.id.trim().length === 0) {
            throw new Error('Resource.addModifier: modifier.id must be a non-empty string');
        }
        if (modifier.amountPerSecond == null || !Number.isFinite(modifier.amountPerSecond)) {
            throw new Error(`Resource.addModifier: modifier "${modifier.id}" has invalid amountPerSecond ${modifier.amountPerSecond}`);
        }
        if (modifier.durationSeconds != null && (!Number.isFinite(modifier.durationSeconds) || modifier.durationSeconds < 0)) {
            throw new Error(`Resource.addModifier: modifier "${modifier.id}" has invalid durationSeconds ${modifier.durationSeconds}`);
        }
        this.modifiers.set(modifier.id, {
            id: modifier.id,
            kind: modifier.kind,
            amountPerSecond: modifier.amountPerSecond,
            durationSeconds: modifier.durationSeconds,
            elapsedSeconds: 0,
        });
        return this;
    }

    removeModifier(id: string): this {
        this.modifiers.delete(id);
        return this;
    }

    hasModifier(id: string): boolean {
        return this.modifiers.has(id);
    }

    getEffectiveRegen(): number {
        let regen = this.baseRegenPerSecond;
        for (const mod of this.modifiers.values()) {
            if (mod.kind === 'regen') regen += mod.amountPerSecond;
        }
        return regen;
    }

    getEffectiveDecay(): number {
        let decay = this.baseDecayPerSecond;
        for (const mod of this.modifiers.values()) {
            if (mod.kind === 'decay') decay += mod.amountPerSecond;
        }
        return decay;
    }

    // ------------------------------------------------------------------ Tick

    update(dtSeconds: number): this {
        if (!Number.isFinite(dtSeconds) || dtSeconds < 0) {
            throw new Error(`Resource.update: dtSeconds must be a finite number >= 0, got ${dtSeconds}`);
        }
        for (const [id, mod] of this.modifiers) {
            if (mod.durationSeconds != null) {
                mod.elapsedSeconds += dtSeconds;
                if (mod.elapsedSeconds >= mod.durationSeconds) {
                    this.modifiers.delete(id);
                }
            }
        }
        const delta = (this.getEffectiveRegen() - this.getEffectiveDecay()) * dtSeconds;
        if (delta !== 0) this.add(delta);
        return this;
    }

    // ------------------------------------------------------------------ Subscriptions

    /** Subscribe to value changes. Returns an unsubscribe function. */
    subscribeChange(listener: (oldValue: number, newValue: number) => void): () => void {
        this.changeListeners.add(listener);
        return () => {
            this.changeListeners.delete(listener);
        };
    }

    /** Subscribe to a threshold crossing. Returns an unsubscribe function. */
    onThreshold(threshold: number, direction: ThresholdDirection, listener: (newValue: number) => void): () => void {
        validateFinite(threshold, 'threshold');
        const entry: Threshold = { value: threshold, direction, listener };
        this.thresholds.push(entry);
        return () => {
            const i = this.thresholds.indexOf(entry);
            if (i >= 0) this.thresholds.splice(i, 1);
        };
    }

    // ------------------------------------------------------------------ Snapshot

    serialize(): ResourceSnapshotV1 {
        return {
            schemaVersion: 1,
            id: this.id,
            value: this._value,
            min: this._min,
            max: this._max,
            regenPerSecond: this.baseRegenPerSecond,
            decayPerSecond: this.baseDecayPerSecond,
            modifiers: [...this.modifiers.values()].map((m) => ({ ...m })),
        };
    }

    static deserialize(snapshot: ResourceSnapshotV1): Resource {
        if (snapshot.schemaVersion !== 1) {
            throw new Error(`Resource.deserialize: unsupported schemaVersion ${snapshot.schemaVersion}`);
        }
        const resource = new Resource({
            id: snapshot.id,
            min: snapshot.min,
            max: snapshot.max,
            regenPerSecond: snapshot.regenPerSecond,
            decayPerSecond: snapshot.decayPerSecond,
        });
        resource._value = clamp(snapshot.value, snapshot.min, snapshot.max);
        for (const m of snapshot.modifiers ?? []) {
            resource.modifiers.set(m.id, { ...m });
        }
        return resource;
    }

    // ------------------------------------------------------------------ Internals

    private notifyChange(oldValue: number, newValue: number): void {
        for (const listener of this.changeListeners) {
            listener(oldValue, newValue);
        }
        for (const t of this.thresholds) {
            let crossed = false;
            if (t.direction === 'below') crossed = oldValue >= t.value && newValue < t.value;
            else if (t.direction === 'above') crossed = oldValue <= t.value && newValue > t.value;
            else if (t.direction === 'cross') {
                crossed = (oldValue < t.value && newValue >= t.value) || (oldValue > t.value && newValue <= t.value);
            }
            if (crossed) t.listener(newValue);
        }
    }
}

/**
 * A computed numeric value derived from other ValueSource<number> inputs.
 * Read-on-demand (no cache, no listeners).
 */
export class DerivedResource implements ValueSource<number> {
    readonly id: string;
    private readonly dependencies: Record<string, ValueSource<number>>;
    private readonly formula: (deps: Record<string, number>) => number;
    private readonly min: number;
    private readonly max: number;

    constructor(config: {
        id?: string;
        dependencies: Record<string, ValueSource<number>>;
        formula: (deps: Record<string, number>) => number;
        min?: number;
        max?: number;
    }) {
        this.id = config.id ?? 'derived';
        this.dependencies = config.dependencies;
        this.formula = config.formula;
        this.min = config.min ?? -Infinity;
        this.max = config.max ?? Infinity;
        validateRange(this.min, this.max);
    }

    get(): number {
        const deps: Record<string, number> = {};
        for (const [name, source] of Object.entries(this.dependencies)) {
            deps[name] = source.get();
        }
        return clamp(this.formula(deps), this.min, this.max);
    }

    getPercent(): number {
        if (this.max === this.min) return 1;
        return (this.get() - this.min) / (this.max - this.min);
    }
}

/** Registers, looks up, and enumerates resources. Does not own update or serialization. */
export class ResourceRegistry {
    private readonly resources = new Map<string, Resource>();

    register(resource: Resource): this {
        this.resources.set(resource.id, resource);
        return this;
    }

    get(id: string): Resource | undefined {
        return this.resources.get(id);
    }

    require(id: string): Resource {
        const resource = this.resources.get(id);
        if (!resource) throw new Error(`ResourceRegistry: unknown id "${id}"`);
        return resource;
    }

    has(id: string): boolean {
        return this.resources.has(id);
    }

    delete(id: string): boolean {
        return this.resources.delete(id);
    }

    values(): IterableIterator<Resource> {
        return this.resources.values();
    }
}

function validateRange(min: number, max: number): void {
    if (!Number.isFinite(min) || !Number.isFinite(max)) {
        throw new Error(`Resource: min and max must be finite, got min=${min} max=${max}`);
    }
    if (min > max) {
        throw new Error(`Resource: min (${min}) cannot be greater than max (${max})`);
    }
}

function validateFinite(value: number, name: string): number {
    if (!Number.isFinite(value)) {
        throw new Error(`Resource: ${name} must be a finite number, got ${value}`);
    }
    return value;
}

function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
}
