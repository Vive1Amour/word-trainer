/* ================= TTS：获取 / 缓存 / 播放 =================
 * 音源：本地代理（tts-proxy.py）Piper 离线实时合成
 * 降级：本地代理 → 浏览器系统语音 speechSynthesis
 */
const LOCAL_TTS = "http://127.0.0.1:8765/tts?lang=";

function fetchWithTimeout(url, timeoutMs) {
  return new Promise((resolve, reject) => {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    fetch(url, { signal: ctrl.signal }).then(resolve).catch(reject).finally(() => clearTimeout(timer));
  });
}

async function proxyAlive() {
  try {
    const r = await fetchWithTimeout("http://127.0.0.1:8765/health", 1500);
    if (!r.ok) return false;
    const status = await r.json();
    return status.engineAvailable === true;
  } catch (e) { return false; }
}

async function fetchTTS(lang, word) {
  const url = LOCAL_TTS + encodeURIComponent(lang) + "&word=" + encodeURIComponent(word);
  const resp = await fetchWithTimeout(url, 15000);
  if (!resp.ok) throw new Error("HTTP " + resp.status);
  const blob = await resp.blob();
  if (!blob || blob.size < 50) throw new Error("empty audio");
  return blob;
}

function spellCompareHTML(guess, ans) {
  const n = Math.max(guess.length, ans.length);
  let spell = "", correctCount = 0;
  for (let i = 0; i < n; i++) {
    const g = guess[i] || "";
    const a = ans[i] || "";
    const hit = !!g && !!a && g === a;
    if (hit) correctCount++;
    spell += '<span class="' + (hit ? "sok" : "sbad") + '">' + esc(g || "·") + '</span>';
  }
  return { html: spell, correct: correctCount, total: ans.length };
}

function showToast(msg, ms) {
  const t = document.getElementById("toast");
  if (!t) return;
  t.textContent = msg;
  t.hidden = false;
  requestAnimationFrame(() => t.classList.add("show"));
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => { t.classList.remove("show"); }, ms || 3800);
}

function showPlayHint(msg) {
  const el = document.getElementById("playHint");
  if (!el) return;
  el.textContent = "🔕 " + msg;
  el.hidden = false;
  clearTimeout(showPlayHint._t);
  showPlayHint._t = setTimeout(() => { el.hidden = true; }, 4500);
}

function speakFallback(lang, word) {
  // 系统语音兜底：只在确有对应语言语音时才用，否则提示启动发音引擎
  if (!("speechSynthesis" in window)) { showPlayHint("发音引擎未运行，请双击「开始使用（Mac）.command」"); return; }
  try {
    const voices = speechSynthesis.getVoices();
    const prefix = LANGUAGES[lang].speechLang.slice(0, 2).toLowerCase();
    const match = voices.find(v => v.lang && v.lang.toLowerCase().startsWith(prefix));
    if (!voices.length) {
      // 语音列表尚未加载（首次调用为空）：按语言直接读，由系统选择
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(word);
      u.lang = LANGUAGES[lang].speechLang;
      u.rate = parseFloat($("listenSpeed").value || "1");
      speechSynthesis.speak(u);
      return;
    }
    if (!match) {
      showPlayHint("系统没有" + LANGUAGES[lang].name + "语音，请双击「开始使用（Mac）.command」启动发音引擎");
      return;
    }
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(word);
    u.lang = match.lang;
    u.voice = match;
    u.rate = parseFloat($("listenSpeed").value || "1");
    speechSynthesis.speak(u);
  } catch (e) { /* ignore */ }
}

let audioRequestVersion = 0;
let audioController = null;
const audioCache = new Map();
const AUDIO_CACHE_LIMIT = 60;

function stopAudio() {
  audioRequestVersion++;
  audioController?.abort();
  audioController = null;
  if (audioEl) audioEl.pause();
  if ("speechSynthesis" in window) speechSynthesis.cancel();
}
function playBlob(blob) {
  if (!audioEl) audioEl = new Audio();
  if (audioEl.src) URL.revokeObjectURL(audioEl.src);
  audioEl.src = URL.createObjectURL(blob);
  audioEl.playbackRate = parseFloat($("listenSpeed").value || "1");
  audioEl.play().catch(() => showPlayHint("浏览器暂停了音频播放，请再次点击发音按钮"));
}
async function playWord(lang, word) {
  stopAudio();
  const version = audioRequestVersion;
  const key = lang + "|" + word;
  if (audioCache.has(key)) { playBlob(audioCache.get(key)); return; }
  const controller = new AbortController();
  audioController = controller;
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const url = LOCAL_TTS + encodeURIComponent(lang) + "&word=" + encodeURIComponent(word);
    const resp = await fetch(url, { signal: controller.signal });
    if (!resp.ok) throw new Error("HTTP " + resp.status);
    const blob = await resp.blob();
    if (blob.size < 50) throw new Error("empty audio");
    if (version !== audioRequestVersion) return;
    if (audioCache.size >= AUDIO_CACHE_LIMIT) audioCache.delete(audioCache.keys().next().value);
    audioCache.set(key, blob);
    playBlob(blob);
  } catch (e) {
    if (version === audioRequestVersion) speakFallback(lang, word);
  } finally {
    clearTimeout(timer);
    if (audioController === controller) audioController = null;
  }
}
window.addEventListener("pagehide", () => {
  stopAudio();
  if (audioEl?.src) URL.revokeObjectURL(audioEl.src);
});
