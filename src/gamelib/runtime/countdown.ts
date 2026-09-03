/**
 * A reusable countdown over simulation time (see docs/adr/0009-simulation-vs-wall-time.md).
 * Use for cooldowns, temporary modifiers, transitions, decay, and timed effects.
 * It is not a wall clock — advance it with simulation `dtSeconds`.
 */
export class Countdown {
    private _remainingSeconds: number;

    constructor(durationSeconds: number) {
        if (!Number.isFinite(durationSeconds) || durationSeconds < 0) {
            throw new Error(`Countdown: durationSeconds must be a finite number >= 0, got ${durationSeconds}`);
        }
        this._remainingSeconds = durationSeconds;
    }

    /** Time remaining, in seconds. */
    get remainingSeconds(): number {
        return this._remainingSeconds;
    }

    /** Whether the countdown has finished (remaining <= 0). */
    get finished(): boolean {
        return this._remainingSeconds <= 0;
    }

    /**
     * Advance by `dtSeconds`. Returns true only on the transition to finished
     * (so a repeated advance once finished returns false).
     */
    advance(dtSeconds: number): boolean {
        if (!Number.isFinite(dtSeconds) || dtSeconds < 0) {
            throw new Error(`Countdown.advance: dtSeconds must be a finite number >= 0, got ${dtSeconds}`);
        }
        if (this._remainingSeconds <= 0) return false;
        this._remainingSeconds -= dtSeconds;
        return this._remainingSeconds <= 0;
    }

    /** Reset to a new duration, in seconds. */
    reset(durationSeconds: number): void {
        if (!Number.isFinite(durationSeconds) || durationSeconds < 0) {
            throw new Error(`Countdown.reset: durationSeconds must be a finite number >= 0, got ${durationSeconds}`);
        }
        this._remainingSeconds = durationSeconds;
    }
}
