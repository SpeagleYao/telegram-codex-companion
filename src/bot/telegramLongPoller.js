function delay(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export class TelegramLongPoller {
  constructor({ config, store, telegramApi, service, debugLogger = null }) {
    this.config = config;
    this.store = store;
    this.telegramApi = telegramApi;
    this.service = service;
    this.debugLogger = debugLogger;
    this.stopped = false;
  }

  async start() {
    let offset = this.store.getUpdateOffset();

    while (!this.stopped) {
      try {
        const updates = await this.telegramApi.getUpdates({
          offset,
          timeout: this.config.pollTimeoutSeconds
        });

        this.debugLogger?.log("telegram.updates.received", {
          count: updates.length,
          offset
        });

        for (const update of updates) {
          if (this.stopped) {
            break;
          }

          try {
            await this.service.handleUpdate(update);
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.debugLogger?.log("telegram.update.failed", {
              updateId: update.update_id,
              message
            });
            console.error(message);
          } finally {
            offset = update.update_id + 1;
            this.store.setUpdateOffset(offset);
          }
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.debugLogger?.log("telegram.poll.failed", { message });
        console.error(message);
        await delay(this.config.pollRetryDelayMs);
      }
    }
  }

  async stop() {
    this.stopped = true;
  }
}
