import test from "node:test";
import assert from "node:assert/strict";

import { buildHelpText, chunkText } from "../src/bot/messageFormatter.js";
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
  assert.deepEqual(parseIncomingText("/project add demo C:/work/demo"), {
    type: "command",
    command: "project_add",
    name: "demo",
    path: "C:/work/demo"
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
});

test("help text documents the core commands and workflow", () => {
  const helpText = buildHelpText();
  assert.match(helpText, /\/help - show this help/);
  assert.match(helpText, /\/project add <name> <path> - add a local folder as a project/);
  assert.match(helpText, /1\. \/project add demo/);
});
