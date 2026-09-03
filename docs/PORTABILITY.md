# 可移植性 (Portability)

> English: [PORTABILITY.en.md](./PORTABILITY.en.md)

ludum 在三个层次上是可移植的。

## 第一层 —— 直接 TypeScript 运行时（一等支持）

- **Phaser** —— 参考消费方（渲染 / 场景 / 输入 / 音频）。
- **Cocos Creator** —— 兼容性冒烟测试消费方。
- **Node / headless** —— 架构参考。
- **浏览器** —— 任意打包器。

## 第二层 —— JS 运行时桥接

- GodotJS 及类似的 JS 桥接。只要桥接能运行标准 JS 模块即可。

## 第三层 —— 规范移植

- Godot C#、Unity、Unreal、Rust 等。

可移植性是通过符合 `spec/conventions.md`（时间 / 随机 / 快照 / 条件语义）来实现的，
而**不是**靠发布引擎适配器。第三层的移植复用的是规范，而非 TypeScript 代码。
