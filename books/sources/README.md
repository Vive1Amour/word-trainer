# 社区词书：来源与处理说明

采集日期：2026-10-12。收录 15 本词书，45,098 条书内词条；跨这 15 本词书按语言与单词去重为 27,487 个词／短语。这些数字不是“全部新单词”数量：不同词书之间、与其他内置词书之间都可能重合。载入学习方案时仍自动去重。

数据已转换为本地 `books-open.js`，正常学习无需联网。来源链接固定到采集时的 Git commit，避免上游后续变化影响追溯。词书仅在手动载入时写入浏览器词库，保留当前学习进度。

## 已接入的词书

| 词书 | 学习语言 | 释义语言 | 有效条目 | 来源 | 上游声明的许可 |
|---|---|---|---:|---|---|
| SAT 词汇 | en | 中文 | 4,463 | [Qwerty Learner](https://github.com/RealKai42/qwerty-learner/blob/1182426f2bd0a28c95302c33f9e19136b1262a70/public/dicts/SAT_3_T.json) | [GPL-3.0](https://github.com/RealKai42/qwerty-learner/blob/1182426f2bd0a28c95302c33f9e19136b1262a70/LICENSE) |
| GMAT 词汇 | en | 中文 | 3,047 | [Qwerty Learner](https://github.com/RealKai42/qwerty-learner/blob/1182426f2bd0a28c95302c33f9e19136b1262a70/public/dicts/GMAT_3_T.json) | [GPL-3.0](https://github.com/RealKai42/qwerty-learner/blob/1182426f2bd0a28c95302c33f9e19136b1262a70/LICENSE) |
| 英语专业四级 TEM4 | en | 中文 | 4,025 | [Qwerty Learner](https://github.com/RealKai42/qwerty-learner/blob/1182426f2bd0a28c95302c33f9e19136b1262a70/public/dicts/Level4luan_2_T.json) | [GPL-3.0](https://github.com/RealKai42/qwerty-learner/blob/1182426f2bd0a28c95302c33f9e19136b1262a70/LICENSE) |
| 英语专业八级 TEM8 | en | 中文 | 12,197 | [Qwerty Learner](https://github.com/RealKai42/qwerty-learner/blob/1182426f2bd0a28c95302c33f9e19136b1262a70/public/dicts/Level8luan_2_T.json) | [GPL-3.0](https://github.com/RealKai42/qwerty-learner/blob/1182426f2bd0a28c95302c33f9e19136b1262a70/LICENSE) |
| 托业 TOEIC 词汇 | en | 中文 | 1,650 | [Qwerty Learner](https://github.com/RealKai42/qwerty-learner/blob/1182426f2bd0a28c95302c33f9e19136b1262a70/public/dicts/TOEIC.json) | [GPL-3.0](https://github.com/RealKai42/qwerty-learner/blob/1182426f2bd0a28c95302c33f9e19136b1262a70/LICENSE) |
| AI for Science 科研词汇 | en | 中文 | 491 | [Qwerty Learner](https://github.com/RealKai42/qwerty-learner/blob/1182426f2bd0a28c95302c33f9e19136b1262a70/public/dicts/ai_for_science.json) | [GPL-3.0](https://github.com/RealKai42/qwerty-learner/blob/1182426f2bd0a28c95302c33f9e19136b1262a70/LICENSE) |
| 机器学习英语 | en | 中文 | 725 | [Qwerty Learner](https://github.com/RealKai42/qwerty-learner/blob/1182426f2bd0a28c95302c33f9e19136b1262a70/public/dicts/ai_machine_learning.json) | [GPL-3.0](https://github.com/RealKai42/qwerty-learner/blob/1182426f2bd0a28c95302c33f9e19136b1262a70/LICENSE) |
| 生物医学专业英语 | en | 中文 | 536 | [Qwerty Learner](https://github.com/RealKai42/qwerty-learner/blob/1182426f2bd0a28c95302c33f9e19136b1262a70/public/dicts/BIOmedical.json) | [GPL-3.0](https://github.com/RealKai42/qwerty-learner/blob/1182426f2bd0a28c95302c33f9e19136b1262a70/LICENSE) |
| 计算机与程序员英语 | en | 中文 | 1,700 | [Qwerty Learner](https://github.com/RealKai42/qwerty-learner/blob/1182426f2bd0a28c95302c33f9e19136b1262a70/public/dicts/it-words.json) | [GPL-3.0](https://github.com/RealKai42/qwerty-learner/blob/1182426f2bd0a28c95302c33f9e19136b1262a70/LICENSE) |
| 德语通用词汇 · 英文释义 | de | 英文 | 5,829 | [Qwerty Learner](https://github.com/RealKai42/qwerty-learner/blob/1182426f2bd0a28c95302c33f9e19136b1262a70/public/dicts/german2en.json) | [GPL-3.0](https://github.com/RealKai42/qwerty-learner/blob/1182426f2bd0a28c95302c33f9e19136b1262a70/LICENSE) |
| BNC 高频 · 基础 | en | 中文 | 989 | [ECDICT](https://github.com/skywind3000/ECDICT/blob/bc015ed2e24a7abef49fc6dbbb7fe32c1dadaf8b/ecdict.csv) | [MIT](https://github.com/skywind3000/ECDICT/blob/bc015ed2e24a7abef49fc6dbbb7fe32c1dadaf8b/LICENSE) |
| BNC 高频 · 进阶 | en | 中文 | 1,961 | [ECDICT](https://github.com/skywind3000/ECDICT/blob/bc015ed2e24a7abef49fc6dbbb7fe32c1dadaf8b/ecdict.csv) | [MIT](https://github.com/skywind3000/ECDICT/blob/bc015ed2e24a7abef49fc6dbbb7fe32c1dadaf8b/LICENSE) |
| BNC 高频 · 扩展 | en | 中文 | 1,967 | [ECDICT](https://github.com/skywind3000/ECDICT/blob/bc015ed2e24a7abef49fc6dbbb7fe32c1dadaf8b/ecdict.csv) | [MIT](https://github.com/skywind3000/ECDICT/blob/bc015ed2e24a7abef49fc6dbbb7fe32c1dadaf8b/LICENSE) |
| 小学基础英语 · 社区词表 | en | 中文 | 1,021 | [endict](https://github.com/ismartcoding/endict/blob/522c17036976c34c994a1d367bd61a7d9fa495d9/vocabulary/xiaoxue.json) | [MIT](https://github.com/ismartcoding/endict/blob/522c17036976c34c994a1d367bd61a7d9fa495d9/LICENSE) |
| 西班牙语通用词汇 · 英文释义 | es | 英文 | 4,497 | [FreeDict](https://github.com/freedict/fd-dictionaries/blob/5bdceeac8d0dba3298c1bebe734f60d54dad30f7/spa-eng/spa-eng.tei) | [GPL-2.0-or-later](https://github.com/freedict/fd-dictionaries/blob/5bdceeac8d0dba3298c1bebe734f60d54dad30f7/spa-eng/COPYING) |

## 处理方式与质量边界

- 保留原词条、释义、可用音标与词性；没有源音标的条目保持为空，不生成猜测音标。多个释义合并展示。
- 每本书按单词忽略大小写去重，重复词条合并释义，不静默丢弃不同词义。
- TOEIC 原数据 1,694 条，其中 47 条缺少有效释义：用 ECDICT 匹配补全 3 条，仍缺释义的 44 条排除，最终 1,650 条。
- endict 小学词表包含 1,026 条，与 ECDICT 匹配到 1,021 条。未匹配的 5 条为 `at the weekend`、`collect stamps`、`get it right`、`have a swim`、`on one's way to`，没有自行编造翻译。
- BNC 三本书分别筛选 ECDICT 的 1–1,000、1,001–3,000、3,001–5,000 排名区间。只保留有中文释义、以字母组成（可含连字符和撇号）的词条，数量不会正好等于区间长度。BNC 数据采用源数据中的词频排名，不代表考试大纲。
- 德英词书和西英词书提供英文释义，含短语或专有名词，不属于 CEFR 分级，也没有做机器翻译来冒充中文释义。
- FreeDict 原西英词典为 0.3.1、4,502 个词头；按当前应用的大小写去重规则合并 5 条，接入 4,497 条。
- 源数据并非都属于现代标准 IPA，已有的释义也可能较旧或同时涵盖多个领域。数据经过结构、空值、去重和样例检查，没有逐条进行语言学校对。

## 许可和来源

- Qwerty Learner 上游仓库声明 GPL-3.0。项目读取词库 JSON，不引入其 React 程序代码。仓库中的部分考试词表来自更早的整理材料；未逐条核验第三方释义的原始授权，因此界面标为社区来源，而非官方授权词书。
- ECDICT 和 endict 上游仓库声明 MIT。小学词书的词表来自 endict，释义与音标来自 ECDICT；补充来源记录在 manifest 中。
- FreeDict 的西英词典在 TEI 文件头明确声明 GPL-2.0-or-later，并注明来源由 Ergane 转换而来。文件中的作者、来源和许可信息已随原始文件保留。
- 各许可证原文、仓库说明、原始词表或词典文件保存在 `raw/`。本记录描述上游的声明，不对第三方权利作额外担保。

## 可复现转换

在项目根目录运行：

```sh
python3 scripts/build_open_books.py
node --test tests/regression.test.cjs
```

转换脚本只读取本地文件，不请求网络、不执行上游程序。为了避免在项目中重复存储完整的 66 MB ECDICT，归档了实际用于筛选和匹配的原始 CSV 行 `raw/ecdict/ecdict.selected.csv`；完整下载文件的 SHA-256 另存于 `manifest.json`。该子集足以重新生成这 15 本词书。

`manifest.json` 包含每本书的输入文件哈希、上游 commit、源路径、原始与有效条目数量、去重和缺失统计，以及生成文件的 SHA-256。
