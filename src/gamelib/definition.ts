/** Common shape for immutable, id-addressed definitions (see docs/adr/0002). */
export interface Definition {
    readonly id: string;
}

/** A small read-only registry for id-addressed definitions. Authoring-time, not hot-reload. */
export class DefinitionRegistry<T extends Definition> {
    private readonly byId = new Map<string, T>();

    constructor(definitions?: readonly T[]) {
        for (const definition of definitions ?? []) {
            this.add(definition);
        }
    }

    add(definition: T): this {
        if (this.byId.has(definition.id)) {
            throw new Error(`DefinitionRegistry: duplicate id "${definition.id}"`);
        }
        this.byId.set(definition.id, definition);
        return this;
    }

    get(id: string): T | undefined {
        return this.byId.get(id);
    }

    require(id: string): T {
        const definition = this.byId.get(id);
        if (!definition) {
            throw new Error(`DefinitionRegistry: unknown id "${id}"`);
        }
        return definition;
    }

    has(id: string): boolean {
        return this.byId.has(id);
    }

    values(): IterableIterator<T> {
        return this.byId.values();
    }

    get size(): number {
        return this.byId.size;
    }
}
