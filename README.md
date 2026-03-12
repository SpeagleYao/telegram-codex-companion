# Telegram Codex Companion

Use Codex CLI from your phone through a private Telegram bot.

[English](./README.md) | [简中](./docs/translations/README.zh-CN.md) | [繁中](./docs/translations/README.zh-TW.md) | [日本語](./docs/translations/README.ja.md) | [한국어](./docs/translations/README.ko.md) | [Français](./docs/translations/README.fr.md) | [Español](./docs/translations/README.es.md)

Quick links: [What It Does](#what-this-project-does) | [Install And Run](#install-and-run) | [Command Overview](#command-overview) | [Configuration](#configuration) | [Troubleshooting](#troubleshooting) | [Windows Startup](#windows-startup)

`telegram-codex-companion` turns a Telegram private chat into a lightweight control surface for Codex running on your own Windows machine. It is built for one person who already uses Codex locally and wants something much simpler than remote desktop when away from the keyboard.

## What This Project Does

- runs Codex CLI on your own Windows machine
- lets you control it from a private Telegram chat on your phone
- keeps separate projects and session history
- sends progress updates and final answers back to Telegram

## Install And Run

### 1. Clone and configure

```powershell
git clone <your-repo-url>
cd telegram-codex-companion
Copy-Item .env.example .env
```

Fill in at least:

- `TELEGRAM_BOT_TOKEN`
- `ALLOWED_USER_IDS`
- `CODEX_EXECUTABLE` only if `codex` is not on `PATH`

### 2. Start the bot

```powershell
npm start
```

### 3. Open Telegram and try it

```text
/start
/project default C:\codex-projects
/project add demo
/project use demo
/new
Please inspect this repo and tell me how to start it.
```

## Command Overview

Use `/help` inside Telegram for the full command reference.

The most common commands are:

- `/project default <path>`
- `/project add <name> [path]`
- `/project use <name>`
- `/new`
- `/sessions`
- `/use <n>`
- `/status`
- `/stop`

## Why People Use It

Instead of opening a full remote desktop session just to ask Codex one thing, you can:

- send a prompt from Telegram
- switch projects from your phone
- resume an older Codex session
- watch simple progress updates
- get the final answer back in chat

## Highlights

- private Telegram chat -> local Codex CLI run
- multiple named local projects with separate session history
- fresh sessions, resume existing ones, and rename sessions for mobile use
- staged progress updates while Codex is working
- stale run recovery after a bot restart
- access limited to approved Telegram user ids
- intentionally no arbitrary shell passthrough

## Best Fit

This repo is a good fit if you want all of the following:

- Codex runs on your own Windows machine
- you control it from a private Telegram chat
- you want project switching and session history
- you do not need remote desktop, browser streaming, or shell passthrough

This repo is probably not the right starting point if you want:

- a web UI
- multi-user access
- Telegram groups
- arbitrary shell execution from chat
- a cloud-hosted service

## Fast Reality Check

A first successful run is usually quick if these three things are already true:

1. you can create a Telegram bot with `@BotFather`
2. you know your Telegram numeric user id
3. `codex` already works in a normal terminal on the same machine

If those are ready, this repo is mostly wiring and workflow.

## What It Feels Like

In Telegram:

```text
/project default C:\codex-projects
/project add blog
/project use blog
/new
Please inspect this repo and tell me how to start it.
```

Then the bot:

- launches or resumes Codex in the selected local folder
- keeps that session attached to the current project
- sends progress updates while Codex is working
- returns the final answer to the same Telegram chat

## Quick Start

If you want the shortest path from zero to a working bot, follow these exact steps.

### 1. Prerequisites

You need:

- Windows
- Node.js 24 or newer
- a Telegram account
- a Telegram bot token from `@BotFather`
- your Telegram numeric user id
- Codex CLI installed and authenticated on the same machine

Check Node:

```powershell
node --version
```

Check Codex:

```powershell
codex --help
```

If `codex` is not found, install the official CLI:

```powershell
npm install -g @openai/codex
```

Then verify it again:

```powershell
codex --help
```

### 2. Create a Telegram bot

In Telegram, open `@BotFather` and create a new bot with `/newbot`. BotFather will give you a bot token.

### 3. Get your Telegram numeric user id

You need your numeric Telegram user id for `ALLOWED_USER_IDS`. A common way is to message a bot such as `@userinfobot` and copy the numeric id it returns.

### 4. Clone the repository

```powershell
git clone <your-repo-url>
cd telegram-codex-companion
```

### 5. Create your local config

```powershell
Copy-Item .env.example .env
```

Edit `.env` and fill in:

- `TELEGRAM_BOT_TOKEN`
- `ALLOWED_USER_IDS`
- `CODEX_EXECUTABLE` only if `codex` is not available on `PATH`
- leave `DEBUG_LOG_ENABLED=false` unless you are temporarily troubleshooting locally

Minimal example:

```env
TELEGRAM_BOT_TOKEN=123456:replace-me
ALLOWED_USER_IDS=123456789
CODEX_EXECUTABLE=codex
DEBUG_LOG_ENABLED=false
```

### 6. Start the bot

```powershell
npm start
```

You should see:

```text
Telegram Codex Companion is starting.
```

### 7. Verify it in Telegram

Open a private chat with your bot and send:

```text
/start
```

Then add one local project:

```text
/project default C:\codex-projects
/project add demo
/project use demo
/new
```

Then send a normal message such as:

```text
Please inspect this project and tell me how to start it.
```

If you reach this point, the repo is working.

## First-Run Checklist

Before debugging anything inside this repo, verify these five things:

- `node --version` shows Node 24 or newer
- `codex --help` works in the same terminal account that will run this bot
- `.env` exists in the repo root
- `TELEGRAM_BOT_TOKEN` is correct
- `ALLOWED_USER_IDS` contains your numeric Telegram user id, not your username

## How It Works

1. You send a command or normal message to the Telegram bot.
2. The bot checks whether your Telegram user id is allowed.
3. The bot resolves the current project and active session.
4. The bot starts or resumes a local `codex exec` run on your Windows machine.
5. Progress is shown in Telegram as the run advances.
6. Final responses are sent back to Telegram and stored under that project's session history.

## Project and Session Model

- A **project** is a named local working directory.
- A **session** always belongs to exactly one project.
- `/sessions` only shows sessions for the current project.
- Switching projects changes which sessions you are looking at.
- `/new` clears the active session so the next prompt starts a fresh conversation.
- `/rename` helps label sessions so they make sense on a phone.

Example:

- `project: blog`
- sessions: `homepage redesign`, `rss bug`, `deploy cleanup`
- `project: api`
- sessions: `rate limit fix`, `schema migration`

These histories stay separate.

## Installation Notes

This repository currently uses Node built-ins only, so there is no separate `npm install` step before first run.

In practice, setup is:

1. clone the repo
2. create `.env`
3. confirm `codex` works
4. run `npm start`

If external npm dependencies are added later, this section should be updated first.

## Configuration

The bot reads configuration from `.env` in the project root.

| Variable | Required | Description |
| --- | --- | --- |
| `TELEGRAM_BOT_TOKEN` | Yes | Telegram bot token from BotFather. |
| `ALLOWED_USER_IDS` | Yes | Comma-separated Telegram numeric user ids allowed to use the bot. |
| `PROJECTS_STORAGE_PATH` | No | SQLite path for project metadata. Default: `./data/projects.sqlite`. |
| `STATE_STORAGE_PATH` | No | SQLite path for sessions, bindings, and polling offset. Default: `./data/state.sqlite`. |
| `CODEX_EXECUTABLE` | No | Codex CLI command or absolute path. |
| `CODEX_FULL_AUTO` | No | When `true`, runs Codex with `--full-auto`. Default: `true`. |
| `CODEX_SANDBOX` | No | Passed as `--sandbox <value>`. Leave blank to use Codex CLI defaults. Example: `workspace-write`. |
| `CODEX_MODEL` | No | Optional exact model id passed as `--model <value>`. If left empty, Codex CLI uses its own default model. See the model guidance below before pinning one. |
| `CODEX_REASONING_EFFORT` | No | Optional explicit reasoning override passed to Codex as `model_reasoning_effort`. Example: `low`, `medium`, `high`. If left empty, Codex CLI uses its own default reasoning setting. |
| `DEFAULT_PROJECT_ROOT` | No | Default root folder used when `/project add <name>` omits the path or `/project use <name>` needs to auto-create a project directory. |
| `DEBUG_LOG_ENABLED` | No | Enable local JSONL debug logging. Default: `false`. Only enable temporarily for local troubleshooting. |
| `DEBUG_LOG_PATH` | No | JSONL file path used when `DEBUG_LOG_ENABLED=true`. Default: `./logs/bot-debug.jsonl`. |
| `DEFAULT_REPLY_CHUNK_SIZE` | No | Max characters per Telegram message chunk. Default: `3500`. |
| `POLL_TIMEOUT_SECONDS` | No | Telegram long-poll timeout. Default: `20`. |
| `POLL_RETRY_DELAY_MS` | No | Delay after polling errors. Default: `3000`. |

### Minimum config for a first successful run

If you want the smallest possible working config, only these are essential:

- `TELEGRAM_BOT_TOKEN`
- `ALLOWED_USER_IDS`
- `CODEX_EXECUTABLE` only when `codex` is not on `PATH`

### Example `.env`

```env
TELEGRAM_BOT_TOKEN=123456:replace-me
ALLOWED_USER_IDS=123456789
PROJECTS_STORAGE_PATH=./data/projects.sqlite
STATE_STORAGE_PATH=./data/state.sqlite
CODEX_EXECUTABLE=codex
DEBUG_LOG_ENABLED=false
CODEX_FULL_AUTO=true
CODEX_SANDBOX=workspace-write
CODEX_MODEL=gpt-5.2-codex
CODEX_REASONING_EFFORT=high
DEFAULT_PROJECT_ROOT=C:\codex-projects
DEBUG_LOG_PATH=./logs/bot-debug.jsonl
DEFAULT_REPLY_CHUNK_SIZE=3500
POLL_TIMEOUT_SECONDS=20
POLL_RETRY_DELAY_MS=3000
```

### `CODEX_MODEL` guidance

Use an official OpenAI model id or leave `CODEX_MODEL=` blank and let Codex CLI choose its default.

Examples verified against official OpenAI model pages on March 11, 2026 ([docs](https://platform.openai.com/docs/models), [pricing/model page](https://openai.com/api/pricing/)):

- `gpt-5.2-codex`
- `gpt-5.1-codex-max`
- `gpt-5.1-codex`

Example `.env` lines:

```env
CODEX_MODEL=gpt-5.2-codex
CODEX_MODEL=gpt-5.1-codex-max
CODEX_MODEL=gpt-5.1-codex
```

If model availability changes, prefer the official OpenAI model pages over this README.

### Debug logging

`DEBUG_LOG_ENABLED` defaults to `false`.

When enabled, local debug logs may still capture prompt-related or output-related diagnostics, filesystem paths, Telegram metadata, and session information. The current implementation avoids logging raw prompt/output previews by default, but the log file is still sensitive. Only enable it temporarily for local troubleshooting, then turn it back off.

### Windows Note About `CODEX_EXECUTABLE`

On some Windows systems, the Codex desktop app installs binaries under `WindowsApps`, but those binaries may not be directly executable from Node child processes.

If `codex` on `PATH` does not work reliably, point `CODEX_EXECUTABLE` to the npm-installed shim instead, for example:

```env
CODEX_EXECUTABLE=C:\Users\<YourUser>\AppData\Roaming\npm\codex.cmd
```

## Telegram Commands

- `/start` - show help
- `/help` - show the full command reference and quick-start workflow
- `/projects [page]` - list saved projects, mark the current one, and paginate the reply keyboard when the list grows
- `/project add <name> [path]` - add a local project directory; if `path` is omitted, the bot uses `DEFAULT_PROJECT_ROOT` or your Telegram override
- `/project use <name>` - switch the current project, auto-creating a local directory inside the default root when needed
- `/project delete <name>` - stage deletion; resend `/project delete <name> confirm` to remove the saved project record and its saved sessions without deleting the local folder
- `/project current` - show the current project, path, and effective default root
- `/project default` - show the effective default project root
- `/project default <path>` - set the default project root from Telegram and create that local directory if it does not exist
- `/new` - arm a brand-new session; the next normal message starts it
- `/sessions` - list recent sessions for the current project
- `/use <n>` - switch to a session shown by `/sessions`
- `/rename <title>` - rename the active session
- `/rename <n> <title>` - rename a session from `/sessions`
- `/status` - show current project, path, session, and running state
- `/stop` - request stop for the current Codex run
- normal text message - continue the active session, or start a new one if `/new` was used

Notes:

- project names may only contain letters, numbers, dot, dash, and underscore
- if `/project add <name>` omits the path, the bot uses the effective default project root and creates the folder when needed
- `/project add` accepts paths with spaces as long as the project name itself has no spaces
- `/project use <unknown>` auto-creates a local directory inside the effective default project root when one is available
- `/project default <path>` also creates the local directory if it does not already exist
- `/project delete <name>` requires a second confirmation command and removes saved bot state only; it does not delete the local directory
- `/projects [page]` paginates the reply keyboard so large project lists stay manageable

## Typical First-Time Workflow

### Add a project

```text
/project default C:\codex-projects
/project add blog
```

### Switch to the project

```text
/project use blog
```

### Start a fresh session

```text
/new
```

### Send your first actual request

```text
Please inspect this project and tell me how to start it.
```

If you want a safer first prompt for testing, use:

```text
Tell me what this repository is, how to run it, and do not change any files.
```

### Rename the session after you know what it became

```text
/rename startup investigation
```

### Later, review old sessions

```text
/sessions
/use 2
```

## Mobile Experience

The bot uses Telegram reply keyboards for common actions such as:

- `/projects`
- `/sessions`
- `/new`
- `/status`
- `/stop`
- `/project default`
- quick project switching with pagination when the project list is long
- quick session switching

This keeps the phone workflow much lighter than typing full commands each time.

## Progress Updates and Run Recovery

### Progress updates

While Codex is working, the bot edits a progress message in Telegram with staged updates such as:

Note: this is stage-based progress, not token-by-token answer streaming.

- starting the session
- gathering context
- working on a task item
- drafting the reply
- completion or failure

### Run recovery

If the bot process restarts while a Codex run is active, it will inspect the saved pid on startup.

Telegram long polling also keeps the failed update pending: the bot only advances the stored offset after `service.handleUpdate()` succeeds. If an update handler throws, that update is retried instead of being silently skipped.

- if the pid is still alive, the run remains marked as active
- if the pid is gone, the session is marked as `interrupted` and the stale run state is cleared

This prevents silent stale state from surviving restarts.

## Storage

This project uses two SQLite databases:

- `PROJECTS_STORAGE_PATH`
  - stores project names, paths, and each project's active session pointer
- `STATE_STORAGE_PATH`
  - stores Codex sessions, per-user bindings, running state, and the Telegram polling offset

These database files are ignored by git.

## Security Notes

- the bot only responds to Telegram user ids listed in `ALLOWED_USER_IDS`
- the bot only accepts private chats
- `.env` is ignored by git
- local database files are ignored by git
- no arbitrary shell command passthrough is exposed over Telegram

If your bot token has ever been shared in a chat, rotate it in BotFather before publishing the project.

## Development

Run the test suite:

```powershell
npm test
```

The tests run in a single process because some environments block worker subprocesses.

Current local verification at the time of the latest README revision: `npm test` passes.

## Windows Startup

See [docs/windows-startup.md](docs/windows-startup.md) for Task Scheduler setup and the included helper script.

## Troubleshooting

Start here if the bot does not work on the first try:

1. run `node --version`
2. run `codex --help`
3. check that `.env` exists
4. confirm `TELEGRAM_BOT_TOKEN` and `ALLOWED_USER_IDS`
5. run `npm start` again and watch the terminal output

### `Unauthorized Telegram user.`

Add your numeric Telegram user id to `ALLOWED_USER_IDS`.

### `This bot only accepts private chats.`

Use a direct private chat with the bot instead of a group.

### `Project path no longer exists`

The saved local path is gone or unavailable. Recreate it or switch projects.

### Codex fails to start

Verify that Codex CLI works in a normal terminal on the same machine.

Try:

```powershell
codex --help
```

If needed, set `CODEX_EXECUTABLE` explicitly to the CLI path.

If `codex` works in your own PowerShell window but not from Node, the most reliable fix on Windows is usually:

```env
CODEX_EXECUTABLE=C:\Users\<YourUser>\AppData\Roaming\npm\codex.cmd
```

### `Missing required config: TELEGRAM_BOT_TOKEN` or similar

Your `.env` file is missing a required key or was not created in the repository root.

Fix:

```powershell
Copy-Item .env.example .env
```

Then fill in the missing values.

### Telegram responds, but Codex does nothing useful

Usually one of these is true:

- the selected project path is wrong
- the selected folder is not the repo you meant to inspect
- Codex CLI is installed but not authenticated
- the active session is not the one you think it is

Check:

```text
/project current
/status
/sessions
```

### Thinking feels too shallow

Set `CODEX_REASONING_EFFORT` explicitly in `.env`, for example:

```env
CODEX_REASONING_EFFORT=high
```

If this is empty, Codex CLI falls back to its own default or your global `~/.codex/config.toml` setting.

### Long replies feel noisy on mobile

Lower `DEFAULT_REPLY_CHUNK_SIZE`.

### The bot restarts but `/status` looks odd

If a previous run was interrupted, the bot will eventually mark it as `interrupted`. Use `/sessions` and `/use <n>` to continue with a clean session selection.

## Public Repo Checklist

Before publishing this repository:

- make sure `.env` is not committed
- make sure `data/` is not committed
- rotate your Telegram bot token if it has ever been exposed
- verify your README examples do not contain personal machine paths
- verify `npm test` passes

## Roadmap Ideas

- Telegram inline buttons instead of only reply keyboards
- richer streaming output
- project aliases and tags
- multi-user mode
- Telegram group/topic support
- lightweight web viewer for diffs and long outputs







