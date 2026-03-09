import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";

import { TelegramCompanionService } from "../src/bot/telegramCompanionService.js";
import { CompanionStateStore } from "../src/state/store.js";

class FakeTelegramApi {
  constructor(options = {}) {
    this.messages = [];
    this.edits = [];
    this.failEdit = options.failEdit ?? false;
  }

  async sendMessage(chatId, text, options = {}) {
    const message = { chatId, text, options, message_id: this.messages.length + 1 };
    this.messages.push(message);
    return { ok: true, message_id: message.message_id };
  }

  async editMessageText(chatId, messageId, text, options = {}) {
    this.edits.push({ chatId, messageId, text, options });
    if (this.failEdit) {
      throw new Error("edit failed");
    }
    return { ok: true };
  }
}

class FakeRunner {
  constructor() {
    this.calls = [];
    this.results = [];
  }

  enqueue(result) {
    this.results.push(result);
  }

  startRun(args) {
    this.calls.push(args);
    const next = this.results.shift() ?? { threadId: "thread-default", output: "ok", pid: 9000, events: [] };
    queueMicrotask(() => {
      if (next.threadId && args.onThreadId) {
        args.onThreadId(next.threadId);
      }
      for (const event of next.events ?? []) {
        args.onEvent?.(event);
      }
    });

    return {
      pid: next.pid ?? 9000,
      stop() {
        if (next.onStop) {
          next.onStop();
        }
      },
      promise: Promise.resolve().then(() => {
        if (next.error) {
          throw next.error;
        }
        return {
          threadId: next.threadId ?? null,
          output: next.output ?? ""
        };
      })
    };
  }
}

function createConfig(overrides = {}) {
  return {
    allowedUserIds: new Set([111]),
    defaultReplyChunkSize: 400,
    codexModel: "",
    codexSandbox: "",
    ...overrides
  };
}

function createUpdate(userId, chatId, text, type = "private") {
  return {
    update_id: Date.now(),
    message: {
      message_id: 1,
      text,
      from: { id: userId },
      chat: { id: chatId, type }
    }
  };
}

async function flush() {
  await new Promise((resolve) => setImmediate(resolve));
  await new Promise((resolve) => setImmediate(resolve));
}

function createStore(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "telegram-codex-companion-"));
  const store = new CompanionStateStore({
    projectsDbPath: path.join(root, "projects.sqlite"),
    stateDbPath: path.join(root, "state.sqlite")
  });
  t.after(() => {
    store.close();
    fs.rmSync(root, { recursive: true, force: true });
  });
  return { store, root };
}

test("rejects unauthorized users", async (t) => {
  const { store } = createStore(t);
  const telegramApi = new FakeTelegramApi();
  const runner = new FakeRunner();
  const service = new TelegramCompanionService({
    config: createConfig(),
    store,
    runner,
    telegramApi
  });

  await service.handleUpdate(createUpdate(222, 500, "/start"));

  assert.equal(telegramApi.messages.at(-1).text, "Unauthorized Telegram user.");
});

test("adds a project and sets it as current for the first user", async (t) => {
  const { store, root } = createStore(t);
  const projectPath = path.join(root, "demo-project");
  fs.mkdirSync(projectPath, { recursive: true });

  const telegramApi = new FakeTelegramApi();
  const runner = new FakeRunner();
  const service = new TelegramCompanionService({
    config: createConfig(),
    store,
    runner,
    telegramApi
  });

  await service.handleUpdate(createUpdate(111, 500, `/project add demo ${projectPath}`));
  await service.handleUpdate(createUpdate(111, 500, "/project current"));

  const currentProject = store.getProject("demo");
  const binding = store.getUserBinding(111);
  assert.equal(currentProject.name, "demo");
  assert.equal(binding.currentProjectName, "demo");
  assert.match(telegramApi.messages.at(-1).text, /Current project: demo/);
});

