import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const UTF8_BOM = "\ufeff";

export function summarizeText(text, maxPreviewLength = 120) {
  const normalized = String(text || "").replace(/\s+/gu, " ").trim();
  if (normalized.length <= maxPreviewLength * 2 + 5) {
    return normalized;
  }
  return `${normalized.slice(0, maxPreviewLength)} ... ${normalized.slice(-maxPreviewLength)}`;
}

export function describeTextForDebug(text, prefix = "text") {
  const value = String(text ?? "");
  const lineCount = value.length === 0 ? 0 : value.split(/\r?\n/u).length;
  const sha256 = crypto.createHash("sha256").update(value, "utf8").digest("hex");

  return {
    [`${prefix}Length`]: value.length,
    [`${prefix}LineCount`]: lineCount,
    [`${prefix}Sha256`]: sha256
  };
}

function ensureUtf8Bom(filePath) {
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, UTF8_BOM, "utf8");
    return;
  }

  const fileBuffer = fs.readFileSync(filePath);
  if (fileBuffer.length === 0) {
    fs.writeFileSync(filePath, UTF8_BOM, "utf8");
    return;
  }

  if (fileBuffer[0] === 0xef && fileBuffer[1] === 0xbb && fileBuffer[2] === 0xbf) {
    return;
  }

  fs.writeFileSync(filePath, Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), fileBuffer]));
}

export class DebugLogger {
  constructor({ enabled = true, filePath }) {
    this.enabled = enabled;
    this.filePath = filePath;

    if (this.enabled && this.filePath) {
      fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
      ensureUtf8Bom(this.filePath);
    }
  }

  log(type, fields = {}) {
    if (!this.enabled || !this.filePath) {
      return;
    }

    const entry = {
      timestamp: new Date().toISOString(),
      type,
      ...fields
    };

    fs.appendFileSync(this.filePath, JSON.stringify(entry) + "\n", "utf8");
  }
}
