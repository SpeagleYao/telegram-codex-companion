import test from "node:test";
import assert from "node:assert/strict";

import { TelegramApi } from "../src/bot/telegramApi.js";

test("TelegramApi sends payloads and returns result bodies", async () => {
  const calls = [];
  const api = new TelegramApi("bot-token", {
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return {
        ok: true,
        async json() {
          return {
            ok: true,
            result: { message_id: 77 }
          };
        }
      };
    }
  });

  const result = await api.sendMessage(123, "hello", { reply_markup: { keyboard: [] } });

  assert.equal(result.message_id, 77);
  assert.equal(calls.length, 1);
  assert.match(calls[0].url, /sendMessage$/);
  const payload = JSON.parse(calls[0].options.body);
  assert.equal(payload.chat_id, 123);
  assert.equal(payload.text, "hello");
  assert.deepEqual(payload.reply_markup, { keyboard: [] });
});

test("TelegramApi surfaces HTTP failures", async () => {
  const api = new TelegramApi("bot-token", {
    fetchImpl: async () => ({
      ok: false,
      status: 500,
      async json() {
        return {};
      }
    })
  });

  await assert.rejects(() => api.getUpdates({ offset: 1, timeout: 2 }), /Telegram API getUpdates failed with HTTP 500/);
});

test("TelegramApi surfaces Telegram error bodies", async () => {
  const api = new TelegramApi("bot-token", {
    fetchImpl: async () => ({
      ok: true,
      async json() {
        return {
          ok: false,
          description: "chat not found"
        };
      }
    })
  });

  await assert.rejects(() => api.editMessageText(1, 2, "oops"), /chat not found/);
});
