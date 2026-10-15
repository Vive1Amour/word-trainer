/* ================= 记忆追踪（遗忘曲线 / 间隔重复） ================= */
// 艾宾浩斯遗忘曲线复习间隔（小时）：30分钟 → 12小时 → 1天 → 2天 → 4天 → 7天 → 15天 → 30天
const REVIEW_INTERVALS_HOURS = [0.5, 12, 24, 48, 96, 168, 360, 720];
const HOUR_MS = 3600000;
const DAY_MS = 86400000;

function localDateStr(d) {
  d = d || new Date();
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, "0"), day = String(d.getDate()).padStart(2, "0");
  return y + "-" + m + "-" + day;
}

function metaGet(key) {
  if (usingMemory) return Promise.resolve(memMeta.get(key) || null);
  return new Promise((resolve, reject) => {
    const req = txStore("wordmeta", "readonly").get(key);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}
function metaPut(meta) {
  if (usingMemory) { memMeta.set(meta.key, meta); return Promise.resolve(); }
  return new Promise((resolve, reject) => {
    const req = txStore("wordmeta", "readwrite").put(meta);
    req.transaction.oncomplete = resolve;
    req.transaction.onabort = () => reject(req.transaction.error || new Error("保存失败"));
    req.onerror = () => reject(req.error);
  });
}
function metaAll() {
  if (usingMemory) return Promise.resolve([...memMeta.values()]);
  return new Promise((resolve, reject) => {
    const req = txStore("wordmeta", "readonly").getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}
function dailyGet(date) {
  if (usingMemory) return Promise.resolve(memDaily.get(date) || null);
  return new Promise((resolve, reject) => {
    const req = txStore("daily", "readonly").get(date);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}
function dailyPut(d) {
  if (usingMemory) { memDaily.set(d.key, d); return Promise.resolve(); }
  return new Promise((resolve, reject) => {
    const req = txStore("daily", "readwrite").put(d);
    req.transaction.oncomplete = resolve;
    req.transaction.onabort = () => reject(req.transaction.error || new Error("保存失败"));
    req.onerror = () => reject(req.error);
  });
}
function dailyAll() {
  if (usingMemory) return Promise.resolve([...memDaily.values()]);
  return new Promise((resolve, reject) => {
    const req = txStore("daily", "readonly").getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

function nextReviewTs(level) {
  if (level <= 0) return Date.now() + 10 * 60000; // 答错/未掌握：10 分钟后重学
  const idx = Math.min(level, REVIEW_INTERVALS_HOURS.length) - 1;
  return Date.now() + REVIEW_INTERVALS_HOURS[idx] * HOUR_MS;
}
function getGroupSize() {
  const n = Number(prefGet("groupSize"));
  return Number.isFinite(n) && n > 0 ? Math.min(50, Math.floor(n)) : 20;
}

let studyWriteQueue = Promise.resolve();
function recordStudy(lang, word, known, familiar = false) {
  const slot = getActiveSlot();
  const result = studyWriteQueue.then(() => persistStudy(slot, lang, word, known, familiar));
  studyWriteQueue = result.catch(e => { console.error(e); showToast("学习记录保存失败，请及时导出备份"); });
  return result;
}

async function persistStudy(slot, lang, word, known, familiar) {
  const key = slot + "|" + lang + "|" + word;
  const today = localDateStr();
  const m = await metaGet(key);
  const isNew = !m;
  const meta = m || { key, slot, lang, word, level: 0, reviewCount: 0, correct: 0, wrong: 0, firstLearned: Date.now() };
  if (known) meta.level = Math.min(8, (meta.level || 0) + 1);
  else meta.level = 0;
  meta.lastReview = Date.now();
  meta.nextReview = nextReviewTs(meta.level);
  if (familiar) { meta.familiar = true; meta.level = 8; meta.nextReview = Date.now() + 999 * DAY_MS; }
  meta.reviewCount = (meta.reviewCount || 0) + 1;
  if (known) meta.correct = (meta.correct || 0) + 1; else meta.wrong = (meta.wrong || 0) + 1;
  const dkey = slot + "|" + lang + "|" + today;
  const d = (await dailyGet(dkey)) || { key: dkey, date: today, slot, lang, learned: 0, reviewed: 0, correct: 0, wrong: 0, newWords: 0 };
  if (isNew) { d.newWords++; d.learned++; }
  d.reviewed++;
  if (known) d.correct++; else d.wrong++;
  await writeStudyRecords(meta, d);
}

// 标记"熟悉"：不再出现在学习队列，进度记为已掌握
function markFamiliar(lang, word) {
  return recordStudy(lang, word, true, true);
}

// 统计一组里：复习（已学过到期） / 新词 各多少
async function deckInfo(deck, lang) {
  const slot = getActiveSlot();
  let review = 0, fresh = 0;
  for (const w of deck) {
    const m = await metaGet(slot + "|" + lang + "|" + w.word);
    if (m) review++; else fresh++;
  }
  return { review, fresh };
}
function showDeckInfo(review, fresh) {
  const el = document.getElementById("studyDeckInfo");
  if (!el) return;
  const total = review + fresh;
  el.innerHTML = review > 0
    ? "🔁 本组复习 <b>" + review + "</b> 个 · 🆕 新词 <b>" + fresh + "</b> 个 · 共 " + total + " 个" + (review > 0 ? "（到期词优先复习）" : "")
    : "🆕 本组新词 <b>" + fresh + "</b> 个 · 共 " + total + " 个";
}

// 待学筛选：到期复习 + 新词 + 补充其它
async function getStudyWords(lang, limit, excludeSet) {
  const words = allWords.filter(w => w.lang === lang);
  const metas = await metaAll();
  const slot = getActiveSlot();
  const metaMap = new Map(metas.map(m => [m.key, m]));
  const now = Date.now();
  const due = [], fresh = [];
  for (const w of words) {
    if (excludeSet && excludeSet.has(w.word.toLocaleLowerCase())) continue;
    const m = metaMap.get(slot + "|" + lang + "|" + w.word);
    if (m && m.familiar) continue; // 熟悉的词不再出现
    if (!m) fresh.push(w);
    else if (m.nextReview <= now) due.push(w);

  }
  const deck = shuffle(due); // 到期复习词优先全部进入
  if (deck.length < limit) deck.push(...shuffle(fresh).slice(0, limit - deck.length));
  // 未到复习时间的词保留原排期；手动「再来一遍」仍可练习当前组。
  return deck.slice(0, limit || deck.length);
}
