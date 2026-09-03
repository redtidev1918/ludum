/// <reference types="vitest/config" />
import { defineConfig } from 'vite';

// Phaser 4 + ludus 开发/构建配置,测试复用同一配置(vitest)
export default defineConfig({
    base: './',
    build: {
        // Demo build goes to a separate dir so it never clobbers the library `dist/`
        // produced by `npm run build:lib`.
        outDir: 'dist-demo'
    },
    server: {
        port: 5173
    },
    test: {
        include: ['tests/**/*.test.ts'],
        environment: 'node',
        reporters: 'dot'
    }
});
