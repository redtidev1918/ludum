/**
 * StateMachine — pure gameplay state logic (see docs/adr/0002).
 * Knows nothing about textures, renderers, or image loading.
 */
import type { Predicate } from './predicate.js';

export type EasingFunction = (t: number) => number;

export const Easing = {
    linear: (t) => t,
    inQuad: (t) => t * t,
    outQuad: (t) => t * (2 - t),
    inOutQuad: (t) => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t),
    inCubic: (t) => t * t * t,
    outCubic: (t) => 1 + (t - 1) ** 3,
    inOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : 1 + (t - 1) ** 3 * 4),
    outElastic: (t) => {
        if (t === 0 || t === 1) return t;
        return Math.pow(2, -10 * t) * Math.sin((t - 0.1) * 5 * Math.PI) + 1;
    },
    outBounce: (t) => {
        if (t < 1 / 2.75) return 7.5625 * t * t;
        if (t < 2 / 2.75) { t -= 1.5 / 2.75; return 7.5625 * t * t + 0.75; }
        if (t < 2.5 / 2.75) { t -= 2.25 / 2.75; return 7.5625 * t * t + 0.9375; }
        t -= 2.625 / 2.75;
        return 7.5625 * t * t + 0.984375;
    },
} satisfies Record<string, EasingFunction>;

export interface StateTransition {
    durationSeconds?: number;
    easing?: EasingFunction;
}

export interface StateCondition<TContext> {
    state: string;
    when: Predicate<TContext>;
    priority?: number;
}

export interface StateMachineConfig<TContext> {
    states: readonly string[];
    initialState?: string;
    defaultTransition?: StateTransition;
    /** Transitions keyed by "from->to". */
    transitions?: Record<string, StateTransition>;
    /** Priority-ordered conditions that auto-switch state via updateContext. */
    conditions?: readonly StateCondition<TContext>[];
}

export class StateMachine<TContext = Record<string, unknown>> {
    private readonly states: Set<string>;
    private readonly initialState: string;
    private currentState: string | null;
    private previousState: string | null = null;
    private temporary: { state: string; remainingSeconds: number } | null = null;
    private progress = 1;
    private durationSeconds = 0;
    private easing: EasingFunction = Easing.linear;
    private readonly defaultTransition: StateTransition;
    private readonly transitions: Map<string, StateTransition>;
    private readonly conditions: StateCondition<TContext>[];
    private readonly listeners = new Set<(oldState: string, newState: string) => void>();

    constructor(config: StateMachineConfig<TContext>) {
        if (config.states.length === 0) throw new Error('StateMachine: states must not be empty');
        this.states = new Set(config.states);
        if (this.states.size !== config.states.length) throw new Error('StateMachine: duplicate state names');
        const initialState = config.initialState ?? config.states[0]!;
        if (!this.states.has(initialState)) throw new Error(`StateMachine: unknown initialState "${initialState}"`);
        this.initialState = initialState;
        this.currentState = initialState;
        this.defaultTransition = { durationSeconds: 0.3, easing: Easing.outQuad, ...(config.defaultTransition ?? {}) };
        this.transitions = new Map(Object.entries(config.transitions ?? {}));
        this.conditions = [...(config.conditions ?? [])].sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
        for (const condition of this.conditions) {
            if (!this.states.has(condition.state)) throw new Error(`StateMachine: condition references unknown state "${condition.state}"`);
        }
    }

    /** Current display state (temporary override if active, otherwise the base state). */
    getState(): string | null {
        return this.temporary?.state ?? this.currentState;
    }

    getPreviousState(): string | null {
        return this.previousState;
    }

    isTransitioning(): boolean {
        return this.progress < 1;
    }

    /** Raw cross-fade progress in [0, 1]. Apply getTransitionEasing() yourself. */
    getTransitionProgress(): number {
        return this.progress;
    }

    getTransitionEasing(): EasingFunction {
        return this.easing;
    }

    setState(state: string, options?: { durationSeconds?: number }): this {
        if (!this.states.has(state)) throw new Error(`StateMachine: unknown state "${state}"`);
        if (options?.durationSeconds != null) {
            if (!Number.isFinite(options.durationSeconds) || options.durationSeconds < 0) {
                throw new Error(`StateMachine.setState: durationSeconds must be a finite number >= 0, got ${options.durationSeconds}`);
            }
            this.temporary = { state, remainingSeconds: options.durationSeconds };
        } else {
            this.transitionTo(state);
        }
        return this;
    }

    update(dtSeconds: number): this {
        if (!Number.isFinite(dtSeconds) || dtSeconds < 0) {
            throw new Error(`StateMachine.update: dtSeconds must be a finite number >= 0, got ${dtSeconds}`);
        }
        if (this.temporary) {
            this.temporary.remainingSeconds -= dtSeconds;
            if (this.temporary.remainingSeconds <= 0) this.temporary = null;
        }
        if (this.progress < 1) {
            this.progress += this.durationSeconds > 0 ? dtSeconds / this.durationSeconds : 1;
            if (this.progress >= 1) {
                this.progress = 1;
                this.previousState = null;
            }
        }
        return this;
    }

    /**
     * Evaluate conditions in priority order; the first matching condition wins.
     * When no condition matches, revert to the initial state.
     */
    updateContext(context: Readonly<TContext>): this {
        let matched: string | null = null;
        for (const condition of this.conditions) {
            if (condition.when(context)) {
                matched = condition.state;
                break;
            }
        }
        const target = matched ?? this.initialState;
        if (target !== this.currentState) this.transitionTo(target);
        return this;
    }

    /** Subscribe to state changes. Returns an unsubscribe function. */
    onStateChange(listener: (oldState: string, newState: string) => void): () => void {
        this.listeners.add(listener);
        return () => {
            this.listeners.delete(listener);
        };
    }

    private transitionTo(newState: string): void {
        if (newState === this.currentState) return;
        const oldState = this.currentState as string;
        this.previousState = oldState;
        this.currentState = newState;
        const transition = this.transitions.get(oldState + '->' + newState) ?? this.defaultTransition;
        this.durationSeconds = transition.durationSeconds ?? 0.3;
        this.easing = transition.easing ?? Easing.outQuad;
        this.progress = this.durationSeconds <= 0 ? 1 : 0;
        if (this.progress >= 1) this.previousState = null;
        for (const listener of this.listeners) listener(oldState, newState);
    }
}
