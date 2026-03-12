# Telegram Codex Companion

透過一個私人 Telegram Bot，在手機上使用 Codex CLI。

[English](../../README.md) | [简中](./README.zh-CN.md) | [繁中](./README.zh-TW.md) | [日本語](./README.ja.md) | [한국어](./README.ko.md) | [Français](./README.fr.md) | [Español](./README.es.md)

快速導覽：[專案用途](#這個專案是做什麼的) | [安裝執行](#怎麼安裝並執行) | [命令說明](#命令怎麼用) | [最小設定](#最小設定) | [完整文件](#完整文件)

`telegram-codex-companion` 會把 Telegram 私聊變成一個輕量的 Codex 控制面板。Codex 仍然跑在你自己的 Windows 電腦上，而你可以直接在手機上切換專案、續接會話、看進度、收結果，不需要一直打開遠端桌面。

## 這個專案是做什麼的

- 在你自己的 Windows 電腦上執行 Codex CLI
- 讓你透過手機裡的 Telegram 私聊控制它
- 為不同專案保留獨立的會話歷史
- 在 Telegram 中回傳進度與最終結果

## 怎麼安裝並執行

### 1. Clone 並設定

```powershell
git clone <your-repo-url>
cd telegram-codex-companion
Copy-Item .env.example .env
```

至少填這些設定：

- `TELEGRAM_BOT_TOKEN`
- `ALLOWED_USER_IDS`
- 如果 `codex` 不在 `PATH` 上，再填 `CODEX_EXECUTABLE`

### 2. 啟動 Bot

```powershell
npm start
```

### 3. 打開 Telegram 試跑

```text
/start
/project default C:\codex-projects
/project add demo
/project use demo
/new
Please inspect this repo and tell me how to start it.
```

## 命令怎麼用

完整命令說明建議直接在 Telegram 裡輸入 `/help` 查看。

最常用的命令：

- `/project default <path>`
- `/project add <name> [path]`
- `/project use <name>`
- `/new`
- `/sessions`
- `/use <n>`
- `/status`
- `/stop`

## 最小設定

- `TELEGRAM_BOT_TOKEN`
- `ALLOWED_USER_IDS`
- 只有當 `codex` 不在 `PATH` 上時，才需要 `CODEX_EXECUTABLE`

```env
TELEGRAM_BOT_TOKEN=123456:replace-me
ALLOWED_USER_IDS=123456789
CODEX_EXECUTABLE=codex
DEBUG_LOG_ENABLED=false
```

## 完整文件

更完整的設定、除錯、Windows 開機自啟與實作細節，請查看 [README.md](../../README.md)。
