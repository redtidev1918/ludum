// tests/weightedEvent.test.ts
// Weighted Event System 单元测试(从 tests/test_weighted_event.lua 移植)
import { describe, it, expect } from 'vitest';
import { newPool } from '../src/gamelib/weightedEvent';

describe('WeightedEventPool', () => {
  it('WeightedEventPool.new creates pool', () => {
    const pool = newPool({
      events: [
        { id: 'a', weight: 10 },
        { id: 'b', weight: 5 },
      ],
    });
    expect(pool.events.length).toBe(2);
  });

  it('addEvent adds event', () => {
    const pool = newPool({ events: [] });
    pool.addEvent({ id: 'new', weight: 10 });
    expect(pool.events.length).toBe(1);
  });

  it('removeEvent removes event', () => {
    const pool = newPool({
      events: [
        { id: 'a', weight: 10 },
        { id: 'b', weight: 5 },
      ],
    });
    pool.removeEvent('a');
    expect(pool.events.length).toBe(1);
    expect(pool.events[0].id).toBe('b');
  });

  it('getEvent returns event', () => {
    const pool = newPool({
      events: [{ id: 'test', weight: 10, type: 'rare' }],
    });
    const event = pool.getEvent('test');
    expect(event).toBeDefined();
    expect(event!.id).toBe('test');
    expect(event!.type).toBe('rare');
  });

  it('roll returns event with 100% chance', () => {
    const pool = newPool({
      events: [{ id: 'only', weight: 10 }],
    });
    const [triggered, event] = pool.roll({ baseChance: 1.0 });
    expect(triggered).toBe(true);
    expect(event!.id).toBe('only');
  });

  it('roll respects baseChance', () => {
    const pool = newPool({
      events: [{ id: 'test', weight: 10 }],
    });

    // 0% chance should never trigger
    let triggerCount = 0;
    for (let i = 0; i < 100; i++) {
      const [triggered] = pool.roll({ baseChance: 0 });
      if (triggered) triggerCount = triggerCount + 1;
    }
    expect(triggerCount).toBe(0);
  });

  it('roll weighted distribution', () => {
    const pool = newPool({
      events: [
        { id: 'common', weight: 90 },
        { id: 'rare', weight: 10 },
      ],
    });

    const results = pool.simulate(1000, { baseChance: 1.0 });

    // Common should be much more frequent
    expect(results.common).toBeGreaterThan(results.rare);
    // Common should be roughly 90%
    expect(results.common).toBeGreaterThan(700);
  });

  it('roll with filter', () => {
    const pool = newPool({
      events: [
        { id: 'a', weight: 10, type: 'positive' },
        { id: 'b', weight: 10, type: 'negative' },
      ],
    });

    const results = pool.simulate(100, {
      baseChance: 1.0,
      filter: { type: 'positive' },
    });

    expect(results.a ?? 0).toBe(100);
    expect(results.b).toBeUndefined();
  });

  it('modifier multiplies weight', () => {
    const pool = newPool({
      events: [
        { id: 'a', weight: 10, type: 'positive' },
        { id: 'b', weight: 10, type: 'negative' },
      ],
      modifiers: [
        {
          condition: (ctx) => !!ctx.boost,
          filter: { type: 'positive' },
          multiply: 10,
        },
      ],
    });

    // Without boost
    let weights = pool.getWeights({ boost: false });
    expect(weights.a).toBe(10);
    expect(weights.b).toBe(10);

    // With boost
    weights = pool.getWeights({ boost: true });
    expect(weights.a).toBe(100);
    expect(weights.b).toBe(10);
  });

  it('modifier adds weight', () => {
    const pool = newPool({
      events: [{ id: 'test', weight: 10 }],
      modifiers: [
        {
          condition: (ctx) => !!ctx.bonus,
          add: 20,
        },
      ],
    });

    expect(pool.getWeights({ bonus: false }).test).toBe(10);
    expect(pool.getWeights({ bonus: true }).test).toBe(30);
  });

  it('pity guarantees event', () => {
    const pool = newPool({
      events: [
        { id: 'common', weight: 100, type: 'common' },
        { id: 'rare', weight: 1, type: 'rare' },
      ],
      pity: {
        threshold: 5,
        guarantee: { type: 'rare' },
      },
    });

    // Force 5 rolls without trigger
    pool.rollCount = 4;
    pool.lastTriggerRoll = 0;

    const [triggered, event] = pool.roll({ baseChance: 1.0 });
    expect(triggered).toBe(true);
    expect(event!.id).toBe('rare');
  });

  it('getHistory returns recent history', () => {
    const pool = newPool({
      events: [{ id: 'test', weight: 10 }],
    });

    for (let i = 0; i < 5; i++) {
      pool.roll({ baseChance: 1.0 });
    }

    const history = pool.getHistory(3);
    expect(history.length).toBe(3);
  });

  it('getStats returns statistics', () => {
    const pool = newPool({
      events: [{ id: 'test', weight: 10 }],
    });

    pool.roll({ baseChance: 1.0 });
    pool.roll({ baseChance: 1.0 });

    const stats = pool.getStats();
    expect(stats.totalRolls).toBe(2);
    expect(stats.events.test.count).toBe(2);
  });

  it('resetStats clears statistics', () => {
    const pool = newPool({
      events: [{ id: 'test', weight: 10 }],
    });

    pool.roll({ baseChance: 1.0 });
    pool.resetStats();

    const stats = pool.getStats();
    expect(stats.totalRolls).toBe(0);
    expect(stats.events.test.count).toBe(0);
  });

  it('getProbabilities returns correct probabilities', () => {
    const pool = newPool({
      events: [
        { id: 'a', weight: 75 },
        { id: 'b', weight: 25 },
      ],
    });

    const probs = pool.getProbabilities();
    expect(Math.abs(probs.a - 0.75)).toBeLessThan(0.01);
    expect(Math.abs(probs.b - 0.25)).toBeLessThan(0.01);
  });

  it('serialize and deserialize', () => {
    const pool = newPool({
      events: [{ id: 'test', weight: 10 }],
    });

    pool.roll({ baseChance: 1.0 });
    pool.roll({ baseChance: 1.0 });

    const data = pool.serialize();

    const pool2 = newPool({
      events: [{ id: 'test', weight: 10 }],
    });
    pool2.deserialize(data);

    expect(pool2.rollCount).toBe(2);
    expect(pool2.history.length).toBe(2);
  });

  it('simulate does not affect real stats', () => {
    const pool = newPool({
      events: [{ id: 'test', weight: 10 }],
    });

    pool.simulate(100, { baseChance: 1.0 });

    expect(pool.rollCount).toBe(0);
    expect(pool.history.length).toBe(0);
  });

  it('multiple modifiers stack', () => {
    const pool = newPool({
      events: [{ id: 'test', weight: 10 }],
      modifiers: [
        { condition: () => true, multiply: 2 },
        { condition: () => true, add: 5 },
      ],
    });

    // 10 * 2 + 5 = 25
    expect(pool.getWeights({}).test).toBe(25);
  });

  it('zero weight event not selected', () => {
    const pool = newPool({
      events: [
        { id: 'zero', weight: 0 },
        { id: 'normal', weight: 10 },
      ],
    });

    const results = pool.simulate(100, { baseChance: 1.0 });
    expect(results.zero).toBeUndefined();
    expect(results.normal).toBe(100);
  });
});
