async function reloadWords() {
  const all = await dbGetAllWords();
  const slot = getActiveSlot();
  wordPage = 0;
  allWords = all.filter(w => (w.slot || "s1") === slot && w.lang === currentLang);
  slotWordCounts = {};
  for (const w of all) {
    const s = w.slot || "s1";
    const l = w.lang;
    if (!slotWordCounts[s]) slotWordCounts[s] = {};
    slotWordCounts[s][l] = (slotWordCounts[s][l] || 0) + 1;
  }
  renderWordList();
  await renderOverview();
}

/* ================= 内置词书 ================= */
function renderBuiltinBooks() {
  window.BOOKS = window.BOOKS || {};
  const intro = document.getElementById("bookIntro");
  for (const src of [window.BOOKS_BIZ, window.BOOKS_PRO, window.BOOKS_EXAM, window.BOOKS_DE_CEFR, window.BOOKS_ES_FREQ, window.BOOKS_OPEN]) {
    if (src) {
      for (const k of Object.keys(src)) {
        if (!window.BOOKS[k]) window.BOOKS[k] = src[k];
      }
    }
  }
  const box = document.getElementById("builtinBooks");
  if (!box) return;
  if (typeof window.BOOKS === "undefined" || !Object.keys(window.BOOKS).length) {
    box.innerHTML = '<p class="hint">未检测到内置词书数据（books-data.js）</p>';
    return;
  }
  const legacyCategory = { coca: "foundation", de_a1: "foundation", de_a2: "foundation", es_3000: "foundation", bec: "professional", aiit: "professional", med: "professional", law: "professional", bio: "professional" };
  const categoryOf = book => book.category || legacyCategory[book.id] || "exam";
  const allLangBooks = Object.values(window.BOOKS).filter(b => b.lang === currentLang);
  const query = $("bookSearchInput").value.trim().toLocaleLowerCase();
  const selectedCategory = $("bookCategorySelect").value || "all";
  const langBooks = allLangBooks.filter(book =>
    (selectedCategory === "all" || categoryOf(book) === selectedCategory) &&
    (!query || [book.name, book.id, book.description || "", book.source?.name || ""].join(" ").toLocaleLowerCase().includes(query))
  );
  if (intro) intro.textContent = LANGUAGES[currentLang].name + " · " + allLangBooks.length + " 本词书" + (langBooks.length !== allLangBooks.length ? " · 筛选出 " + langBooks.length + " 本" : "");
  if (!langBooks.length) {
    box.innerHTML = '<p class="hint">没有匹配的词书，试试其他关键词或选择「全部主题」。</p>';
    return;
  }
  const groups = [
    { key: "foundation", icon: "◌", title: "基础与高频" },
    { key: "exam", icon: "▤", title: "考试词汇" },
    { key: "professional", icon: "✳", title: "专业与科研" },
    { key: "dictionary", icon: "↔", title: "其他语言词典" }
  ];
  let html = "";
  for (const g of groups) {
    const books = langBooks.filter(b => categoryOf(b) === g.key);
    if (!books.length) continue;
    const total = books.reduce((s, b) => s + b.words.length, 0);
    html += '<div class="book-group">' + g.icon + ' ' + esc(g.title)
      + '<span class="book-group__count">' + books.length + ' 本 · ' + total + ' 词</span>'
      + '<span class="book-group__line"></span></div>'
      + '<div class="book-grid">'
      + books.map((book) =>
          '<div class="book-card"' + (book.description ? ' title="' + esc(book.description) + '"' : '') + '>' +
            '<div class="book-card__name">' + esc(book.name) + '</div>' +
            '<div class="book-card__meta">' + book.lang.toUpperCase() + ' · ' + book.words.length.toLocaleString() + ' 词 · ' + (book.meaningLang === 'en' ? '英文释义' : '中文释义') + '</div>' +
            (book.source ? '<div class="book-card__source"><a href="' + esc(book.source.url) + '" target="_blank" rel="noopener noreferrer" title="' + esc(book.source.notes || '查看词书来源') + '">' + esc(book.source.name) + ' ↗</a><a href="' + esc(book.source.licenseURL) + '" target="_blank" rel="noopener noreferrer" title="上游声明的许可">' + esc(book.source.license) + '</a></div>' : '') +
            '<div class="book-card__actions"><button class="btn ghost" data-book="' + esc(book.id) + '">' + (getActiveSlotObj().bookIds.includes(book.id) ? "✓ 已载入" : "载入") + '</button></div>' +
          '</div>'
        ).join("")
      + '</div>';
  }
  box.innerHTML = html || '<p class="hint">当前语言暂无内置词书 · 可切换语言，或在上方导入 Excel</p>';
  box.querySelectorAll("[data-book]").forEach((btn) => {
    btn.onclick = async () => {
      const id = btn.dataset.book;
      const book = window.BOOKS[id];
      if (!book || libraryBusy || getActiveSlotObj().bookIds.includes(id)) return;
      setLibraryBusy(true);
      try {
      btn.disabled = true;
      btn.textContent = "载入中…";
      const list = book.words.map((w) => ({ lang: book.lang, word: w.w, meaning: w.m, phonetic: w.p, pos: w.pos }));
      const res = await dbAddWords(list);
      updateSlotBookIds(id, true);
      btn.textContent = "✓ 已载入";
      btn.disabled = false;
      await reloadWords();
      renderSlots();
      await resetStudy();
      setProgress(1, "已载入《" + book.name + "》：新增 " + res.added + " 个单词" + (res.skipped ? "，重复 " + res.skipped + " 个已排除" : ""));
      $("progressWrap").classList.add("visible");
      setTimeout(() => $("progressWrap").classList.remove("visible"), 5000);
      } catch (e) { showToast("载入失败：" + e.message); btn.textContent = "重新载入"; }
      finally { setLibraryBusy(false); }
    };
  });
}

