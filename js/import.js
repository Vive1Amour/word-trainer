/* ================= Excel 导入 ================= */
const HEADER_WORD = /^(单词|word|english|英文|deutsch|german|spanish|español|espanol|palabra|vocabulary|词汇|wort)$/i;
const HEADER_MEAN = /^(释义|意思|含义|翻译|meaning|definition|translation|chinese|中文|中文释义|中文意思|bedeutung|significado)$/i;

function detectLang(sheetName) {
  for (const key of Object.keys(LANGUAGES)) {
    if (LANGUAGES[key].sheet.test(sheetName)) return key;
  }
  return null;
}

function parseRows(rows) {
  const out = [];
  for (const r of rows || []) {
    const w = String(r[0] == null ? "" : r[0]).trim();
    const m = String(r[1] == null ? "" : r[1]).trim();
    if (!w || !m) continue;
    if (HEADER_WORD.test(w) && HEADER_MEAN.test(m)) continue; // 跳过表头行
    out.push({ word: w, meaning: m, phonetic: String(r[2] == null ? "" : r[2]).trim(), pos: String(r[3] == null ? "" : r[3]).trim() });
  }
  return out;
}

async function parseWorkbook(file) {
  const ext = (file.name.split(".").pop() || "").toLowerCase();
  const text = ["txt", "md", "json", "csv"].includes(ext) ? await file.text() : "";
  if (ext === "txt" || ext === "md") {
    // 每行：word 空格/tab 释义（可含音标列）
    const rows = [];
    for (const line of text.split(/\r?\n/)) {
      const t = line.replace(/^#+\s*/, "").replace(/^\|/, "").trim();
      if (!t || /^[-=*]+$/.test(t)) continue;
      const idx = t.search(/[\t ]/);
      if (idx > 0) {
        const w = t.slice(0, idx).trim();
        const m = t.slice(idx).trim().replace(/\|/g, "").replace(/^[-:]+/, "").trim();
        if (w) rows.push([w, m]);
      } else if (t) {
        rows.push([t.trim(), ""]);
      }
    }
    return [{ name: file.name, rows }];
  }
  if (ext === "json") {
    try {
      const data = JSON.parse(text);
      const rows = [];
      if (Array.isArray(data)) {
        for (const item of data) {
          if (item && typeof item === "object") {
            const w = item.word || item.w || item.name || "";
            const m = item.meaning || item.translation || item.m || item.def || "";
            const p = item.phonetic || item.p || "";
            const pos = item.pos || "";
            if (w) rows.push([String(w), String(m), String(p), String(pos)]);
          }
        }
      } else if (data && typeof data === "object") {
        for (const [w, m] of Object.entries(data)) {
          if (m && typeof m === "object") rows.push([w, String(m.meaning || m.translation || ""), String(m.phonetic || ""), String(m.pos || "")]);
          else rows.push([w, String(m)]);
        }
      }
      return [{ name: file.name, rows }];
    } catch (e) {
      throw new Error("JSON 解析失败：" + e.message);
    }
  }
  if (ext === "csv") {
    const wb = XLSX.read(text, { type: "string" });
    return [{ name: wb.SheetNames[0] || "", rows: XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: "" }) }];
  }
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  return wb.SheetNames.map((name) => ({
    name,
    rows: XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: "" })
  }));
}

async function handleFile(file) {
  if (!file) return;
  if (file.size > 20 * 1024 * 1024) { showToast("文件超过 20 MB，请拆分后导入"); return; }
  if (libraryBusy) { showToast("词库正在更新，请稍候"); return; }
  const importLang = currentLang, importSlot = getActiveSlot();
  const okExt = /\.(xlsx|xls|csv|txt|md|json)$/i.test(file.name);
  if (!okExt) { showToast("请选择 Excel、CSV、TXT、Markdown 或 JSON 单词表"); return; }
  setProgress(0, "正在解析 " + file.name + " …");
  $("progressWrap").classList.add("visible");
  setLibraryBusy(true);
  try {
    const sheets = await parseWorkbook(file);
    const newWords = [];
    for (const s of sheets) {
      const lang = detectLang(s.name) || importLang;
      for (const item of parseRows(s.rows)) {
        newWords.push({ lang, ...item });
      }
    }
    if (!newWords.length) { setProgress(0, "没有找到可导入的单词，请检查列格式"); showToast("没有解析到有效数据：请确保第一列是单词、第二列是释义"); return; }
    const res = await dbAddWords(newWords, importSlot);
    await reloadWords();
    renderSlots();
    await resetStudy();
    setProgress(1, "导入完成：新增 " + res.added + " 个单词" + (res.skipped ? "，跳过重复 " + res.skipped + " 个" : ""));
    setTimeout(() => $("progressWrap").classList.remove("visible"), 4000);
  } catch (e) {
    console.error(e);
    setProgress(1, "导入失败：" + e.message);
    setTimeout(() => $("progressWrap").classList.remove("visible"), 5000);
  } finally { setLibraryBusy(false); }
}
