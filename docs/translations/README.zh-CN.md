# Telegram Codex Companion

通过一个私有 Telegram Bot，在手机上使用 Codex CLI。

[English](../../README.md) | [简中](./README.zh-CN.md) | [繁中](./README.zh-TW.md) | [日本語](./README.ja.md) | [한국어](./README.ko.md) | [Français](./README.fr.md) | [Español](./README.es.md)

快速导航：[项目作用](#这个项目是做什么的) | [安装运行](#怎么安装并运行) | [命令说明](#命令怎么用) | [最小配置](#最小配置) | [完整文档](#完整文档)

`telegram-codex-companion` 会把 Telegram 私聊变成一个轻量的 Codex 控制面板。Codex 继续运行在你自己的 Windows 电脑上，而你可以直接在手机里切项目、续会话、看进度、收结果，不需要频繁打开远程桌面。

## 这个项目是做什么的

- 在你自己的 Windows 电脑上运行 Codex CLI
- 让你通过手机里的 Telegram 私聊去控制它
- 为不同项目保留独立的会话历史
- 在 Telegram 中回传进度和最终结果

## 怎么安装并运行

### 1. 克隆并配置

```powershell
git clone <your-repo-url>
cd telegram-codex-companion
Copy-Item .env.example .env
```

至少填写这些配置：

- `TELEGRAM_BOT_TOKEN`
- `ALLOWED_USER_IDS`
- 如果 `codex` 不在 `PATH` 上，再填写 `CODEX_EXECUTABLE`

### 2. 启动 Bot

```powershell
npm start
```

### 3. 打开 Telegram 试一下

```text
/start
/project default C:\codex-projects
/project add demo
/project use demo
/new
Please inspect this repo and tell me how to start it.
```

## 命令怎么用

完整命令说明建议直接在 Telegram 里发送 `/help` 查看。

最常用的命令：

- `/project default <path>`
- `/project add <name> [path]`
- `/project use <name>`
- `/new`
- `/sessions`
- `/use <n>`
- `/status`
- `/stop`

## 最小配置

- `TELEGRAM_BOT_TOKEN`
- `ALLOWED_USER_IDS`
- 只有当 `codex` 不在 `PATH` 上时，才需要 `CODEX_EXECUTABLE`

```env
TELEGRAM_BOT_TOKEN=123456:replace-me
ALLOWED_USER_IDS=123456789
CODEX_EXECUTABLE=codex
DEBUG_LOG_ENABLED=false
```

## 完整文档

更完整的配置、排障、Windows 开机自启和实现细节，请查看 [README.md](../../README.md)。
