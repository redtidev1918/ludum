/**
 * Minimal declarations for host-provided globals that exist in every JS runtime
 * (browser, Node, Deno, Bun) but are not part of the ECMAScript standard library.
 *
 * The core library is compiled against `lib: ["ES2022"]` only (tsconfig.lib.json),
 * so DOM and Node globals are intentionally absent. `console` is declared here
 * because it is a universal host capability, not a DOM/Node-specific API.
 *
 * This file is included only by the core/tests/build configs — never by the DOM
 * (example) config, which already provides its own `console` declaration.
 */
declare const console: {
    log(...data: unknown[]): void;
    info(...data: unknown[]): void;
    warn(...data: unknown[]): void;
    error(...data: unknown[]): void;
    debug(...data: unknown[]): void;
};
