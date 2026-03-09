import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";

import { DebugLogger, summarizeText } from "../src/logging/debugLogger.js";

function stripBom(value) {
  return value.replace(/^\ufeff/u, "");
}

test("summarizeText shortens long messages but preserves both ends", () => {
  const value = summarizeText("a".repeat(150) + " middle " + "z".repeat(150), 20);
  assert.match(value, /^a{20} .* z{20}$/);
});

test("DebugLogger writes JSON lines to disk with a UTF-8 BOM header", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "telegram-codex-debug-"));
  const filePath = path.join(root, "bot-debug.jsonl");

  try {
    const logger = new DebugLogger({ enabled: true, filePath });
    logger.log("telegram.message.received", { textLength: 42 });

    const fileText = fs.readFileSync(filePath, "utf8");
    assert.ok(fileText.startsWith("\ufeff"));

    const lines = stripBom(fileText).trim().split(/\r?\n/u);
    assert.equal(lines.length, 1);

    const parsed = JSON.parse(lines[0]);
    assert.equal(parsed.type, "telegram.message.received");
    assert.equal(parsed.textLength, 42);
    assert.ok(parsed.timestamp);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("DebugLogger adds a UTF-8 BOM to existing log files", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "telegram-codex-debug-"));
  const filePath = path.join(root, "bot-debug.jsonl");

  try {
    fs.writeFileSync(filePath, '{"type":"existing"}\n', "utf8");
    const logger = new DebugLogger({ enabled: true, filePath });
    logger.log("telegram.message.received", { textLength: 1 });

    const fileText = fs.readFileSync(filePath, "utf8");
    assert.ok(fileText.startsWith("\ufeff"));

    const lines = stripBom(fileText).trim().split(/\r?\n/u);
    assert.equal(JSON.parse(lines[0]).type, "existing");
    assert.equal(JSON.parse(lines[1]).type, "telegram.message.received");
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
