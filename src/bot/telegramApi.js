export class TelegramApi {
  constructor(botToken, options = {}) {
    this.botToken = botToken;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.baseUrl = `https://api.telegram.org/bot${botToken}`;
  }

  async call(method, payload = {}) {
    const response = await this.fetchImpl(`${this.baseUrl}/${method}`, {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const body = await response.json().catch(() => null);

    if (!response.ok) {
      const description = body?.description ? `: ${body.description}` : "";
      throw new Error(`Telegram API ${method} failed with HTTP ${response.status}${description}`);
    }

    if (!body?.ok) {
      throw new Error(body?.description || `Telegram API ${method} failed`);
    }

    return body.result;
  }

  getUpdates({ offset = null, timeout = 20 }) {
    return this.call("getUpdates", {
      offset,
      timeout,
      allowed_updates: ["message"]
    });
  }

  sendMessage(chatId, text, options = {}) {
    return this.call("sendMessage", {
      chat_id: chatId,
      text,
      disable_web_page_preview: true,
      ...options
    });
  }

  editMessageText(chatId, messageId, text, options = {}) {
    return this.call("editMessageText", {
      chat_id: chatId,
      message_id: messageId,
      text,
      disable_web_page_preview: true,
      ...options
    });
  }
}
