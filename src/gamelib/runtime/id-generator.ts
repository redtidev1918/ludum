/** Stable id generation for runtime objects. Never use `Date.now()+Math.random()` for ids. */
export interface IdGenerator {
    next(): string;
}

/** Returns monotonically increasing ids ("1", "2", …), optionally prefixed. */
export class SequentialIdGenerator implements IdGenerator {
    private counter = 0;

    constructor(private readonly prefix = '') {}

    next(): string {
        this.counter += 1;
        return this.prefix + this.counter;
    }
}