test("creates a new session, streams progress, and resumes it on the next prompt", async (t) => {
  const { store, root } = createStore(t);
  const projectPath = path.join(root, "demo-project");
  fs.mkdirSync(projectPath, { recursive: true });

  const telegramApi = new FakeTelegramApi();
  const runner = new FakeRunner();
  runner.enqueue({
    threadId: "thread-1",
    output: "First answer",
    pid: 1111,
    events: [
      { type: "thread.started", thread_id: "thread-1" },
      { type: "item.started", item: { type: "exec_command" } },
      { type: "item.completed", item: { type: "agent_message" } }
    ]
  });
  runner.enqueue({ threadId: "thread-1", output: "Second answer", pid: 2222 });

  const service = new TelegramCompanionService({
    config: createConfig(),
    store,
    runner,
    telegramApi
  });

  await service.handleUpdate(createUpdate(111, 500, `/project add demo ${projectPath}`));
  await service.handleUpdate(createUpdate(111, 500, "/new"));
  await service.handleUpdate(createUpdate(111, 500, "fix the bug in this repo"));
  await flush();

  assert.equal(telegramApi.messages.find((entry) => entry.text.includes("Starting a new session in demo...")).options.reply_markup, undefined);

  const firstSession = store.listSessionsForProject("demo")[0];
  assert.equal(runner.calls[0].resumeSessionId, null);
  assert.equal(firstSession.codexSessionId, "thread-1");
  assert.equal(store.getUserBinding(111).activeSessionId, firstSession.id);
  assert.ok(telegramApi.edits.length > 0);
  assert.deepEqual(telegramApi.edits[0].options, {});

  await service.handleUpdate(createUpdate(111, 500, "now add tests"));
  await flush();

  assert.equal(runner.calls[1].resumeSessionId, "thread-1");
  assert.equal(store.getUserBinding(111).activeSessionId, firstSession.id);
  assert.equal(store.getSessionById(firstSession.id).status, "idle");
  assert.ok(telegramApi.messages.some((entry) => entry.text.includes("First answer")));
  assert.ok(telegramApi.messages.some((entry) => entry.text.includes("Second answer")));
});

test("renames the active session", async (t) => {
  const { store, root } = createStore(t);
  const projectPath = path.join(root, "demo-project");
  fs.mkdirSync(projectPath, { recursive: true });

  const telegramApi = new FakeTelegramApi();
  const runner = new FakeRunner();
  runner.enqueue({ threadId: "thread-rename", output: "Answer", pid: 1111 });

  const service = new TelegramCompanionService({
    config: createConfig(),
    store,
    runner,
    telegramApi
  });

  await service.handleUpdate(createUpdate(111, 500, `/project add demo ${projectPath}`));
  await service.handleUpdate(createUpdate(111, 500, "start a session"));
  await flush();
  await service.handleUpdate(createUpdate(111, 500, "/rename bugfix investigation"));

  const session = store.listSessionsForProject("demo")[0];
  assert.equal(session.title, "bugfix investigation");
});

test("recovery clears dead detached runs and marks sessions interrupted", async (t) => {
  const { store, root } = createStore(t);
  const projectPath = path.join(root, "demo-project");
  fs.mkdirSync(projectPath, { recursive: true });

  store.addProject({ name: "demo", cwd: projectPath });
  store.ensureUserBinding(111);
  const session = store.createSession({
    codexSessionId: "thread-dead",
    projectName: "demo",
    title: "old run",
    status: "running"
  });
  store.setActiveSession(111, session.id);
  store.setRunState(111, {
    runningSessionId: session.id,
    runningPid: 4242,
    runningProjectName: "demo"
  });

  const telegramApi = new FakeTelegramApi();
  const runner = new FakeRunner();
  const service = new TelegramCompanionService({
    config: createConfig(),
    store,
    runner,
    telegramApi,
    processUtils: {
      isPidAlive() {
        return false;
      },
      killPid() {}
    }
  });

  await service.recoverRunningState();

  const binding = store.getUserBinding(111);
  assert.equal(binding.runningPid, null);
  assert.equal(store.getSessionById(session.id).status, "interrupted");
});

