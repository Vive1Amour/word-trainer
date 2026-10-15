#!/usr/bin/env python3
"""Convert pinned, locally archived open vocabulary data; no network or third-party code execution."""
import argparse
import csv
import hashlib
import json
import re
import xml.etree.ElementTree as ET
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
QWERTY = [
    ("open_sat", "SAT 词汇", "SAT_3_T.json", "exam", "zh", "SAT 考试词汇，社区整理版"),
    ("open_gmat", "GMAT 词汇", "GMAT_3_T.json", "exam", "zh", "GMAT 考试词汇，社区整理版"),
    ("open_tem4", "英语专业四级 TEM4", "Level4luan_2_T.json", "exam", "zh", "英语专业四级词汇，区别于大学英语 CET4"),
    ("open_tem8", "英语专业八级 TEM8", "Level8luan_2_T.json", "exam", "zh", "英语专业八级词汇，适合进阶阅读"),
    ("open_toeic", "托业 TOEIC 词汇", "TOEIC.json", "exam", "zh", "职场和国际交流考试词汇"),
    ("open_ai_science", "AI for Science 科研词汇", "ai_for_science.json", "professional", "zh", "AI 与科学计算相关术语，含短语"),
    ("open_ml", "机器学习英语", "ai_machine_learning.json", "professional", "zh", "机器学习和数据科学术语，含短语"),
    ("open_biomedical", "生物医学专业英语", "BIOmedical.json", "professional", "zh", "生物医学术语，适合专业阅读"),
    ("open_coder", "计算机与程序员英语", "it-words.json", "professional", "zh", "计算机及编程常用英语词汇"),
    ("open_de_en", "德语通用词汇 · 英文释义", "german2en.json", "dictionary", "en", "德英词表；不是 CEFR 分级，也不是中文翻译"),
]


def clean(value):
    if value is None:
        return ""
    return re.sub(r"\s+", " ", str(value).replace("\\n", "; ").replace("\\r", " ")).strip()


def unique_rows(rows):
    """Keep source order/casing and merge senses for repeated case-insensitive headwords."""
    result = {}
    rejected = 0
    merged = 0
    for row in rows:
        row = {k: clean(row.get(k)) for k in ["w", "m", "p", "pos"]}
        if not row["w"] or not row["m"]:
            rejected += 1
            continue
        key = row["w"].casefold()
        if key in result:
            merged += 1
            old = result[key]
            if row["m"] not in old["m"].split("； "):
                old["m"] += "； " + row["m"]
            for field in ["p", "pos"]:
                if not old[field]:
                    old[field] = row[field]
        else:
            result[key] = row
    return list(result.values()), {"rejected": rejected, "mergedDuplicates": merged}


