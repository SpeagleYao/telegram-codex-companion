import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import test from "node:test";
import assert from "node:assert/strict";

import { CodexRunner, resolveWindowsCodexNodeEntry } from "../src/codex_runner/codexRunner.js";

function createChild() {
  const child = new EventEmitter();
  child.stdout = new PassThrough();
  child.stderr = new PassThrough();
  child.pid = 321;
  child.killed = false;
  child.kill = () => {
    child.killed = true;
  };
  return child;
}

test("buildArgs includes explicit reasoning effort override when configured", () => {
  const runner = new CodexRunner({
    codexExecutable: "codex",
    codexFullAuto: true,
    codexSandbox: "workspace-write",
    codexModel: "gpt-5.2-codex",
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
    "gpt-5.2-codex",
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

test("resolveWindowsCodexNodeEntry parses codex.cmd shim contents when the JS entrypoint lives elsewhere", () => {
  const executable = "C:\\Tools\\codex\\bin\\codex.cmd";
  const shimScript = "C:\\Tools\\codex\\dist\\codex.js";
  const entry = resolveWindowsCodexNodeEntry(executable, {
    platform: "win32",
    nodeExecutable: "node.exe",
    exists(candidate) {
      return candidate === executable || candidate === shimScript;
    },
    readFile() {
      return '@IF EXIST "%~dp0\\..\\dist\\codex.js" node "%~dp0\\..\\dist\\codex.js" %*';
    }
  });

  assert.deepEqual(entry, {
    command: "node.exe",
    argsPrefix: [shimScript]
  });
});

test("resolveWindowsCodexNodeEntry supports quoted shim paths with spaces", () => {
  const entry = resolveWindowsCodexNodeEntry('"C:\\Program Files\\OpenAI\\codex.cmd"', {
    platform: "win32",
    nodeExecutable: "node.exe",
    exists(candidate) {
      return candidate === "C:\\Program Files\\OpenAI\\node_modules\\@openai\\codex\\bin\\codex.js";
    }
  });

  assert.deepEqual(entry, {
    command: "node.exe",
    argsPrefix: ["C:\\Program Files\\OpenAI\\node_modules\\@openai\\codex\\bin\\codex.js"]
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

test("spawnChild on Windows passes prompts with shell metacharacters as literal arguments", () => {
  const calls = [];
  const runner = new CodexRunner(
    {
      codexExecutable: "C:\\Users\\me\\AppData\\Roaming\\npm\\codex.cmd",
      codexFullAuto: false,
      codexSandbox: "",
      codexModel: "",
      codexReasoningEffort: ""
    },
    {
      platform: "win32",
      spawnImpl(command, args, options) {
        calls.push({ command, args, options });
        return createChild();
      },
      resolveWindowsCodexNodeEntry() {
        return {
          command: "node.exe",
          argsPrefix: ["C:\\Users\\me\\AppData\\Roaming\\npm\\node_modules\\@openai\\codex\\bin\\codex.js"]
        };
      }
    }
  );

  const prompt = 'inspect a & b | find "quoted"';
  const args = runner.buildArgs(prompt);
  runner.spawnChild("C:\\repo", args);

  assert.equal(calls.length, 1);
  assert.equal(calls[0].command, "node.exe");
  assert.equal(calls[0].args.at(-1), prompt);
  assert.equal("shell" in calls[0].options, false);
});

test("spawnChild keeps quoted Windows executable paths and arguments usable without shell mode", () => {
  const calls = [];
  const runner = new CodexRunner(
    {
      codexExecutable: '"C:\\Program Files\\OpenAI\\codex.cmd"',
      codexFullAuto: true,
      codexSandbox: "workspace-write",
      codexModel: "gpt-5.2-codex",
      codexReasoningEffort: "medium"
    },
    {
      platform: "win32",
      spawnImpl(command, args, options) {
        calls.push({ command, args, options });
        return createChild();
      },
      resolveWindowsCodexNodeEntry(executable) {
        assert.equal(executable, "C:\\Program Files\\OpenAI\\codex.cmd");
        return {
          command: "node.exe",
          argsPrefix: ["C:\\Program Files\\OpenAI\\node_modules\\@openai\\codex\\bin\\codex.js"]
        };
      }
    }
  );

  const prompt = 'say "hello world"';
  const args = runner.buildArgs(prompt);
  runner.spawnChild("C:\\repo with spaces", args);

  assert.equal(calls.length, 1);
  assert.equal(calls[0].command, "node.exe");
  assert.equal(calls[0].args[0], "C:\\Program Files\\OpenAI\\node_modules\\@openai\\codex\\bin\\codex.js");
  assert.equal(calls[0].args.at(-1), prompt);
  assert.equal(calls[0].options.cwd, "C:\\repo with spaces");
  assert.equal("shell" in calls[0].options, false);
});

test("spawnChild refuses unresolved Windows .cmd shims instead of trying a direct spawn", () => {
  const runner = new CodexRunner(
    {
      codexExecutable: "C:\\Custom\\codex.cmd",
      codexFullAuto: false,
      codexSandbox: "",
      codexModel: "",
      codexReasoningEffort: ""
    },
    {
      platform: "win32",
      spawnImpl() {
        throw new Error("should not reach spawn");
      },
      resolveWindowsCodexNodeEntry() {
        return null;
      }
    }
  );

  assert.throws(() => runner.spawnChild("C:\\repo", runner.buildArgs("inspect")), /could not be resolved safely/i);
});

test("startRun debug logging records prompt metadata without raw args or previews", async () => {
  const logs = [];
  const child = createChild();
  const runner = new CodexRunner(
    {
      codexExecutable: "codex",
      codexFullAuto: false,
      codexSandbox: "",
      codexModel: "",
      codexReasoningEffort: ""
    },
    {
      spawnImpl() {
        return child;
      },
      debugLogger: {
        log(type, fields) {
          logs.push({ type, fields });
        }
      }
    }
  );

  const runHandle = runner.startRun({ cwd: "/repo", prompt: "secret prompt text" });
  child.stdout.end();
  child.emit("exit", 0, null);
  await runHandle.promise;

  const started = logs.find((entry) => entry.type === "codex.run.started");
  assert.ok(started);
  assert.equal(started.fields.promptLength, 18);
  assert.match(started.fields.promptSha256, /^[a-f0-9]{64}$/);
  assert.equal("promptPreview" in started.fields, false);
  assert.equal("args" in started.fields, false);
});
