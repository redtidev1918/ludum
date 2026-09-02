# GameLib

通用游戏系统库(TS 版)—— 一套**引擎无关、零运行时依赖**的轻量级游戏系统库。本仓库是原 Lua 版(1.x)的完整 TypeScript 重构版(v2.0),7 个游戏系统模块保持与 Lua 版等价的 API 与行为,并随附一个可运行的 **Phaser 4** 集成演示。

> 上游消费方 LuckyReels 以 git submodule 方式引用本库,共享同一套 ECS / 资源 / 状态精灵 / 程序化形状 / 交互区域 / 对话 / 加权事件系统。

## 特性

- **引擎无关**:库本体是纯 TypeScript,不 import Phaser、不依赖 DOM,可独立复用于任何 JS/TS 运行时。
- **零运行时依赖**:`dependencies` 中仅 `phaser` 用于演示场景,库代码本身零依赖。
- **链式 API**:绝大多数方法返回 `this`,可流畅串联。
- **182 个测试**:所有单元测试由 Lua 原版完整移植为 Vitest,覆盖 7 个模块的核心行为。
- **Phaser 4 演示**:`src/demo/DemoScene.ts` 展示每个模块在 Phaser 场景里的真实对接方式。
- **上游复用**:LuckyReels 以 submodule 形式消费本库,是「小通用引擎」设计原则的落地范例。

## 技术栈

| 组件 | 版本(声明) | 已安装 | 用途 |
|---|---|---|---|
| Phaser | `4.2.1`(精确) | 4.2.1 | 演示场景渲染 |
| TypeScript | `~5.9.3` | 5.9.3 | 类型系统 |
| Vite | `^8.2.2` | 8.2.2 | 开发服务器 / 构建 |
| Vitest | `^4.1.11` | 4.1.11 | 单元测试 |

`scripts`(见 `package.json`):

