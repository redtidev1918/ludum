// Cross-platform bootstrap: ensure dependencies are installed before the demo runs.
// Wired as the `prestart` hook, so `npm start` works on a fresh clone on
// Windows / macOS / Linux without a separate install step. Uses only Node builtins.
import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

if (!existsSync(resolve(root, 'node_modules'))) {
    const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
    console.log('首次运行：安装依赖 (npm install) ...');
    const result = spawnSync(npm, ['install'], {
        cwd: root,
        stdio: 'inherit',
        shell: process.platform === 'win32',
    });
    if (result.status !== 0) process.exit(result.status ?? 1);
}
