# Telegram Codex Companion

Use Codex CLI from your phone through a private Telegram bot.

`telegram-codex-companion` turns a Telegram private chat into a small-screen control surface for Codex running on your own Windows machine. It is designed for people who want to keep working with Codex while away from their desk without relying on remote desktop software.

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

## Requirements

- Windows machine with network access
- Node.js 24 or newer
- Telegram account
- a Telegram bot token from BotFather
- your Telegram numeric user id
- Codex CLI installed and authenticated on the same machine

## Before You Start

### 1. Create a Telegram bot

In Telegram, open `@BotFather` and create a new bot with `/newbot`. BotFather will give you a bot token.

### 2. Get your Telegram numeric user id

You need your numeric Telegram user id for `ALLOWED_USER_IDS`. A common way is to message a bot such as `@userinfobot` and copy the numeric id it returns.

### 3. Install Codex CLI

This project expects a shell-callable Codex CLI, not only the Codex desktop app bundle.

If you do not already have a working `codex` command, install the official CLI globally:

```powershell
npm install -g @openai/codex
```

### 4. Authenticate Codex CLI

Make sure Codex CLI works in a normal terminal before starting this bot.

For example:

```powershell
codex --help
```

or, on some Windows setups, point to the npm shim directly:

```powershell
C:\Users\<YourUser>\AppData\Roaming\npm\codex.cmd --help
```

## Installation

Clone the repository and enter the directory:

```powershell
git clone <your-repo-url>
cd telegram-codex-companion
```

Create your local config file:

```powershell
Copy-Item .env.example .env
```

Edit `.env` and fill in at least these values:

- `TELEGRAM_BOT_TOKEN`
- `ALLOWED_USER_IDS`
- `CODEX_EXECUTABLE` if `codex` is not already on `PATH`

Then start the bot:

```powershell
npm start
```

When the bot is running, open a private chat with it in Telegram and send:

```text
/start
```

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
| `DEFAULT_REPLY_CHUNK_SIZE` | No | Max characters per Telegram message chunk. Default: `3500`. |
| `POLL_TIMEOUT_SECONDS` | No | Telegram long-poll timeout. Default: `20`. |
| `POLL_RETRY_DELAY_MS` | No | Delay after polling errors. Default: `3000`. |

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
- `/projects` - list saved projects and mark the current one
- `/project add <name> <path>` - add a local project directory
- `/project use <name>` - switch the current project
- `/project current` - show the current project and path
- `/new` - arm a brand-new session; the next normal message starts it
- `/sessions` - list recent sessions for the current project
- `/use <n>` - switch to a session shown by `/sessions`
- `/rename <title>` - rename the active session
- `/rename <n> <title>` - rename a session from `/sessions`
- `/status` - show current project, path, session, and running state
- `/stop` - request stop for the current Codex run
- normal text message - continue the active session, or start a new one if `/new` was used

## Typical First-Time Workflow

### Add a project

```text
/project add blog E:\work\blog
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
- quick project switching
- quick session switching

This keeps the phone workflow much lighter than typing full commands each time.

## Progress Updates and Run Recovery

### Progress updates

While Codex is working, the bot edits a progress message in Telegram with staged updates such as:

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

## Windows Startup

See [docs/windows-startup.md](docs/windows-startup.md) for Task Scheduler setup and the included helper script.

## Troubleshooting

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
