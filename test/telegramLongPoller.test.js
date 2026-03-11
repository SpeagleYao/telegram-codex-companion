import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";

import { TelegramLongPoller } from "../src/bot/telegramLongPoller.js";
import { TelegramCompanionService } from "../src/bot/telegramCompanionService.js";
import { CompanionStateStore } from "../src/state/store.js";

class NoopRunner {
  startRun() {
    throw new Error("runner should not be used in this test");
  }
}

function createStore(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "telegram-codex-poller-"));
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

test("failed updates are retried before the poller advances the stored offset", async () => {
  const handled = [];
  const storedOffsets = [];
  let poller;
  let firstAttempt = true;
  let updateCalls = 0;

  const store = {
    getUpdateOffset() {
      return null;
    },
    setUpdateOffset(offset) {
      storedOffsets.push(offset);
    }
  };

  const service = {
    async handleUpdate(update) {
      handled.push(update.update_id);
      if (update.update_id === 1 && firstAttempt) {
        firstAttempt = false;
        throw new Error("boom");
      }
      if (update.update_id === 1 && !firstAttempt) {
        await poller.stop();
      }
    }
  };

  const telegramApi = {
    async getUpdates({ offset }) {
      updateCalls += 1;
      if (updateCalls === 1) {
        assert.equal(offset, null);
      }
      if (updateCalls === 2) {
        assert.equal(offset, null);
      }
      return [
        { update_id: 1, message: { text: "hello" } },
        { update_id: 2, message: { text: "world" } }
      ];
    }
  };

  poller = new TelegramLongPoller({
    config: { pollTimeoutSeconds: 1, pollRetryDelayMs: 0 },
    store,
    telegramApi,
    service
  });

  await poller.start();

  assert.deepEqual(handled, [1, 1]);
  assert.deepEqual(storedOffsets, [2]);
});

test("poller advances offset after a post-commit reply failure without replaying side effects", async (t) => {
  const { store, root } = createStore(t);
  const projectPath = path.join(root, "demo-project");
  fs.mkdirSync(projectPath, { recursive: true });

  let poller;
  let updateCalls = 0;
  let serviceCalls = 0;
  let sendAttempts = 0;

  const telegramApi = {
    async getUpdates({ offset }) {
      updateCalls += 1;
      if (updateCalls === 1) {
        assert.equal(offset, null);
        return [
          {
            update_id: 1,
            message: {
              message_id: 1,
              text: `/project add demo ${projectPath}`,
              from: { id: 111 },
              chat: { id: 500, type: "private" }
            }
          }
        ];
      }

      assert.equal(offset, 2);
      await poller.stop();
      return [];
    },
    async sendMessage() {
      sendAttempts += 1;
      throw new Error("temporary send failure");
    },
    async editMessageText() {
      throw new Error("unexpected edit");
    }
  };

  const service = new TelegramCompanionService({
    config: {
      allowedUserIds: new Set([111]),
      defaultReplyChunkSize: 400,
      codexModel: "",
      codexSandbox: ""
    },
    store,
    runner: new NoopRunner(),
    telegramApi
  });
  const realHandleUpdate = service.handleUpdate.bind(service);
  service.handleUpdate = async (update) => {
    serviceCalls += 1;
    return realHandleUpdate(update);
  };

  poller = new TelegramLongPoller({
    config: { pollTimeoutSeconds: 1, pollRetryDelayMs: 0 },
    store,
    telegramApi,
    service
  });

  await poller.start();

  assert.equal(serviceCalls, 1);
  assert.equal(sendAttempts, 1);
  assert.ok(store.getProject("demo"));
  assert.equal(store.getProject("demo").cwd, projectPath);
  assert.equal(store.getUpdateOffset(), 2);
});
