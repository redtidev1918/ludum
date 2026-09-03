/**
 * A minimal, JSON-serializable condition expression (see docs/adr/0002).
 * Replaces the Lua-style `['<', 20]` array DSL with a typed discriminated union.
 */
export type ConditionExpression =
    | { kind: 'equals'; field: string; value: unknown }
    | { kind: 'notEquals'; field: string; value: unknown }
    | { kind: 'lessThan'; field: string; value: number }
    | { kind: 'lessOrEqual'; field: string; value: number }
    | { kind: 'greaterThan'; field: string; value: number }
    | { kind: 'greaterOrEqual'; field: string; value: number }
    | { kind: 'in'; field: string; values: readonly unknown[] }
    | { kind: 'between'; field: string; min: number; max: number }
    | { kind: 'all'; conditions: readonly ConditionExpression[] }
    | { kind: 'any'; conditions: readonly ConditionExpression[] }
    | { kind: 'not'; condition: ConditionExpression };

/** Evaluate a condition expression against a plain context. Pure and side-effect free. */
export function evaluateCondition(
    expression: ConditionExpression,
    context: Readonly<Record<string, unknown>>,
): boolean {
    const valueOf = (field: string): unknown => context[field];

    switch (expression.kind) {
        case 'equals':
            return valueOf(expression.field) === expression.value;
        case 'notEquals':
            return valueOf(expression.field) !== expression.value;
        case 'lessThan': {
            const v = valueOf(expression.field);
            return typeof v === 'number' && v < expression.value;
        }
        case 'lessOrEqual': {
            const v = valueOf(expression.field);
            return typeof v === 'number' && v <= expression.value;
        }
        case 'greaterThan': {
            const v = valueOf(expression.field);
            return typeof v === 'number' && v > expression.value;
        }
        case 'greaterOrEqual': {
            const v = valueOf(expression.field);
            return typeof v === 'number' && v >= expression.value;
        }
        case 'in': {
            const v = valueOf(expression.field);
            return expression.values.includes(v);
        }
        case 'between': {
            const v = valueOf(expression.field);
            return typeof v === 'number' && v >= expression.min && v <= expression.max;
        }
        case 'all':
            return expression.conditions.every((c) => evaluateCondition(c, context));
        case 'any':
            return expression.conditions.some((c) => evaluateCondition(c, context));
        case 'not':
            return !evaluateCondition(expression.condition, context);
    }
}
