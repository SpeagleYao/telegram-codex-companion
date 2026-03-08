function delay(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export class TelegramLongPoller {
  constructor({ config, store, telegramApi, service }) {
    this.config = config;
    this.store = store;
    this.telegramApi = telegramApi;
    this.service = service;
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

        for (const update of updates) {
          if (this.stopped) {
            break;
          }

          try {
            await this.service.handleUpdate(update);
          } catch (error) {
            console.error(error instanceof Error ? error.message : String(error));
          } finally {
            offset = update.update_id + 1;
            this.store.setUpdateOffset(offset);
          }
        }
      } catch (error) {
        console.error(error instanceof Error ? error.message : String(error));
        await delay(this.config.pollRetryDelayMs);
      }
    }
  }

  async stop() {
    this.stopped = true;
  }
}
