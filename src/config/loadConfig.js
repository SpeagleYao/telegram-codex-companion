import fs from "node:fs";
import path from "node:path";

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return {};
  }

  const values = {};
  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/u);

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const separatorIndex = line.indexOf("=");
    if (separatorIndex <= 0) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    let value = line.slice(separatorIndex + 1).trim();

    if (
      (value.startsWith("\"") && value.endsWith("\"")) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    values[key] = value;
  }

  return values;
}

function resolveValue(name, fileValues) {
  if (process.env[name] !== undefined) {
    return process.env[name];
  }
  return fileValues[name];
}

function parseRequiredString(name, fileValues) {
  const value = resolveValue(name, fileValues);
  if (!value) {
    throw new Error(`Missing required config: ${name}`);
  }
  return value;
}

function parseIntValue(name, fileValues, defaultValue) {
  const value = resolveValue(name, fileValues);
  if (value === undefined || value === "") {
    return defaultValue;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid integer config for ${name}`);
  }
  return parsed;
}

function parseBooleanValue(name, fileValues, defaultValue) {
  const value = resolveValue(name, fileValues);
  if (value === undefined || value === "") {
    return defaultValue;
  }

  if (["1", "true", "yes", "on"].includes(value.toLowerCase())) {
    return true;
  }

  if (["0", "false", "no", "off"].includes(value.toLowerCase())) {
    return false;
  }

  throw new Error(`Invalid boolean config for ${name}`);
}

function parseUserIds(fileValues) {
  const value = parseRequiredString("ALLOWED_USER_IDS", fileValues);
  const ids = value
    .split(",")
    .map((part) => Number.parseInt(part.trim(), 10))
    .filter((part) => Number.isFinite(part));

  if (ids.length === 0) {
    throw new Error("ALLOWED_USER_IDS must contain at least one numeric Telegram user id");
  }

  return new Set(ids);
}

function resolvePathValue(name, fileValues, defaultRelativePath) {
  const rawValue = resolveValue(name, fileValues) ?? defaultRelativePath;
  return path.resolve(process.cwd(), rawValue);
}

function resolveOptionalPathValue(name, fileValues) {
  const rawValue = resolveValue(name, fileValues);
  if (rawValue === undefined || rawValue === "") {
    return null;
  }
  return path.resolve(process.cwd(), rawValue);
}

export function loadConfig() {
  const fileValues = parseEnvFile(path.resolve(process.cwd(), ".env"));

  return {
    telegramBotToken: parseRequiredString("TELEGRAM_BOT_TOKEN", fileValues),
    allowedUserIds: parseUserIds(fileValues),
    projectsStoragePath: resolvePathValue(
      "PROJECTS_STORAGE_PATH",
      fileValues,
      "./data/projects.sqlite"
    ),
    stateStoragePath: resolvePathValue(
      "STATE_STORAGE_PATH",
      fileValues,
      "./data/state.sqlite"
    ),
    codexExecutable: resolveValue("CODEX_EXECUTABLE", fileValues) || "codex",
    codexFullAuto: parseBooleanValue("CODEX_FULL_AUTO", fileValues, true),
    codexSandbox: resolveValue("CODEX_SANDBOX", fileValues) || "",
    codexModel: resolveValue("CODEX_MODEL", fileValues) || "",
    codexReasoningEffort: resolveValue("CODEX_REASONING_EFFORT", fileValues) || "",
    defaultProjectRoot: resolveOptionalPathValue("DEFAULT_PROJECT_ROOT", fileValues),
    debugLogEnabled: parseBooleanValue("DEBUG_LOG_ENABLED", fileValues, true),
    debugLogPath: resolvePathValue("DEBUG_LOG_PATH", fileValues, "./logs/bot-debug.jsonl"),
    defaultReplyChunkSize: parseIntValue("DEFAULT_REPLY_CHUNK_SIZE", fileValues, 3500),
    pollTimeoutSeconds: parseIntValue("POLL_TIMEOUT_SECONDS", fileValues, 20),
    pollRetryDelayMs: parseIntValue("POLL_RETRY_DELAY_MS", fileValues, 3000)
  };
}
