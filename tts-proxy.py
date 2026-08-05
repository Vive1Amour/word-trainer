#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Word Trainer 本地 TTS 代理
==========================
用途：让 index.html 获得完全离线的单词发音。

用法：
    python3 tts-proxy.py

启动后：
  1. 用浏览器打开 index.html（双击「开始使用」即可）
  2. 点任意单词 → Piper 本地实时合成发音（纯实时，不缓存）

发音引擎：
  - Piper 离线神经网络语音（模型在 piper/，运行时在 piper_lib/）

说明：
  - 需要本机已安装 Python 3.10+（macOS 可 brew install python@3.12，Windows 官网安装）
  - 不运行本脚本时，页面只能使用系统朗读。
  - 本文件夹可整体拷到任意电脑（Windows / macOS / Linux）直接运行。
"""
import http.server
import io
import re
import sys
import urllib.parse
import wave
from pathlib import Path

PORT = 8765
MIN_AUDIO_BYTES = 100
BASE = Path(__file__).resolve().parent

LANGS = {"en": "en", "de": "de", "es": "es"}

PIPER_AVAILABLE = False
_piper_voices = {}
try:
    _PIPER_LIB = BASE / "piper_lib"
    if _PIPER_LIB.exists():
        sys.path.insert(0, str(_PIPER_LIB))
    from piper import PiperVoice
    PIPER_MODELS = {
        "en": "piper/en_US-lessac-medium.onnx",
        "de": "piper/de_DE-thorsten-medium.onnx",
        "es": "piper/es_ES-sharvard-medium.onnx",
    }
    if all((BASE / p).exists() for p in PIPER_MODELS.values()):
        PIPER_AVAILABLE = True
        print("[engine] Piper 离线引擎已启用（完全离线 · 神经网络语音）")
    else:
        print("[engine] Piper 模型缺失：请确认 piper/ 目录完整")
except ImportError:
    print("[engine] piper_lib 未就绪（可 pip3 install --target piper_lib piper-tts onnxruntime）")


def piper_synthesize(lang, word):
    if not PIPER_AVAILABLE or lang not in PIPER_MODELS:
        raise RuntimeError("Piper 不可用")
    if lang not in _piper_voices:
        _piper_voices[lang] = PiperVoice.load(str(BASE / PIPER_MODELS[lang]))
    voice = _piper_voices[lang]
    buf = io.BytesIO()
    with wave.open(buf, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(voice.config.sample_rate)
        for chunk in voice.synthesize(word):
            wf.writeframes(chunk.audio_int16_bytes)
    data = buf.getvalue()
    if len(data) < MIN_AUDIO_BYTES:
        raise RuntimeError("piper 空音频")
    return data


def safe_filename(word):
    s = re.sub(r'[\\/:*?"<>|\s]+', "_", word).strip("._")
    return (s[:80] or "word")


def synthesize_audio(lang, word, voice_opt=None):
    """生成单词音频，返回 (bytes, engine)。Piper 离线合成。"""
    if not PIPER_AVAILABLE:
        raise RuntimeError("Piper 引擎不可用：请确认 piper/ 模型与 piper_lib/ 运行时存在")
    return piper_synthesize(lang, word), "piper"


class Handler(http.server.BaseHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def _send(self, code, body, ctype, extra_headers=None):
        self.send_response(code)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "*")
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        for k, v in (extra_headers or {}).items():
            self.send_header(k, v)
        self.end_headers()
        try:
            self.wfile.write(body)
        except (BrokenPipeError, ConnectionResetError):
            pass

    def do_OPTIONS(self):
        self._send(200, b"", "text/plain")

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        if parsed.path == "/health":
            self._send(200, b"ok", "text/plain")
            return

        # 接口：/tts?lang=en|de|es&word=<单词>
        lang, word, voice_opt = None, None, None
        qs = urllib.parse.parse_qs(parsed.query)
        if parsed.path == "/tts":
            lang = (qs.get("lang", ["en"])[0]).lower()
            word = qs.get("word", [""])[0]
            voice_opt = qs.get("voice", [""])[0] or None
        if not word or lang not in LANGS:
            self._send(400, b"bad params", "text/plain")
            return

        # 纯实时：直接合成返回，不读缓存、不写缓存
        try:
            data, engine = synthesize_audio(lang, word, voice_opt)
            if len(data) < MIN_AUDIO_BYTES:
                self._send(502, b"empty audio", "text/plain")
                return
            ctype = "audio/wav" if engine == "piper" else "audio/mpeg"
            self._send(200, data, ctype, {"X-Engine": engine})
            print(f"[tts] {lang}: {word} ({engine})")
        except Exception as e:
            self._send(502, (str(e)[:200]).encode("utf-8", "replace"), "text/plain")
            print(f"[error] {lang}: {word} -> {e}")

        return


if __name__ == "__main__":
    print("=" * 56)
    print(" Word Trainer 本地 TTS 代理已启动")
    print(f" 地址: http://127.0.0.1:{PORT}")
    print(" 现在双击打开 index.html，点「缓存全部发音」即可稳定缓存。")

    print(" 停止代理: Ctrl + C")
    print("=" * 56)
    server = http.server.ThreadingHTTPServer(("127.0.0.1", PORT), Handler)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n已停止代理")
