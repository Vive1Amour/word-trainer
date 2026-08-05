@echo off
REM Word Trainer 一键开始（Windows 双击）：启动发音引擎 + 打开网页
cd /d %~dp0
echo ==============================================
echo  正在启动 Word Trainer 本地发音引擎...
echo ==============================================
start /b "" python tts-proxy.py
timeout /t 2 > nul
start "" index.html
echo.
echo  ✅ 已打开 Word Trainer（发音引擎运行中）
echo  ⚠️ 请保持本窗口打开；学习完关闭本窗口即停止引擎。
echo ==============================================
pause
