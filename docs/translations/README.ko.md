# Telegram Codex Companion

개인 Telegram Bot으로 휴대폰에서 Codex CLI를 쓰기 위한 도구입니다.

[English](../../README.md) | [简中](./README.zh-CN.md) | [繁中](./README.zh-TW.md) | [日本語](./README.ja.md) | [한국어](./README.ko.md) | [Français](./README.fr.md) | [Español](./README.es.md)

바로가기: [무엇을 하는 프로젝트인가](#이-프로젝트는-무엇을-하나요) | [설치와 실행](#설치와-실행) | [명령어](#명령어) | [최소 설정](#최소-설정) | [전체 문서](#전체-문서)

`telegram-codex-companion`은 Telegram 개인 채팅을 Codex용 경량 제어 화면으로 바꿉니다. Codex는 계속 내 Windows 컴퓨터에서 실행되고, 나는 휴대폰에서 프로젝트 전환, 세션 이어쓰기, 진행 상황 확인, 결과 수신만 하면 됩니다.

## 이 프로젝트는 무엇을 하나요

- 내 Windows 컴퓨터에서 Codex CLI를 실행합니다
- 휴대폰의 Telegram 개인 채팅으로 이를 제어합니다
- 프로젝트별로 분리된 세션 기록을 유지합니다
- 진행 상황과 최종 결과를 Telegram으로 돌려줍니다

## 설치와 실행

### 1. 클론하고 설정하기

```powershell
git clone <your-repo-url>
cd telegram-codex-companion
Copy-Item .env.example .env
```

최소한 다음 값을 채우세요:

- `TELEGRAM_BOT_TOKEN`
- `ALLOWED_USER_IDS`
- `codex`가 `PATH`에 없을 때만 `CODEX_EXECUTABLE`

### 2. Bot 시작

```powershell
npm start
```

### 3. Telegram에서 테스트

```text
/start
/project default C:\codex-projects
/project add demo
/project use demo
/new
Please inspect this repo and tell me how to start it.
```

## 명령어

전체 명령어 설명은 Telegram에서 `/help`를 보내 확인하는 편이 가장 좋습니다.

가장 자주 쓰는 명령어:

- `/project default <path>`
- `/project add <name> [path]`
- `/project use <name>`
- `/new`
- `/sessions`
- `/use <n>`
- `/status`
- `/stop`

## 최소 설정

- `TELEGRAM_BOT_TOKEN`
- `ALLOWED_USER_IDS`
- `codex`가 `PATH`에 없을 때만 `CODEX_EXECUTABLE`

```env
TELEGRAM_BOT_TOKEN=123456:replace-me
ALLOWED_USER_IDS=123456789
CODEX_EXECUTABLE=codex
DEBUG_LOG_ENABLED=false
```

## 전체 문서

설정, 문제 해결, Windows 시작 등록, 구현 세부 내용은 [README.md](../../README.md)를 참고하세요.