| 命令 | 作用 |
|---|---|
| `npm run dev` | 启动 Vite 开发服务器(Phaser 演示,http://localhost:5173) |
| `npm run build` | 生产构建(`vite build`) |
| `npm run preview` | 预览构建产物(`vite preview`) |
| `npm run typecheck` | 类型检查(`tsc --noEmit`) |
| `npm test` | 跑一次测试(`vitest run`) |
| `npm run test:watch` | 测试监听模式(`vitest`) |

> 要求 Node `>=20.19.0`。

## 快速开始

~~~bash
npm install        # 安装依赖
npm test           # 运行 182 个单元测试
npm run dev        # 启动 Phaser 4 演示(浏览器打开 http://localhost:5173)
npm run typecheck  # 类型检查
npm run build      # 生产构建
~~~

## 目录结构

~~~text
GameLib/
├── index.html               # 演示入口页面
├── package.json             # 包名 gamelib,v2.0.0
├── tsconfig.json            # TS 配置(strict)
├── vite.config.ts           # Vite + Vitest 共用配置
├── src/
│   ├── main.ts              # Phaser 4 启动入口
│   ├── demo/
│   │   └── DemoScene.ts     # 7 个模块的集成演示场景
│   └── gamelib/             # ★ 库本体(引擎无关、零依赖)
│       ├── index.ts         # 汇总导出 + VERSION/getVersion
│       ├── ecs.ts           # ECS 实体组件系统
│       ├── resource.ts      # Resource / DerivedResource / ResourceManager
│       ├── stateSprite.ts   # StateSprite / LayeredStateSprite / Easing
│       ├── procShape.ts     # ProcShape / BezierShape
│       ├── interactRegion.ts# InteractRegion / InteractRegionManager
│       ├── dialogue.ts      # DialogueLibrary / DialogueTree
│       └── weightedEvent.ts # WeightedEventPool
├── tests/                   # Vitest 单元测试(182 个)
└── docs/                    # 模块文档(README 之外的详细 API)
~~~

## 快速上手

统一入口 `src/gamelib/index.ts` 聚合导出所有模块,既可整体引入,也可按文件单独导入。

~~~ts
// 整体引入(或按模块:import { ECS } from './src/gamelib/ecs')
import { ECS, Resource, StateSprite, ProcShape,
         InteractRegion, newLibrary, newTree, newPool } from './src/gamelib';
~~~

### ECS —— 实体组件系统

~~~ts
import { ECS } from './src/gamelib/ecs';
ECS.defineComponent('Position', { x: 0, y: 0 });
ECS.defineComponent('Velocity', { vx: 0, vy: 0 });
ECS.defineSystem('Move', ['Position', 'Velocity'], (e, dt) => {
    const p = e.get('Position'), v = e.get('Velocity');
    p.x += v.vx * dt; p.y += v.vy * dt;
});
const e = ECS.createEntity().add('Position', { x: 1 }).add('Velocity').tag('player');
ECS.update(dt);
~~~

### Resource —— 数值资源

~~~ts
import { Resource } from './src/gamelib/resource';
const hp = new Resource({ id: 'hp', value: 100, max: 100, regen: 1 });
hp.subtract(30);
hp.addModifier({ id: 'poison', type: 'decay', value: 5, duration: 10 });
hp.onThreshold(20, 'below', () => console.log('危险!'));
hp.update(1 / 60);   // 应用 regen/decay、移除过期 modifier
~~~

### StateSprite —— 状态精灵

~~~ts
import { StateSprite } from './src/gamelib/stateSprite';
const ch = new StateSprite({
    states: { neutral: { sprite: 'faceN' }, critical: { sprite: 'faceC' } },
    conditions: [{ state: 'critical', when: (ctx) => ctx.hp < 20 }],
    defaultState: 'neutral',
});
ch.updateContext({ hp: 15 });   // 条件命中自动切到 critical
ch.update(dt);
ch.getState();                   // 'critical'
~~~

### ProcShape —— 程序化形状

~~~ts
import { ProcShape } from './src/gamelib/procShape';
const blob = new ProcShape({ type: 'ellipse', baseWidth: 100, baseHeight: 80,
    physics: { jiggle: true, stiffness: 100, damping: 10 } });
blob.bindParam('scale', hp, (v) => 1 + v / 1000);
blob.poke(0, 10, 1); blob.update(dt);
const pts = blob.getOutlinePoints();  // {x,y}[] 交给 Graphics 绘制
~~~

### InteractRegion —— 交互区域

~~~ts
import { InteractRegion, InteractRegionManager } from './src/gamelib/interactRegion';
const btn = new InteractRegion({ shape: 'rect', bounds: [100, 100, 200, 50],
    interactions: ['click', 'hover'] });
btn.on('click', (x, y) => console.log('clicked', x, y));
const mgr = new InteractRegionManager().register('btn', btn);
mgr.mousepressed(150, 120, 0); mgr.mousereleased(150, 120, 0);
~~~

### Dialogue —— 对话系统

~~~ts
import { newLibrary, newTree } from './src/gamelib/dialogue';
const lib = newLibrary({
    entries: [{ id: 'hi', text: '你好,{name}!', conditions: { hp: ['<', 20] }, priority: 10 }],
    variables: { name: (ctx) => ctx.playerName },
});
const [entry, text] = lib.get({ hp: 10, playerName: '玩家' });
const tree = newTree({ nodes: { start: { text: '选择:', choices: [{ text: 'A', next: 'a' }] } } });
tree.start(); tree.choose(1);
~~~

### WeightedEvent —— 加权随机事件

~~~ts
import { newPool } from './src/gamelib/weightedEvent';
const loot = newPool({
    events: [{ id: 'common', weight: 80, type: 'item' }, { id: 'legendary', weight: 5, type: 'item' }],
    pity: { threshold: 8, guarantee: { id: 'legendary' } },
});
const [ok, ev] = loot.roll({ baseChance: 1 });
loot.getStats();      // { totalRolls, totalTriggers, events: {...} }
~~~

## 模块一览

| 模块 | 文件 | 说明 | 文档 |
|---|---|---|---|
| ECS | `ecs.ts` | 实体组件系统(模块级单例函数式 API) | [docs/ECS.md](docs/ECS.md) |
| Resource | `resource.ts` | 数值资源、修改器、阈值、派生资源、管理器 | [docs/RESOURCE.md](docs/RESOURCE.md) |
| StateSprite | `stateSprite.ts` | 状态机 + 缓动 + 分层状态精灵 | [docs/STATE_SPRITE.md](docs/STATE_SPRITE.md) |
| ProcShape | `procShape.ts` | 程序化形状(几何 + 弹簧物理 + 贝塞尔) | [docs/PROC_SHAPE.md](docs/PROC_SHAPE.md) |
| InteractRegion | `interactRegion.ts` | 交互区域命中检测与事件 | [docs/INTERACT_REGION.md](docs/INTERACT_REGION.md) |
| Dialogue | `dialogue.ts` | 条件对话库 + 对话树 | [docs/DIALOGUE.md](docs/DIALOGUE.md) |
| WeightedEvent | `weightedEvent.ts` | 加权随机事件池(修改器/保底/统计) | [docs/WEIGHTED_EVENT.md](docs/WEIGHTED_EVENT.md) |

设计原则与 Phaser 4 对接模式见 [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)。

## 从 Lua 1.x 迁移

构造方式由 `Xxx.new(...)` 改为 TS 的 `new Xxx(...)`(或等价工厂函数):

| Lua 1.x | TS v2.0 |
|---|---|
| `Resource.new(cfg)` | `new Resource(cfg)` |
| `StateSprite.new(cfg)` | `new StateSprite(cfg)` |
| `ProcShape.new(cfg)` | `new ProcShape(cfg)` |
| `Dialogue.newLibrary(cfg)` | `newLibrary(cfg)` |
| `Dialogue.newTree(cfg)` | `newTree(cfg)` |
| `WeightedEvent.newPool(cfg)` | `newPool(cfg)` |
| `ECS.*`(函数式单例) | `ECS.*`(保持不变,也可具名导入单个函数) |

渲染语义变化:

- LÖVE 的 `draw()` 在 TS 版是**空操作**(签名保留,渲染交给上层);`loadImage()` / `preloadImages()` 退化为「纹理键字符串记录」,不真正加载/绘制。
- 上层(如 Phaser)依据 `getState()` / `getOutlinePoints()` / `getControlPoints()` 拿到纯几何数据,自己绘制(见 `DemoScene.ts`)。

数值与颜色约定:

- 坐标 / 数值 / 时间均为 JS `number`;`dt` 一律以**秒**为单位。
- 颜色统一为 `[r, g, b, a]` 数组,分量取 `0-1`;上层换算到 0-255(见 `DemoScene.ts` 的颜色换算)。

## 许可证

[MIT](LICENSE) —— Copyright (c) 2024 LuckyReels Team。
