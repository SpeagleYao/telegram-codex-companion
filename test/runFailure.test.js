import test from "node:test";
import assert from "node:assert/strict";

import { buildCodexFailureReply, classifyCodexFailure } from "../src/codex_runner/runFailure.js";

test("classifyCodexFailure detects missing CLI launches", () => {
  const failure = classifyCodexFailure("spawn codex ENOENT");
  assert.equal(failure.code, "cli_not_found");
});

test("classifyCodexFailure detects resume failures only when resuming", () => {
  const failure = classifyCodexFailure("resume session thread-1 not found", { isResume: true });
  assert.equal(failure.code, "resume_failed");
});

test("buildCodexFailureReply returns a concise user-facing message", () => {
  const failure = buildCodexFailureReply("spawn codex ENOENT", {
    projectName: "demo",
    isResume: false
  });

  assert.equal(failure.classification.code, "cli_not_found");
  assert.match(failure.text, /Codex run failed in demo\./);
  assert.match(failure.text, /Codex CLI could not be launched/);
  assert.match(failure.text, /Technical summary:/);
});
