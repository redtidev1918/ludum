/**
 * Time source capability (see docs/adr/0005-time-units.md).
 * Gameplay modules depend on `Clock`, never `Date.now()`.
 */

export interface Clock {
    /** Current time in milliseconds since an arbitrary epoch. */
    nowMs(): number;
}

/** Reads the real system clock. Use for production; inject `ManualClock` in tests. */
export class SystemClock implements Clock {
    nowMs(): number {
        return Date.now();
    }
}

/** A manually advanced clock, for deterministic simulation and tests. */
export class ManualClock implements Clock {
    private currentMs: number;

    constructor(startMs = 0) {
        this.currentMs = startMs;
    }

    nowMs(): number {
        return this.currentMs;
    }

    advanceMs(deltaMs: number): void {
        if (!Number.isFinite(deltaMs) || deltaMs < 0) {
            throw new Error(`ManualClock.advanceMs: deltaMs must be a finite number >= 0, got ${deltaMs}`);
        }
        this.currentMs += deltaMs;
    }
}
