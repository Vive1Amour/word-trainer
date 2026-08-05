#!/bin/bash
# Word Trainer 一键开始（macOS 双击）：启动发音引擎 + 打开网页
cd "$(dirname "$0")"
echo "=============================================="
echo " 正在启动 Word Trainer 本地发音引擎..."
echo "=============================================="
# 启动发音代理（前台模式：保持本窗口打开，关闭窗口即停止引擎）
python3 tts-proxy.py > /dev/null 2>&1 &
PROXY_PID=$!
# 等待代理就绪（最多 5 秒）
for i in $(seq 1 10); do
  if curl -s -m 1 http://127.0.0.1:8765/health > /dev/null 2>&1; then
    break
  fi
  sleep 0.5
done
# 打开网页
open index.html
echo ""
echo " ✅ 已打开 Word Trainer（发音引擎运行中）"
echo " ⚠️ 请保持本窗口打开；学习完关闭本窗口即停止引擎。"
echo "=============================================="
wait $PROXY_PID
