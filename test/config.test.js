import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";

import { loadConfig } from "../src/config/loadConfig.js";

function withTempCwd(t) {
  const originalCwd = process.cwd();
  const originalEnv = { ...process.env };
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "telegram-codex-config-"));

  process.chdir(root);
  t.after(() => {
    process.chdir(originalCwd);
    for (const key of Object.keys(process.env)) {
      if (!(key in originalEnv)) {
        delete process.env[key];
      }
    }
    Object.assign(process.env, originalEnv);
    fs.rmSync(root, { recursive: true, force: true });
  });

  return root;
}

test("loadConfig reads .env values and resolves default paths", (t) => {
  const root = withTempCwd(t);
  fs.writeFileSync(
    path.join(root, ".env"),
    [
      "TELEGRAM_BOT_TOKEN=test-token",
      "ALLOWED_USER_IDS=111, 222",
      "CODEX_FULL_AUTO=false",
      "CODEX_SANDBOX=workspace-write",
      "CODEX_MODEL=gpt-5.4",
      "CODEX_REASONING_EFFORT=high",
      "DEFAULT_PROJECT_ROOT=./workspace-root",
      "DEBUG_LOG_ENABLED=true",
      "DEFAULT_REPLY_CHUNK_SIZE=1234",
      "POLL_TIMEOUT_SECONDS=9",
      "POLL_RETRY_DELAY_MS=4567"
    ].join("\n"),
    "utf8"
  );

  const config = loadConfig();

  assert.equal(config.telegramBotToken, "test-token");
  assert.deepEqual([...config.allowedUserIds], [111, 222]);
  assert.equal(config.codexFullAuto, false);
  assert.equal(config.codexSandbox, "workspace-write");
  assert.equal(config.codexModel, "gpt-5.4");
  assert.equal(config.codexReasoningEffort, "high");
  assert.equal(config.defaultProjectRoot, path.join(root, "workspace-root"));
  assert.equal(config.debugLogEnabled, true);
  assert.equal(config.defaultReplyChunkSize, 1234);
  assert.equal(config.pollTimeoutSeconds, 9);
  assert.equal(config.pollRetryDelayMs, 4567);
  assert.equal(config.projectsStoragePath, path.join(root, "data", "projects.sqlite"));
  assert.equal(config.stateStoragePath, path.join(root, "data", "state.sqlite"));
  assert.equal(config.debugLogPath, path.join(root, "logs", "bot-debug.jsonl"));
});

test("loadConfig lets process.env override .env values", (t) => {
  const root = withTempCwd(t);
  fs.writeFileSync(
    path.join(root, ".env"),
    "TELEGRAM_BOT_TOKEN=file-token\nALLOWED_USER_IDS=111\nDEBUG_LOG_ENABLED=false\nDEFAULT_PROJECT_ROOT=./from-file\n",
    "utf8"
  );

  process.env.TELEGRAM_BOT_TOKEN = "env-token";
  process.env.ALLOWED_USER_IDS = "333,444";
  process.env.DEBUG_LOG_ENABLED = "true";
  process.env.DEFAULT_PROJECT_ROOT = "./from-env";

  const config = loadConfig();

  assert.equal(config.telegramBotToken, "env-token");
  assert.deepEqual([...config.allowedUserIds], [333, 444]);
  assert.equal(config.debugLogEnabled, true);
  assert.equal(config.defaultProjectRoot, path.join(root, "from-env"));
});


test("loadConfig rejects invalid booleans", (t) => {
  const root = withTempCwd(t);
  fs.writeFileSync(
    path.join(root, ".env"),
    "TELEGRAM_BOT_TOKEN=test-token\nALLOWED_USER_IDS=111\nDEBUG_LOG_ENABLED=maybe\n",
    "utf8"
  );

  assert.throws(() => loadConfig(), /Invalid boolean config for DEBUG_LOG_ENABLED/);
});
