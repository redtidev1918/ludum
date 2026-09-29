// tests/deck.test.ts — Deck 定义/实例分离抽牌规范
import { describe, it, expect } from 'vitest';
import { DeckInstance, createDeck, type DeckSpec } from '../src/gamelib/deck';
import { SeededRandom } from '../src/gamelib/runtime/random';

function baseSpec(over: Partial<DeckSpec> = {}): DeckSpec {
    return {
        id: 'd',
        startingCards: ['a', 'b', 'c', 'd'],
        ...over,
    };
}

describe('DeckInstance — 抽牌', () => {
    it('初始 size = startingCards 数量', () => {
        const d = new DeckInstance(baseSpec(), new SeededRandom(1));
        expect(d.size).toBe(4);
    });

    it('抽一张移除一张, 不重复', () => {
        const d = new DeckInstance(baseSpec(), new SeededRandom(7));
        const drawn: string[] = [];
        for (let i = 0; i < 4; i++) {
            const card = d.draw();
            expect(card).toBeDefined();
            drawn.push(card!);
        }
        expect(new Set(drawn).size).toBe(4); // 全部不同
        expect(d.size).toBe(0);
    });

    it('resetOnExhaustion 抽空后重填', () => {
        const d = new DeckInstance(baseSpec({ resetOnExhaustion: true }), new SeededRandom(3));
        for (let i = 0; i < 4; i++) d.draw();
        expect(d.size).toBe(0);
        expect(d.draw()).toBeDefined(); // 空后重填再抽
        expect(d.size).toBe(3);
    });

    it('无 resetOnExhaustion 但设 defaultCard, 空后返兜底卡', () => {
        const d = new DeckInstance(baseSpec({ defaultCard: 'joker' }), new SeededRandom(5));
        for (let i = 0; i < 4; i++) d.draw();
        expect(d.draw()).toBe('joker');
        expect(d.size).toBe(0);
    });

    it('无兜底且不重置, 空后返回 undefined', () => {
        const d = new DeckInstance(baseSpec(), new SeededRandom(9));
        for (let i = 0; i < 4; i++) d.draw();
        expect(d.draw()).toBeUndefined();
    });

    it('removeCard 移除并计入 eliminated', () => {
        const d = new DeckInstance(baseSpec(), new SeededRandom(2));
        expect(d.removeCard('x')).toBe(false);
        expect(d.removeCard('a')).toBe(true);
        const snap = d.serialize();
        expect(snap.eliminated).toContain('a');
    });

    it('reset 清空 eliminated 并重填池', () => {
        const d = new DeckInstance(baseSpec(), new SeededRandom(4));
        d.draw(); d.draw();
        d.reset();
        expect(d.size).toBe(4);
        expect(d.serialize().eliminated).toEqual([]);
    });

    it('Same seed 抽取序列确定(确定性)', () => {
        const d1 = new DeckInstance(baseSpec(), new SeededRandom(42));
        const d2 = new DeckInstance(baseSpec(), new SeededRandom(42));
        const s1 = [d1.draw(), d1.draw(), d1.draw()];
        const s2 = [d2.draw(), d2.draw(), d2.draw()];
        expect(s1).toEqual(s2);
    });

    it('createDeck 工厂', () => {
        const d = createDeck(baseSpec(), new SeededRandom(0));
        expect(d.spec.id).toBe('d');
        expect(d.size).toBe(4);
    });

    it('serialize 快照可复现结构', () => {
        const d = new DeckInstance(baseSpec(), new SeededRandom(1));
        d.draw();
        const snap = d.serialize();
        expect(snap.schemaVersion).toBe(1);
        expect(snap.specId).toBe('d');
        expect(snap.cards.length + snap.eliminated.length).toBe(4);
    });
});