"use strict";

/* ================= 常量与状态 ================= */
const LANGUAGES = {
  en: { name: "English", flag: "🇬🇧", ttsLang: "en", speechLang: "en-US", sheet: /(?:^|[\s_.-])(en|eng|english)(?:$|[\s_.-])|英文|英语/i },
  de: { name: "Deutsch", flag: "🇩🇪", ttsLang: "de", speechLang: "de-DE", sheet: /(?:^|[\s_.-])(de|ger|deutsch|german)(?:$|[\s_.-])|德语|德文/i },
  es: { name: "Español", flag: "🇪🇸", ttsLang: "es", speechLang: "es-ES", sheet: /(?:^|[\s_.-])(es|spa|spanish|español|espanol)(?:$|[\s_.-])|西语|西班牙/i }
};
let currentLang = "en";
let allWords = [];
let slotWordCounts = {};
let audioEl = null;

/* ================= 存储层（IndexedDB + 内存降级） ================= */
let db = null;
let usingMemory = false;
let memWords = [];
const memMeta = new Map();
const memDaily = new Map();
const DB_NAME = "word-trainer";
const DB_VERSION = 3;

/* ===== 轻量偏好存储（localStorage → sessionStorage → 内存） ===== */
let prefMemory = {};
function prefGet(k) {
  if (Object.prototype.hasOwnProperty.call(prefMemory, k)) return prefMemory[k];
  try { const value = localStorage.getItem(k); if (value !== null) return value; } catch (e) {}
  try { const value = sessionStorage.getItem(k); if (value !== null) return value; } catch (e) {}
  return null;
}
function prefSet(k, v) {
  // The in-session value remains authoritative even if persistent storage is full.
  prefMemory[k] = String(v);
  try { localStorage.setItem(k, v); return; } catch (e) {}
  try { sessionStorage.setItem(k, v); } catch (e) {}
}

/* ===== 词书槽位（学习方案，按语言独立） ===== */
function getAllSlots() {
  let data = null;
  try { data = JSON.parse(prefGet("slots") || "null"); } catch (e) {}
  // 旧格式（数组）迁移为按语言
  if (Array.isArray(data)) data = { en: data, de: null, es: null };
  if (!data || typeof data !== "object") data = {};
  return data;
}
function saveSlots(all) { prefSet("slots", JSON.stringify(all)); }
function getSlots() {
  const all = getAllSlots();
  const lang = currentLang || "en";
  if (!Array.isArray(all[lang]) || !all[lang].length) {
    all[lang] = [1, 2, 3, 4, 5].map(i => ({ id: "s" + i, name: "方案 " + i, bookIds: [] }));
    saveSlots(all);
  }
  return all[lang];
}
function getActiveSlot() {
  return prefGet("activeSlot:" + (currentLang || "en")) || "s1";
}
function getActiveSlotObj() {
  const arr = getSlots();
  return arr.find(s => s.id === getActiveSlot()) || arr[0];
}
function updateSlotBookIds(bookId, add) {
  const all = getAllSlots();
  const lang = currentLang || "en";
  const arr = all[lang] || (all[lang] = []);
  const obj = arr.find(s => s.id === getActiveSlot());
  if (obj && add && !obj.bookIds.includes(bookId)) obj.bookIds.push(bookId);
  saveSlots(all);
}

function enterMemoryMode() {
  usingMemory = true;
  const tip = document.getElementById("storageTip");
  if (!tip) return;
  if (prefGet("tipForeverClosed") || prefGet("tipOnceClosed")) { tip.hidden = true; return; }
  tip.hidden = false;
}

function openDB() {
  return new Promise((resolve) => {
    if (!("indexedDB" in window)) { enterMemoryMode(); resolve(null); return; }
    try {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = (e) => {
        const d = e.target.result;
        if (!d.objectStoreNames.contains("words")) {
          const ws = d.createObjectStore("words", { keyPath: "id", autoIncrement: true });
          ws.createIndex("lang", "lang", { unique: false });
        }
        if (!d.objectStoreNames.contains("audio")) {
          d.createObjectStore("audio", { keyPath: "key" });
        }
        if (!d.objectStoreNames.contains("wordmeta")) {
          d.createObjectStore("wordmeta", { keyPath: "key" });
        }
        if (!d.objectStoreNames.contains("daily")) d.createObjectStore("daily", { keyPath: "key" });
      };
      req.onsuccess = () => {
        db = req.result;
        db.onversionchange = () => { db.close(); showToast("数据版本已更新，请刷新页面"); };
        resolve(db);
      };
      req.onblocked = () => showToast("请关闭其他 Word Trainer 页面后重试");
      req.onerror = () => { enterMemoryMode(); resolve(null); };
    } catch (e) { enterMemoryMode(); resolve(null); }
  });
}

