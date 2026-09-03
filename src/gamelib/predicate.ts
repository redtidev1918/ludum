/** A pure, side-effect-free predicate over a read-only context. */
export type Predicate<T> = (context: Readonly<T>) => boolean;