/* ================= 学习方案槽位 ================= */
function renderSlots() {
  const slots = getSlots();
  const active = getActiveSlot();
  const tabs = document.getElementById("slotTabs");
  if (!tabs) return;
  tabs.innerHTML = slots.map(s => {
    const cnt = ((slotWordCounts[s.id] || {})[currentLang] || 0);
    return '<button class="slot-tab ' + (s.id === active ? "active" : "") + (cnt > 0 ? " has-words" : "") + '" data-slot="' + s.id + '" title="' + esc(s.name) + ' · ' + cnt + ' 词">' +
      esc(s.name) +
    '</button>';
  }).join("");
  tabs.querySelectorAll("[data-slot]").forEach(b => {
    b.onclick = () => switchSlot(b.dataset.slot);
  });
  const hint = document.getElementById("slotHint");
  if (hint) {
    const obj = slots.find(s => s.id === active);
    const cnt = ((slotWordCounts[active] || {})[currentLang] || 0);
    hint.textContent = "当前方案「" + (obj ? obj.name : "") + "」：" + (cnt > 0 ? "已导入 " + cnt + " 词" : "空方案，可载入词书或导入 Excel");
  }
}

async function switchSlot(id) {
  if (libraryBusy) return;
  await studyWriteQueue;
  stopAudio();
  prefSet("activeSlot:" + currentLang, id);
  await reloadWords();
  renderSlots();
  renderBuiltinBooks();
  listenSuppressAuto = true;
  await resetStudy();
  // 若当前正在统计视图，立即刷新为该语言数据
  const sv = $("stats-view");
  if (sv && !sv.hidden) renderStats();
}

function renameSlot() {
  const slots = getSlots();
  const obj = slots.find(s => s.id === getActiveSlot());
  if (!obj) return;
  const name = prompt("重命名当前学习方案：", obj.name);
  if (name === null || !name.trim()) return;
  obj.name = name.trim().slice(0, 24);
  const all = getAllSlots();
  all[currentLang] = slots;
  saveSlots(all);
  renderSlots();
  renderOverview();
}

/* ================= 单词搜索 ================= */
function searchWords(q) {
  const out = document.getElementById("searchResults");
  if (!out) return;
  q = q.trim().toLocaleLowerCase();
  if (!q) { out.innerHTML = ""; return; }
  const results = [];
  const seen = new Set();
  // 已导入词库（当前语言优先）
  for (const w of allWords) {
    if (w.word.toLocaleLowerCase().includes(q) || w.meaning.toLocaleLowerCase().includes(q)) {
      const k = w.lang + "|" + w.word.toLocaleLowerCase();
      if (!seen.has(k)) { seen.add(k); results.push({ word: w.word, ph: w.phonetic, m: w.meaning, src: "我的词库" + (w.lang !== currentLang ? "·" + w.lang.toUpperCase() : ""), lang: w.lang }); }
    }
  }
  // 内置词书（同一单词只显示一次：按语言+单词去重，已在词库的跳过）
  if (typeof window.BOOKS !== "undefined") {
    for (const book of Object.values(window.BOOKS)) {
      if (book.lang !== currentLang) continue;
      for (const w of book.words) {
        if (results.length >= 20) break;
        if (w.w.toLocaleLowerCase().startsWith(q) || String(w.m || "").toLocaleLowerCase().includes(q)) {
          const k = book.lang + "|" + w.w.toLocaleLowerCase();
          if (!seen.has(k)) { seen.add(k); results.push({ word: w.w, ph: w.p, m: w.m, src: "内置·" + book.name, lang: book.lang }); }
        }
      }
    }
  }
  if (!results.length) {
    out.innerHTML = '<div class="hint" style="padding:8px">未找到「' + esc(q) + '」</div>';
    return;
  }
  out.innerHTML = results.slice(0, 20).map((r) =>
    '<div class="search-item" data-lang="' + esc(r.lang) + '" data-word="' + esc(r.word) + '">' +
      '<button type="button" class="si-word text-btn" title="点击朗读">' + esc(r.word) + '</button>' +
      '<span class="si-ph">' + esc(r.ph || "") + '</span>' +
      '<span class="si-meaning">' + esc(r.m || "") + '</span>' +
      '<span class="si-src">' + esc(r.src) + '</span>' +
    '</div>'
  ).join("");
  out.querySelectorAll(".si-word").forEach((el) => {
    el.onclick = () => {
      const item = el.closest(".search-item");
      playWord(item.dataset.lang, item.dataset.word);
    };
  });
}

