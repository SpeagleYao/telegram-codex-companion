# Telegram Codex Companion

Utilisez Codex CLI depuis votre téléphone avec un bot Telegram privé.

[English](../../README.md) | [简中](./README.zh-CN.md) | [繁中](./README.zh-TW.md) | [日本語](./README.ja.md) | [한국어](./README.ko.md) | [Français](./README.fr.md) | [Español](./README.es.md)

Accès rapide : [À quoi sert ce projet](#à-quoi-sert-ce-projet) | [Installation et lancement](#installation-et-lancement) | [Commandes](#commandes) | [Configuration minimale](#configuration-minimale) | [Documentation complète](#documentation-complète)

`telegram-codex-companion` transforme une discussion privée Telegram en interface légère pour piloter Codex. Codex continue de tourner sur votre propre machine Windows, pendant que vous changez de projet, reprenez une session, suivez la progression et récupérez la réponse depuis votre téléphone.

## À quoi sert ce projet

- exécuter Codex CLI sur votre propre machine Windows
- le contrôler depuis une discussion privée Telegram sur votre téléphone
- conserver un historique de sessions séparé par projet
- renvoyer la progression et la réponse finale dans Telegram

## Installation et lancement

### 1. Cloner et configurer

```powershell
git clone <your-repo-url>
cd telegram-codex-companion
Copy-Item .env.example .env
```

Renseignez au minimum :

- `TELEGRAM_BOT_TOKEN`
- `ALLOWED_USER_IDS`
- `CODEX_EXECUTABLE` seulement si `codex` n'est pas sur le `PATH`

### 2. Démarrer le bot

```powershell
npm start
```

### 3. Tester dans Telegram

```text
/start
/project default C:\codex-projects
/project add demo
/project use demo
/new
Please inspect this repo and tell me how to start it.
```

## Commandes

Pour la liste complète, envoyez `/help` directement dans Telegram.

Commandes les plus utiles :

- `/project default <path>`
- `/project add <name> [path]`
- `/project use <name>`
- `/new`
- `/sessions`
- `/use <n>`
- `/status`
- `/stop`

## Configuration minimale

- `TELEGRAM_BOT_TOKEN`
- `ALLOWED_USER_IDS`
- `CODEX_EXECUTABLE` seulement si `codex` n'est pas sur le `PATH`

```env
TELEGRAM_BOT_TOKEN=123456:replace-me
ALLOWED_USER_IDS=123456789
CODEX_EXECUTABLE=codex
DEBUG_LOG_ENABLED=false
```

## Documentation complète

Pour la configuration détaillée, le dépannage, le démarrage automatique sous Windows et les détails d'implémentation, consultez [README.md](../../README.md).
