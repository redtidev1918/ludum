# EventBus —— 通用事件总线

引擎无关的发布订阅模块(纯 TypeScript、零运行时依赖),用于模块/系统之间解耦通信。
适合作为游戏内的“事件中枢”:任何一方只管 `emit`,关心的一方 `on` 即可。

## 快速开始

~~~ts
import { EventBus } from '../src/gamelib/eventBus';

const bus = new EventBus();
const stop = bus.on('score', (delta: number, total: number) => {
    console.log('score +=', delta, '-> total', total);
});
bus.emit('score', 10, 100);
bus.off('score', stop);
~~~

## API

### on(event, callback, priority?): string

注册监听器。

| 参数 | 类型 | 说明 |
|---|---|---|
| event | string | 事件名(任意字符串;建议用常量集中管理) |
| callback | (...args: any[]) => void | 事件触发时调用 |
| priority | number | 优先级,默认 0;越大越先触发 |

返回监听器 id(用于 `off` 退订)。回调非函数时抛错。

### once(event, callback): string

注册一次性监听器:触发一次后自动退订(也可手动退订)。

### off(event, id): boolean | undefined

退订。返回 `true` 表示已移除,`false` 表示事件存在但找不到该 id,
`undefined` 表示该事件从未注册过监听器。

### emit(event, ...args): void

触发事件。某个监听器抛错会被捕获并打印(控制台),**不影响后续监听器**。

### clear(event?): void

清空监听器:传 event 只清该事件,省略则清空全部。

### count(event): number

查询某事件当前监听器数量。

## 设计说明与注意事项

- **多实例**:每个 `new EventBus()` 拥有独立的监听表;系统级总线、场景级总线各建实例互不干扰。
- **触发顺序**:同级按注册顺序;高优先级在前(`priority` 降序)。
- **emit 期间的动态增删**:遍历基于实时列表,监听器在回调中退订自身或后续监听器是安全的。
- **无事件常量**:事件名就是字符串;建议在业务侧定义常量对象管理(如 `Events.UI_CLICK = 'ui:click'`)。
- **与资源模块配合**:常在 `Resource` 的 `onChange/onThreshold` 回调里 `bus.emit` 广播状态变化,UI 侧只订阅不轮询(演示场景即如此)。

## 示例:资源状态广播

~~~ts
const bus = new EventBus();
const hp = new Resource({ id: 'hp', value: 100, max: 100, regen: 1 });

// 生产者:阈值触发时广播
hp.onThreshold(20, 'below', () => bus.emit('hp:low', hp.get()));
hp.onThreshold(50, 'above', () => bus.emit('hp:ok', hp.get()));

// 消费者:两个系统分别订阅(互不依赖)
bus.on('hp:low', (v) => hud.showDanger(v), 10);
bus.on('hp:low', () => audio.play('alarm'));
~~~