let wordPage = 0;
const WORD_PAGE_SIZE = 50;
function renderWordList() {
  const langWords = allWords.filter(w => w.lang === currentLang);
  $("wordCount").textContent = langWords.length;
  const pages = Math.max(1, Math.ceil(langWords.length / WORD_PAGE_SIZE));
  wordPage = Math.max(0, Math.min(wordPage, pages - 1));
  $("listPage").textContent = langWords.length ? `${wordPage + 1} / ${pages} 页 · ${langWords.length.toLocaleString()} 词` : "尚未载入词书";
  $("btnListPrev").disabled = wordPage === 0;
  $("btnListNext").disabled = wordPage === pages - 1;
  const tbody = $("wordListBody");
  if (!langWords.length) {
    tbody.innerHTML = '<tr><td colspan="5" class="empty">你的词库还是空的。选择一本内置词书，或导入自己的单词表。</td></tr>';
    return;
  }
  const offset = wordPage * WORD_PAGE_SIZE;
  const page = langWords.slice(offset, offset + WORD_PAGE_SIZE);
  tbody.innerHTML = page.map((w, i) =>
    '<tr><td>' + (offset + i + 1) + '</td><td class="w">' + esc(w.word) + '</td><td class="ph">' + esc(w.phonetic || "—") + '</td><td class="m">' + esc(w.meaning) +
    '</td><td><button class="mini ok" aria-label="朗读 ' + esc(w.word) + '" data-play="' + i + '">↗</button></td></tr>'
  ).join("");
  tbody.querySelectorAll("[data-play]").forEach(btn => { btn.onclick = () => playWord(currentLang, page[+btn.dataset.play].word); });
}

async function switchLang(lang) {
  if (libraryBusy) return;
  await studyWriteQueue;
  const pw = $("progressWrap");
  if (pw) pw.classList.remove("visible");
  if (!LANGUAGES[lang]) return;
  $("searchInput").value = "";
  $("searchResults").innerHTML = "";
  stopAudio();
  currentLang = lang;
  $("bookSearchInput").value = "";
  $("bookCategorySelect").value = "all";
  prefSet("currentLang", lang);
  const langSel = $("langSelect");
  if (langSel) langSel.value = lang;
  await reloadWords();
  renderWordList();
  renderSlots();
  renderBuiltinBooks();
  listenSuppressAuto = true;
  deck = []; quiz = []; listen = [];
  await resetStudy();
  // 若当前正在统计视图，立即刷新为该语言数据
  const sv = $("stats-view");
  if (sv && !sv.hidden) renderStats();
}

/* ================= 学习模式：抽认卡 ================= */
let deck = [], deckIdx = 0, deckKnown = 0, deckUnknown = [], cardFlipped = false;

async function startCards() {
  await studyWriteQueue;
  const lang = currentLang, slot = getActiveSlot();
  const words = await getStudyWords(lang, getGroupSize());
  if (lang !== currentLang || slot !== getActiveSlot()) return;
  deck = words.map(w => ({ ...w }));
  deckIdx = 0; deckKnown = 0; deckUnknown = []; cardFlipped = false;
  refreshActiveDeckInfo();
  renderCard();
}

function renderCard() {
  updateSessionProgress();
  $("studyEmpty").hidden = allWords.length > 0 && deck.length > 0;
  if (!deck.length) {
    $("cards-game").hidden = true;
    $("cardDone").hidden = true;
    $("cardProgress").textContent = "0 / 0";
    return;
  }
  const done = deckIdx >= deck.length;
  $("cardDone").hidden = !done;
  $("cards-game").hidden = done;
  if (done) {
    const pct = deck.length ? Math.round(deckKnown / deck.length * 100) : 0;
    $("cardDoneText").textContent = "🎉 本组完成！认识 " + deckKnown + " 个，不认识 " + deckUnknown.length + " 个";
    $("cardDoneSub").textContent = deckUnknown.length
      ? "还有 " + deckUnknown.length + " 个词没记住，点「复习错词」再巩固一遍"
      : "全部掌握（正确率 " + pct + "%），可以试试拼写测试！";
    $("btnRetryWrongCards").disabled = deckUnknown.length === 0;
    return;
  }
  const w = deck[deckIdx];
  cardFlipped = false;
  $("fcWord").textContent = w.word;
  const phEl = $("fcPhonetic");
  if (phEl) {
    phEl.innerHTML = (w.phonetic ? esc(w.phonetic) : "") + (w.pos ? '<span class="pos-badge">' + esc(w.pos) + '</span>' : "");
  }
  $("fcMeaning").textContent = w.meaning;
  $("fcMeaning").hidden = true;
  $("fcHint").textContent = "👆 点击卡片显示释义";
  $("cardProgress").textContent = (deckIdx + 1) + " / " + deck.length;
}

function flipCard() {
  if ($("cardDone").hidden === false || deckIdx >= deck.length) return;
  cardFlipped = !cardFlipped;
  $("fcMeaning").hidden = !cardFlipped;
  $("fcHint").textContent = cardFlipped ? "💡 记住后点下方按钮继续" : "👆 点击卡片显示释义";
}

function cardAnswer(known) {
  if ($("cardDone").hidden === false || deckIdx >= deck.length) return;
  const w = deck[deckIdx];
  if (known) deckKnown++; else deckUnknown.push(w);
  recordStudy(currentLang, w.word, known);
  deckIdx++;
  renderCard();
}

function cardFamiliar() {
  if ($("cardDone").hidden === false || deckIdx >= deck.length) return;
  const w = deck[deckIdx];
  markFamiliar(currentLang, w.word);
  deckKnown++;
  deckIdx++;
  renderCard();
}

function restartWith(list) {
  deck = list.slice();
  deckIdx = 0; deckKnown = 0; deckUnknown = []; cardFlipped = false;
  renderCard();
}

/* ================= 学习模式：拼写测试 ================= */
let quiz = [], quizIdx = 0, quizScore = 0, quizWrong = [], quizAnswer = "", quizChecked = false;