def build(source_dir):
    revisions = json.loads((source_dir / "revisions.json").read_text())
    ecdict_path = source_dir / "ecdict" / "ecdict.csv"
    if not ecdict_path.exists():
        ecdict_path = source_dir / "ecdict" / "ecdict.selected.csv"
    with ecdict_path.open(newline="", encoding="utf-8-sig") as stream:
        ecdict = list(csv.DictReader(stream))
    elementary = json.loads((source_dir / "endict/vocabulary/xiaoxue.json").read_text())
    lookup = {}
    exact_lookup = {}
    for row in ecdict:
        if row.get("translation"):
            exact_lookup[clean(row["word"])] = row
        key = clean(row["word"]).casefold()
        if row.get("translation") and key not in lookup:
            lookup[key] = row
    def match_word(word):
        word = clean(word)
        return exact_lookup.get(word) or lookup.get(word.casefold())
    supplemental_rows = []
    books = {}
    sources = []
    archived_paths = set()

    def provenance(repo_key, filename, license_name, notes=""):
        repo, commit = revisions[repo_key]
        return {"name": {"qwerty": "Qwerty Learner", "ecdict": "ECDICT", "endict": "endict", "freedict": "FreeDict"}[repo_key],
                "repository": "https://github.com/" + repo,
                "url": f"https://github.com/{repo}/blob/{commit}/{filename}",
                "revision": commit, "path": filename, "license": license_name,
                "licenseURL": f"https://github.com/{repo}/blob/{commit}/" + ("spa-eng/COPYING" if repo_key == "freedict" else "LICENSE"),
                "licenseScope": "dictionary" if repo_key == "freedict" else "repository",
                "notes": notes}

    def add(identifier, name, lang, category, meaning_lang, description, raw_rows, provenance_info, file_path, extra=None):
        words, audit = unique_rows(raw_rows)
        assert words, identifier
        books[identifier] = {"id": identifier, "name": name, "lang": lang, "category": category,
                             "meaningLang": meaning_lang, "description": description,
                             "source": provenance_info, "words": words}
        audit.update(extra or {})
        sources.append({"id": identifier, "name": name, "lang": lang, "count": len(words),
                        "rawCount": len(raw_rows), "category": category, "meaningLang": meaning_lang,
                        "source": provenance_info, "audit": audit,
                        "input": str(file_path.relative_to(source_dir)),
                        "inputSHA256": hashlib.sha256(file_path.read_bytes()).hexdigest()})
        archived_paths.add(file_path.relative_to(source_dir))
        print(identifier, lang, len(words), "words", audit)

    for identifier, name, filename, category, meaning_lang, description in QWERTY:
        file_path = source_dir / "qwerty/public/dicts" / filename
        data = json.loads(file_path.read_text())
        rows = []
        fallback = 0
        for word in data:
            translations = word.get("trans") or []
            meaning = "； ".join(clean(x) for x in translations if clean(x)) if isinstance(translations, list) else clean(translations)
            if not meaning and meaning_lang == "zh":
                old = match_word(word.get("name"))
                if old:
                    meaning = clean(old["translation"])
                    fallback += 1
                    supplemental_rows.append(old)
            rows.append({"w": word.get("name"), "m": meaning, "p": word.get("ukphone") or word.get("usphone") or "", "pos": word.get("pos") or ""})
        source = provenance("qwerty", "public/dicts/" + filename, "GPL-3.0", "上游仓库声明 GPL-3.0；词表及释义的更早来源未逐条独立核验。")
        extra = {"ecdictFilledMeanings": fallback} if fallback else None
        if fallback:
            source["supplementalSource"] = provenance("ecdict", "ecdict.csv", "MIT", "用于补全上游空释义")
        add(identifier, name, "de" if meaning_lang == "en" else "en", category, meaning_lang, description, rows, source, file_path, extra)

    rank = lambda row: int(row["bnc"]) if row.get("bnc", "").isdigit() else 0
    selected = supplemental_rows.copy()
    for low, high, name, identifier in [(1, 1000, "BNC 高频 · 基础", "open_bnc_1000"), (1001, 3000, "BNC 高频 · 进阶", "open_bnc_3000"), (3001, 5000, "BNC 高频 · 扩展", "open_bnc_5000")]:
        data = sorted((r for r in ecdict if low <= rank(r) <= high and r.get("translation") and re.fullmatch(r"[A-Za-z]+(?:[-'][A-Za-z]+)*", r["word"])), key=rank)
        selected.extend(data)
        rows = [{"w": r["word"], "m": r["translation"], "p": r["phonetic"], "pos": r["pos"]} for r in data]
        add(identifier, name, "en", "foundation", "zh", f"ECDICT 的 BNC 词频排名 {low}–{high} 区间，保留有中文释义的单词；不是新版考试大纲", rows, provenance("ecdict", "ecdict.csv", "MIT"), ecdict_path)

    rows = []
    missing = []
    for word in elementary:
        row = match_word(word)
        if row:
            rows.append({"w": word, "m": row["translation"], "p": row["phonetic"], "pos": row["pos"]})
            selected.append(row)
        else:
            missing.append(word)
    source = provenance("endict", "vocabulary/xiaoxue.json", "MIT", "词表来自 endict，释义和音标匹配 ECDICT；未匹配的条目不猜测翻译。")
    source["supplementalSource"] = provenance("ecdict", "ecdict.csv", "MIT")
    add("open_primary", "小学基础英语 · 社区词表", "en", "foundation", "zh", "endict 小学词表与 ECDICT 英汉释义匹配，含常见短语；不是官方教材词表", rows, source, source_dir / "endict/vocabulary/xiaoxue.json", {"unmatched": missing, "originalListCount": len(elementary)})

    tei_path = source_dir / "freedict/spa-eng/spa-eng.tei"
    tree = ET.parse(tei_path)
    ns = {"t": "http://www.tei-c.org/ns/1.0"}
    rows = []
    text = lambda element: "" if element is None else clean("".join(element.itertext()))
    for entry in tree.findall(".//t:body/t:entry", ns):
        word = text(entry.find("./t:form/t:orth", ns))
        quotes = list(dict.fromkeys(text(q) for q in entry.findall('.//t:cit[@type="trans"]/t:quote', ns) if text(q)))
        pos = list(dict.fromkeys(text(q) for q in entry.findall(".//t:pos", ns) if text(q)))
        rows.append({"w": word, "m": "; ".join(quotes), "p": text(entry.find("./t:form/t:pron", ns)), "pos": "/".join(pos)})
    add("open_es_en", "西班牙语通用词汇 · 英文释义", "es", "dictionary", "en", "FreeDict 西英词典 0.3.1；含短语与专有名词，不按频率或 CEFR 分级", rows, provenance("freedict", "spa-eng/spa-eng.tei", "GPL-2.0-or-later", "许可见词典 TEI 文件头；原始词典由 Ergane 转换而来。"), tei_path)

    output = ROOT / "books/books-open.js"
    output.write_text("/* Generated by scripts/build_open_books.py. Sources and licenses: books/sources/README.md. */\nwindow.BOOKS_OPEN = " + json.dumps(books, ensure_ascii=False, separators=(",", ":")) + ";\n", encoding="utf-8")
    archive = ROOT / "books/sources/raw"
    archive.mkdir(parents=True, exist_ok=True)
    # Archive the smaller editable input set rather than the entire 66 MB dictionary.
    subset = archive / "ecdict/ecdict.selected.csv"
    subset.parent.mkdir(parents=True, exist_ok=True)
    subset_rows = {row["word"]: row for row in selected}
    with subset.open("w", encoding="utf-8", newline="") as stream:
        writer = csv.DictWriter(stream, fieldnames=list(ecdict[0]))
        writer.writeheader()
        writer.writerows(sorted(subset_rows.values(), key=lambda row: (row["word"].casefold(), row["word"])))
    for path in sorted(archived_paths):
        if path.parts[0] == "ecdict":
            continue
        target = archive / path
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes((source_dir / path).read_bytes())
    for repo_key, files in {"qwerty": ["LICENSE", "README.md", "src/resources/dictionary.ts"], "endict": ["LICENSE", "README.md"], "ecdict": ["LICENSE", "README.md"], "freedict": ["spa-eng/COPYING"]}.items():
        for filename in files:
            target = archive / repo_key / filename
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes((source_dir / repo_key / filename).read_bytes())
    (archive / "revisions.json").write_text(json.dumps(revisions, indent=2))
    # Input checksum now points to the archived, reproducible ECDICT subset; keep full download identity separately.
    for item in sources:
        if item["source"]["name"] == "ECDICT":
            item["input"] = "ecdict/ecdict.selected.csv"
            item["inputSHA256"] = hashlib.sha256(subset.read_bytes()).hexdigest()
    manifest = {"format": "word-trainer-open-books", "version": 1, "collectedOn": "2026-10-12", "books": sources,
                "totalEntries": sum(len(b["words"]) for b in books.values()),
                "uniqueLanguageWords": len({(b["lang"], w["w"].casefold()) for b in books.values() for w in b["words"]}),
                "fullECDICTSHA256": hashlib.sha256(ecdict_path.read_bytes()).hexdigest() if ecdict_path.name == "ecdict.csv" else None,
                "generatedSHA256": hashlib.sha256(output.read_bytes()).hexdigest()}
    manifest_path = ROOT / "books/sources/manifest.json"
    if manifest_path.exists() and not manifest["fullECDICTSHA256"]:
        manifest["fullECDICTSHA256"] = json.loads(manifest_path.read_text()).get("fullECDICTSHA256")
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print("Built", len(books), "books;", manifest["totalEntries"], "entries;", manifest["uniqueLanguageWords"], "unique language/word pairs;", output.stat().st_size, "bytes")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source-dir", type=Path, default=ROOT / "books/sources/raw")
    args = parser.parse_args()
    build(args.source_dir.resolve())
