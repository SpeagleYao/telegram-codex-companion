# Telegram Codex Companion

Use Codex CLI from your phone through a private Telegram bot.

`telegram-codex-companion` turns a Telegram private chat into a small-screen control surface for Codex running on your own Windows machine. It is meant for a single person who already uses Codex locally and wants a simpler alternative to remote desktop when away from the keyboard.

## Can A Beginner Use This Quickly?

Yes. You can still start with an explicit path, but a default project root can now handle first-run project creation too.

For a new user, the real blockers are usually not inside this repo. They are:

1. creating a Telegram bot with `@BotFather`
2. finding your Telegram numeric user id
3. making sure `codex` already works in a normal terminal

If those three are ready, this project is quick to start. This README is organized around that first successful run.

## Who This Is For

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

## What It Does

- maps Telegram messages to local Codex CLI runs
- stores multiple local projects as named working directories
- keeps separate session history per project
- lets you switch projects and sessions from Telegram
- supports creating fresh sessions and resuming old ones
- supports renaming sessions for easier mobile navigation
- shows staged progress updates while Codex is working
- detects interrupted or detached runs after a bot restart
- keeps access restricted to approved Telegram user ids

## Intended Use

This project is intentionally narrow in scope:

- single user
- private Telegram chats only
- no arbitrary shell passthrough
- no desktop streaming
- no web UI
- no Telegram group or topic routing yet

The focus is reliability and clarity for personal use on mobile.

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

Minimal example:

```env
TELEGRAM_BOT_TOKEN=123456:replace-me
ALLOWED_USER_IDS=123456789
CODEX_EXECUTABLE=codex
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
/project default E:\codex project
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
| `CODEX_SANDBOX` | No | Passed as `--sandbox <value>`. Default: `workspace-write`. |
| `CODEX_MODEL` | No | Optional Codex model override. If left empty, Codex CLI uses its own default model. |
| `CODEX_REASONING_EFFORT` | No | Optional explicit reasoning override passed to Codex as `model_reasoning_effort`. Example: `low`, `medium`, `high`. If left empty, Codex CLI uses its own default reasoning setting. |
| `DEFAULT_PROJECT_ROOT` | No | Default root folder used when `/project add <name>` omits the path or `/project use <name>` needs to auto-create a project. |
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
CODEX_FULL_AUTO=true
CODEX_SANDBOX=workspace-write
CODEX_MODEL=
CODEX_REASONING_EFFORT=high
DEFAULT_PROJECT_ROOT=E:\codex project
DEFAULT_REPLY_CHUNK_SIZE=3500
POLL_TIMEOUT_SECONDS=20
POLL_RETRY_DELAY_MS=3000
```

### Windows Note About `CODEX_EXECUTABLE`

On some Windows systems, the Codex desktop app installs binaries under `WindowsApps`, but those binaries may not be directly executable from Node child processes.

If `codex` on `PATH` does not work reliably, point `CODEX_EXECUTABLE` to the npm-installed shim instead, for example:

```env
CODEX_EXECUTABLE=C:\Users\<YourUser>\AppData\Roaming\npm\codex.cmd
```

## Telegram Commands

- `/start` - show help
- `/help` - show the full command reference and quick-start workflow
- `/projects` - list saved projects and mark the current one
- `/project add <name> [path]` - add a local project directory; if `path` is omitted, the bot uses `DEFAULT_PROJECT_ROOT` or your Telegram override
- `/project use <name>` - switch the current project, auto-creating it inside the default root when needed
- `/project current` - show the current project, path, and effective default root
- `/project default` - show the effective default project root
- `/project default <path>` - set the default project root from Telegram
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

## Typical First-Time Workflow

### Add a project

```text
/project default E:\codex project
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
- quick project switching
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

