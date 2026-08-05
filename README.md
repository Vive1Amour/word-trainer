# Word Trainer · 三语单词训练器

> ⚠️ **项目状态说明**：这是一个**个人学习 / 练手性质的项目**（仅供学习交流与尝试），非商业产品。
> 内置词书与词典数据均来自开源项目（见下方「数据来源」），仅用于个人学习目的；如涉及版权问题请联系删除。

一个**完全本地**的单词学习网页应用：内置词书 + Excel 导入，三语（英 / 德 / 西）发音与记忆训练，抽认卡 / 拼写 / 听写三种模式，完全离线可用。

## ✨ 特性

- 🔒 **完全离线**：断网可用，学习数据只存本机浏览器，不上传、不追踪
- 🗣️ **本地神经网络发音**：Piper TTS（英 / 德 / 西，medium 音质）实时合成
- 📚 **内置 17+ 本词书**：考试 / 专业领域 / 德西 CEFR 分级 + 高频词表
- 🃏 三种学习模式：抽认卡 / 拼写测试 / 听写模式（均支持沉浸全屏）
- 🧠 艾宾浩斯复习 + 统计（热力图 / 复习压力 / 记忆曲线 / 连续天数）

## 🚀 快速开始

**Mac**：双击 **「开始使用（Mac）.command」**
**Windows**：双击 **「开始使用（Windows）.bat」**

→ 自动启动发音引擎 + 自动打开网页，然后：
1. 选择语言（英语 / 德语 / 西语），内置词书直接「载入」
2. 进入「🎯 开始学习」选模式即可训练，点单词/点卡片**实时发音**（Piper 本地神经网络，无需联网）
3. 或拖入 Excel 导入自己的单词（第一列单词、第二列释义；工作表名含 English / Deutsch / Español 自动分类）

**用完**：关闭「开始使用」窗口即停止发音引擎（学习数据保存在浏览器里，不会丢）

## 🎮 三种学习模式

| 模式 | 玩法 | 特色 |
|------|------|------|
| 🃏 抽认卡 | 看词想释义，点击翻面，答「认识 / 不认识 / 掌握」 | 艾宾浩斯复习；掌握词永久移出；可打乱 / 再来一组 |
| ✍️ 拼写测试 | 看中文释义，输入单词 | **逐字检查**：对的位置绿、错的位置红，不直接给答案 |
| 🎧 听写模式 | 听发音，输入单词 | 同逐字检查；可调速（0.6x~1.5x） |

三种模式通用：**🔀 打乱顺序 / ↺ 重新开始 / 🧘 沉浸**（全屏无干扰，ESC 退出）、**跳过 / 👁 显示答案 / 检查**。

## 📖 内置词书

- **英语（14 本）**：中考 / 高考 / 雅思 / 托福 / GRE / CET4 / CET6 / 考研 / COCA + 商务 BEC / AI 与 IT / 医学 / 法律 / 生物
- **德语（2 本）**：CEFR 分级 A1（707 词）· A2（1034 词）
- **西语（1 本）**：高频 3000 词（2858 词）

## 🗂️ 文件说明

| 文件 / 目录 | 用途 |
|------|------|
| `index.html` | 网页主程序（双击打开即用，全部逻辑在单文件内） |
| `tts-proxy.py` | 本地发音引擎（Piper 实时合成） |
| `开始使用（Mac）.command` / `.bat` | 一键启动：开引擎 + 打开网页 |
| `books/` | 内置词书（英语 14 本 + 德语 CEFR + 西语高频） |
| `piper/` | Piper 离线语音模型（英 / 德 / 西） |
| `piper_lib/` | Piper 运行时（onnxruntime 等，平台绑定） |
| `vendor/` | Excel 解析库（内置，完全离线） |
| `assets/` | 示例单词表 sample-words.xlsx |

## 🔈 发音原理

1. **Piper 本地合成**：点单词 → 本地引擎即时合成，完全离线、无缓存文件
2. **系统朗读（兜底）**：引擎没启动时，用浏览器系统语音朗读（自动匹配语言）

引擎未运行时，页面「⚙️ 发音引擎」卡片会直接提示你该双击哪个脚本。

## 💻 换电脑 / 换系统

- **整个文件夹拷走即可用**（Windows / macOS 通用）
- `piper/` 模型跨系统通用；但 `piper_lib/` 含平台编译库（onnxruntime），**新电脑需重装一次**：
  ```
  pip3 install --target piper_lib piper-tts onnxruntime
  ```
- 需要 **Python 3.10+**（macOS 可 `brew install python@3.12`；Windows 官网安装并勾选 Add to PATH）

## 📚 数据来源与致谢

本项目内置词书与词典数据来自以下开源项目，特此致谢：

| 数据 | 来源 | 说明 |
|------|------|------|
| 英语考试词书（中考/高考/CET/考研/雅思/托福/GRE） | [skywind3000/ECDICT](https://github.com/skywind3000/ECDICT) | 开源英语词典数据（音标 + 中文释义） |
| 英语 COCA 高频 | COCA 词频表 | 美式英语语料库词频 |
| 商务英语 BEC | [guhenglhy/bec-vocab-app](https://github.com/guhenglhy/bec-vocab-app) | 开源 BEC 商务词汇 |
| AI 与 IT 词汇 | [eng4dev2026/open-english-for-devs](https://github.com/eng4dev2026/open-english-for-devs) · [NotebookAI/ai-wiki](https://github.com/NotebookAI/ai-wiki) | LLM 术语 + AI 知识库 |
| 医学/法律/生物专业词 | [skywind3000/ECDICT](https://github.com/skywind3000/ECDICT) | 专业词表 + ECDICT 释义 |
| 德语 CEFR 分级 | [ph98/german-cefr-wordlist](https://github.com/ph98/german-cefr-wordlist) | 开源德语 CEFR 分级词表（A1-C2，14000 词） |
| 德语释义/音标 | 朗氏德汉双解大词典（公开文本，[来源](https://github.com/mahavivo/langenscheidt)） | 德汉双解词典 |
| 西语高频词表 | [hermitdave/FrequencyWords](https://github.com/hermitdave/FrequencyWords) | OpenSubtitles 多语言词频 |
| 西语释义 | [katia317/iberia-study](https://github.com/katia317/iberia-study) | 开源西中词典（MDX 数据） |
| 离线语音合成 | [rhasspy/piper](https://github.com/rhasspy/piper) | 本地神经网络 TTS，模型：en_US-lessac-medium / de_DE-thorsten-medium / es_ES-sharvard-medium |

> 上述数据的版权归其各自作者所有；本项目仅做整理与聚合，供个人学习使用。

## 📄 License

本项目代码采用 **MIT License**（见 [LICENSE](LICENSE)）。
内置词典 / 词书数据版权归各自来源项目所有，仅供个人学习，请勿用于商业用途。
