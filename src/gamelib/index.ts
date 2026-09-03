// GameLib —— 通用游戏系统库(TS 版,引擎无关,零运行时依赖)
// 可按模块单独导入,或从这里统一引入。
//
// 模块清单:
//   ecs.ts            - ECS 实体组件系统(实例化 World + 类型化组件)
//   resource.ts       - Resource / DerivedResource / ResourceManager 数值资源
//   stateSprite.ts    - StateSprite / LayeredStateSprite / Easing 状态精灵状态机
//   procShape.ts      - ProcShape / BezierShape 程序化形状(几何 + 弹簧物理)
//   interactRegion.ts - InteractRegion / InteractRegionManager 交互区域命中检测
//   dialogue.ts       - DialogueLibrary / DialogueTree 对话系统
//   weighted/         - WeightedTable / selectWeighted / WeightedSession 加权随机选择
//   runtime/          - Clock / RandomSource / IdGenerator / ValueSource 运行时能力
//   predicate.ts      - Predicate<T> 纯谓词
//   signal.ts         - Signal<T> 类型化局部事件
//
// 注意:相对导入使用 .js 扩展名,使 ESM 产物可被 Node 直接解析(非 bundler 消费)。

export * from './ecs.js';
export * from './resource.js';
export * from './dialogue.js';
export * from './weighted/table.js';
export * from './weighted/session.js';
export * from './stateSprite.js';
export * from './procShape.js';
export * from './interactRegion.js';
export * from './runtime/clock.js';
export * from './runtime/random.js';
export * from './runtime/id-generator.js';
export * from './runtime/value-source.js';
export * from './runtime/countdown.js';
export * from './predicate.js';
export * from './signal.js';
export * from './condition-expression.js';
export * from './definition.js';
export * from './validation.js';

/** GameLib 版本号 */
export const VERSION = '3.0.0';

/** GameLib 描述 */
export const DESCRIPTION = '引擎无关、零运行时依赖的 TypeScript gameplay systems toolkit';

/** 获取版本信息 */
export function getVersion(): string {
    return VERSION;
}
