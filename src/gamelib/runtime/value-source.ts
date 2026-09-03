/**
 * A read-only source of a value. Resource and DerivedResource implement
 * `ValueSource<number>`, so downstream modules (e.g. procedural shapes) depend on
 * this minimal capability instead of the Resource subsystem (see ADR dependency rules).
 */
export interface ValueSource<T> {
    get(): T;
}
