// tests/dialogue.test.ts — Dialogue v3 specification
import { describe, it, expect } from 'vitest';
import {
    DialogueSession,
    type DialogueDefinition,
    selectLine,
    formatDialogueText,
} from '../src/gamelib/dialogue';
import { SequenceRandom } from '../src/gamelib/runtime/random';

interface Ctx { hp: number; gold: number; }

const tree: DialogueDefinition<Ctx> = {
    startNodeId: 'start',
    nodes: {
        start: {
            text: 'What do you do?',
            choices: [
                { id: 'fight', text: 'Fight!', next: 'fight' },
                { id: 'rest', text: 'Rest', next: 'rest' },
                { id: 'leave', text: 'Leave' },
                { id: 'rich', text: 'Bribe', next: 'bribe', condition: (c) => c.gold > 100 },
            ],
        },
        fight: { text: 'You fought!', action: (c) => { c.hp -= 20; }, next: 'start' },
        rest: { text: 'You rested', next: 'start' },
        bribe: { text: 'You bribed the guard', next: 'start' },
    },
};

describe('DialogueSession', () => {
    it('starts at the start node', () => {
        const s = new DialogueSession<Ctx>(tree, { hp: 100, gold: 0 });
        expect(s.getText()).toBe('What do you do?');
        expect(s.isEnded()).toBe(false);
    });

    it('getChoices filters by condition', () => {
        const poor = new DialogueSession<Ctx>(tree, { hp: 100, gold: 0 });
        expect(poor.getChoices().map((c) => c.id)).toEqual(['fight', 'rest', 'leave']);

        const rich = new DialogueSession<Ctx>(tree, { hp: 100, gold: 200 });
        expect(rich.getChoices().map((c) => c.id)).toEqual(['fight', 'rest', 'leave', 'rich']);
    });

    it('choose by id advances; the node action runs on continue', () => {
        const s = new DialogueSession<Ctx>(tree, { hp: 100, gold: 0 });
        expect(s.choose('fight')).toBe(true);
        expect(s.getText()).toBe('You fought!');
        expect(s.getContext().hp).toBe(100); // node action deferred to continue
        s.continue();
        expect(s.getContext().hp).toBe(80); // node action ran
        expect(s.getText()).toBe('What do you do?'); // back at start
    });

    it('chooseIndex advances by 0-based index', () => {
        const s = new DialogueSession<Ctx>(tree, { hp: 100, gold: 0 });
        expect(s.chooseIndex(0)).toBe(true); // fight
        expect(s.getText()).toBe('You fought!');
    });

    it('choosing a choice without next ends the dialogue', () => {
        const s = new DialogueSession<Ctx>(tree, { hp: 100, gold: 0 });
        expect(s.choose('leave')).toBe(true);
        expect(s.isEnded()).toBe(true);
    });

    it('continue advances a non-choice node', () => {
        const def: DialogueDefinition<Ctx> = {
            startNodeId: 'a',
            nodes: {
                a: { text: 'First', next: 'b' },
                b: { text: 'Second' },
            },
        };
        const s = new DialogueSession<Ctx>(def, { hp: 1, gold: 1 });
        expect(s.continue()).toBe(true);
        expect(s.getText()).toBe('Second');
    });

    it('goTo jumps to a node and records history', () => {
        const s = new DialogueSession<Ctx>(tree, { hp: 100, gold: 0 });
        s.goTo('rest');
        expect(s.getText()).toBe('You rested');
        expect(s.getHistory()).toEqual(['start', 'rest']);
    });

    it('rejects an unknown start node', () => {
        expect(() => new DialogueSession<Ctx>({ startNodeId: 'nope', nodes: {} }, { hp: 1, gold: 1 }))
            .toThrow(/startNodeId/);
    });
});

describe('selectLine', () => {
    it('picks the highest-priority matching line, random among ties', () => {
        const lines = [
            { id: 'idle', text: 'idle', priority: 0 },
            { id: 'warn', text: 'warn', priority: 10, condition: (c: Ctx) => c.hp < 30 },
        ];
        const r = new SequenceRandom([0]);
        expect(selectLine(lines, { hp: 50, gold: 0 }, r)!.id).toBe('idle');
        expect(selectLine(lines, { hp: 10, gold: 0 }, r)!.id).toBe('warn');
    });

    it('returns undefined when nothing matches', () => {
        const lines = [{ id: 'x', text: 'x', condition: (c: Ctx) => c.hp < 0 }];
        expect(selectLine(lines, { hp: 50, gold: 0 }, new SequenceRandom([0]))).toBeUndefined();
    });
});

describe('formatDialogueText', () => {
    it('interpolates {field} placeholders and leaves unknown fields', () => {
        expect(formatDialogueText('Hi {name}, you have {gold} gold and {missing}', { name: 'Ada', gold: 42 }))
            .toBe('Hi Ada, you have 42 gold and {missing}');
    });
});
