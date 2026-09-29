// tests/situation.test.ts — Situation + Heartbeat 并行叙事规范
import { describe, it, expect } from 'vitest';
import { Situation, Heartbeat } from '../src/gamelib/narrative/situation';

describe('Situation — 生命周期与倒计时', () => {
    it('初始为 idle, 事件未填满时不推进', () => {
        const s = new Situation({ id: 'ritual', slots: [{ id: 'main', requiredAspects: { lantern: 2 } }], durationSeconds: 10 });
        expect(s.state).toBe('idle');
        s.advance(1);
        expect(s.state).toBe('idle'); // 未 start
    });

    it('start 后进入 running, 填满输入后才倒计时', () => {
        const s = new Situation({ id: 'ritual', slots: [{ id: 'main', requiredAspects: { lantern: 2 } }], durationSeconds: 10 });
        s.fill('main', { lantern: 2 });
        expect(s.isReadyInput).toBe(true);
        s.start();
        expect(s.isRunning).toBe(true);
        expect(s.advance(5)).toBe(false);
        expect(s.advance(5)).toBe(true); // 第10s 到界
        expect(s.state).toBe('ready');
    });

    it('未填满输入时倒计时不推进', () => {
        const s = new Situation({ id: 'r', slots: [{ id: 'x', requiredAspects: { a: 1 } }], durationSeconds: 3 });
        s.start();
        expect(s.advance(10)).toBe(false);
        expect(s.state).toBe('running');
    });

    it('complete 只在 ready 后生效', () => {
        const s = new Situation({ id: 'r', slots: [], durationSeconds: 1 });
        expect(isStrictComplete(s)).toBe(false);
        s.start();
        s.advance(1);
        s.complete();
        expect(s.state).toBe('complete');
        s.complete(); // 幂等
        expect(s.state).toBe('complete');
    });

    it('fill 未知槽位或重复填充返回 false', () => {
        const s = new Situation({ id: 'r', slots: [{ id: 'a' }] });
        expect(s.fill('nope', {})).toBe(false);
        expect(s.fill('a', {})).toBe(true);
        expect(s.fill('a', {})).toBe(false);
    });

    it('reset 回到 idle', () => {
        const s = new Situation({ id: 'r', durationSeconds: 1 });
        s.start();
        expect(s.isRunning).toBe(true);
        s.reset();
        expect(s.state).toBe('idle');
    });

    it('onReady 在到界时触发一次', () => {
        const s = new Situation({ id: 'r', slots: [], durationSeconds: 2 });
        let calls = 0;
        s.onReady = () => calls++;
        s.start();
        s.advance(1);
        expect(calls).toBe(0);
        s.advance(1);
        expect(calls).toBe(1);
        s.advance(1); // 已完成, 不再触发
        expect(calls).toBe(1);
    });

    it('需要独特 slot id', () => {
        expect(() => new Situation({ id: 'r', slots: [{ id: 'a' }, { id: 'a' }] })).toThrow(/duplicate/);
    });

    it('serialize 快照', () => {
        const s = new Situation({ id: 'r', slots: [{ id: 'a' }], durationSeconds: 5 });
        s.fill('a', { x: 1 });
        s.start();
        const snap = s.serialize();
        expect(snap.schemaVersion).toBe(1);
        expect(snap.id).toBe('r');
        expect(snap.state).toBe('running');
        expect(snap.fills).toEqual({ a: { x: 1 } });
        expect(snap.remainingSeconds).toBe(5);
    });
});

describe('Heartbeat — 并行推进', () => {
    it('一次 tick 推进所有 running situation, 返回到界的', () => {
        const h = new Heartbeat();
        const s1 = new Situation({ id: 'a', slots: [], durationSeconds: 2 });
        const s2 = new Situation({ id: 'b', slots: [], durationSeconds: 4 });
        h.add(s1).add(s2);
        s1.start(); s2.start();
        expect(h.advance(2)).toEqual([s1]);
        expect(h.advance(2)).toEqual([s2]);
        expect(s1.state).toBe('ready');
        expect(s2.state).toBe('ready');
    });

    it('重复 id 拒绝', () => {
        const h = new Heartbeat();
        h.add(new Situation({ id: 'x' }));
        expect(() => h.add(new Situation({ id: 'x' }))).toThrow(/duplicate/);
    });

    it('get/has/clear', () => {
        const h = new Heartbeat();
        const s = new Situation({ id: 'only' });
        h.add(s);
        expect(h.has('only')).toBe(true);
        expect(h.get('only')).toBe(s);
        h.clear();
        expect(h.has('only')).toBe(false);
    });
});

function isStrictComplete(s: Situation): boolean {
    return s.state === 'complete';
}