async function startQuiz() {
  await studyWriteQueue;
  const lang = currentLang, slot = getActiveSlot();
  const words = await getStudyWords(lang, getGroupSize());
  if (lang !== currentLang || slot !== getActiveSlot()) return;
  quiz = shuffle(words.map(w => ({ ...w })));
  refreshActiveDeckInfo();
  quizIdx = 0; quizScore = 0; quizWrong = [];
  $("btnCheckQuiz").textContent = "检查";
  renderQuiz();
}

function renderQuiz() {
  updateSessionProgress();
  $("studyEmpty").hidden = allWords.length > 0 && quiz.length > 0;
  if (!quiz.length) {
    $("quiz-game").hidden = true;
    $("quizDone").hidden = true;
    $("quizProgress").textContent = "0 / 0";
    return;
  }
  const done = quizIdx >= quiz.length;
  $("quizDone").hidden = !done;
  $("quiz-game").hidden = done;
  if (done) {
    $("quizDoneText").textContent = "🏁 测试完成！答对 " + quizScore + " / " + quiz.length;
    $("quizDoneSub").textContent = quizWrong.length
      ? quizWrong.length + " 个词曾拼错或跳过，点「重做错题」巩固"
      : "全对！太棒了，试试换一门语言吧";
    $("btnRetryWrongQuiz").disabled = quizWrong.length === 0;
    return;
  }
  const w = quiz[quizIdx];
  quizAnswer = w.word;
  quizChecked = false;
  $("quizMeaning").textContent = w.meaning;
  const input = $("quizInput");
  input.value = "";
  input.disabled = false;
  input.className = "";
  $("quizFeedback").textContent = "";
  $("quizFeedback").className = "";
  $("btnCheckQuiz").textContent = "检查";
  $("btnSkipQuiz").disabled = false;
  $("btnShowAnswerQuiz").disabled = false;
  $("quizProgress").textContent = (quizIdx + 1) + " / " + quiz.length;
  setTimeout(() => { if (!$("study-view").hidden && !$("quiz-area").hidden) input.focus(); }, 50);
}

function showAnswerQuiz() {
  if (quizChecked || quizIdx >= quiz.length) return;
  if ($("btnShowAnswerQuiz").disabled) return;
  const input = $("quizInput");
  const w = quiz[quizIdx];
  input.value = w.word;
  input.disabled = true;
  input.className = "wrong";
  const fb = $("quizFeedback");
  fb.textContent = "👁 已显示答案：" + w.word;
  fb.className = "wrong";
  if (!quizWrong.includes(quizAnswer)) quizWrong.push(quizAnswer);
  recordStudy(currentLang, quizAnswer, false);
  quizChecked = true;
  $("btnCheckQuiz").textContent = "下一题 →";
  $("btnSkipQuiz").disabled = true;
  $("btnShowAnswerQuiz").disabled = true;
}

function skipQuiz() {
  if (quizChecked || quizIdx >= quiz.length) return;
  if (!quizWrong.includes(quizAnswer)) quizWrong.push(quizAnswer);
  recordStudy(currentLang, quizAnswer, false);
  quizIdx++;
  renderQuiz();
}

function checkSpelling() {
  if (quizChecked || quizIdx >= quiz.length) return;
  const input = $("quizInput");
  const guess = input.value.trim().toLocaleLowerCase();
  const ans = quizAnswer.trim().toLocaleLowerCase();
  const w = quiz[quizIdx];
  const fb = $("quizFeedback");
  if (!guess) return; // 空输入不检查
  if (guess === ans) {
    // 全对：绿色显示 + 进入下一题
    quizScore++;
    recordStudy(currentLang, quizAnswer, true);
    quizChecked = true;
    input.disabled = true;
    input.className = "correct";
    fb.innerHTML = '<div class="spell-word"><span class="sok">' + esc(w.word) + '</span></div>'
      + '<div class="spell-msg ok">✅ 拼写正确！</div>';
    $("btnCheckQuiz").textContent = "下一题 →";
    $("btnSkipQuiz").disabled = true;
    $("btnShowAnswerQuiz").disabled = true;
    return;
  }
  // 有错：逐字红绿反馈；不直接给答案、不跳题，可修改后重新检查
  const sc = spellCompareHTML(guess, ans);
  if (!quizWrong.includes(quizAnswer)) quizWrong.push(quizAnswer);
  input.className = "wrong";
  quizChecked = false;
  input.disabled = false;
  fb.innerHTML = '<div class="spell-word">' + sc.html + '</div>'
    + '<div class="spell-msg bad">拼对 ' + sc.correct + ' / ' + sc.total + ' 个字母 —— 修改后重新「检查」，或点「跳过」</div>';
  input.focus();
}

function nextQuiz() {
  if (!quizChecked) { checkSpelling(); return; }
  quizIdx++;
  renderQuiz();
}

function restartQuizWrong() {
  const wrongWords = quizWrong.map(w => allWords.find(x => x.lang === currentLang && x.word === w));
  const list = wrongWords.filter(Boolean).map(w => ({ ...w }));
  if (!list.length) return;
  quiz = shuffle(list);
  quizIdx = 0; quizScore = 0; quizWrong = [];
  $("btnCheckQuiz").textContent = "检查";
  renderQuiz();
}

/* ================= 学习模式：听写（听音拼写，复刻爱听写） ================= */
let listen = [], listenIdx = 0, listenScore = 0, listenWrong = [], listenAnswer = "", listenChecked = false;
let listenSuppressAuto = false;

