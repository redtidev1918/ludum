# GameLib

通用游戏系统库 —— 基于 **Phaser 4 + TypeScript + Vite** 的轻量级、模块化游戏系统库。

> 本仓库为原 Lua 版(1.x)的完整 TypeScript 重构版(v2.x)。7 个游戏系统模块保持等价 API 与行为,
> 所有单元测试已从 Lua 移植为 Vitest。旧版 Lua 源码保留在 git 历史中。

## 特性

- **模块化设计**:按需导入,零依赖(库本身不依赖 Phaser,纯 TypeScript,可单独复用)
- **链式 API**:流畅的接口设计
- **完整测试**:182 个 Vitest 单元测试覆盖(从原 Lua 测试完整移植)
- **Phaser 4 集成**:内置可运行演示,展示各模块在 Phaser 场景中的用法

## 技术栈

| 组件 | 版本 |
|---|---|
| Phaser | ^4.2.1 |
| TypeScript | ~5.9 |
| Vite | ^8 |
| Vitest | ^4 |

## 快速开始

`bash
npm install
# 开发(启动 Phaser 4 演示)
npm run dev
# 单元测试
npm test
# 类型检查
npm run typecheck
# 生产构建
npm run build
`

浏览器打开 http://localhost:5173 查看模块集成演示。

## 项目结构

`text
GameLib/
├── index.html            # 入口页面
├── src/
│   ├── main.ts           # Phaser 启动入口
│   ├── demo/
│   │   └── DemoScene.ts  # 模块集成演示场景
│   └── gamelib/          # 游戏系统库(引擎无关)
│       ├── index.ts      # 汇总导出
│       ├── ecs.ts            # 实体组件系统
│       ├── resource.ts       # 数值资源系统
│       ├── stateSprite.ts    # 状态精灵
│       ├── procShape.ts      # 程序化形状
│       ├── interactRegion.ts # 交互区域
│       ├── dialogue.ts       # 对话系统
│       └── weightedEvent.ts  # 加权事件
└── tests/                # Vitest 单元测试
`

## 快速开始

`ts
import { ECS, Resource } from './src/gamelib';

// ---- ECS ----
ECS.defineComponent('Position', { x: 0, y: 0 });
ECS.defineComponent('Velocity', { vx: 0, vy: 0 });
ECS.defineSystem('Movement', ['Position', 'Velocity'], (entity, dt) => {
    const pos = entity.get('Position');
    const vel = entity.get('Velocity');
    pos.x += vel.vx * dt;
    pos.y += vel.vy * dt;
});
const player = ECS.createEntity()
    .add('Position', { x: 100, y: 100 })
    .add('Velocity', { vx: 50, vy: 0 })
    .tag('player');

// ---- Resource ----
const hp = new Resource({ id: 'hp', value: 100, max: 100, regen: 1 });
hp.subtract(30);
hp.addModifier({ id: 'poison', type: 'decay', value: 5, duration: 10 });
hp.onThreshold(20, 'below', () => console.log('HP 危险!'));
hp.update(1 / 60);
`

## 模块概览

### ECS —— 实体组件系统

`ts
import { ECS } from './src/gamelib/ecs';

// 定义组件
ECS.defineComponent('Position', { x: 0, y: 0 });

// 定义系统(可带 priority / onAdd / onRemove 回调)
ECS.defineSystem('Movement', ['Position', 'Velocity'], (entity, dt) => { /* ... */ });

// 实体链式 API
const e = ECS.createEntity().add('Position', { x: 1 }).tag('player');
ECS.update(dt);

// 查询 / 统计 / 序列化
ECS.query(['Position']);
ECS.queryByTag('player');
ECS.serialize(); ECS.deserialize(data); ECS.reset();
`

### Resource —— 资源系统

管理 HP、金币、能量等数值资源;支持 modifier、阈值事件、自动恢复/衰减、派生资源、资源管理器与存档序列化。

`ts
import { Resource, DerivedResource, ResourceManager } from './src/gamelib/resource';

const hp = new Resource({ id: 'hp', value: 100, max: 100, regen: 1 });
hp.subtract(30);
hp.addModifier({ id: 'poison', type: 'decay', value: 5, duration: 10 });
hp.onThreshold(20, 'below', () => console.log('HP 危险!'));
hp.update(1 / 60);

const total = new DerivedResource({
    id: 'total',
    dependencies: { hp, gold: 50 },
    formula: (deps) => deps.hp + deps.gold,
});
`

事件:onChange(old,new) / onMin() / onMax() / onThreshold(value, above|below|equal|cross, cb)。

### StateSprite —— 状态精灵

按条件/手动在状态间切换(带过渡进度与缓动、临时状态)。Lua 版负责 LÖVE 贴图渲染,
TS 版专注状态机,渲染由上层(如 Phaser)根据 getState() 完成;图像以纹理键字符串管理。

