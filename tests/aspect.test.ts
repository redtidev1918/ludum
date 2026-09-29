// tests/aspect.test.ts — Aspects 标签+等级数值模型规范
import { describe, it, expect } from 'vitest';
import {
    totalAspects,
    presentAspects,
    satisfiesAspects,
    combineAspects,
    applyAspectDelta,
    aspectLevel,
    type Aspects,
} from '../src/gamelib/aspect';

describe('Aspects — 聚合与门槛', () => {
    it('totalAspects 求所有等级之和', () => {
        expect(totalAspects({ lantern: 2, grail: 3 })).toBe(5);
        expect(totalAspects({})).toBe(0);
    });

    it('presentAspects 只返回 > 0 的键', () => {
        expect(presentAspects({ lantern: 2, grail: 0, edge: 1 })).toEqual(['lantern', 'edge']);
        expect(presentAspects({})).toEqual([]);
    });

    it('satisfiesAspects 判断门槛(所有项分别达标)', () => {
        const have: Aspects = { lantern: 3, grail: 2 };
        expect(satisfiesAspects(have, { lantern: 2 })).toBe(true);
        expect(satisfiesAspects(have, { lantern: 4 })).toBe(false);
        expect(satisfiesAspects(have, { lantern: 2, grail: 2 })).toBe(true);
        expect(satisfiesAspects(have, { lantern: 2, edge: 1 })).toBe(false);
        expect(satisfiesAspects({}, {})).toBe(true);
    });

    it('combineAspects 叠加多个记录', () => {
        expect(combineAspects({ a: 1 }, { b: 2 }, { a: 2 })).toEqual({ a: 3, b: 2 });
        expect(combineAspects()).toEqual({});
    });

    it('applyAspectDelta 支持正负与下限', () => {
        expect(applyAspectDelta({ a: 5, b: 1 }, { a: -2, c: 3 })).toEqual({ a: 3, b: 1, c: 3 });
        expect(applyAspectDelta({ a: 1 }, { a: -5 }, 0)).toEqual({ a: 0 });
        expect(applyAspectDelta({ a: 1 }, { a: -1 }, 2)).toEqual({ a: 2 });
    });

    it('aspectLevel 缺失为 0', () => {
        expect(aspectLevel({ a: 2 }, 'a')).toBe(2);
        expect(aspectLevel({ a: 2 }, 'b')).toBe(0);
    });
});