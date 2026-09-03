/**
 * A typed, instance-local event signal (see docs/adr/0007-local-signals-over-global-event-bus.md).
 * Replaces the v1 stringly-typed EventBus.
 */
export class Signal<T> {
    private listeners = new Set<(event: T) => void>();

    /** Subscribe a listener. Returns an idempotent unsubscribe function. */
    subscribe(listener: (event: T) => void): () => void {
        this.listeners.add(listener);
        return () => {
            this.listeners.delete(listener);
        };
    }

    /**
     * Emit an event to the listeners subscribed at the start of this call.
     * Unsubscribing during emit therefore affects only later emits. Listener errors propagate.
     */
    emit(event: T): void {
        for (const listener of [...this.listeners]) {
            listener(event);
        }
    }

    /** Remove all listeners. */
    clear(): void {
        this.listeners.clear();
    }

    /** Number of subscribed listeners. */
    get size(): number {
        return this.listeners.size;
    }
}
