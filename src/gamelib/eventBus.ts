/**
 * EventBus —— 通用发布订阅(事件总线),引擎无关、零运行时依赖。
 *
 * 设计要点:
 * - 支持优先级(priority 高者先回调,默认 0)、一次性监听(once)、
 *   按 id 退订(off)、异常隔离(单个监听器抛错不影响后续)与清空(clear)。
 * - 可多实例使用:每个 EventBus 拥有独立监听表,适合做场景级/系统级总线。
 * - 语义说明:emit 期间监听器按注册快照长度实时遍历,监听器在回调中
 *   退订自身是安全的(与主流 EventEmitter 的常见实现一致)。
 */

export type EventCallback = (...args: any[]) => void;

interface Listener {
    id: string;
    callback: EventCallback;
    priority: number;
}

type ListenerMap = Record<string, Listener[]>;

/** 监听器 id 序列(保证 off 可唯一定位) */
let listenerSeq = 0;

export class EventBus {
    private _listeners: ListenerMap = {};

    /**
     * 注册事件监听器。
     * @param event 事件名(任意字符串,可用事件常量或直接字面量)
     * @param callback 回调
     * @param priority 优先级(默认 0;越大越先触发)
     * @returns 监听器 id,用于 off(event, id) 退订
     */
    on(event: string, callback: EventCallback, priority?: number): string {
        if (typeof callback !== 'function') {
            throw new Error('EventBus.on: callback must be a function');
        }
        const p = priority ?? 0;
        let list = this._listeners[event];
        if (list == null) {
            list = [];
            this._listeners[event] = list;
        }
        const id = 'l' + ++listenerSeq + '_' + (Math.floor(Math.random() * 100000) + 1);
        list.push({ id, callback, priority: p });
        // 按优先级降序排序(高优先级在前)
        list.sort((a, b) => b.priority - a.priority);
        return id;
    }

    /**
     * 注册一次性监听器:触发一次后自动退订。
     * @returns 监听器 id(同样可用于手动退订)
     */
    once(event: string, callback: EventCallback): string {
        let id = '';
        id = this.on(event, (...args: any[]) => {
            this.off(event, id);
            callback(...args);
        });
        return id;
    }

    /**
     * 退订监听器。
     * @returns true=已移除;false=事件存在但未找到该 id;undefined=该事件没有监听器
     */
    off(event: string, id: string): boolean | undefined {
        const list = this._listeners[event];
        if (list == null) return undefined;
        for (let i = 0; i < list.length; i++) {
            if (list[i].id === id) {
                list.splice(i, 1);
                return true;
            }
        }
        return false;
    }

    /**
     * 触发事件。单个监听器抛错会被捕获并打印,不影响其余监听器。
     */
    emit(event: string, ...args: any[]): void {
        const list = this._listeners[event];
        if (list == null) return;
        for (let i = 0; i < list.length; i++) {
            const l = list[i];
            try {
                l.callback(...args);
            } catch (err) {
                console.log('[EventBus] error in \'' + event + '\' listener: ' + String(err));
            }
        }
    }

    /**
     * 清空监听器。event 省略时清空全部事件。
     */
    clear(event?: string): void {
        if (event != null) {
            delete this._listeners[event];
        } else {
            this._listeners = {};
        }
    }

    /** 查询某事件的监听器数量 */
    count(event: string): number {
        const list = this._listeners[event];
        return list == null ? 0 : list.length;
    }
}

export default EventBus;
