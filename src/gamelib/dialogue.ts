/**
 * Dialogue — data-driven branching dialogue (see docs/adr/0002, 0004).
 * Definition (static nodes/choices) is separated from Session (runtime traversal).
 * Choices use stable string ids, not 1-based indices. Conditions are Predicate<TContext>;
 * for serializable data use ConditionExpression + evaluateCondition.
 */
import type { Predicate } from './predicate.js';
import type { RandomSource } from './runtime/random.js';

export interface DialogueChoice<TContext> {
    id: string;
    text: string;
    /** Node id to advance to; omit to end the dialogue. */
    next?: string;
    condition?: Predicate<TContext>;
    action?: (context: TContext) => void;
}

export interface DialogueNode<TContext> {
    text: string;
    speaker?: string;
    choices?: readonly DialogueChoice<TContext>[];
    /** For non-choice nodes: auto-advance target. */
    next?: string;
    action?: (context: TContext) => void;
}

export interface DialogueDefinition<TContext> {
    nodes: Readonly<Record<string, DialogueNode<TContext>>>;
    startNodeId: string;
}

export class DialogueSession<TContext> {
    readonly definition: DialogueDefinition<TContext>;
    private context: TContext;
    private currentNodeId: string | null;
    private readonly history: string[] = [];

    constructor(definition: DialogueDefinition<TContext>, initialContext: TContext) {
        if (!definition.nodes[definition.startNodeId]) {
            throw new Error(`DialogueSession: unknown startNodeId "${definition.startNodeId}"`);
        }
        this.definition = definition;
        this.context = initialContext;
        this.currentNodeId = definition.startNodeId;
        this.history.push(definition.startNodeId);
    }

    getCurrentNode(): DialogueNode<TContext> | null {
        return this.currentNodeId != null ? this.definition.nodes[this.currentNodeId] : null;
    }

    getText(): string | null {
        return this.getCurrentNode()?.text ?? null;
    }

    /** Choices whose condition (if any) passes for the current context. */
    getChoices(): readonly DialogueChoice<TContext>[] {
        const node = this.getCurrentNode();
        if (!node?.choices) return [];
        return node.choices.filter((choice) => !choice.condition || choice.condition(this.context));
    }

    /** Choose a choice by its stable id. */
    choose(choiceId: string): boolean {
        const node = this.getCurrentNode();
        const choice = node?.choices?.find((c) => c.id === choiceId);
        if (!choice) return false;
        if (choice.condition && !choice.condition(this.context)) return false;
        choice.action?.(this.context);
        this.advanceTo(choice.next);
        return true;
    }

    /** Choose by 0-based index into the available choices. */
    chooseIndex(index: number): boolean {
        const choices = this.getChoices();
        const choice = choices[index];
        return choice ? this.choose(choice.id) : false;
    }

    /** Advance a non-choice node (or any node without choices). */
    continue(): boolean {
        const node = this.getCurrentNode();
        if (!node) return false;
        if (node.choices && node.choices.length > 0) return false;
        node.action?.(this.context);
        this.advanceTo(node.next);
        return this.currentNodeId != null;
    }

    goTo(nodeId: string): boolean {
        if (!this.definition.nodes[nodeId]) return false;
        this.advanceTo(nodeId);
        return true;
    }

    isEnded(): boolean {
        return this.currentNodeId == null;
    }

    getContext(): TContext {
        return this.context;
    }

    getHistory(): readonly string[] {
        return this.history;
    }

    private advanceTo(nodeId: string | undefined): void {
        if (nodeId != null && this.definition.nodes[nodeId]) {
            this.currentNodeId = nodeId;
            this.history.push(nodeId);
        } else {
            this.currentNodeId = null;
        }
    }
}

// ---------------------------------------------------------------------------
// Line pool — conditional one-liner selection (replaces the v1 DialogueLibrary)
// ---------------------------------------------------------------------------

export interface DialogueLine<TContext> {
    id: string;
    text: string;
    condition?: Predicate<TContext>;
    priority?: number;
}

/** Pick the highest-priority matching line, random among ties. Pure (no cooldown state). */
export function selectLine<TContext>(
    lines: readonly DialogueLine<TContext>[],
    context: Readonly<TContext>,
    random: RandomSource,
): DialogueLine<TContext> | undefined {
    const available = lines.filter((line) => !line.condition || line.condition(context));
    if (available.length === 0) return undefined;
    const maxPriority = available.reduce((max, line) => Math.max(max, line.priority ?? 0), -Infinity);
    const top = available.filter((line) => (line.priority ?? 0) === maxPriority);
    return top[Math.floor(random.next() * top.length)];
}

/** Replace {field} placeholders with context values. Leaves unknown fields as-is. */
export function formatDialogueText<TContext>(text: string, context: Readonly<TContext>): string {
    return text.replace(/\{(\w+)\}/g, (match, name: string) => {
        const value = (context as Record<string, unknown>)[name];
        return value != null ? String(value) : match;
    });
}
