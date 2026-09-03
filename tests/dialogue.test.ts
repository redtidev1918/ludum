// tests/dialogue.test.ts
// Conditional Dialogue System 单元测试
import { describe, it, expect } from 'vitest';
import { newLibrary, newTree } from '../src/gamelib/dialogue';

describe('DialogueLibrary', () => {
  it('DialogueLibrary.new creates library', () => {
    const lib = newLibrary({
      entries: [{ id: 'greeting', text: 'Hello!' }],
    });
    expect(lib.entries.length).toBe(1);
  });

  it('DialogueLibrary:addEntry adds entry', () => {
    const lib = newLibrary({});
    lib.addEntry({ id: 'test', text: 'Test' });
    expect(lib.entries.length).toBe(1);
  });

  it('DialogueLibrary entries sorted by priority', () => {
    const lib = newLibrary({
      entries: [
        { id: 'low', text: 'Low', priority: 1 },
        { id: 'high', text: 'High', priority: 10 },
      ],
    });
    expect(lib.entries[0].id).toBe('high');
  });

  it('Simple equality condition', () => {
    const lib = newLibrary({
      entries: [
        { id: 'happy', text: 'Happy!', conditions: { mood: 'happy' } },
      ],
    });
    expect(lib.query({ mood: 'happy' })).not.toBeNull();
    expect(lib.query({ mood: 'sad' })).toBeNull();
  });

  it('Greater than condition', () => {
    const lib = newLibrary({
      entries: [{ id: 'rich', text: 'Rich!', conditions: { money: ['>', 100] } }],
    });
    expect(lib.query({ money: 50 })).toBeNull();
    expect(lib.query({ money: 150 })).not.toBeNull();
  });

  it('Less than condition', () => {
    const lib = newLibrary({
      entries: [{ id: 'poor', text: 'Poor!', conditions: { money: ['<', 20] } }],
    });
    expect(lib.query({ money: 10 })).not.toBeNull();
    expect(lib.query({ money: 50 })).toBeNull();
  });

  it('Between condition', () => {
    const lib = newLibrary({
      entries: [{ id: 'normal', text: 'Normal', conditions: { hp: ['between', [30, 70]] } }],
    });
    expect(lib.query({ hp: 50 })).not.toBeNull();
    expect(lib.query({ hp: 10 })).toBeNull();
  });

  it('In list condition', () => {
    const lib = newLibrary({
      entries: [{ id: 'weekend', text: 'Weekend!', conditions: { day: ['in', ['sat', 'sun']] } }],
    });
    expect(lib.query({ day: 'sat' })).not.toBeNull();
    expect(lib.query({ day: 'mon' })).toBeNull();
  });

  it('Multiple conditions (AND)', () => {
    const lib = newLibrary({
      entries: [{ id: 'both', text: 'Both!', conditions: { hp: ['>', 50], money: ['>', 100] } }],
    });
    expect(lib.query({ hp: 80, money: 150 })).not.toBeNull();
    expect(lib.query({ hp: 80, money: 50 })).toBeNull();
  });

  it('Higher priority matched first', () => {
    const lib = newLibrary({
      entries: [
        { id: 'normal', text: 'Normal', priority: 0, conditions: { hp: ['>', 0] } },
        { id: 'critical', text: 'Critical!', priority: 10, conditions: { hp: ['<', 20] } },
      ],
    });
    expect(lib.query({ hp: 10 })!.id).toBe('critical');
    expect(lib.query({ hp: 50 })!.id).toBe('normal');
  });

  it('format replaces variables', () => {
    const lib = newLibrary({
      entries: [{ id: 'greeting', text: 'Hello, {name}!' }],
    });
    const text = lib.format(lib.entries[0], { name: 'Player' });
    expect(text).toBe('Hello, Player!');
  });

  it('format uses variable functions', () => {
    const lib = newLibrary({
      entries: [{ id: 'status', text: 'HP: {hp_pct}' }],
      variables: { hp_pct: (ctx) => Math.floor((ctx.hp / ctx.maxHp) * 100) + '%' },
    });
    const text = lib.format(lib.entries[0], { hp: 75, maxHp: 100 });
    expect(text).toBe('HP: 75%');
  });

  it('Cooldown prevents reuse', () => {
    const lib = newLibrary({
      entries: [
        { id: 'once', text: 'Once!', cooldown: 60 },
        { id: 'always', text: 'Always' },
      ],
    });
    expect(lib.query({})!.id).toBe('once');
    lib._setCooldown('once', 60);
    expect(lib.query({})!.id).toBe('always');
  });

  it('clearCooldown works', () => {
    const lib = newLibrary({ entries: [{ id: 'test', text: 'Test' }] });
    lib._setCooldown('test', 60);
    expect(lib._checkCooldown('test')).toBe(false);
    lib.clearCooldown('test');
    expect(lib._checkCooldown('test')).toBe(true);
  });

  it('queryAll returns all matches', () => {
    const lib = newLibrary({
      entries: [
        { id: 'a', text: 'A', conditions: { x: true } },
        { id: 'b', text: 'B', conditions: { x: true } },
        { id: 'c', text: 'C', conditions: { x: false } },
      ],
    });
    expect(lib.queryAll({ x: true }).length).toBe(2);
  });

  it('query filters by tags', () => {
    const lib = newLibrary({
      entries: [
        { id: 'a', text: 'A', tags: ['greeting'] },
        { id: 'b', text: 'B', tags: ['farewell'] },
      ],
    });
    expect(lib.query({}, { tags: ['greeting'] })!.id).toBe('a');
  });

  it('get returns entry and text', () => {
    const lib = newLibrary({ entries: [{ id: 'hi', text: 'Hello, {name}!' }] });
    const [entry, text] = lib.get({ name: 'World' });
    expect(entry!.id).toBe('hi');
    expect(text).toBe('Hello, World!');
  });

  it('get records history', () => {
    const lib = newLibrary({ entries: [{ id: 'test', text: 'Test' }] });
    lib.get({});
    lib.get({});
    expect(lib.getHistory().length).toBe(2);
  });
});