`ts
import { StateSprite } from './src/gamelib/stateSprite';

const character = new StateSprite({
    states: {
        neutral:   { sprite: 'charNeutral' },
        happy:     { sprite: 'charHappy' },
        critical:  { sprite: 'charCritical', priority: 10 },
    },
    conditions: [
        { state: 'critical', when: (ctx) => ctx.hp < 20 },
        { state: 'happy', when: (ctx) => ctx.money > 100 },
    ],
});
character.loadImage('neutral', 'charNeutral');   // 记录纹理键
character.updateContext({ hp: 15, money: 50 });
character.update(dt);
character.getState(); // => 'critical'
`

### ProcShape —— 程序化形状

动态变形的椭圆/多边形/贝塞尔形状,支持弹簧-阻尼晃动、参数绑定到 Resource、下垂/凸起/旋转与命中检测。TS 版不渲染,通过 getOutlinePoints() 交给 Phaser Graphics 绘制。

`ts
import { ProcShape } from './src/gamelib/procShape';

const blob = new ProcShape({
    type: 'ellipse', baseWidth: 100, baseHeight: 80,
    physics: { jiggle: true, stiffness: 100, damping: 10 },
});
blob.bindParam('scale', hp, (v) => 1 + v / 1000);
blob.poke(0, 10, 1);   // 触发晃动
blob.update(dt);
const pts = blob.getOutlinePoints(); // {x,y}[] 交给 Graphics 绘制
blob.contains(px, py, cx, cy);       // 命中检测
`

### InteractRegion —— 交互区域

rect/circle/ellipse/polygon 命中检测,click/hover/drag/hold/release/enter/leave 事件,支持子区域、offset、启用开关与区域管理器。纯坐标输入,由上层把指针事件喂进来:

`ts
import { InteractRegion, InteractRegionManager } from './src/gamelib/interactRegion';

const btn = new InteractRegion({
    shape: 'rect', bounds: [100, 100, 200, 50],
    interactions: ['click', 'hover'],
});
btn.on('click', (x, y) => console.log('Clicked!'));

// 在 Phaser 场景中桥接指针事件:
this.input.on('pointerdown', (p) => manager.mousepressed(p.x, p.y, 0));
this.input.on('pointermove', (p) => manager.mousemoved(p.x, p.y));
this.input.on('pointerup',   (p) => manager.mousereleased(p.x, p.y, 0));
manager.update(dt);   // hold 检测
`

### Dialogue —— 对话系统

条件对话库(优先级/标签/说话者/冷却/变量插值/随机)与对话树(节点/选项/动作/事件)。

`ts
import { newLibrary, newTree } from './src/gamelib/dialogue';

const lib = newLibrary({
    entries: [
        { id: 'greeting', text: '你好,{name}!', conditions: { mood: 'happy' } },
        { id: 'warning', text: 'HP 不足!', conditions: { hp: ['<', 20] }, priority: 10 },
    ],
    variables: { name: (ctx) => ctx.playerName },
});
const [entry, text] = lib.get({ mood: 'happy', playerName: '玩家' }) ?? [null, null];

const tree = newTree({
    nodes: {
        start: {
            text: '你想做什么?',
            choices: [
                { text: '战斗', next: 'fight' },
                { text: '离开', next: 'leave' },
            ],
        },
    },
});
tree.start();
tree.getChoices();   // [{ index, text, disabled }...]
tree.choose(1);
`

### WeightedEvent —— 加权事件

带权重随机抽取,支持 modifier(条件/乘数/增量)、保底(pity)、过滤器、统计与模拟。

`ts
import { newPool } from './src/gamelib/weightedEvent';

const loot = newPool({
    events: [
        { id: 'common', weight: 80, type: 'item' },
        { id: 'rare', weight: 15, type: 'item' },
        { id: 'legendary', weight: 5, type: 'item' },
    ],
    pity: { threshold: 50, guarantee: { id: 'legendary' } },
});
const [triggered, event] = loot.roll({ baseChance: 0.1 });
loot.getStats();      // { totalRolls, totalTriggers, events: {...} }
loot.simulate(1000, { baseChance: 1 });
`

## API 文档

各模块源文件含中文 JSDoc;模块行为与 Lua 1.x 版等价。

## 从 Lua 版移植说明

- 构造:Resource.new(config) → new Resource(config);StateSprite.new / ProcShape.new 同理;
  Dialogue.newLibrary → newLibrary(config);WeightedEvent.newPool → newPool(config)。
- ECS 保持模块级单例函数式 API(与 Lua 相同,含 reset())。
- LÖVE 渲染相关方法(Lua 版在无 LÖVE 时为空操作):draw() / loadImage() 等保留签名但不再渲染,
  渲染交给 Phaser 层(演示场景演示了对接方式)。
- 数值/坐标均采用 number;颜色为 [r,g,b,a](0-1)数组,供上层换算。

## 许可证

MIT License