function txStore(name, mode) { return db.transaction(name, mode).objectStore(name); }

function dbGetAllWords() {
  if (usingMemory) return Promise.resolve(memWords.slice());
  return new Promise((resolve, reject) => {
    const req = txStore("words", "readonly").getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

async function dbAddWords(list, slot = getActiveSlot()) {
  const existing = await dbGetAllWords();
  const seen = new Set(existing.map(w => (w.slot || "s1") + "|" + w.lang + "|" + w.word.toLocaleLowerCase()));
  const toAdd = [];
  let skipped = 0;
  for (const w of list) {
    const k = slot + "|" + w.lang + "|" + w.word.toLocaleLowerCase();
    if (seen.has(k)) { skipped++; continue; }
    seen.add(k);
    toAdd.push({ slot, lang: w.lang, word: w.word, meaning: w.meaning, phonetic: w.phonetic || "", pos: w.pos || "", created: Date.now() });
  }
  if (usingMemory) memWords.push(...toAdd);
  else if (toAdd.length) await new Promise((resolve, reject) => {
    const tx = db.transaction("words", "readwrite");
    for (const w of toAdd) tx.objectStore("words").put(w);
    tx.oncomplete = resolve;
    tx.onabort = tx.onerror = () => reject(tx.error || new Error("词库保存失败"));
  });
  return { added: toAdd.length, skipped };
}

function dbClearWords() {
  if (usingMemory) { memWords = []; return Promise.resolve(); }
  return new Promise((resolve, reject) => {
    const req = txStore("words", "readwrite").clear();
    req.transaction.oncomplete = resolve;
    req.transaction.onabort = () => reject(req.transaction.error || new Error("保存失败"));
    req.onerror = () => reject(req.error);
  });
}
function dbClearMeta() {
  if (usingMemory) { memMeta.clear(); return Promise.resolve(); }
  return new Promise((resolve, reject) => {
    const req = txStore("wordmeta", "readwrite").clear();
    req.transaction.oncomplete = resolve;
    req.transaction.onabort = () => reject(req.transaction.error || new Error("保存失败"));
    req.onerror = () => reject(req.error);
  });
}
function dbClearDaily() {
  if (usingMemory) { memDaily.clear(); return Promise.resolve(); }
  return new Promise((resolve, reject) => {
    const req = txStore("daily", "readwrite").clear();
    req.transaction.oncomplete = resolve;
    req.transaction.onabort = () => reject(req.transaction.error || new Error("保存失败"));
    req.onerror = () => reject(req.error);
  });
}
// 只删当前语言 + 当前方案的数据
function dbDeleteWordsBySlotLang(slot, lang) {
  if (usingMemory) {
    memWords = memWords.filter(w => !((w.slot || "s1") === slot && w.lang === lang));
    return Promise.resolve();
  }
  return new Promise(async (resolve, reject) => {
    try {
      const all = await dbGetAllWords();
      const ids = all.filter(w => (w.slot || "s1") === slot && w.lang === lang).map(w => w.id);
      if (ids.length) {
        await new Promise((res2, rej2) => {
          const t = db.transaction("words", "readwrite");
          const st = t.objectStore("words");
          for (const id of ids) st.delete(id);
          t.oncomplete = res2;
          t.onerror = () => rej2(t.error);
        });
      }
      resolve();
    } catch (e) { reject(e); }
  });
}
function dbDeleteMetaBySlotLang(slot, lang) {
  if (usingMemory) {
    for (const [k, v] of [...memMeta]) { if ((v.slot || "s1") === slot && v.lang === lang) memMeta.delete(k); }
    return Promise.resolve();
  }
  return new Promise(async (resolve, reject) => {
    try {
      const all = await metaAll();
      const keys = all.filter(m => (m.slot || "s1") === slot && m.lang === lang).map(m => m.key);
      if (keys.length) {
        await new Promise((res2, rej2) => {
          const t = db.transaction("wordmeta", "readwrite");
          const st = t.objectStore("wordmeta");
          for (const k of keys) st.delete(k);
          t.oncomplete = res2;
          t.onerror = () => rej2(t.error);
        });
      }
      resolve();
    } catch (e) { reject(e); }
  });
}
/* ================= 工具函数 ================= */
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
function setProgress(pct, text) {
  $("progressBar").style.width = Math.round(pct * 100) + "%";
  $("progressText").textContent = text || "";
}