async function startListen() {
  await studyWriteQueue;
  const lang = currentLang, slot = getActiveSlot();
  const words = await getStudyWords(lang, getGroupSize());
  if (lang !== currentLang || slot !== getActiveSlot()) return;
  listen = shuffle(words.map(w => ({ ...w })));
  refreshActiveDeckInfo();
  listenIdx = 0; listenScore = 0; listenWrong = [];
  $("btnCheckListen").textContent = "检查";
  renderListen();
}

function renderListen() {
  updateSessionProgress();
  $("studyEmpty").hidden = allWords.length > 0 && listen.length > 0;
  if (!listen.length) {
    $("listen-game").hidden = true;
    $("listenDone").hidden = true;
    $("listenProgress").textContent = "0 / 0";
    return;
  }
  const done = listenIdx >= listen.length;
  $("listenDone").hidden = !done;
  $("listen-game").hidden = done;
  if (done) {
    $("listenDoneText").textContent = "🎉 听写完成！答对 " + listenScore + " / " + listen.length;
    $("listenDoneSub").textContent = listenWrong.length
      ? listenWrong.length + " 个词曾拼错或跳过，点「重做错词」巩固"
      : "全对！听力拼写很扎实！";
    $("btnRetryWrongListen").disabled = listenWrong.length === 0;
    return;
  }
  const w = listen[listenIdx];
  listenAnswer = w.word;
  listenChecked = false;
  const input = $("listenInput");
  input.value = "";
  input.disabled = false;
  input.className = "";
  $("listenFeedback").textContent = "";
  $("listenFeedback").className = "";
  $("btnCheckListen").textContent = "检查";
  $("btnSkipListen").disabled = false;
  $("btnShowAnswerListen").disabled = false;
  $("btnListenPlay").textContent = "🔊 播放发音";
  $("listenProgress").textContent = (listenIdx + 1) + " / " + listen.length;
  setTimeout(() => {
    if (!$("study-view").hidden && !$("listen-area").hidden) {
      input.focus();
      if (!listenSuppressAuto) listenPlay();
    }
    listenSuppressAuto = false;
  }, 150);
}

function listenPlay() {
  if (listenIdx >= listen.length) return;
  if (audioEl) audioEl.playbackRate = parseFloat($("listenSpeed").value || "1");
  playWord(currentLang, listen[listenIdx].word);
}

function checkListen() {
  if (listenChecked || listenIdx >= listen.length) return;
  const input = $("listenInput");
  const guess = input.value.trim().toLocaleLowerCase();
  const ans = listenAnswer.trim().toLocaleLowerCase();
  const w = listen[listenIdx];
  const fb = $("listenFeedback");
  if (!guess) return; // 空输入不检查
  if (guess === ans) {
    // 全对：绿色显示 + 中文意思 → 进入下一题
    listenScore++;
    recordStudy(currentLang, listenAnswer, true);
    listenChecked = true;
    input.disabled = true;
    input.className = "correct";
    fb.innerHTML = '<div class="spell-word"><span class="sok">' + esc(w.word) + '</span></div>'
      + '<div class="spell-mean">' + esc(w.meaning) + '</div>'
      + '<div class="spell-msg ok">✅ 拼写正确！</div>';
    $("btnCheckListen").textContent = "下一题 →";
    $("btnSkipListen").disabled = true;
    $("btnListenPlay").textContent = "🔊 播放音频";
    return;
  }
  // 有错：逐字红绿反馈 + 中文意思；不直接给答案、不跳题，可修改后重新检查
  const sc = spellCompareHTML(guess, ans);
  if (!listenWrong.includes(listenAnswer)) listenWrong.push(listenAnswer);
  input.className = "wrong";
  listenChecked = false;
  input.disabled = false;
  fb.innerHTML = '<div class="spell-word">' + sc.html + '</div>'
    + '<div class="spell-mean">' + esc(w.meaning) + '</div>'
    + '<div class="spell-msg bad">拼对 ' + sc.correct + ' / ' + sc.total + ' 个字母 —— 修改后重新「检查」，或点「跳过」</div>';
  input.focus();
}

function skipListen() {
  if (listenChecked || listenIdx >= listen.length) return;
  if (!listenWrong.includes(listenAnswer)) listenWrong.push(listenAnswer);
  recordStudy(currentLang, listenAnswer, false);
  listenIdx++;
  renderListen();
}

function showAnswerListen() {
  if (listenChecked || listenIdx >= listen.length) return;
  if ($("btnShowAnswerListen").disabled) return;
  const input = $("listenInput");
  const w = listen[listenIdx];
  input.value = w.word;
  input.disabled = true;
  input.className = "wrong";
  const fb = $("listenFeedback");
  fb.innerHTML = '<div class="spell-word"><span class="sbad">' + esc(w.word) + '</span></div>'
    + '<div class="spell-mean">' + esc(w.meaning) + '</div>'
    + '<div class="spell-msg bad">👁 已显示答案，记入未掌握</div>';
  if (!listenWrong.includes(listenAnswer)) listenWrong.push(listenAnswer);
  recordStudy(currentLang, listenAnswer, false);
  listenChecked = true;
  $("btnCheckListen").textContent = "下一题 →";
  $("btnSkipListen").disabled = true;
  $("btnShowAnswerListen").disabled = true;
}

function nextListen() {
  if (!listenChecked) { checkListen(); return; }
  listenIdx++;
  renderListen();
}

function restartListenWrong() {
  const wrongWords = listenWrong.map(w => allWords.find(x => x.lang === currentLang && x.word === w));
  const list = wrongWords.filter(Boolean).map(w => ({ ...w }));
  if (!list.length) return;
  listen = shuffle(list);
  listenIdx = 0; listenScore = 0; listenWrong = [];
  $("btnCheckListen").textContent = "检查";
  renderListen();
}

