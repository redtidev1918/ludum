# GameLib 架构设计

> ⚠️ **v1 文档,迁移中**:本文档描述 v1 架构(模块级 ECS 单例、EventBus 等)。v3 已重写 ECS(见 `docs/ECS.md`)并移除 EventBus(见 `docs/EVENT_BUS.md`);权威决策见 `docs/adr/`。本文档将在 Phase 9 全面重写。

本文档说明 GameLib(TS v1.0)的定位、设计原则、模块职责、通用约定,以及与 Phaser 4 的对接模式。

## 定位:小通用引擎

GameLib 不追求做一个大而全的游戏框架,而是一个**小而通用的系统库**:把反复出现在各类游戏里的基础系统(实体组件、数值资源、状态机、形状、命中检测、对话、加权随机)抽成可独立复用的纯逻辑模块。渲染、输入、物理等平台相关的部分一律不碰,交给上层引擎。

这一定位落地为五条设计原则:

1. **引擎无关**:库代码不 import Phaser,也不 import 任何 DOM / Node 专属 API;每个模块只依赖 JS 语言本身。这样同一套系统能同时跑在浏览器(Phaser 演示)、Node(Vitest 测试)与任何其他宿主。
2. **不重复造轮子**:Phaser 已经有的(渲染、Tween、输入、场景)本库绝不重复实现,只负责 Phaser 不做或不便做的「纯逻辑」部分。
3. **社区 / 标准优先**:类型声明、目录布局、构建脚本都遵循社区常规(Vite + TS + Vitest 的标准工程),不引入私有 DSL。
4. **独立可消费**:每个模块可单独导入;库不绑定渲染引擎,显示层按需接入(见下文与 Phaser 的对接模式)。
5. **行为可预测**:核心行为以单元测试锁定,连「看似不合理但已有测试锁定」的细节(如某些字段只算不用)也一并保留,避免静默改变行为。

## 目录与模块职责

| 路径 | 职责 |
|---|---|
| `src/gamelib/ecs.ts` | 实体组件系统:组件/实体/系统的注册、查询、更新、序列化。模块级单例。 |
| `src/gamelib/resource.ts` | 数值资源:`Resource` / `DerivedResource` / `ResourceManager`。 |
| `src/gamelib/stateSprite.ts` | 状态精灵:`StateSprite` / `LayeredStateSprite` / `Easing`。 |
| `src/gamelib/procShape.ts` | 程序化形状:`ProcShape` / `BezierShape`(几何 + 弹簧阻尼)。 |
| `src/gamelib/interactRegion.ts` | 交互区域:`InteractRegion` / `InteractRegionManager`(命中检测 + 事件)。 |
| `src/gamelib/dialogue.ts` | 对话:`DialogueLibrary` / `DialogueTree`(条件/冷却/插值/历史)。 |
| `src/gamelib/weightedEvent.ts` | 加权事件:`WeightedEventPool`(权重/修改器/保底/统计)。 |
| `src/gamelib/eventBus.ts` | 通用发布订阅:`EventBus`(优先级 / once / 异常隔离 / 多实例)。 |
| `src/gamelib/index.ts` | 汇总导出(`export *`)+ `VERSION` / `getVersion`。 |
| `src/demo/DemoScene.ts` | Phaser 4 集成演示,展示各模块与引擎的桥接方式。 |
| `src/main.ts` | Phaser `GameConfig` 启动入口。 |
| `tests/*.test.ts` | Vitest 单元测试,与 `src/gamelib` 一一对应。 |

模块之间只有两种依赖关系,都通过「鸭子类型」而非具体 import 松耦合:

- `procShape.bindParam` 接受 `ResourceLike`(只要提供 `get(): number`),因此 `Resource` 与任何 mock 都能直接绑定。
- `interactRegion.bindToShape` 接受含 `contains(x, y, cx, cy)` 的对象,因此 `ProcShape` 能作为动态区域使用。

## 通用约定

| 约定 | 规则 |
|---|---|
| 真值语义 | 仅 `null` / `undefined` / `false` 为假;0、空串均为真。用 `luaTruthy()`(仅 `null`/`undefined`/`false` 为假)在需要处(对话条件)表达该语义。 |
| 索引基准 | 内部存储统一 0-based(数组)。但**用户面向的索引为 1-based**:`DialogueTree.choose(n)` 与 `getChoices()` 的 `index`、`BezierDeformRule.point` 均从 1 开始。 |
| 时间单位 | `update(dt)` 一律按**秒**;`Resource` 修改器 `duration`、`StateSprite` 过渡/临时状态时长均为秒。 |
| 颜色 | 统一 `[r, g, b, a]` 数组,分量 0-1;上层换算 0-255。 |
| 链式 | 修改型方法返回 `this`,便于串联。 |
| 渲染 | `draw()` 为空操作;`loadImage()` 只记录纹理键字符串。 |

> 注意时间单位不一致处:`DialogueLibrary` 的冷却/历史用 `osTime()`(秒),而 `WeightedEventPool` 历史条目 `time` 用 `Date.now()`(毫秒)。以源码为准。

## 与 Phaser 4 对接模式

### StateSprite:纹理键 + 状态机,上层做交叉淡入淡出

