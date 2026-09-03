// tests/state-machine.test.ts — StateMachine v3 specification
import { describe, it, expect } from 'vitest';
import { StateMachine, Easing } from '../src/gamelib/state-machine';
import type { VisualStateMap } from '../src/gamelib/visual-state';

interface Ctx { hp: number; money: number; }

describe('StateMachine', () => {
    it('starts in the initial state', () => {
        const sm = new StateMachine({ states: ['idle', 'run'] });
        expect(sm.getState()).toBe('idle');
        const sm2 = new StateMachine({ states: ['idle', 'run'], initialState: 'run' });
        expect(sm2.getState()).toBe('run');
    });

    it('setState transitions and fires onStateChange', () => {
        const sm = new StateMachine({ states: ['a', 'b'] });
        const changes: string[] = [];
        sm.onStateChange((oldS, newS) => changes.push(oldS + '->' + newS));
        sm.setState('b');
        expect(sm.getState()).toBe('b');
        expect(changes).toEqual(['a->b']);
    });

    it('onStateChange returns an unsubscribe', () => {
        const sm = new StateMachine({ states: ['a', 'b'] });
        let count = 0;
        const unsubscribe = sm.onStateChange(() => count++);
        sm.setState('b');
        unsubscribe();
        sm.setState('a');
        expect(count).toBe(1);
    });

    it('setState with duration creates a temporary override that reverts', () => {
        const sm = new StateMachine({ states: ['neutral', 'happy'] });
        sm.setState('happy', { durationSeconds: 2 });
        expect(sm.getState()).toBe('happy');
        sm.update(1);
        expect(sm.getState()).toBe('happy');
        sm.update(1.5);
        expect(sm.getState()).toBe('neutral');
    });

    it('updateContext auto-switches by priority', () => {
        const sm = new StateMachine<Ctx>({
            states: ['neutral', 'happy', 'critical'],
            conditions: [
                { state: 'happy', when: (c) => c.money > 100, priority: 1 },
                { state: 'critical', when: (c) => c.hp < 20, priority: 10 },
            ],
        });
        sm.updateContext({ hp: 10, money: 150 });
        expect(sm.getState()).toBe('critical');
        sm.updateContext({ hp: 50, money: 150 });
        expect(sm.getState()).toBe('happy');
        sm.updateContext({ hp: 50, money: 50 });
        expect(sm.getState()).toBe('neutral');
    });

    it('tracks transition progress and easing', () => {
        const sm = new StateMachine({ states: ['a', 'b'], defaultTransition: { durationSeconds: 1, easing: Easing.linear } });
        expect(sm.isTransitioning()).toBe(false);
        sm.setState('b');
        expect(sm.isTransitioning()).toBe(true);
        expect(sm.getTransitionProgress()).toBe(0);
        sm.update(0.5);
        expect(sm.getTransitionProgress()).toBeCloseTo(0.5, 6);
        sm.update(0.5);
        expect(sm.isTransitioning()).toBe(false);
    });

    it('uses a specific "from->to" transition when defined', () => {
        const sm = new StateMachine({
            states: ['a', 'b'],
            transitions: { 'a->b': { durationSeconds: 2, easing: Easing.outQuad } },
        });
        sm.setState('b');
        expect(sm.getTransitionEasing()).toBe(Easing.outQuad);
        sm.update(1);
        expect(sm.getTransitionProgress()).toBeCloseTo(0.5, 6);
    });

    it('rejects invalid configuration', () => {
        expect(() => new StateMachine({ states: [] })).toThrow(/empty/);
        expect(() => new StateMachine({ states: ['a', 'a'] })).toThrow(/duplicate/);
        expect(() => new StateMachine({ states: ['a'], initialState: 'nope' })).toThrow(/initialState/);
    });

    it('rejects unknown state and negative dt', () => {
        const sm = new StateMachine({ states: ['a'] });
        expect(() => sm.setState('nope')).toThrow(/unknown state/);
        expect(() => sm.update(-0.1)).toThrow(/dtSeconds/);
    });
});

describe('Easing', () => {
    it('linear and outQuad behave correctly', () => {
        expect(Easing.linear(0)).toBe(0);
        expect(Easing.linear(1)).toBe(1);
        expect(Easing.outQuad(0)).toBe(0);
        expect(Easing.outQuad(1)).toBe(1);
        expect(Easing.outQuad(0.5)).toBeCloseTo(0.75, 6);
    });
});

describe('VisualStateMap', () => {
    it('is a plain readonly record of state -> metadata', () => {
        const map: VisualStateMap = {
            idle: { textureKey: 'idle.png' },
            run: { textureKey: 'run.png', scale: 1.5 },
        };
        expect(map.idle!.textureKey).toBe('idle.png');
        expect(map.run!.scale).toBe(1.5);
    });
});