/* ================= 学习统计渲染 ================= */
async function renderStats() {
  const slot = getActiveSlot();
  const metas = (await metaAll()).filter(m => (m.slot || "s1") === slot && m.lang === currentLang);
  const dailies = aggregateDaily((await dailyAll()).filter(d => d.lang === currentLang));
  const now = Date.now();
  // 总览
  $("statLearned").textContent = metas.length;
  $("statDue").textContent = metas.filter(m => m.nextReview <= now).length;
  const todayD = dailies.find(d => d.date === localDateStr());
  $("statToday").textContent = todayD ? todayD.reviewed : 0;
  // 连续天数
  let streak = 0;
  const daySet = new Set(dailies.map(d => d.date));
  const cur = new Date();
  for (let i = 0; i < 400; i++) {
    const ds = localDateStr(cur);
    if (daySet.has(ds)) streak++;
    else if (i > 0) break;
    cur.setDate(cur.getDate() - 1);
  }
  $("statStreak").textContent = streak + " 天";
  // 未来 7 天压力
  const weekday = ["日", "一", "二", "三", "四", "五", "六"];
  const pressure = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(); d.setDate(d.getDate() + i);
    const start = new Date(d); start.setHours(0, 0, 0, 0);
    const end = new Date(start); end.setDate(end.getDate() + 1);
    const n = metas.filter(m => !m.familiar && (i === 0 || m.nextReview >= start.getTime()) && m.nextReview < end.getTime()).length;
    pressure.push({ label: i === 0 ? "今天" : "周" + weekday[d.getDay()], n });
  }
  const maxP = Math.max(1, ...pressure.map(p => p.n));
  $("pressureChart").innerHTML = pressure.map((p, i) =>
    '<div class="pressure-col"><div class="pressure-bar ' + (i === 0 ? "today" : "") + '" style="height:' + Math.max(4, Math.round(p.n / maxP * 112)) + 'px"></div><span>' + p.label + '</span><b>' + p.n + '</b></div>'
  ).join("");
  // 热力图
  const dayCount = new Map(dailies.map(d => [d.date, d.reviewed || 0]));
  renderHeatmap(dayCount);
  // 遗忘曲线等级分布
  const levels = [0, 1, 2, 3, 4, 5, 6, 7, 8].map(lv => metas.filter(m => m.level === lv).length);
  const maxL = Math.max(1, ...levels);
  $("forgettingChart").innerHTML = levels.map((n, lv) =>
    '<div class="fg-col"><div class="fg-bar" style="height:' + Math.max(4, Math.round(n / maxL * 100)) + 'px"></div><span>L' + lv + '</span><b>' + n + '</b></div>'
  ).join("");
  $("levelHint").textContent = "当前复习间隔：L0 10分钟 · L1 30分钟 · L2 12小时 · L3 1天 · L4 2天 · L5 4天 · L6 7天 · L7 15天 · L8 30天。答错回到 L0 重新记忆。";
}

function renderHeatmap(dayCount) {
  const el = document.getElementById("heatmap");
  if (!el) return;
  const today = new Date();
  const start = new Date(today);
  start.setDate(start.getDate() - 25 * 7 + 1);
  const dow = (start.getDay() + 6) % 7;
  start.setDate(start.getDate() - dow);
  const rows = [];
  for (let w = 0; w < 26; w++) {
    const cells = [];
    for (let d = 0; d < 7; d++) {
      const dt = new Date(start);
      dt.setDate(start.getDate() + w * 7 + d);
      const ds = localDateStr(dt);
      const n = dayCount.get(ds) || 0;
      const lv = n <= 0 ? "" : n <= 5 ? "hm-1" : n <= 15 ? "hm-2" : n <= 30 ? "hm-3" : n <= 60 ? "hm-4" : "hm-5";
      cells.push('<div class="hm-cell ' + lv + '" title="' + ds + ' · ' + n + ' 词"></div>');
    }
    rows.push('<div class="heatmap-row">' + cells.join("") + '</div>');
  }
  el.innerHTML = rows.join("");
}

