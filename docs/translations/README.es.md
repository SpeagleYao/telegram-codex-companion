# Telegram Codex Companion

Usa Codex CLI desde tu teléfono mediante un bot privado de Telegram.

[English](../../README.md) | [简中](./README.zh-CN.md) | [繁中](./README.zh-TW.md) | [日本語](./README.ja.md) | [한국어](./README.ko.md) | [Français](./README.fr.md) | [Español](./README.es.md)

Accesos rápidos: [Qué hace este proyecto](#qué-hace-este-proyecto) | [Instalación y ejecución](#instalación-y-ejecución) | [Comandos](#comandos) | [Configuración mínima](#configuración-mínima) | [Documentación completa](#documentación-completa)

`telegram-codex-companion` convierte un chat privado de Telegram en una interfaz ligera para controlar Codex. Codex sigue ejecutándose en tu propia máquina Windows, mientras tú cambias de proyecto, reanudas sesiones, revisas el progreso y recibes la respuesta final desde el teléfono.

## Qué hace este proyecto

- ejecuta Codex CLI en tu propia máquina Windows
- te permite controlarlo desde un chat privado de Telegram en tu teléfono
- mantiene historiales de sesión separados por proyecto
- devuelve el progreso y la respuesta final a Telegram

## Instalación y ejecución

### 1. Clonar y configurar

```powershell
git clone <your-repo-url>
cd telegram-codex-companion
Copy-Item .env.example .env
```

Completa al menos estos valores:

- `TELEGRAM_BOT_TOKEN`
- `ALLOWED_USER_IDS`
- `CODEX_EXECUTABLE` solo si `codex` no está en el `PATH`

### 2. Iniciar el bot

```powershell
npm start
```

### 3. Probarlo en Telegram

```text
/start
/project default C:\codex-projects
/project add demo
/project use demo
/new
Please inspect this repo and tell me how to start it.
```

## Comandos

Para la referencia completa, envía `/help` dentro de Telegram.

Los comandos más comunes son:

- `/project default <path>`
- `/project add <name> [path]`
- `/project use <name>`
- `/new`
- `/sessions`
- `/use <n>`
- `/status`
- `/stop`

## Configuración mínima

- `TELEGRAM_BOT_TOKEN`
- `ALLOWED_USER_IDS`
- `CODEX_EXECUTABLE` solo si `codex` no está en el `PATH`

```env
TELEGRAM_BOT_TOKEN=123456:replace-me
ALLOWED_USER_IDS=123456789
CODEX_EXECUTABLE=codex
DEBUG_LOG_ENABLED=false
```

## Documentación completa

Para configuración detallada, solución de problemas, inicio automático en Windows y detalles de implementación, consulta [README.md](../../README.md).
