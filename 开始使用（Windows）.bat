@echo off
chcp 65001 > nul
cd /d "%~dp0"
where python >nul 2>nul
if errorlevel 1 (
  echo 未找到 Python。请安装 Python 3.10+ 并勾选 Add to PATH。
  echo 将打开网页，仍可使用系统朗读。
  start "" index.html
  pause
  exit /b 1
)
powershell -NoProfile -Command "try { $s = Invoke-RestMethod -Uri 'http://127.0.0.1:8765/health' -TimeoutSec 1; if ($s.engine -eq 'piper') { exit 0 }; exit 1 } catch { exit 1 }" >nul 2>nul
if not errorlevel 1 (
  echo 检测到已有 Word Trainer 发音服务，将直接使用。
  start "" index.html
  exit /b 0
)
echo 正在启动 Word Trainer。请保留此窗口，Ctrl+C 可停止发音服务。
python tts-proxy.py --open
if errorlevel 1 (
  echo 发音服务未能启动。请查看上方错误；网页仍可使用系统朗读。
  start "" index.html
  pause
)
