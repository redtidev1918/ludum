# StateMachine / VisualStateMap — state

**Language / 语言:** [中文](/docs/STATE.md) · English

ludum v3 splits v1's `StateSprite` / `LayeredStateSprite` into a gameplay layer and a
presentation layer; the fake rendering API (`draw` / `loadImage` / `preloadImages`) is gone.

## Core concepts

- `StateMachine<TContext>`: pure gameplay state (states / conditions / transitions / temporary
  state / events). It **knows nothing about textures or renderers**.
- `VisualStateMap`: plain data mapping state → presentation metadata (textureKey / scale /
  rotation / color).
- `Easing`: pure easing functions.

## Quick start

```ts
import { StateMachine } from './gamelib';

const sm = new StateMachine<{ hp: number }>({
    states: ['neutral', 'critical'],
    initialState: 'neutral',
    conditions: [
        { state: 'critical', when: (ctx) => ctx.hp < 20 },
    ],
});

sm.updateContext({ hp: 15 });  // -> critical
sm.updateContext({ hp: 80 });  // no match -> back to neutral
sm.setState('critical', { durationSeconds: 3 });  // temporary state
sm.onStateChange((oldS, newS) => { /* … */ });    // returns an unsubscribe function
```

## Key semantics

- `updateContext` matches conditions by priority; **with no match it returns to the initial
  state** (fixing v1's "push-only, never return" quirk).
- The presentation layer uses `VisualStateMap`: hand `visualStates[state].textureKey` to the
  renderer.
- `LayeredStateSprite` is removed (no real consumer; compose several StateMachines with
  VisualStateMaps instead).
