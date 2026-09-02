// GameLib —— 通用游戏系统库(TS 版,引擎无关,零运行时依赖)
// 从 Lua 1.x 完整移植,API 等价。可按模块单独导入,或从这里统一引入。
//
// 模块清单:
//   ecs.ts            - ECS 实体组件系统(模块级单例函数式 API)
//   resource.ts       - Resource / DerivedResource / ResourceManager 数值资源
//   stateSprite.ts    - StateSprite / LayeredStateSprite / Easing 状态精灵状态机
//   procShape.ts      - ProcShape / BezierShape 程序化形状(几何 + 弹簧物理)
//   interactRegion.ts - InteractRegion / InteractRegionManager 交互区域命中检测
//   dialogue.ts       - DialogueLibrary / DialogueTree 对话系统
//   weightedEvent.ts  - WeightedEventPool 加权随机事件

export * from './ecs';
export * from './resource';
export * from './dialogue';
export * from './weightedEvent';
export * from './stateSprite';
export * from './procShape';
export * from './interactRegion';

/** GameLib 版本号(本 TS 重构版) */
export const VERSION = '2.0.0';

/** GameLib 描述 */
export const DESCRIPTION = '通用游戏系统库(Phaser 4 + TypeScript 重构版)';

/** 获取版本信息 */
export function getVersion(): string {
    return VERSION;
}
