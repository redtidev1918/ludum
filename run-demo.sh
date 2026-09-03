#!/usr/bin/env bash
# ludum 一键演示：首次自动安装依赖，然后启动 Phaser 4 演示并自动打开浏览器。
# 用法: ./run-demo.sh   （Windows 请用: npm install && npm start）
set -euo pipefail
cd "$(dirname "$0")"

if ! command -v node >/dev/null 2>&1; then
  echo "需要 Node.js >= 20.19。请先安装: https://nodejs.org" >&2
  exit 1
fi

if [ ! -d node_modules ]; then
  echo "首次运行，安装依赖 (npm install) ..."
  npm install
fi

echo "启动演示 -> http://localhost:5173"
npm start
