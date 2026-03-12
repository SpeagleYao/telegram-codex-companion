# Telegram Codex Companion

通过一个私有 Telegram Bot，在手机上使用 Codex CLI。

[English](./README.md) | [简体中文](./README.zh-CN.md)

快速导航：[项目作用](#这个项目是做什么的) | [安装运行](#怎么安装并运行) | [命令说明](#命令怎么用) | [配置](#最小配置) | [常见问题](#常见问题)

`telegram-codex-companion` 会把 Telegram 私聊变成一个轻量的 Codex 控制面板。Codex 仍然运行在你自己的 Windows 电脑上，而你可以直接在手机里切项目、续会话、看进度、收结果，不需要频繁打开远程桌面。

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

最常用的命令通常只有这些：

- `/project default <path>`
- `/project add <name> [path]`
- `/project use <name>`
- `/new`
- `/sessions`
- `/use <n>`
- `/status`
- `/stop`

## 最小配置

如果你只想先跑通，最少只需要：

- `TELEGRAM_BOT_TOKEN`
- `ALLOWED_USER_IDS`
- 只有当 `codex` 不在 `PATH` 上时，才需要 `CODEX_EXECUTABLE`

最小示例：

```env
TELEGRAM_BOT_TOKEN=123456:replace-me
ALLOWED_USER_IDS=123456789
CODEX_EXECUTABLE=codex
DEBUG_LOG_ENABLED=false
```

## 常见问题

### 它是不是远程控制电脑？

不是。它不是远程桌面，也不是任意 shell 透传。它做的是把 Telegram 私聊映射成你本机上的 Codex CLI 任务。

### 手机上能不能继续之前的对话？

可以。项目支持会话历史、恢复旧会话、重命名会话，适合在手机上继续之前的上下文。

### 适合什么人？

适合已经在本地使用 Codex、但不想为了看结果或续一个任务就打开远程桌面的人。

### 完整文档在哪？

更完整的配置说明、命令说明、排障信息和启动方式，请查看 [README.md](./README.md)。

## 你可以预期它支持什么

- 单用户
- 私有 Telegram 私聊
- 多项目切换
- 会话历史和恢复
- 简洁的进度更新

## 它不打算做什么

- Web UI
- 多用户系统
- Telegram 群组支持
- 任意 shell 命令执行
- 云端托管服务

## 开发与测试

```powershell
npm test
```

## Windows 开机自启

参见 [docs/windows-startup.md](./docs/windows-startup.md)。
