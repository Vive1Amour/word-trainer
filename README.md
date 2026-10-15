# Word Trainer · 三语单词训练器

本地使用的英语、德语、西班牙语学习工具。内置词书、单词表导入、抽认卡、拼写、听写、间隔重复和学习统计，无需账号或构建工具。

## 当前版本

- 支持英语、德语、西班牙语，提供独立学习方案、到期复习、抽认卡、拼写和听写。
- 侧栏集中展示学习入口、词书与统计；支持词书搜索、主题筛选、列表分页和沉浸学习。
- 新增 15 本社区词书，共 45,098 条书内词条，附来源、许可、清洗记录与离线生成脚本。
- 学习数据保存在本地浏览器，支持完整备份与恢复；Piper 提供三种语言的离线发音。
- 页面、样式、存储、发音、导入与学习逻辑已拆分为独立文件，仍可直接打开 HTML 使用。

## 下载与开始使用

从 [GitHub 仓库](https://github.com/Vive1Amour/word-trainer) 选择 **Code → Download ZIP**，下载后完整解压；或通过 Git 获取：

```sh
git clone https://github.com/Vive1Amour/word-trainer.git
cd word-trainer
```

仓库包含三种语言的语音模型和本地运行库，下载体积较大。只使用网页时不需要 Node.js 或 Python；启动 Piper 发音服务需要 Python 3.10+ 和兼容当前系统的运行库。

- **macOS**：双击「开始使用（Mac）.command」。
- **Windows**：双击「开始使用（Windows）.bat」。
- 也可以直接打开 `index.html`；本地发音服务未启动时会尝试系统朗读。系统需要安装对应语言的语音；系统语音是否离线可用取决于浏览器和系统设置。

1. 在左侧选择语言，在「学习方案」选择一个独立方案。
2. 载入内置词书，或导入自己的单词表。
3. 点击「开始学习」，选择抽认卡、拼写或听写。可直接调整每组 5–50 个词。
4. 结束后定期点击「导出完整备份」，保存所有语言、方案和学习进度。

发音服务只监听本机 `127.0.0.1:8765`。关闭启动窗口或按 Ctrl+C 停止本次服务；如果脚本复用了已有服务，已有服务由原来的窗口管理。

## 新增社区词书

已接入 15 本来自 Qwerty Learner、ECDICT、endict、FreeDict 的词书，包括 SAT、GMAT、英语专四／专八、TOEIC、AI for Science、机器学习、生物医学、计算机词汇、BNC 分段高频、小学基础，以及德英／西英词书。

在「内置词书」搜索书名或筛选主题，然后点「载入」。新增词书共 45,098 条书内词条，彼此可能重合，载入当前方案时自动去重。德英和西英两本采用**英文释义**；来源和许可链接在词书卡片上可查看。详细数量、来源、原始数据和清洗记录见 [`books/sources/README.md`](books/sources/README.md)。

## 学习方式

| 模式 | 操作 |
|---|---|
| 抽认卡 | 回忆释义、翻面，再选择不认识 / 认识 / 掌握 |
| 拼写 | 根据释义输入单词；错误字母会标记，可修改后重试 |
| 听写 | 点击播放、输入单词；支持调速和重做错词 |

抽认卡快捷键：**空格**翻面、**1**不认识、**2**认识、**3**掌握、**P**发音。卡片获得焦点时也可按 Enter 翻面。拼写和听写按 Enter 检查或下一题；Esc 退出沉浸模式，页面同时提供退出按钮。

学习队列优先安排到期词，再补新词。未到期的词不会自动填充队列；「再来一遍」仍可练习当前组。选择「掌握」会把单词移出自动学习队列。当前复习间隔是固定规则，不代表针对个人验证过的记忆模型：答错后 10 分钟，L1–L8 为 30 分钟、12 小时、1 天、2 天、4 天、7 天、15 天、30 天。

## 导入和备份

支持 `.xlsx`、`.xls`、`.csv`、`.txt`、`.md`、`.json`，单词表最大 20 MB。

- 表格前四列：单词、释义、音标（可选）、词性（可选）。表头可省略。
- Excel 工作表名中的 English / Deutsch / German / Español 等语言名称会自动分类；无法识别的工作表归入当前语言。
- TXT 每行 `单词 释义`。含空格的短语建议使用 Excel / CSV，以免拆分错误。
- JSON 支持 `[{"word":"hello","meaning":"你好","phonetic":"/həˈləʊ/","pos":"int."}]` 或 `{"hello":"你好"}`。
- 同语言、同方案中按单词忽略大小写去重。

**完整备份**与**单词 JSON 导入**是两个不同入口。完整备份从「恢复备份」载入，最大 50 MB：恢复时合并词库，相同单词进度、同日统计及方案设置采用备份版本。建议恢复前先导出当前数据。

数据保存于浏览器 IndexedDB；无法使用时会明确提示仅在本次会话保存。请使用同一浏览器、同一文件位置继续学习。清理浏览器数据、换浏览器或移动文件可能使旧记录无法访问，先导出备份。

## 统计范围

- 首页计数、已学词、待复习、记忆等级：当前语言的当前方案。
- 统计页每日活动、连续天数、热力图：当前语言的所有方案汇总；热力图计答题次数，同一单词可练习多次。
- 清空方案仅清除此方案及语言的词库、进度和新版每日记录。
- 旧版每日记录没有方案字段，无法可靠拆分；保留为语言级历史记录，不随某个方案清空。

## 文件结构

| 路径 | 用途 |
|---|---|
| `index.html` | 页面结构 |
| `css/app.css` | 视觉设计、响应式布局和可访问性样式 |
| `js/core.js` | IndexedDB、偏好、词库读写 |
| `js/audio.js` | 发音播放、请求取消和限量内存缓存 |
| `js/import.js` | 各格式导入 |
| `js/learning.js` | 复习排期、学习记录及写入队列 |
| `js/workspace.js` | 概览、备份恢复、快捷键和事务辅助 |
| `js/app.js` | 词书、训练模式、统计和事件绑定 |
| `tts-proxy.py` | Piper 发音服务 |
| `books/` | 内置词书，包括新增社区词库 `books-open.js` |
| `books/sources/` | 来源记录、许可文本、原始输入和数据审计 |
| `scripts/build_open_books.py` | 离线重新生成新增词书 |
| `piper/` / `piper_lib/` | 语音模型 / 平台相关运行库 |
| `vendor/` | 本地 Excel 解析库 |
| `tests/` | 无 npm 依赖的回归测试和本地发音接口测试 |

本地 `.backups/`、Python 缓存、日志和 macOS 临时文件由 `.gitignore` 排除，不随代码上传。`.backups/` 中的源文件副本不包含浏览器学习记录。

保留经典脚本加载方式，支持直接打开本地 HTML。无需 npm、打包器、CDN、在线字体。运行库含平台编译文件，不能保证直接跨系统复制后即可启动；换电脑可用 Python 3.10+ 重新安装：

```sh
pip3 install --target piper_lib piper-tts onnxruntime
```

Piper 服务和网页分别限量缓存重复发音到内存，不写音频到磁盘。浏览器系统朗读作为兜底。

## 验证

在项目根目录运行：

```sh
node --test tests/regression.test.cjs
python3 tests/test_tts.py
```

前端测试使用隔离 VM 与轻量 DOM 替身验证应用逻辑，不等同于浏览器集成或界面截图验证。发音测试临时监听本机随机端口，结束后关闭；Piper 不可用时会跳过真实音频测试。Windows 启动脚本需要在 Windows 实机验证。


2026-10-15 在 macOS 本机运行：21 项前端回归测试、5 项发音接口与真实音频测试全部通过，包含英语、德语、西班牙语 WAV 生成及并发缓存验证。

## 更新本地版本

先在网页中导出完整备份，然后关闭本次发音服务。在项目目录运行 `git pull --ff-only`，再通过原来的启动脚本打开。使用 ZIP 的用户可下载新版并替换程序文件；尽量保持原有文件夹位置，并在更新后检查学习记录，需要时恢复备份。浏览器学习数据不会通过 GitHub 同步。

## 数据来源与致谢

感谢以下项目和数据贡献者。原有词书的来源沿用历史版本记录；新增 15 本词书的固定提交、数量、哈希与许可原文见 [词书来源与处理记录](books/sources/README.md)。来源可访问不等于已确认所有内容的再分发授权，各资源应按其自身许可使用。

### 1. 英语词书

| 词书或数据 | 来源 | 用途与说明 |
|---|---|---|
| 考试词汇、医学／法律／生物专业词汇 | [ECDICT](https://github.com/skywind3000/ECDICT) | 原有词书的英文词条、音标和中文释义；中考／高考按标签整理 |
| COCA 高频词汇 | COCA 词频表（历史记录） | 原有高频词书；具体输入版本与原始文件未在历史版本中归档 |
| 商务英语 BEC | [bec-vocab-app](https://github.com/guhenglhy/bec-vocab-app) | 原有商务词汇 |
| AI 与 IT 词汇 | [open-english-for-devs](https://github.com/eng4dev2026/open-english-for-devs)、[ai-wiki](https://github.com/NotebookAI/ai-wiki) | 原有 LLM 术语与 AI 知识词汇 |
| SAT、GMAT、专四、专八、TOEIC、AI for Science、机器学习、生物医学、计算机词汇 | [Qwerty Learner](https://github.com/RealKai42/qwerty-learner) | 新增社区词书，提供中文释义；上游仓库声明 GPL-3.0 |
| BNC 高频基础／进阶／扩展 | [ECDICT](https://github.com/skywind3000/ECDICT) | 新增三个词频分段词书；上游声明 MIT |
| 小学基础英语 | [endict](https://github.com/ismartcoding/endict)、[ECDICT](https://github.com/skywind3000/ECDICT) | endict 提供词表，ECDICT 提供释义与音标；上游均声明 MIT |

### 2. 德语词书

| 词书或数据 | 来源 | 用途与说明 |
|---|---|---|
| 德语 A1／A2 分级词书 | [german-cefr-wordlist](https://github.com/ph98/german-cefr-wordlist) | 原有词书的 CEFR 分级依据；本项目实际内置 A1／A2 |
| 德语中文释义 | [langenscheidt](https://github.com/mahavivo/langenscheidt) | 历史版本记录的朗氏德汉双解词典文本来源；不据此宣称获得词典出版方授权 |
| 德语通用词汇 | [Qwerty Learner](https://github.com/RealKai42/qwerty-learner) | 新增 5,829 条词书，采用英文释义，不属于 CEFR 分级；上游仓库声明 GPL-3.0 |

### 3. 西班牙语词书

| 词书或数据 | 来源 | 用途与说明 |
|---|---|---|
| 西语高频 3000 | [FrequencyWords](https://github.com/hermitdave/FrequencyWords) | 原有词书的词频来源；历史记录注明基于 OpenSubtitles |
| 西语中文释义 | [iberia-study](https://github.com/katia317/iberia-study) | 历史版本记录的西中词典数据来源，另有常用词补充 |
| 西班牙语通用词汇 | [FreeDict](https://github.com/freedict/fd-dictionaries/tree/master/spa-eng) | 新增 4,497 条词书，采用英文释义；源词典为 spa-eng 0.3.1，声明 GPL-2.0-or-later |

### 4. 语音模型与运行依赖

| 资源 | 来源或本地位置 | 用途与说明 |
|---|---|---|
| Piper 语音合成引擎 | [OHF-Voice/piper1-gpl](https://github.com/OHF-Voice/piper1-gpl)；原项目 [rhasspy/piper](https://github.com/rhasspy/piper) | 本地神经网络 TTS，运行库位于 `piper_lib/` |
| 英语语音模型 | `piper/en_US-lessac-medium.onnx` | `en_US`，Lessac，medium；附同名 JSON 配置 |
| 德语语音模型 | `piper/de_DE-thorsten-medium.onnx` | `de_DE`，Thorsten，medium；附同名 JSON 配置 |
| 西班牙语语音模型 | `piper/es_ES-sharvard-medium.onnx` | `es_ES`，Sharvard，medium；附同名 JSON 配置 |
| 模型上游资源 | [Piper Voices](https://huggingface.co/rhasspy/piper-voices) | 各声音的许可和数据说明以对应模型卡为准；本地 ONNX 与配置本身不构成完整授权说明 |
| ONNX Runtime、NumPy 等 | `piper_lib/` 内对应包及许可文件 | 模型推理与数值运算；包含平台相关编译文件 |
| Excel 解析 | `vendor/xlsx.full.min.js`（SheetJS） | 本地读取 Excel 单词表，无需在线 CDN |

## 许可与第三方内容

项目原有代码许可见 [LICENSE](LICENSE)。词书、语音模型、运行库及其他第三方内容应按各自许可使用；项目根目录的许可证不替代第三方许可证。新增词书的来源、固定版本、许可原文与处理记录见 [books/sources/README.md](books/sources/README.md)，包括上游声明的 MIT、GPL-3.0 和 GPL-2.0-or-later。
