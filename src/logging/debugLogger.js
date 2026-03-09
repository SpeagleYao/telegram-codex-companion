import fs from "node:fs";
import path from "node:path";

export function summarizeText(text, maxPreviewLength = 120) {
  const normalized = String(text || "").replace(/\s+/gu, " ").trim();
  if (normalized.length <= maxPreviewLength * 2 + 5) {
    return normalized;
  }
  return `${normalized.slice(0, maxPreviewLength)} ... ${normalized.slice(-maxPreviewLength)}`;
}

export class DebugLogger {
  constructor({ enabled = true, filePath }) {
    this.enabled = enabled;
    this.filePath = filePath;

    if (this.enabled && this.filePath) {
      fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
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
