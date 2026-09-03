// GameLib —— 通用游戏系统库(TS 版,引擎无关,零运行时依赖)
// 可按模块单独导入,或从这里统一引入。
//
// 模块清单:
//   ecs.ts            - ECS 实体组件系统(模块级单例函数式 API)
//   resource.ts       - Resource / DerivedResource / ResourceManager 数值资源
//   stateSprite.ts    - StateSprite / LayeredStateSprite / Easing 状态精灵状态机
//   procShape.ts      - ProcShape / BezierShape 程序化形状(几何 + 弹簧物理)
//   interactRegion.ts - InteractRegion / InteractRegionManager 交互区域命中检测
//   dialogue.ts       - DialogueLibrary / DialogueTree 对话系统
//   eventBus.ts       - EventBus 通用发布订阅(事件总线)
//   weightedEvent.ts  - WeightedEventPool 加权随机事件

export * from './ecs';
export * from './resource';
export * from './dialogue';
export * from './weightedEvent';
export * from './stateSprite';
export * from './procShape';
export * from './interactRegion';
export * from './eventBus';

/** GameLib 版本号 */
export const VERSION = '1.0.0';

/** GameLib 描述 */
export const DESCRIPTION = '通用游戏系统库(引擎无关、零运行时依赖)';

/** 获取版本信息 */
export function getVersion(): string {
    return VERSION;
}
