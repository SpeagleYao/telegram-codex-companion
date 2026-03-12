# Telegram Codex Companion

プライベートな Telegram Bot から、スマホで Codex CLI を使うためのツールです。

[English](../../README.md) | [简中](./README.zh-CN.md) | [繁中](./README.zh-TW.md) | [日本語](./README.ja.md) | [한국어](./README.ko.md) | [Français](./README.fr.md) | [Español](./README.es.md)

クイックリンク: [何をするプロジェクトか](#このプロジェクトでできること) | [インストールと実行](#インストールと実行) | [コマンド](#コマンド) | [最小設定](#最小設定) | [完全なドキュメント](#完全なドキュメント)

`telegram-codex-companion` は Telegram のプライベートチャットを、Codex の軽量な操作画面に変えます。Codex は自分の Windows マシン上で動かし続けたまま、スマホからプロジェクト切り替え、セッション再開、進捗確認、結果受け取りができます。

## このプロジェクトでできること

- 自分の Windows マシンで Codex CLI を動かす
- スマホの Telegram プライベートチャットから操作する
- プロジェクトごとに独立したセッション履歴を持つ
- 進捗と最終結果を Telegram に返す

## インストールと実行

### 1. クローンして設定

```powershell
git clone <your-repo-url>
cd telegram-codex-companion
Copy-Item .env.example .env
```

最低限必要な設定:

- `TELEGRAM_BOT_TOKEN`
- `ALLOWED_USER_IDS`
- `codex` が `PATH` にない場合のみ `CODEX_EXECUTABLE`

### 2. Bot を起動

```powershell
npm start
```

### 3. Telegram で試す

```text
/start
/project default C:\codex-projects
/project add demo
/project use demo
/new
Please inspect this repo and tell me how to start it.
```

## コマンド

完全なコマンド一覧は Telegram で `/help` を送って確認してください。

よく使うコマンド:

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
- `codex` が `PATH` にない場合のみ `CODEX_EXECUTABLE`

```env
TELEGRAM_BOT_TOKEN=123456:replace-me
ALLOWED_USER_IDS=123456789
CODEX_EXECUTABLE=codex
DEBUG_LOG_ENABLED=false
```

## 完全なドキュメント

設定、トラブルシューティング、Windows 起動設定、実装の詳細は [README.md](../../README.md) を参照してください。
