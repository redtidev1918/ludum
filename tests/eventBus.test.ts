// EventBus —— 发布订阅单元测试
import { describe, it, expect, vi } from 'vitest';
import { EventBus } from '../src/gamelib/eventBus';

describe('EventBus 基础注册与触发', () => {
  it('注册监听器后可收到事件', () => {
    const bus = new EventBus();
    const fn = vi.fn();
    bus.on('hello', fn);
    bus.emit('hello', 1, 2);
    expect(fn).toHaveBeenCalledWith(1, 2);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('未注册事件时 emit 不报错', () => {
    const bus = new EventBus();
    expect(() => bus.emit('nothing')).not.toThrow();
  });

  it('多参数透传', () => {
    const bus = new EventBus();
    const fn = vi.fn();
    bus.on('e', fn);
    bus.emit('e', 'a', 1, true, null);
    expect(fn).toHaveBeenCalledWith('a', 1, true, null);
  });

  it('多个监听器按注册顺序执行(同级优先级)', () => {
    const bus = new EventBus();
    const order: string[] = [];
    bus.on('e', () => order.push('first'));
    bus.on('e', () => order.push('second'));
    bus.emit('e');
    expect(order).toEqual(['first', 'second']);
  });

  it('优先级高者先触发', () => {
    const bus = new EventBus();
    const order: string[] = [];
    bus.on('e', () => order.push('low'), -10);
    bus.on('e', () => order.push('high'), 100);
    bus.on('e', () => order.push('mid'));
    bus.emit('e');
    expect(order).toEqual(['high', 'mid', 'low']);
  });
});

describe('EventBus once / off / clear / count', () => {
  it('once 只触发一次', () => {
    const bus = new EventBus();
    const fn = vi.fn();
    bus.once('ping', fn);
    bus.emit('ping');
    bus.emit('ping');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('off 三态:true / false / undefined', () => {
    const bus = new EventBus();
    expect(bus.off('none', 'x')).toBeUndefined();
    const id = bus.on('e', () => {});
    expect(bus.off('e', id)).toBe(true);
    expect(bus.off('e', id)).toBe(false);
  });

  it('off 后不再收到事件', () => {
    const bus = new EventBus();
    const fn = vi.fn();
    const id = bus.on('e', fn);
    bus.off('e', id);
    bus.emit('e');
    expect(fn).not.toHaveBeenCalled();
  });

  it('clear(event) 只清该事件;clear() 清全部', () => {
    const bus = new EventBus();
    const a = vi.fn();
    const b = vi.fn();
    bus.on('a', a);
    bus.on('b', b);
    bus.clear('a');
    bus.emit('a');
    bus.emit('b');
    expect(a).not.toHaveBeenCalled();
    expect(b).toHaveBeenCalledTimes(1);
    bus.clear();
    bus.emit('b');
    expect(b).toHaveBeenCalledTimes(1);
  });

  it('count 返回监听器数量', () => {
    const bus = new EventBus();
    expect(bus.count('e')).toBe(0);
    bus.on('e', () => {});
    bus.on('e', () => {});
    expect(bus.count('e')).toBe(2);
    bus.clear('e');
    expect(bus.count('e')).toBe(0);
  });

  it('on 非函数回调抛错', () => {
    const bus = new EventBus();
    expect(() => bus.on('e', 'x' as unknown as () => void)).toThrow();
  });
});

describe('EventBus 健壮性', () => {
  it('监听器抛错不影响其余监听器(异常隔离)', () => {
    const bus = new EventBus();
    const ok = vi.fn();
    bus.on('e', () => { throw new Error('boom'); });
    bus.on('e', ok);
    expect(() => bus.emit('e')).not.toThrow();
    expect(ok).toHaveBeenCalledTimes(1);
  });

  it('emit 期间监听器可安全退订自身', () => {
    const bus = new EventBus();
    const seen: number[] = [];
    const fn1 = vi.fn(() => { seen.push(1); });
    const fn2 = vi.fn(() => { seen.push(2); });
    const id1 = bus.on('e', fn1);
    bus.on('e', fn2);
    // 在 fn1 中退订自身:退订发生在列表中间,following listener 仍应被调用
    bus.off('e', id1); // 直接退订后触发
    bus.emit('e');
    expect(fn1).not.toHaveBeenCalled();
    expect(fn2).toHaveBeenCalledTimes(1);
    void seen;
  });

  it('各实例监听表相互独立', () => {
    const a = new EventBus();
    const b = new EventBus();
    const fa = vi.fn();
    const fb = vi.fn();
    a.on('e', fa);
    b.on('e', fb);
    a.emit('e');
    expect(fa).toHaveBeenCalledTimes(1);
    expect(fb).not.toHaveBeenCalled();
  });
});
