// ludum —— Phaser 4 演示启动入口
import * as Phaser from 'phaser';
import { DemoScene } from './DemoScene';

// 参考:https://docs.phaser.io/api-documentation/typedef/types-core#gameconfig
const config: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO,
    width: 960,
    height: 640,
    parent: 'game-container',
    backgroundColor: '#10141f',
    scene: [DemoScene],
};

export function StartGame(parent: string): Phaser.Game {
    return new Phaser.Game({ ...config, parent });
}

// DOM 就绪后启动游戏
document.addEventListener('DOMContentLoaded', () => {
    StartGame('game-container');
});
