// tests/rules.test.ts — ConditionExpression / Definition / Validation specification
import { describe, it, expect } from 'vitest';
import { evaluateCondition, type ConditionExpression } from '../src/gamelib/condition-expression';
import { DefinitionRegistry, type Definition } from '../src/gamelib/definition';
import { ok, fail } from '../src/gamelib/validation';

describe('evaluateCondition', () => {
    const ctx = { hp: 50, mood: 'happy', day: 'sat' };

    it('evaluates comparisons', () => {
        expect(evaluateCondition({ kind: 'lessThan', field: 'hp', value: 20 }, ctx)).toBe(false);
        expect(evaluateCondition({ kind: 'greaterThan', field: 'hp', value: 20 }, ctx)).toBe(true);
        expect(evaluateCondition({ kind: 'greaterOrEqual', field: 'hp', value: 50 }, ctx)).toBe(true);
        expect(evaluateCondition({ kind: 'lessOrEqual', field: 'hp', value: 50 }, ctx)).toBe(true);
    });

    it('evaluates equality', () => {
        expect(evaluateCondition({ kind: 'equals', field: 'mood', value: 'happy' }, ctx)).toBe(true);
        expect(evaluateCondition({ kind: 'notEquals', field: 'mood', value: 'sad' }, ctx)).toBe(true);
    });

    it('evaluates in and between', () => {
        expect(evaluateCondition({ kind: 'in', field: 'day', values: ['sat', 'sun'] }, ctx)).toBe(true);
        expect(evaluateCondition({ kind: 'between', field: 'hp', min: 30, max: 70 }, ctx)).toBe(true);
    });

    it('evaluates all / any / not composition', () => {
        const expr: ConditionExpression = {
            kind: 'all',
            conditions: [
                { kind: 'greaterThan', field: 'hp', value: 20 },
                { kind: 'not', condition: { kind: 'equals', field: 'mood', value: 'sad' } },
            ],
        };
        expect(evaluateCondition(expr, ctx)).toBe(true);

        const anyExpr: ConditionExpression = {
            kind: 'any',
            conditions: [
                { kind: 'lessThan', field: 'hp', value: 0 },
                { kind: 'equals', field: 'mood', value: 'happy' },
            ],
        };
        expect(evaluateCondition(anyExpr, ctx)).toBe(true);
    });

    it('is JSON-serializable plain data', () => {
        const expr: ConditionExpression = { kind: 'all', conditions: [{ kind: 'lessThan', field: 'hp', value: 20 }] };
        const reparsed = JSON.parse(JSON.stringify(expr)) as ConditionExpression;
        expect(evaluateCondition(reparsed, { hp: 10 })).toBe(true);
    });
});

describe('DefinitionRegistry', () => {
    interface Item extends Definition { label: string; }

    it('registers and retrieves definitions', () => {
        const registry = new DefinitionRegistry<Item>([{ id: 'a', label: 'A' }]);
        expect(registry.get('a')!.label).toBe('A');
        expect(registry.has('a')).toBe(true);
        expect(registry.get('nope')).toBeUndefined();
    });

    it('require throws on an unknown id', () => {
        const registry = new DefinitionRegistry<Item>();
        expect(() => registry.require('nope')).toThrow(/unknown id/);
    });

    it('rejects duplicate ids', () => {
        expect(() => new DefinitionRegistry<Item>([{ id: 'a', label: 'A' }, { id: 'a', label: 'B' }])).toThrow(/duplicate/);
    });

    it('enumerates values', () => {
        const registry = new DefinitionRegistry<Item>([{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }]);
        expect([...registry.values()].map((d) => d.id).sort()).toEqual(['a', 'b']);
        expect(registry.size).toBe(2);
    });
});

describe('CompileResult', () => {
    it('ok and fail build structured results', () => {
        expect(ok(42)).toEqual({ ok: true, value: 42 });
        const result = fail<number>([{ path: 'hp.max', code: 'MIN_GT_MAX', message: 'min > max' }]);
        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.errors[0]!.code).toBe('MIN_GT_MAX');
        }
    });
});
