"use strict";

let libraryBusy = false;
function setLibraryBusy(busy) {
  libraryBusy = busy;
  for (const selector of ["#langSelect", ".slot-tab", "[data-book]", "#btnClear", "#btnRestoreBackup", "#btnStartStudy"]) {
    document.querySelectorAll(selector).forEach(el => { el.disabled = busy; });
  }
  $("dropzone").setAttribute("aria-disabled", String(busy));
}

// Shared workspace interactions. Classic scripts intentionally support direct file opening.
async function writeStudyRecords(meta, daily) {
  if (usingMemory) {
    memMeta.set(meta.key, { ...meta });
    memDaily.set(daily.key, { ...daily });
    return;
  }
  await new Promise((resolve, reject) => {
    const tx = db.transaction(["wordmeta", "daily"], "readwrite");
    tx.objectStore("wordmeta").put(meta);
    tx.objectStore("daily").put(daily);
    tx.oncomplete = resolve;
    tx.onabort = tx.onerror = () => reject(tx.error || new Error("保存失败"));
  });
}

function aggregateDaily(rows) {
  const result = new Map();
  for (const row of rows) {
    if (!row.date) continue;
    const total = result.get(row.date) || { date: row.date, reviewed: 0, newWords: 0, learned: 0, correct: 0, wrong: 0 };
    for (const key of ["reviewed", "newWords", "learned", "correct", "wrong"]) total[key] += Number(row[key]) || 0;
    result.set(row.date, total);
  }
  return [...result.values()];
}

async function deleteDailyForSlot(slot, lang) {
  const rows = (await dailyAll()).filter(row => row.slot === slot && row.lang === lang);
  if (usingMemory) { rows.forEach(row => memDaily.delete(row.key)); return; }
  await new Promise((resolve, reject) => {
    const tx = db.transaction("daily", "readwrite");
    rows.forEach(row => tx.objectStore("daily").delete(row.key));
    tx.oncomplete = resolve;
    tx.onabort = tx.onerror = () => reject(tx.error || new Error("清空失败"));
  });
}

async function clearWorkspaceData(slot, lang) {
  if (usingMemory) {
    await dbDeleteWordsBySlotLang(slot, lang);
    await dbDeleteMetaBySlotLang(slot, lang);
    await deleteDailyForSlot(slot, lang);
    return;
  }
  await new Promise((resolve, reject) => {
    const tx = db.transaction(["words", "wordmeta", "daily"], "readwrite");
    for (const name of ["words", "wordmeta", "daily"]) {
      const store = tx.objectStore(name);
      const req = store.openCursor();
      req.onsuccess = () => {
        const cursor = req.result;
        if (!cursor) return;
        const row = cursor.value;
        const rowSlot = name === "daily" ? row.slot : row.slot || "s1";
        if (rowSlot === slot && row.lang === lang) cursor.delete();
        cursor.continue();
      };
    }
    tx.oncomplete = resolve;
    tx.onabort = tx.onerror = () => reject(tx.error || new Error("清空失败"));
  });
}

async function renderOverview() {
  const slot = getActiveSlot();
  const lang = currentLang;
  const metas = (await metaAll()).filter(m => (m.slot || "s1") === slot && m.lang === lang);
  const rows = (await dailyAll()).filter(d => d.slot === slot && d.lang === lang && d.date === localDateStr());
  // Ignore results for a workspace that changed while storage was being read.
  if (slot !== getActiveSlot() || lang !== currentLang) return;
  const due = metas.filter(m => !m.familiar && m.nextReview <= Date.now()).length;
  const fresh = Math.max(0, allWords.length - metas.length);
  $("overviewWords").textContent = allWords.length.toLocaleString();
  $("overviewLearned").textContent = metas.length.toLocaleString();
  $("overviewDue").textContent = due.toLocaleString();
  $("overviewToday").textContent = rows.reduce((n, r) => n + (r.reviewed || 0), 0).toLocaleString();
  $("overviewSlot").textContent = getActiveSlotObj().name + " · " + LANGUAGES[lang].name;
  $("heroTitle").textContent = !allWords.length ? "从今天的第一个词开始" : due ? "有 " + due + " 个老朋友，等你再见一面" : fresh ? "今天，再认识一些新词" : "练习完成，给记忆一点时间";
  $("heroDescription").textContent = !allWords.length ? "先挑一本适合自己的词书，再用抽认卡、拼写或听写慢慢记住。" : `「${getActiveSlotObj().name}」里有 ${allWords.length.toLocaleString()} 个词。到期词优先复习，新词按你的节奏加入。`;
  $("heroCaption").textContent = `每组 ${getGroupSize()} 个词 · 三种方式练习 · 进度${usingMemory ? "仅在本次会话保存" : "自动保存在本机"}`;
  $("btnStartStudy").textContent = !allWords.length ? "先选一本词书 ↗" : "开始学习 ↗";
}