`StateSprite` 只输出「当前状态 + 过渡进度」,`DemoScene` 据此控制 `Image` 的 `alpha`:

~~~ts
character.updateContext({ hp: this.hp.get(), money: this.gold.get() });
character.update(dt);
const cur = character.getState();
let eased = character.transitionProgress;
if (typeof character.transitionEasing === 'function') {
    eased = character.transitionEasing(eased);
}
for (const [name, img] of this.charImages) {
    const isCur = name === cur;
    const isPrev = character.isTransitioning() && character.previousState === name;
    img.setVisible(isCur || isPrev);
    if (isCur) img.setAlpha(0.2 + 0.8 * eased);
    else if (isPrev) img.setAlpha(0.8 * (1 - eased));
}
~~~

### ProcShape:`getOutlinePoints()` → Phaser Graphics

形状只产出轮廓点数组,上层把 `{x,y}` 转成 `Phaser.Math.Vector2` 后 `fillPoints` / `strokePoints`;颜色换算 0-1 → 0-255。

### InteractRegion:指针事件喂入 manager

`InteractRegion` 是纯坐标输入,由场景把 Phaser 指针桥接进来:

~~~ts
this.input.on('pointerdown', (p) => this.regions.mousepressed(p.x, p.y, 0));
this.input.on('pointermove', (p) => this.regions.mousemoved(p.x, p.y));
this.input.on('pointerup',   (p) => this.regions.mousereleased(p.x, p.y, 0));
~~~

### Resource:`onChange` / `onThreshold` 驱动 UI

每帧 `hp.update(dt)` 后读 `getPercent()` 更新血条宽度;阈值/监听器负责副作用(如跌破 20 弹警告)。

### DialogueLibrary / DialogueTree:UI 选择

`getChoices()` 返回可渲染的选项列表,场景把每个选项映射成一个 `InteractRegion`,点击后调 `tree.choose(choice.index)` 再刷新 UI;无选项节点渲染一个「继续」按钮调 `tree.continue()`。

### WeightedEvent:`getStats()` 统计

`getStats()` 返回 `{ totalRolls, totalTriggers, events: { id: { count, rate, lastRoll } } }`,直接驱动掉落统计面板。


## 每帧更新顺序(参考 DemoScene)

演示场景的 `update` 里,各系统的驱动顺序体现了模块间的数据依赖,可作为集成参考:

1. `Resource.update(dt)` —— 先结算 regen/decay 与 modifier 生命周期,后续系统才能读到最新数值。
2. `StateSprite.updateContext(...)` + `update(dt)` —— 把最新资源值喂入上下文,驱动条件切换与过渡进度。
3. `ProcShape.update(dt)` —— 结算绑定参数与弹簧物理,再 `getOutlinePoints()` 重绘。
4. `InteractRegionManager` —— 指针事件即时桥接;每帧 `update(dt)` 用于 hold 计时。
5. `DialogueLibrary` —— 由定时器(而非每帧)触发 `getRandom()`,对话树由点击事件驱动。
6. `WeightedEventPool` —— 由点击触发 `roll()`,每帧只读 `getStats()` 刷新面板。
7. `ECS.update(dt)` —— 最后跑实体系统,再 `query` 把组件位置同步到图像。

原则:**纯逻辑先结算,渲染最后读数据**。库模块从不主动触碰渲染对象,单向从「逻辑状态」流向「表现」。

## 序列化约定

各模块提供不同粒度的存档能力,均返回纯 JSON 可序列化对象:

- `Resource.serialize()` / `Resource.deserialize()`(静态)/ `ResourceManager.serialize()/deserialize()`。
- `ECS.serialize()` / `ECS.deserialize()`(含 `nextId`)。
- `WeightedEventPool.serialize()` / `deserialize()`(统计与历史)。

`DerivedResource` 刻意不实现 `update` / `serialize`,靠 `ResourceManager` 的鸭子判断(`typeof update === 'function'` 等)区分「基础资源」与「派生资源」,这是一条结构约定。

## 依赖方向

~~~text
            ┌──────────────────────────────┐
            │  src/demo/DemoScene.ts (Phaser)│
            └──────────────▲───────────────┘
                           │ import
            ┌──────────────┴───────────────┐
            │  src/gamelib/index.ts (聚合)  │
            └──────────────▲───────────────┘
        ┌────────┬─────────┼─────────┬────────┐
        │        │         │         │        │
      ecs   resource  stateSprite procShape ... weightedEvent eventBus
        └────────┴─────────┴─────────┴────────┘
          (各模块彼此仅通过鸭子类型弱耦合,无循环依赖)
~~~

模块层不反向依赖演示层,也不依赖 Phaser;只有 `DemoScene` 单向 import 库。

## 测试策略

- 运行器:**Vitest**,`environment: 'node'`(纯逻辑库无需 DOM)。
- 覆盖:8 个测试文件、共 **196** 个 `it` 用例,与 `src/gamelib` 模块一一对应。
- 每个测试文件通过 `describe` 组织,ECS 用 `beforeEach(reset)` 保证用例隔离。
- 配置复用 `vite.config.ts` 的 `test` 块(`include: ['tests/**/*.test.ts']`)。
