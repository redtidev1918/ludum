# ludum x Cocos Creator (integration reference)

> 中文：[README.md](./README.md)

Type-level integration reference showing ludum's pure gameplay systems wired into a
Cocos Creator 3.x component. ludum owns ALL the gameplay logic (state machine,
weighted symbol selection, shuffle bag, balance); Cocos owns rendering, input, and
lifecycle.

## Files

- `ReelLogic.ts` — a `@ccclass` slot-reel controller using
  `StateMachine` + `WeightedTable` + `ShuffleBag` + `Resource`.
- `cc.d.ts` — a minimal `cc` type shim so the example typechecks standalone
  (without the Cocos editor). **Delete it in a real Cocos project.**

## Use in a real Cocos Creator project

1. `npm install ludum`
2. Copy `ReelLogic.ts` into your project's `assets/` (delete `cc.d.ts`).
3. Change the import from the relative `../../src/gamelib` path to the package:

   ```ts
   import { Resource, StateMachine, WeightedTable, selectFromTable, ShuffleBag, SystemRandom } from 'ludum';
   ```

4. Attach `ReelLogic` to a node; call `spin()` from a button; read `getState()` in
   your renderer/animator.

## Why it matters

This proves the headline claim at the type level: ludum compiles against
`lib: ["ES2022"]` only, so the same gameplay code runs unchanged in Phaser 4
(`examples/phaser`), headless Node (`examples/headless`), and Cocos Creator — with
zero runtime dependencies and no engine imports in the library itself.
