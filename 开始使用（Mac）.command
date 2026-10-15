#!/bin/bash
# Keep the page on file:// so existing browser learning data remains at its original origin.
cd "$(dirname "$0")" || exit 1
if ! command -v python3 >/dev/null 2>&1; then
  echo "请先安装 Python 3.10+，或直接打开 index.html 使用系统朗读。"
  open index.html
  read -r -p "按回车退出…"
  exit 1
fi
if curl -fsS -m 1 http://127.0.0.1:8765/health 2>/dev/null | python3 -c 'import json,sys; assert json.load(sys.stdin).get("engine") == "piper"' 2>/dev/null; then
  echo "检测到已有 Word Trainer 发音服务，将直接使用。"
  open index.html
  exit 0
fi
echo "正在启动 Word Trainer…"
python3 tts-proxy.py &
PROXY_PID=$!
trap 'kill "$PROXY_PID" 2>/dev/null' EXIT
trap 'exit 0' INT TERM HUP
READY=0
for ((i=0; i<20; i++)); do
  if curl -fsS -m 1 http://127.0.0.1:8765/health >/dev/null 2>&1; then
    READY=1
    break
  fi
  if ! kill -0 "$PROXY_PID" 2>/dev/null; then break; fi
  sleep 0.5
done
open index.html
if [ "$READY" -eq 1 ]; then
  echo "网页已打开。请保留此窗口；Ctrl+C 可停止本次发音服务。"
  wait "$PROXY_PID"
else
  echo "发音服务未就绪，网页仍可使用系统朗读。请查看上面的错误信息。"
  read -r -p "按回车退出…"
fi