test("status reports detached run metadata", async (t) => {
  const { store, root } = createStore(t);
  const projectPath = path.join(root, "demo-project");
  fs.mkdirSync(projectPath, { recursive: true });

  store.addProject({ name: "demo", cwd: projectPath });
  store.ensureUserBinding(111);
  store.setCurrentProject(111, "demo", null);
  store.setRunState(111, {
    runningPid: 4242,
    runningProjectName: "demo",
    runningCwd: projectPath,
    runningModel: "gpt-5.4",
    runningSandbox: "workspace-write",
    runningResumeMode: "fresh",
    runningStartedAt: new Date(Date.now() - 60000).toISOString(),
    runningLastEventText: "Thinking...",
    runningLastEventAt: new Date(Date.now() - 5000).toISOString()
  });

  const telegramApi = new FakeTelegramApi();
  const runner = new FakeRunner();
  const service = new TelegramCompanionService({
    config: createConfig(),
    store,
    runner,
    telegramApi,
    processUtils: {
      isPidAlive() {
        return true;
      },
      killPid() {}
    }
  });

  const beforeCount = telegramApi.messages.length;
  await service.handleUpdate(createUpdate(111, 500, "/status"));

  const statusText = telegramApi.messages.slice(beforeCount).map((entry) => entry.text).join("\n");
  assert.match(statusText, /Model: gpt-5.4/);
  assert.match(statusText, /Sandbox: workspace-write/);
  assert.match(statusText, /^Started: \d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/m);
  assert.match(statusText, /Last progress: Thinking\.\.\./);
  assert.match(statusText, /^Last progress at: \d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/m);
});

test("refuses new prompts while a detached run is still alive", async (t) => {
  const { store, root } = createStore(t);
  const projectPath = path.join(root, "demo-project");
  fs.mkdirSync(projectPath, { recursive: true });

  store.addProject({ name: "demo", cwd: projectPath });
  store.ensureUserBinding(111);
  store.setCurrentProject(111, "demo", null);
  store.setRunState(111, {
    runningPid: 4242,
    runningProjectName: "demo"
  });

  const telegramApi = new FakeTelegramApi();
  const runner = new FakeRunner();
  const service = new TelegramCompanionService({
    config: createConfig(),
    store,
    runner,
    telegramApi,
    processUtils: {
      isPidAlive() {
        return true;
      },
      killPid() {}
    }
  });

  await service.handleUpdate(createUpdate(111, 500, "please continue"));

  assert.equal(runner.calls.length, 0);
  assert.match(telegramApi.messages.at(-1).text, /detached Codex run is still marked active/);
});

test("classifies Codex launch failures for user-facing replies", async (t) => {
  const { store, root } = createStore(t);
  const projectPath = path.join(root, "demo-project");
  fs.mkdirSync(projectPath, { recursive: true });

  const telegramApi = new FakeTelegramApi();
  const runner = new FakeRunner();
  runner.enqueue({
    error: new Error("spawn codex ENOENT")
  });

  const service = new TelegramCompanionService({
    config: createConfig(),
    store,
    runner,
    telegramApi
  });

  await service.handleUpdate(createUpdate(111, 500, `/project add demo ${projectPath}`));
  await service.handleUpdate(createUpdate(111, 500, "debug this repo"));
  await flush();

  const combined = telegramApi.messages.map((entry) => entry.text).join("\n");
  assert.match(combined, /Codex CLI could not be launched/);
  assert.match(combined, /CODEX_EXECUTABLE/);
});

test("refuses prompts when the current project path no longer exists", async (t) => {
  const { store, root } = createStore(t);
  const projectPath = path.join(root, "missing-project");
  fs.mkdirSync(projectPath, { recursive: true });

  const telegramApi = new FakeTelegramApi();
  const runner = new FakeRunner();
  const service = new TelegramCompanionService({
    config: createConfig(),
    store,
    runner,
    telegramApi
  });

  await service.handleUpdate(createUpdate(111, 500, `/project add demo ${projectPath}`));
  fs.rmSync(projectPath, { recursive: true, force: true });
  await service.handleUpdate(createUpdate(111, 500, "please continue"));

  assert.match(telegramApi.messages.at(-1).text, /Project path no longer exists/);
  assert.equal(runner.calls.length, 0);
});

test("splits long replies into multiple Telegram messages", async (t) => {
  const { store, root } = createStore(t);
  const projectPath = path.join(root, "demo-project");
  fs.mkdirSync(projectPath, { recursive: true });

  const telegramApi = new FakeTelegramApi();
  const runner = new FakeRunner();
  runner.enqueue({
    threadId: "thread-99",
    output: "one two three four five six seven eight nine ten eleven twelve thirteen fourteen"
  });

  const service = new TelegramCompanionService({
    config: createConfig({ defaultReplyChunkSize: 40 }),
    store,
    runner,
    telegramApi
  });

  await service.handleUpdate(createUpdate(111, 500, `/project add demo ${projectPath}`));
  await service.handleUpdate(createUpdate(111, 500, "long answer please"));
  await flush();

  const answerChunks = telegramApi.messages.filter((entry) => entry.text.includes("one two") || entry.text.includes("eleven") || entry.text.includes("fourteen"));
  assert.ok(answerChunks.length >= 2);
});