/* ================= 事件绑定与初始化 ================= */
function bindEvents() {
  bindWorkspaceEvents();
  $("bookSearchInput").addEventListener("input", renderBuiltinBooks);
  $("bookCategorySelect").onchange = renderBuiltinBooks;
  // 主导航：词书管理 / 开始学习
  document.querySelectorAll(".main-nav button").forEach((b) => {
    b.onclick = () => {
      document.querySelectorAll(".main-nav button").forEach(x => x.classList.toggle("active", x === b));
      const v = b.dataset.view;
      stopAudio();
      syncNavigation();
      if (v === "study") refreshActiveDeckInfo();
      $("manage-view").hidden = v !== "manage";
      $("study-view").hidden = v !== "study";
      const sv = $("stats-view");
      if (sv) { sv.hidden = v !== "stats"; if (v === "stats") renderStats(); }
    };
  });


  // 存储降级提示：本次 / 永久关闭
  const tipOnce = $("tipCloseOnce");
  if (tipOnce) tipOnce.onclick = () => { prefSet("tipOnceClosed", "1"); $("storageTip").hidden = true; };
  const tipForever = $("tipCloseForever");
  if (tipForever) tipForever.onclick = () => { prefSet("tipForeverClosed", "1"); $("storageTip").hidden = true; };

  const dz = $("dropzone");
  dz.onclick = () => $("fileInput").click();
  dz.onkeydown = e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); dz.click(); } };
  $("fileInput").onchange = (e) => { handleFile(e.target.files[0]); e.target.value = ""; };
  dz.ondragover = (e) => { e.preventDefault(); dz.classList.add("dragover"); };
  dz.ondragleave = () => dz.classList.remove("dragover");
  dz.ondrop = (e) => {
    e.preventDefault(); dz.classList.remove("dragover");
    if (e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]);
  };

  const langSel = $("langSelect");
  if (langSel) langSel.onchange = () => switchLang(langSel.value);
  // 每日新词上限
  const maxSel = $("maxNewSelect");
  if (maxSel) {
    maxSel.value = prefGet("groupSize") || "20";
    maxSel.onchange = async () => { prefSet("groupSize", maxSel.value); $("studyGroupSize").value = maxSel.value; await resetStudy(); await renderOverview(); };
  }
  $("studyGroupSize").value = String(getGroupSize());
  $("studyGroupSize").onchange = async () => {
    prefSet("groupSize", $("studyGroupSize").value);
    $("maxNewSelect").value = $("studyGroupSize").value;
    await studyWriteQueue;
    await resetStudy();
    await renderOverview();
  };
  // 学习方案槽位
  const renameBtn = $("btnRenameSlot");
  if (renameBtn) renameBtn.onclick = renameSlot;
  // 搜索
  const sInput = $("searchInput");
  if (sInput) {
    let st = null;
    sInput.addEventListener("input", () => {
      clearTimeout(st);
      st = setTimeout(() => searchWords(sInput.value), 180);
    });
  }
  $("btnClear").onclick = async () => {
    if (libraryBusy) return;
    const slot = getActiveSlot();
    const lang = currentLang;
    const sobj = getActiveSlotObj();
    if (!confirm("确定清空当前方案？将清除：当前语言「" + lang.toUpperCase() + "」方案「" + (sobj ? sobj.name : slot) + "」的单词、学习进度和已载入词书。其他方案不受影响。此操作不可恢复。")) return;
    setLibraryBusy(true);
    try {
    await studyWriteQueue;
    stopAudio();
    await clearWorkspaceData(slot, lang);
    const all = getAllSlots();
    const arr = all[lang] || [];
    const target = arr.find(s => s.id === slot);
    if (target) target.bookIds = [];
    saveSlots(all);
    await reloadWords();
    renderSlots();
    renderBuiltinBooks();
    await resetStudy();
    setProgress(1, "已清空当前方案「" + (target ? target.name : slot) + "」"); $("progressWrap").classList.add("visible");
    setTimeout(() => $("progressWrap").classList.remove("visible"), 3000);
    } catch (e) { showToast("清空失败：" + e.message); }
    finally { setLibraryBusy(false); }
  };

  // 模式切换
  const MODE_INTRO = {
    cards: "🃏 抽认卡：看单词回忆释义，点击卡片翻转，回答「认识 / 不认识」，系统按间隔重复计划安排复习。",
    quiz: "✍️ 拼写测试：看词语释义，输入对应单词。德英、西英词书提供英文释义。",
    listen: "🎧 听写模式：听发音，拼出单词；答错不会直接给答案，会逐字提示对错，直到拼对或选择跳过。",
  };
  document.querySelectorAll(".mode-tabs button").forEach((b) => {
    b.onclick = () => {
      document.querySelectorAll(".mode-tabs button").forEach(x => x.classList.toggle("active", x === b));
      const mode = b.dataset.mode;
      stopAudio();
      syncNavigation();
      refreshActiveDeckInfo();
      $("cards-area").hidden = mode !== "cards";
      $("quiz-area").hidden = mode !== "quiz";
      $("listen-area").hidden = mode !== "listen";
      $("tbCards").hidden = mode !== "cards";
      $("tbQuiz").hidden = mode !== "quiz";
      $("tbListen").hidden = mode !== "listen";
      $("modeIntro").textContent = MODE_INTRO[mode];
      if (mode === "cards" && !deck.length) startCards();
      if (mode === "quiz" && !quiz.length) startQuiz();
      if (mode === "listen" && !listen.length) startListen();
    };
  });

  // 沉浸模式（浏览器全屏 + 隐藏界面，ESC 退出）
  function enterImmersive() {
    document.body.classList.add("immersive");
    const el = document.documentElement;
    let p = null;
    if (el.requestFullscreen) {
      p = el.requestFullscreen();
    } else if (el.webkitRequestFullscreen) {
      el.webkitRequestFullscreen();
      p = Promise.resolve();
    }
    // 标准 API 被拒时，降级尝试 webkit 前缀（部分 Chrome 场景）
    if (p && p.catch) {
      p.catch(() => {
        try {
          if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
        } catch (e) { /* ignore */ }
      });
    }
    // 兜底检测：1 秒后仍未进入全屏 → 提示手动 F11
    clearTimeout(enterImmersive._t);
    enterImmersive._t = setTimeout(() => {
      if (!document.fullscreenElement && !document.webkitFullscreenElement) {
        showToast("浏览器未允许自动全屏，可按 F11 手动进入全屏");
      }
    }, 1000);
  }
  function exitImmersive() {
    document.body.classList.remove("immersive");
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else if (document.webkitFullscreenElement) document.webkitExitFullscreen();
  }
  document.querySelectorAll(".immersive-btn").forEach((btn) => {
    btn.onclick = () => {
      if (document.body.classList.contains("immersive")) exitImmersive();
      else enterImmersive();
    };
  });
  document.addEventListener("fullscreenchange", () => {
    // 浏览器全屏被 ESC 退出时，同步退出沉浸状态
    if (!document.fullscreenElement && document.body.classList.contains("immersive")) {
      document.body.classList.remove("immersive");
    }
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && document.body.classList.contains("immersive")) exitImmersive();
  });

  // 抽认卡
  $("flashcard").onclick = flipCard;
  $("btnPlayCard").onclick = () => { if (deckIdx < deck.length && deck.length) playWord(currentLang, deck[deckIdx].word); };
  $("btnKnown").onclick = () => cardAnswer(true);
  $("btnUnknown").onclick = () => cardAnswer(false);
  $("btnFamiliar").onclick = cardFamiliar;
  $("btnRestartCards").onclick = () => startCards();
  $("btnShuffleQuiz").onclick = () => {
    // 打乱当前拼写组的顺序（不重新拉词）
    if (!quiz.length) return;
    shuffle(quiz);
    quizIdx = 0; quizScore = 0; quizWrong = [];
    renderQuiz();
  };
  $("btnShuffleListen").onclick = () => {
    // 打乱当前听写组的顺序（不重新拉词）
    if (!listen.length) return;
    shuffle(listen);
    listenIdx = 0; listenScore = 0; listenWrong = [];
    renderListen();
  };
  $("btnRetryWrongCards").onclick = () => restartWith(deckUnknown);
  // 再来一遍：重学当前这一组（已掌握的词不再出现）
  $("btnCardsAgain").onclick = async () => {
    await studyWriteQueue;
    const slot = getActiveSlot();
    const remaining = [];
    for (const w of deck) {
      const m = await metaGet(slot + "|" + currentLang + "|" + w.word);
      if (!(m && m.familiar)) remaining.push(w);
    }
    if (!remaining.length) { $("btnNextGroup").click(); return; } // 本组全掌握 → 直接进下一组
    deck = remaining.map(w => ({ ...w }));
    deckIdx = 0; deckKnown = 0; deckUnknown = []; cardFlipped = false;
    refreshActiveDeckInfo();
    renderCard();
  };
  // 再来一组：拉取另外随机一组（排除当前组单词）
  $("btnNextGroup").onclick = async () => {
    await studyWriteQueue;
    const gs = getGroupSize();
    const exclude = new Set(deck.map(w => w.word.toLocaleLowerCase()));
    let words = await getStudyWords(currentLang, gs, exclude);
    if (words.length < Math.min(5, gs)) words = await getStudyWords(currentLang, gs);
    if (!words.length) { showToast("暂无更多可学习的单词，可载入新词书或切换方案"); return; }
    deck = words.map(w => ({ ...w }));
    deckIdx = 0; deckKnown = 0; deckUnknown = []; cardFlipped = false;
    refreshActiveDeckInfo();
    renderCard();
  };
  $("btnShuffleCards").onclick = () => {
    // 打乱当前卡片组的顺序（不重新拉词，相当于刷新按键）
    if (!deck.length) return;
    shuffle(deck);
    deckIdx = 0; deckKnown = 0; deckUnknown = []; cardFlipped = false;
    refreshActiveDeckInfo();
    renderCard();
  };

  // 拼写测试
  $("quizInput").addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.isComposing) { e.preventDefault(); nextQuiz(); }
  });
  $("btnCheckQuiz").onclick = nextQuiz;
  $("btnQuizSpeak").onclick = () => { if (quizIdx < quiz.length && quiz.length) playWord(currentLang, quizAnswer); };
  $("btnSkipQuiz").onclick = skipQuiz;
  $("btnShowAnswerQuiz").onclick = showAnswerQuiz;
  $("btnRestartQuiz").onclick = () => startQuiz();
  $("btnQuizAgain").onclick = () => startQuiz();
  $("btnRetryWrongQuiz").onclick = restartQuizWrong;
  // 听写模式
  $("listenSpeed").onchange = () => { if (audioEl) audioEl.playbackRate = parseFloat($("listenSpeed").value || "1"); };
  $("btnListenPlay").onclick = listenPlay;
  $("listenInput").addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.isComposing) { e.preventDefault(); nextListen(); } });
  $("btnCheckListen").onclick = nextListen;
  $("btnSkipListen").onclick = skipListen;
  $("btnShowAnswerListen").onclick = showAnswerListen;
  $("btnRestartListen").onclick = () => startListen();
  $("btnListenAgain").onclick = () => startListen();
  $("btnRetryWrongListen").onclick = restartListenWrong;
}

async function init() {
  if (typeof XLSX === "undefined") {
    showToast("Excel 解析库未加载：请确认 index.html 与 vendor 文件夹在同一目录下");
    return;
  }
  audioEl = new Audio();
  await openDB();
  bindEvents();
  await reloadWords();
  renderSlots();
  renderBuiltinBooks();
  await switchLang(LANGUAGES[prefGet("currentLang")] ? prefGet("currentLang") : "en");
  // 检测本地发音代理
  const alive = await proxyAlive();
  // 发音引擎状态卡（代理未运行信息统一在此展示）
  const es = $("engineStatus");
  if (es) {
    es.textContent = alive
      ? "✅ 发音引擎运行中"
      : "系统朗读模式 · 启动「开始使用」脚本可启用 Piper 离线语音。";
    es.classList.toggle("off", !alive);
  }
}

init().catch(e => { console.error(e); showToast("初始化失败：" + e.message, 10000); });
