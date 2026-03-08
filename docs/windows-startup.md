# Windows Startup

This project is intended to run as a small always-on local service on your current Windows machine.

## Option 1: Start it manually

Open PowerShell in the project directory and run:

```powershell
npm start
```

## Option 2: Register a Task Scheduler task

The repository includes a helper script at [scripts/register-startup-task.ps1](../scripts/register-startup-task.ps1).

Example:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\register-startup-task.ps1 -TaskName "Telegram Codex Companion" -ProjectRoot "C:\path\to\telegram-codex-companion"
```

By default the script:

- starts at user logon
- runs `npm start` inside the project directory
- uses the current user account
- writes Task Scheduler output to the standard task history

## Notes

- The bot is only reachable while this computer is awake and connected.
- If Windows sleeps, Telegram polling stops until the machine wakes again.
- Make sure `.env` exists before you register the startup task.
- Confirm `npm start` works in a normal terminal before automating it.

## If `codex` is not on PATH

Set `CODEX_EXECUTABLE` in `.env` to the full path of the Codex executable.

## Updating the service

After you pull changes:

1. Stop the running task if it is active.
2. Update files.
3. Start the task again or log out and back in.

## Removing the task

```powershell
Unregister-ScheduledTask -TaskName "Telegram Codex Companion" -Confirm:$false
```
