/** A structured, locatable validation error (path + stable code + message). */
export interface ValidationError {
    path: string;
    code: string;
    message: string;
}

/** Result of validating/normalizing/compiling a definition. */
export type CompileResult<T> =
    | { ok: true; value: T }
    | { ok: false; errors: readonly ValidationError[] };

export function ok<T>(value: T): CompileResult<T> {
    return { ok: true, value };
}

export function fail<T>(errors: readonly ValidationError[]): CompileResult<T> {
    return { ok: false, errors };
}
