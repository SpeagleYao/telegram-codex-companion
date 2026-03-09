import test from "node:test";
import assert from "node:assert/strict";

import { buildHelpText, chunkText, formatStatus } from "../src/bot/messageFormatter.js";
import { parseIncomingText } from "../src/bot/commandParser.js";

test("chunkText splits long replies on boundaries", () => {
  const text = "alpha beta gamma delta epsilon zeta eta theta iota kappa lambda";
  const chunks = chunkText(text, 20);
  assert.ok(chunks.length > 1);
  assert.ok(chunks.every((chunk) => chunk.length <= 20));
  assert.equal(chunks.join(" ").replace(/\s+/gu, " ").trim(), text);
});

test("parseIncomingText understands project commands, rename commands, and prompts", () => {
  assert.deepEqual(parseIncomingText("hello"), { type: "prompt", prompt: "hello" });
  assert.deepEqual(parseIncomingText("/project current"), {
    type: "command",
    command: "project_current"
  });
  assert.deepEqual(parseIncomingText("/project add demo"), {
    type: "command",
    command: "project_add",
    name: "demo",
    path: null
  });
  assert.deepEqual(parseIncomingText("/project add demo C:/work/demo"), {
    type: "command",
    command: "project_add",
    name: "demo",
    path: "C:/work/demo"
  });
  assert.deepEqual(parseIncomingText("/project default"), {
    type: "command",
    command: "project_default_show",
    path: null
  });
  assert.deepEqual(parseIncomingText("/project default E:/codex project"), {
    type: "command",
    command: "project_default_set",
    path: "E:/codex project"
  });
  assert.deepEqual(parseIncomingText("/use 2"), {
    type: "command",
    command: "use",
    index: 2
  });
  assert.deepEqual(parseIncomingText("/rename current bugfix"), {
    type: "command",
    command: "rename_current",
    title: "current bugfix"
  });
  assert.deepEqual(parseIncomingText("/rename 2 bugfix session"), {
    type: "command",
    command: "rename_index",
    index: 2,
    title: "bugfix session"
  });
  assert.deepEqual(parseIncomingText("/status@demo_bot"), {
    type: "command",
    command: "status",
    args: ""
  });
});

test("formatStatus includes detailed run metadata when a run is active", () => {
  const startedAt = new Date("2026-03-09T14:23:10");
  const lastEventAt = new Date("2026-03-09T14:28:57");
  const statusText = formatStatus({
    project: { name: "demo", cwd: "E:/work/demo" },
    session: { title: "Bug hunt", codexSessionId: "thread-1", status: "running" },
    binding: {
      runningPid: 1234,
      runningProjectName: "demo",
      runningCwd: "E:/work/demo",
      runningModel: "gpt-5.4",
      runningSandbox: "workspace-write",
      runningResumeMode: "resume",
      runningStartedAt: startedAt.toISOString(),
      runningLastEventText: "Thinking...",
      runningLastEventAt: lastEventAt.toISOString()
    },
    detachedRunning: true,
    defaultProjectRoot: "E:/codex project"
  });

  assert.match(statusText, /Default project root: E:\/codex project/);
  assert.match(statusText, /Running: yes \(tracked from a previous bot instance, pid 1234\)/);
  assert.match(statusText, /Model: gpt-5.4/);
  assert.match(statusText, /Sandbox: workspace-write/);
  assert.match(statusText, /Run mode: resumed existing session/);
  assert.match(statusText, /^Started: 2026-03-09 14:23:10$/m);
  assert.match(statusText, /Last progress: Thinking.../);
  assert.match(statusText, /^Last progress at: 2026-03-09 14:28:57$/m);
});

test("help text documents the core commands and workflow", () => {
  const helpText = buildHelpText();
  assert.match(helpText, /\/help - show this help/);
  assert.match(helpText, /\/project add <name> \[path\] - add a local folder as a project/);
  assert.match(helpText, /\/project default <path> - set the default project root/);
  assert.match(helpText, /1\. \/project default E:\\codex project/);
});
