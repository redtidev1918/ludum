/// <reference types="vitest/config" />
import { defineConfig } from 'vite';

// Phaser 4 + GameLib 开发/构建配置,测试复用同一配置(vitest)
export default defineConfig({
    base: './',
    server: {
        port: 5173
    },
    test: {
        include: ['tests/**/*.test.ts'],
        environment: 'node',
        reporters: 'dot'
    }
});