test("merges back-to-back long Telegram prompt fragments before starting Codex", async (t) => {
  const { store, root } = createStore(t);
  const projectPath = path.join(root, "demo-project");
  fs.mkdirSync(projectPath, { recursive: true });

  const telegramApi = new FakeTelegramApi();
  const runner = new FakeRunner();
  runner.enqueue({
    threadId: "thread-merged",
    output: "Merged answer"
  });

  const service = new TelegramCompanionService({
    config: createConfig(),
    store,
    runner,
    telegramApi
  });

  await service.handleUpdate(createUpdate(111, 500, `/project add demo ${projectPath}`));

  const firstPart = "a".repeat(3600);
  const secondPart = "b".repeat(300);
  await service.handleUpdate(createUpdate(111, 500, firstPart));
  await service.handleUpdate(createUpdate(111, 500, secondPart));
  await new Promise((resolve) => setTimeout(resolve, 1700));
  await flush();

  assert.equal(runner.calls.length, 1);
  assert.equal(runner.calls[0].prompt, firstPart + secondPart);
  assert.ok(telegramApi.messages.some((entry) => entry.text.includes("Merged answer")));
});

test("start and projects attach a mobile-friendly reply keyboard", async (t) => {
  const { store, root } = createStore(t);
  const projectPath = path.join(root, "demo-project");
  fs.mkdirSync(projectPath, { recursive: true });

  const telegramApi = new FakeTelegramApi();
  const runner = new FakeRunner();
  const service = new TelegramCompanionService({
    config: createConfig(),
    store,
    runner,
    telegramApi
  });

  await service.handleUpdate(createUpdate(111, 500, "/start"));
  await service.handleUpdate(createUpdate(111, 500, `/project add demo ${projectPath}`));
  await service.handleUpdate(createUpdate(111, 500, "/projects"));

  const projectsReply = telegramApi.messages.at(-1);
  const keyboard = projectsReply.options.reply_markup.keyboard.flat().map((button) => button.text);

  assert.ok(keyboard.includes("/project use demo"));
  assert.ok(keyboard.includes("/new"));
  assert.ok(keyboard.includes("/status"));
});

test("help command returns the detailed help text and keyboard", async (t) => {
  const { store } = createStore(t);
  const telegramApi = new FakeTelegramApi();
  const runner = new FakeRunner();
  const service = new TelegramCompanionService({
    config: createConfig(),
    store,
    runner,
    telegramApi
  });

  await service.handleUpdate(createUpdate(111, 500, "/help"));

  const combinedText = telegramApi.messages.map((message) => message.text).join("\n");
  assert.match(combinedText, /Project commands/);
  assert.match(combinedText, /\/help - show this help/);
  const firstReply = telegramApi.messages[0];
  const keyboard = firstReply.options.reply_markup.keyboard.flat().map((button) => button.text);
  assert.ok(keyboard.includes("/help"));
});

test("falls back to sending progress messages when Telegram edits fail", async (t) => {
  const { store, root } = createStore(t);
  const projectPath = path.join(root, "demo-project");
  fs.mkdirSync(projectPath, { recursive: true });

  const telegramApi = new FakeTelegramApi({ failEdit: true });
  const runner = new FakeRunner();
  runner.enqueue({
    threadId: "thread-fallback",
    output: "Answer",
    pid: 1111,
    events: [
      { type: "thread.started", thread_id: "thread-fallback" },
      { type: "item.started", item: { type: "exec_command" } }
    ]
  });

  const service = new TelegramCompanionService({
    config: createConfig(),
    store,
    runner,
    telegramApi
  });

  await service.handleUpdate(createUpdate(111, 500, "/project add demo " + projectPath));
  await service.handleUpdate(createUpdate(111, 500, "debug this repo"));
  await flush();

  assert.ok(telegramApi.edits.length > 0);
  assert.ok(telegramApi.messages.some((entry) => entry.text.includes("Session started. Gathering context")));
  assert.ok(telegramApi.messages.some((entry) => entry.options.reply_markup));
});