let studyResetVersion = 0;
async function resetStudy() {
  // Build all modes from one read, to keep a consistent group and prevent stale asynchronous results.
  const version = ++studyResetVersion;
  const lang = currentLang, slot = getActiveSlot();
  const words = await getStudyWords(lang, getGroupSize());
  if (version !== studyResetVersion || lang !== currentLang || slot !== getActiveSlot()) return;
  deck = words.map(w => ({ ...w }));
  quiz = shuffle(words.map(w => ({ ...w })));
  listen = shuffle(words.map(w => ({ ...w })));
  deckIdx = quizIdx = listenIdx = 0;
  deckKnown = quizScore = listenScore = 0;
  deckUnknown = []; quizWrong = []; listenWrong = [];
  cardFlipped = quizChecked = listenChecked = false;
  listenSuppressAuto = true;
  renderCard(); renderQuiz(); renderListen();
  await refreshActiveDeckInfo();
}

function activeStudyMode() {
  return document.querySelector(".mode-tabs button.active")?.dataset.mode || "cards";
}
async function refreshActiveDeckInfo() {
  const mode = activeStudyMode();
  const group = mode === "cards" ? deck : mode === "quiz" ? quiz : listen;
  const lang = currentLang, slot = getActiveSlot();
  const info = await deckInfo(group, lang);
  if (mode !== activeStudyMode() || lang !== currentLang || slot !== getActiveSlot()) return;
  showDeckInfo(info.review, info.fresh);
  $("studyEmpty").hidden = group.length > 0;
  const idx = mode === "cards" ? deckIdx : mode === "quiz" ? quizIdx : listenIdx;
  $("sessionProgress").style.width = (group.length ? Math.min(100, idx / group.length * 100) : 0) + "%";
}
function updateSessionProgress() {
  const mode = activeStudyMode();
  const total = mode === "cards" ? deck.length : mode === "quiz" ? quiz.length : listen.length;
  const idx = mode === "cards" ? deckIdx : mode === "quiz" ? quizIdx : listenIdx;
  $("sessionProgress").style.width = (total ? Math.min(100, idx / total * 100) : 0) + "%";
}
function syncNavigation() {
  for (const selector of [".main-nav button", ".mode-tabs button", ".slot-tab"]) {
    document.querySelectorAll(selector).forEach(b => b.setAttribute("aria-pressed", String(b.classList.contains("active"))));
  }
}
function navigateView(view) {
  document.querySelector(`.main-nav button[data-view="${view}"]`)?.click();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function downloadJSON(data, name) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = url; link.download = name;
  document.body.appendChild(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
async function exportBackup() {
  await studyWriteQueue;
  const [words, meta, daily] = await Promise.all([dbGetAllWords(), metaAll(), dailyAll()]);
  const prefs = { slots: getAllSlots(), currentLang, groupSize: getGroupSize() };
  for (const lang of Object.keys(LANGUAGES)) prefs["activeSlot:" + lang] = prefGet("activeSlot:" + lang) || "s1";
  downloadJSON({ format: "word-trainer-backup", version: 1, exportedAt: new Date().toISOString(), words, meta, daily, prefs }, "word-trainer-backup-" + localDateStr() + ".json");
  showToast("完整备份已导出：包括所有语言、方案和学习进度");
}

function validateBackup(raw) {
  if (!raw || raw.format !== "word-trainer-backup" || raw.version !== 1) throw new Error("不是支持的 Word Trainer 备份文件");
  for (const key of ["words", "meta", "daily"]) {
    if (!Array.isArray(raw[key]) || raw[key].length > 200000) throw new Error("备份内容不完整或过大");
  }
  const validSlot = slot => /^s[1-5]$/.test(slot || "s1");
  const text = value => typeof value === "string" && value.length <= 10000;
  const words = raw.words.map(w => {
    if (!w || !LANGUAGES[w.lang] || !validSlot(w.slot) || !text(w.word) || !w.word.trim() || !text(w.meaning)) throw new Error("备份中存在无效单词");
    return { slot: w.slot || "s1", lang: w.lang, word: w.word.trim(), meaning: w.meaning, phonetic: text(w.phonetic) ? w.phonetic : "", pos: text(w.pos) ? w.pos : "", created: Number(w.created) || Date.now() };
  });
  const meta = raw.meta.map(m => {
    if (!m || !LANGUAGES[m.lang] || !validSlot(m.slot) || !text(m.word) || !m.word || m.key !== (m.slot || "s1") + "|" + m.lang + "|" + m.word) throw new Error("备份中存在无效学习记录");
    const row = { key: m.key, slot: m.slot || "s1", lang: m.lang, word: m.word, familiar: !!m.familiar };
    for (const field of ["level", "reviewCount", "correct", "wrong", "firstLearned", "lastReview", "nextReview"]) {
      row[field] = Number(m[field]) || 0;
      if (!Number.isFinite(row[field]) || row[field] < 0) throw new Error("备份中的学习数值无效");
    }
    if (row.level > 8) throw new Error("备份中的记忆等级无效");
    return row;
  });
  const daily = raw.daily.map(d => {
    if (!d || !LANGUAGES[d.lang] || (d.slot && !validSlot(d.slot)) || !/^\d{4}-\d{2}-\d{2}$/.test(d.date) || d.key !== (d.slot ? d.slot + "|" : "") + d.lang + "|" + d.date) throw new Error("备份中存在无效每日统计");
    const row = { key: d.key, date: d.date, lang: d.lang };
    if (d.slot) row.slot = d.slot;
    for (const field of ["reviewed", "newWords", "learned", "correct", "wrong"]) {
      row[field] = Number(d[field]) || 0;
      if (!Number.isFinite(row[field]) || row[field] < 0) throw new Error("备份中的统计数值无效");
    }
    return row;
  });
  const prefs = {};
  if (raw.prefs?.slots) {
    const slots = {};
    for (const lang of Object.keys(LANGUAGES)) {
      const list = raw.prefs.slots[lang];
      if (!list) continue;
      if (!Array.isArray(list) || list.length !== 5 || new Set(list.map(s => s.id)).size !== 5) throw new Error("备份中的方案设置无效");
      slots[lang] = list.map(s => {
        if (!validSlot(s.id) || !text(s.name) || !s.name.trim() || !Array.isArray(s.bookIds)) throw new Error("备份中的方案设置无效");
        return { id: s.id, name: s.name.slice(0, 24), bookIds: s.bookIds.filter(id => typeof id === "string" && window.BOOKS?.[id]?.lang === lang) };
      });
    }
    prefs.slots = JSON.stringify(slots);
  }
  if (LANGUAGES[raw.prefs?.currentLang]) prefs.currentLang = raw.prefs.currentLang;
  if ([5,10,15,20,30,40,50].includes(raw.prefs?.groupSize)) prefs.groupSize = String(raw.prefs.groupSize);
  for (const lang of Object.keys(LANGUAGES)) {
    const id = raw.prefs?.["activeSlot:" + lang];
    if (id && validSlot(id)) prefs["activeSlot:" + lang] = id;
  }
  return { words, meta, daily, prefs };
}

async function restoreBackup(file) {
  if (!file || libraryBusy) return;
  try {
    if (file.size > 50 * 1024 * 1024) throw new Error("备份文件超过 50 MB");
    const data = validateBackup(JSON.parse(await file.text()));
    if (!confirm(`恢复备份中的 ${data.words.length.toLocaleString()} 个词和学习记录？\n将合并到本地词库；相同单词的进度、同日统计和方案名称使用备份版本。\n建议先导出当前备份。`)) return;
    setLibraryBusy(true);
    await studyWriteQueue;
    const existing = await dbGetAllWords();
    const key = w => (w.slot || "s1") + "|" + w.lang + "|" + w.word.toLocaleLowerCase();
    const map = new Map(existing.map(w => [key(w), w]));
    for (const word of data.words) {
      const old = map.get(key(word));
      map.set(key(word), old?.id ? { ...word, id: old.id } : word);
    }
    if (usingMemory) {
      memWords = [...map.values()];
      data.meta.forEach(m => memMeta.set(m.key, m));
      data.daily.forEach(d => memDaily.set(d.key, d));
    } else {
      await new Promise((resolve, reject) => {
        const tx = db.transaction(["words", "wordmeta", "daily"], "readwrite");
        for (const w of map.values()) tx.objectStore("words").put(w);
        data.meta.forEach(m => tx.objectStore("wordmeta").put(m));
        data.daily.forEach(d => tx.objectStore("daily").put(d));
        tx.oncomplete = resolve;
        tx.onabort = tx.onerror = () => reject(tx.error || new Error("恢复失败"));
      });
    }
    for (const [k,v] of Object.entries(data.prefs)) prefSet(k,v);
    $("maxNewSelect").value = String(getGroupSize());
    $("studyGroupSize").value = String(getGroupSize());
    setLibraryBusy(false);
    await switchLang(data.prefs.currentLang || currentLang);
    showToast("备份已恢复，词库和学习进度已更新");
  } catch (e) { showToast("恢复失败：" + e.message, 7000); }
  finally { setLibraryBusy(false); }
}

async function checkEngine() {
  $("engineStatus").textContent = "正在检测…";
  const alive = await proxyAlive();
  $("engineStatus").textContent = alive ? "Piper 离线发音已就绪" : "系统朗读模式 · 启动「开始使用」脚本可启用 Piper 离线语音。";
  $("engineStatus").classList.toggle("off", !alive);
}

function bindWorkspaceEvents() {
  $("todayLabel").textContent = new Intl.DateTimeFormat("zh-CN", { month:"long", day:"numeric", weekday:"long" }).format(new Date());
  document.querySelector(".brand").onclick = e => { e.preventDefault(); navigateView("manage"); };
  $("btnStartStudy").onclick = async () => {
    if (!allWords.length) { $("librarySection").scrollIntoView({ behavior:"smooth", block:"start" }); return; }
    await studyWriteQueue;
    await resetStudy();
    navigateView("study");
  };
  $("btnBrowseBooks").onclick = () => $("librarySection").scrollIntoView({ behavior:"smooth", block:"start" });
  $("btnEmptyLibrary").onclick = () => navigateView("manage");
  $("btnListPrev").onclick = () => { wordPage--; renderWordList(); };
  $("btnListNext").onclick = () => { wordPage++; renderWordList(); };
  $("btnExportBackup").onclick = () => exportBackup().catch(e => showToast("导出失败：" + e.message));
  $("btnRestoreBackup").onclick = () => $("backupInput").click();
  $("backupInput").onchange = e => { restoreBackup(e.target.files[0]); e.target.value = ""; };
  $("btnCheckEngine").onclick = checkEngine;
  $("btnExitFocus").onclick = () => {
    document.body.classList.remove("immersive");
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else if (document.webkitFullscreenElement) document.webkitExitFullscreen();
  };
  document.addEventListener("keydown", e => {
    if (e.isComposing || e.ctrlKey || e.metaKey || e.altKey || $("study-view").hidden || activeStudyMode() !== "cards") return;
    if (e.target.closest("input,select,textarea,a,[contenteditable=true]")) return;
    if (e.key === " " && e.target.closest("button")) return;
    const actions = { " ":flipCard, "1":() => cardAnswer(false), "2":() => cardAnswer(true), "3":cardFamiliar, p:() => $("btnPlayCard").click() };
    if (actions[e.key.toLowerCase()]) { e.preventDefault(); actions[e.key.toLowerCase()](); }
  });
  $("flashcard").addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); flipCard(); } });
  // Keep status and progress synchronized after user actions, without polling.
  document.addEventListener("click", () => {
    setTimeout(async () => {
      await studyWriteQueue;
      await renderOverview();
      await refreshActiveDeckInfo();
      syncNavigation();
    }, 0);
  });
}