describe('DialogueTree', () => {
  it('DialogueTree:start sets current node', () => {
    const tree = newTree({ nodes: { start: { text: 'Hello!' } } });
    tree.start();
    expect(tree.currentNode).toBe('start');
  });

  it('DialogueTree:getText returns text', () => {
    const tree = newTree({ nodes: { start: { text: 'Hello!' } } });
    tree.start();
    expect(tree.getText()).toBe('Hello!');
  });

  it('DialogueTree:getChoices returns choices', () => {
    const tree = newTree({
      nodes: { start: { text: 'Choose:', choices: [{ text: 'A', next: 'a' }, { text: 'B', next: 'b' }] } },
    });
    tree.start();
    expect(tree.getChoices()!.length).toBe(2);
  });

  it('DialogueTree:choose advances node', () => {
    const tree = newTree({
      nodes: {
        start: { text: 'Choose:', choices: [{ text: 'Go A', next: 'a' }] },
        a: { text: 'At A!' },
      },
    });
    tree.start();
    tree.choose(1);
    expect(tree.currentNode).toBe('a');
  });

  it('DialogueTree:continue advances without choices', () => {
    const tree = newTree({
      nodes: { start: { text: 'First', next: 'second' }, second: { text: 'Second' } },
    });
    tree.start();
    tree.continue();
    expect(tree.currentNode).toBe('second');
  });

  it('DialogueTree:isEnded works', () => {
    const tree = newTree({ nodes: { start: { text: 'End' } } });
    tree.start();
    expect(tree.isEnded()).toBe(false);
    tree.continue();
    expect(tree.isEnded()).toBe(true);
  });

  it('DialogueTree choice conditions filter', () => {
    const tree = newTree({
      nodes: { start: { text: 'Choose:', choices: [
        { text: 'Free', next: 'a' },
        { text: 'Paid', next: 'b', conditions: { money: ['>=', 100] } },
      ] } },
    });
    tree.start('start', { money: 50 });
    expect(tree.getChoices()!.length).toBe(1);
    tree.start('start', { money: 150 });
    expect(tree.getChoices()!.length).toBe(2);
  });

  it('DialogueTree:goTo jumps to node', () => {
    const tree = newTree({ nodes: { start: { text: 'Start' }, other: { text: 'Other' } } });
    tree.start();
    tree.goTo('other');
    expect(tree.currentNode).toBe('other');
  });

  it('DialogueTree:addNode adds node', () => {
    const tree = newTree({ nodes: {} });
    tree.addNode('new', { text: 'New node' });
    expect(tree.nodes.new).toBeDefined();
  });
});
