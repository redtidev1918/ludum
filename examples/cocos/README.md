# ludum x Cocos Creator（集成参考）

类型层面的集成参考，展示 ludum 的纯玩法系统接入一个 Cocos Creator 3.x 组件。
ludum 拥有**全部**玩法逻辑（状态机、加权符号选择、shuffle bag、余额）；Cocos 负责
渲染、输入与生命周期。

## 文件

- `ReelLogic.ts` —— 一个 `@ccclass` 老虎机卷轴控制器，使用
  `StateMachine` + `WeightedTable` + `ShuffleBag` + `Resource`。
- `cc.d.ts` —— 一个极简 `cc` 类型 shim，让示例能独立 typecheck
  （无需 Cocos 编辑器）。**在真实 Cocos 项目中删除它。**

## 在真实 Cocos Creator 项目中使用

1. `npm install ludum`
2. 把 `ReelLogic.ts` 复制到你项目的 `assets/`（删除 `cc.d.ts`）。
3. 把 import 从相对的 `../../src/gamelib` 路径改为包名：

   ```ts
   import { Resource, StateMachine, WeightedTable, selectFromTable, ShuffleBag, SystemRandom } from 'ludum';
   ```

4. 把 `ReelLogic` 挂到某个节点上；用按钮调用 `spin()`；在你的渲染器/动画器里读 `getState()`。

## 为什么重要

这在类型层面证明了核心主张：ludum 只针对 `lib: ["ES2022"]` 编译，所以同一份玩法
代码可以原样运行在 Phaser 4（`examples/phaser`）、headless Node（`examples/headless`）
和 Cocos Creator 中 —— 零运行时依赖，库本身没有任何引擎 import。
