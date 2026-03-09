import test from "node:test";
import assert from "node:assert/strict";

import { CodexRunner, resolveWindowsCodexNodeEntry } from "../src/codex_runner/codexRunner.js";

test("buildArgs includes explicit reasoning effort override when configured", () => {
  const runner = new CodexRunner({
    codexExecutable: "codex",
    codexFullAuto: true,
    codexSandbox: "workspace-write",
    codexModel: "gpt-5.4",
    codexReasoningEffort: "high"
  });

  const args = runner.buildArgs("inspect the repo");

  assert.deepEqual(args, [
    "exec",
    "--json",
    "--skip-git-repo-check",
    "--full-auto",
    "--sandbox",
    "workspace-write",
    "--model",
    "gpt-5.4",
    "--config",
    "model_reasoning_effort=high",
    "inspect the repo"
  ]);
});

test("buildArgs omits reasoning effort override when not configured", () => {
  const runner = new CodexRunner({
    codexExecutable: "codex",
    codexFullAuto: false,
    codexSandbox: "",
    codexModel: "",
    codexReasoningEffort: ""
  });

  const args = runner.buildArgs("inspect the repo", "thread-1");

  assert.deepEqual(args, [
    "exec",
    "--json",
    "--skip-git-repo-check",
    "resume",
    "thread-1",
    "inspect the repo"
  ]);
});

test("resolveWindowsCodexNodeEntry maps npm codex.cmd shims to the JS entrypoint", () => {
  const entry = resolveWindowsCodexNodeEntry("C:\\Users\\me\\AppData\\Roaming\\npm\\codex.cmd", {
    platform: "win32",
    nodeExecutable: "node.exe",
    exists(candidate) {
      return candidate === "C:\\Users\\me\\AppData\\Roaming\\npm\\node_modules\\@openai\\codex\\bin\\codex.js";
    }
  });

  assert.deepEqual(entry, {
    command: "node.exe",
    argsPrefix: ["C:\\Users\\me\\AppData\\Roaming\\npm\\node_modules\\@openai\\codex\\bin\\codex.js"]
  });
});

test("resolveWindowsCodexNodeEntry falls back to the global npm package for codex on PATH", () => {
  const entry = resolveWindowsCodexNodeEntry("codex", {
    platform: "win32",
    appData: "C:\\Users\\me\\AppData\\Roaming",
    nodeExecutable: "node.exe",
    exists(candidate) {
      return candidate === "C:\\Users\\me\\AppData\\Roaming\\npm\\node_modules\\@openai\\codex\\bin\\codex.js";
    }
  });

  assert.deepEqual(entry, {
    command: "node.exe",
    argsPrefix: ["C:\\Users\\me\\AppData\\Roaming\\npm\\node_modules\\@openai\\codex\\bin\\codex.js"]
  });
});
