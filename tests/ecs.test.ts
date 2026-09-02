// tests/ecs.test.ts
// Entity-Component System 单元测试
import { describe, it, expect, beforeEach } from 'vitest';
import {
  defineComponent,
  getComponent,
  hasComponent,
  createEntity,
  getEntity,
  destroyEntity,
  getAllEntities,
  clearEntities,
  defineSystem,
  getSystem,
  setSystemPriority,
  setSystemEnabled,
  setSystemCallback,
  update,
  query,
  queryByTag,
  each,
  reduce,
  count,
  serialize,
  deserialize,
  reset,
  clearRuntime,
} from '../src/gamelib/ecs';

describe('Entity-Component System Tests', () => {
  // 每个测试前重置 ECS
  beforeEach(() => {
    reset();
  });

  // Component Tests
  it('defineComponent creates component', () => {
    defineComponent('Position', { x: 0, y: 0 });
    expect(hasComponent('Position')).toBe(true);
  });

  it('getComponent returns component definition', () => {
    defineComponent('Health', { value: 100, max: 100 });
    const comp = getComponent('Health');
    expect(comp).toBeDefined();
    expect(comp!._defaults.value).toBe(100);
  });

  // Entity Tests
  it('createEntity creates entity with id', () => {
    const entity = createEntity();
    expect(entity).toBeDefined();
    expect(entity.id > 0).toBe(true);
  });

  it('createEntity increments id', () => {
    const e1 = createEntity();
    const e2 = createEntity();
    expect(e2.id).toBe(e1.id + 1);
  });

  it('entity:add adds component', () => {
    defineComponent('Position', { x: 0, y: 0 });
    const entity = createEntity().add('Position', { x: 10, y: 20 });

    expect(entity.has('Position')).toBe(true);
    expect(entity.get('Position').x).toBe(10);
    expect(entity.get('Position').y).toBe(20);
  });

  it('entity:add uses defaults', () => {
    defineComponent('Health', { value: 100, max: 100 });
    const entity = createEntity().add('Health');

    expect(entity.get('Health').value).toBe(100);
  });

  it('entity:add merges data with defaults', () => {
    defineComponent('Health', { value: 100, max: 100 });
    const entity = createEntity().add('Health', { value: 50 });

    expect(entity.get('Health').value).toBe(50);
    expect(entity.get('Health').max).toBe(100);
  });

  it('entity:remove removes component', () => {
    defineComponent('Position', { x: 0, y: 0 });
    const entity = createEntity().add('Position');

    expect(entity.has('Position')).toBe(true);
    entity.remove('Position');
    expect(entity.has('Position')).toBe(false);
  });

  it('entity:tag and hasTag work', () => {
    const entity = createEntity().tag('player');

    expect(entity.hasTag('player')).toBe(true);
    expect(entity.hasTag('enemy')).toBe(false);
  });

  it('entity:untag removes tag', () => {
    const entity = createEntity().tag('player');
    entity.untag('player');

    expect(entity.hasTag('player')).toBe(false);
  });

  it('entity:destroy marks entity as dead', () => {
    const entity = createEntity();
    expect(entity.isAlive()).toBe(true);

    entity.destroy();
    expect(entity.isAlive()).toBe(false);
  });

  it('getEntity returns entity by id', () => {
    const entity = createEntity();
    const found = getEntity(entity.id);

    expect(found!.id).toBe(entity.id);
  });

  it('destroyEntity removes entity', () => {
    const entity = createEntity();
    const id = entity.id;

    destroyEntity(entity);
    expect(getEntity(id)).toBeUndefined();
  });

  it('getAllEntities returns all alive entities', () => {
    createEntity();
    createEntity();
    const e3 = createEntity();
    e3.destroy();

    const all = getAllEntities();
    expect(all.length).toBe(2);
  });

  it('clearEntities removes all entities', () => {
    createEntity();
    createEntity();

    clearEntities();
    expect(getAllEntities().length).toBe(0);
  });

  // System Tests
  it('defineSystem creates system', () => {
    defineComponent('Position', { x: 0, y: 0 });
    defineSystem('Movement', ['Position'], () => {});

    expect(getSystem('Movement')).toBeDefined();
  });

  it('system update is called for matching entities', () => {
    defineComponent('Counter', { value: 0 });
    defineSystem('CounterSystem', ['Counter'], (entity) => {
      entity.get('Counter').value = entity.get('Counter').value + 1;
    });

    const entity = createEntity().add('Counter');

    update(0.1);
    expect(entity.get('Counter').value).toBe(1);

    update(0.1);
    expect(entity.get('Counter').value).toBe(2);
  });

  it('system only updates entities with required components', () => {
    defineComponent('A', {});
    defineComponent('B', {});

    const updated: Record<number, boolean> = {};
    defineSystem('TestSystem', ['A', 'B'], (entity) => {
      updated[entity.id] = true;
    });

    const e1 = createEntity().add('A').add('B');
    const e2 = createEntity().add('A'); // missing B
    const e3 = createEntity().add('B'); // missing A

    update(0.1);

    expect(updated[e1.id]).toBe(true);
    expect(updated[e2.id]).toBeUndefined();
    expect(updated[e3.id]).toBeUndefined();
  });

  it('setSystemEnabled disables system', () => {
    defineComponent('Counter', { value: 0 });
    defineSystem('CounterSystem', ['Counter'], (entity) => {
      entity.get('Counter').value = entity.get('Counter').value + 1;
    });

    const entity = createEntity().add('Counter');

    setSystemEnabled('CounterSystem', false);
    update(0.1);

    expect(entity.get('Counter').value).toBe(0);
  });

  it('system priority affects order', () => {
    defineComponent('Value', { v: 0 });

    const order: string[] = [];
    defineSystem('First', ['Value'], () => {
      order.push('first');
    });
    defineSystem('Second', ['Value'], () => {
      order.push('second');
    });

    setSystemPriority('First', 10);
    setSystemPriority('Second', 5);

    createEntity().add('Value');
    update(0.1);

    expect(order[0]).toBe('first');
    expect(order[1]).toBe('second');
  });

  // Query Tests
  it('query returns entities with components', () => {
    defineComponent('A', {});
    defineComponent('B', {});

    createEntity().add('A').add('B');
    createEntity().add('A');
    createEntity().add('B');

    expect(query(['A', 'B']).length).toBe(1);
    expect(query(['A']).length).toBe(2);
    expect(query(['B']).length).toBe(2);
  });

  it('queryByTag returns entities with tag', () => {
    createEntity().tag('player');
    createEntity().tag('enemy');
    createEntity().tag('enemy');

    expect(queryByTag('player').length).toBe(1);
    expect(queryByTag('enemy').length).toBe(2);
  });

  it('each iterates over matching entities', () => {
    defineComponent('Value', { v: 0 });

    createEntity().add('Value', { v: 1 });
    createEntity().add('Value', { v: 2 });
    createEntity().add('Value', { v: 3 });

    let sum = 0;
    each(['Value'], (entity) => {
      sum = sum + entity.get('Value').v;
    });

    expect(sum).toBe(6);
  });

  it('reduce aggregates values', () => {
    defineComponent('Value', { v: 0 });

    createEntity().add('Value', { v: 10 });
    createEntity().add('Value', { v: 20 });
    createEntity().add('Value', { v: 30 });

    const total = reduce(['Value'], (acc, entity) => {
      return acc + entity.get('Value').v;
    }, 0);

    expect(total).toBe(60);
  });

  it('count returns entity count', () => {
    defineComponent('A', {});

    createEntity().add('A');
    createEntity().add('A');
    createEntity();

    expect(count(['A'])).toBe(2);
  });

  // Callback Tests
  it('onAdd callback is called', () => {
    defineComponent('A', {});
    defineComponent('B', {});

    const addedEntities: Record<number, boolean> = {};
    defineSystem('TestSystem', ['A', 'B'], () => {});
    setSystemCallback('TestSystem', 'onAdd', (entity) => {
      addedEntities[entity.id] = true;
    });

    const entity = createEntity().add('A');
    expect(addedEntities[entity.id]).toBeUndefined(); // not yet, missing B

    entity.add('B');
    expect(addedEntities[entity.id]).toBe(true); // now has both
  });

  it('onRemove callback is called', () => {
    defineComponent('A', {});
    defineComponent('B', {});

    const removedEntities: Record<number, boolean> = {};
    defineSystem('TestSystem', ['A', 'B'], () => {});
    setSystemCallback('TestSystem', 'onRemove', (entity) => {
      removedEntities[entity.id] = true;
    });

    const entity = createEntity().add('A').add('B');
    expect(removedEntities[entity.id]).toBeUndefined();

    entity.remove('B');
    expect(removedEntities[entity.id]).toBe(true);
  });

  // Serialization Tests
  it('serialize and deserialize entities', () => {
    defineComponent('Position', { x: 0, y: 0 });
    defineComponent('Health', { value: 100 });

    createEntity().add('Position', { x: 10, y: 20 }).add('Health', { value: 50 });
    createEntity().add('Position', { x: 30, y: 40 }).tag('player');

    const data = serialize();

    clearEntities();
    expect(getAllEntities().length).toBe(0);

    deserialize(data);

    const restored = getAllEntities();
    expect(restored.length).toBe(2);
  });

  // Chain API Tests
  it('entity methods are chainable', () => {
    defineComponent('A', {});
    defineComponent('B', {});

    const entity = createEntity()
      .add('A')
      .add('B')
      .tag('test');

    expect(entity.has('A')).toBe(true);
    expect(entity.has('B')).toBe(true);
    expect(entity.hasTag('test')).toBe(true);
  });

  // Reset Tests
  it('reset clears everything', () => {
    defineComponent('Test', {});
    defineSystem('TestSystem', ['Test'], () => {});
    createEntity().add('Test');

    reset();

    expect(hasComponent('Test')).toBe(false);
    expect(getSystem('TestSystem')).toBeUndefined();
    expect(getAllEntities().length).toBe(0);
  });

  it('clearRuntime keeps definitions', () => {
    defineComponent('Test', {});
    defineSystem('TestSystem', ['Test'], () => {});
    createEntity().add('Test');

    clearRuntime();

    expect(hasComponent('Test')).toBe(true);
    expect(getSystem('TestSystem')).toBeDefined();
    expect(getAllEntities().length).toBe(0);
  });
});
