import { TelegramLongPoller } from "./bot/telegramLongPoller.js";
import { TelegramApi } from "./bot/telegramApi.js";
import { TelegramCompanionService } from "./bot/telegramCompanionService.js";
import { loadConfig } from "./config/loadConfig.js";
import { CodexRunner } from "./codex_runner/codexRunner.js";
import { CompanionStateStore } from "./state/store.js";

async function main() {
  const config = loadConfig();
  const store = new CompanionStateStore({
    projectsDbPath: config.projectsStoragePath,
    stateDbPath: config.stateStoragePath
  });
  const runner = new CodexRunner(config);
  const telegramApi = new TelegramApi(config.telegramBotToken);
  const service = new TelegramCompanionService({
    config,
    store,
    runner,
    telegramApi
  });
  const poller = new TelegramLongPoller({
    config,
    store,
    telegramApi,
    service
  });

  process.on("SIGINT", async () => {
    await poller.stop();
    process.exit(0);
  });

  process.on("SIGTERM", async () => {
    await poller.stop();
    process.exit(0);
  });

  await service.recoverRunningState();
  console.log("Telegram Codex Companion is starting.");
  await poller.start();
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
