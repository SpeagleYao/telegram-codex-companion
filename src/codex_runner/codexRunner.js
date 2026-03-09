import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { summarizeText } from "../logging/debugLogger.js";

function extractMessageText(item) {
  if (!item || typeof item !== "object") {
    return "";
  }

  if (typeof item.text === "string") {
    return item.text;
  }

  if (Array.isArray(item.content)) {
    return item.content
      .map((entry) => {
        if (!entry || typeof entry !== "object") {
          return "";
        }
        if (typeof entry.text === "string") {
          return entry.text;
        }
        if (typeof entry.value === "string") {
          return entry.value;
        }
        return "";
      })
      .filter(Boolean)
      .join("\n\n");
  }

  return "";
}

function quoteForShell(value) {
  if (value === "") {
    return '""';
  }

  if (!/[\s"]/u.test(value)) {
    return value;
  }

  return `"${value.replace(/([\\"])/gu, "\\$1")}"`;
}

function normalizeExecutable(executable) {
  if (
    process.platform === "win32" &&
    /\\WindowsApps\\/iu.test(executable) &&
    path.basename(executable).toLowerCase() === "codex.exe"
  ) {
    return "codex";
  }

  return executable;
}

export function resolveWindowsCodexNodeEntry(
  executable,
  {
    platform = process.platform,
    appData = process.env.APPDATA,
    nodeExecutable = process.execPath,
    exists = fs.existsSync
  } = {}
) {
  if (platform !== "win32") {
    return null;
  }

  const candidates = [];
  const executableText = String(executable || "");
  const lowerExecutable = executableText.toLowerCase();

  if (lowerExecutable.endsWith(".cmd")) {
    candidates.push(path.join(path.dirname(executableText), "node_modules", "@openai", "codex", "bin", "codex.js"));
  }

  if (lowerExecutable === "codex" || /\\windowsapps\\/iu.test(executableText)) {
    if (appData) {
      candidates.push(path.join(appData, "npm", "node_modules", "@openai", "codex", "bin", "codex.js"));
    }
  }

  for (const candidate of candidates) {
    if (exists(candidate)) {
      return {
        command: nodeExecutable,
        argsPrefix: [candidate]
      };
    }
  }

  return null;
}

export class CodexRunner {
  constructor(config, options = {}) {
    this.config = config;
    this.spawnImpl = options.spawnImpl ?? spawn;
    this.debugLogger = options.debugLogger ?? null;
  }

  buildArgs(prompt, resumeSessionId = null) {
    const args = ["exec", "--json", "--skip-git-repo-check"];

    if (this.config.codexFullAuto) {
      args.push("--full-auto");
    }

    if (this.config.codexSandbox) {
      args.push("--sandbox", this.config.codexSandbox);
    }

    if (this.config.codexModel) {
      args.push("--model", this.config.codexModel);
    }

    if (this.config.codexReasoningEffort) {
      args.push("--config", "model_reasoning_effort=" + this.config.codexReasoningEffort);
    }

    if (resumeSessionId) {
      args.push("resume", resumeSessionId, prompt);
    } else {
      args.push(prompt);
    }

    return args;
  }

  spawnChild(cwd, args) {
    const executable = normalizeExecutable(this.config.codexExecutable);
    const nodeEntry = resolveWindowsCodexNodeEntry(executable);

    if (nodeEntry) {
      return {
        child: this.spawnImpl(nodeEntry.command, [...nodeEntry.argsPrefix, ...args], {
          cwd,
          env: process.env,
          windowsHide: true
        }),
        launchMode: "node_entry",
        command: nodeEntry.command,
        args: [...nodeEntry.argsPrefix, ...args]
      };
    }

    if (process.platform === "win32") {
      const command = [executable, ...args].map(quoteForShell).join(" ");
      return {
        child: this.spawnImpl(command, {
          cwd,
          env: process.env,
          windowsHide: true,
          shell: true
        }),
        launchMode: "shell_command",
        command,
        args: []
      };
    }

    return {
      child: this.spawnImpl(executable, args, {
        cwd,
        env: process.env,
        windowsHide: true
      }),
      launchMode: "direct",
      command: executable,
      args
    };
  }

  startRun({ cwd, prompt, resumeSessionId = null, onThreadId = null, onEvent = null }) {
    const args = this.buildArgs(prompt, resumeSessionId);
    const spawnResult = this.spawnChild(cwd, args);
    const child = spawnResult.child;

    this.debugLogger?.log("codex.run.started", {
      cwd,
      resumeSessionId,
      pid: child.pid ?? null,
      promptLength: prompt.length,
      promptPreview: summarizeText(prompt),
      launchMode: spawnResult.launchMode,
      command: spawnResult.command,
      args: spawnResult.args,
      argsLength: args.join(" ").length
    });

    let threadId = resumeSessionId;
    let stdoutText = "";
    let stderrText = "";
    const agentMessages = [];
    const errors = [];
    let onThreadIdCalled = false;

    const notifyThreadId = (value) => {
      if (value && onThreadId && !onThreadIdCalled) {
        onThreadIdCalled = true;
        onThreadId(value);
      }
    };

    const notifyEvent = (event) => {
      if (onEvent) {
        onEvent(event);
      }
    };

    const stdoutReader = readline.createInterface({ input: child.stdout });
    stdoutReader.on("line", (line) => {
      stdoutText += `${line}\n`;
      let parsed;
      try {
        parsed = JSON.parse(line);
      } catch {
        return;
      }

      notifyEvent(parsed);

      if (parsed?.type === "thread.started" && parsed.thread_id) {
        threadId = parsed.thread_id;
        this.debugLogger?.log("codex.thread.started", { threadId, pid: child.pid ?? null });
        notifyThreadId(threadId);
        return;
      }

      if (parsed?.type === "item.completed") {
        const item = parsed.item;
        if (item?.type === "agent_message") {
          const text = extractMessageText(item);
          if (text) {
            agentMessages.push(text);
          }
        }
        return;
      }

      if (parsed?.type === "turn.failed") {
        errors.push(parsed.message || "Codex reported a failed turn.");
      }
    });

    child.stderr?.on("data", (chunk) => {
      stderrText += chunk.toString("utf8");
    });

    const promise = new Promise((resolve, reject) => {
      child.on("error", (error) => {
        this.debugLogger?.log("codex.run.error", {
          pid: child.pid ?? null,
          message: error instanceof Error ? error.message : String(error)
        });
        reject(error);
      });

      child.on("exit", (code, signal) => {
        stdoutReader.close();
        const output = agentMessages.filter(Boolean).join("\n\n").trim();
        const stderrSummary = summarizeText(stderrText.trim(), 100);
        const stdoutTail = summarizeText(stdoutText.trim().split(/\r?\n/u).slice(-10).join("\n"), 100);

        if (code === 0) {
          this.debugLogger?.log("codex.run.completed", {
            pid: child.pid ?? null,
            threadId,
            exitCode: code,
            outputLength: output.length,
            outputPreview: summarizeText(output),
            stderrLength: stderrText.trim().length,
            stderrPreview: stderrSummary || null
          });
          resolve({
            threadId,
            output,
            stdout: stdoutText.trim(),
            stderr: stderrText.trim()
          });
          return;
        }

        const reasonParts = [];
        if (signal) {
          reasonParts.push(`stopped by signal ${signal}`);
        }
        if (errors.length > 0) {
          reasonParts.push(errors.join("\n"));
        }
        if (stderrText.trim()) {
          reasonParts.push(stderrText.trim());
        }
        if (!reasonParts.length && stdoutText.trim()) {
          reasonParts.push(stdoutText.trim().split(/\r?\n/u).slice(-10).join("\n"));
        }

        const reason = reasonParts.filter(Boolean).join("\n\n") || `Codex exited with code ${code}`;
        this.debugLogger?.log("codex.run.failed", {
          pid: child.pid ?? null,
          threadId,
          exitCode: code,
          signal,
          reasonPreview: summarizeText(reason),
          stderrLength: stderrText.trim().length,
          stderrPreview: stderrSummary || null,
          stdoutTail: stdoutTail || null
        });
        const error = new Error(reason);
        error.threadId = threadId;
        reject(error);
      });
    });

    notifyThreadId(threadId);

    return {
      pid: child.pid ?? null,
      stop() {
        if (!child.killed) {
          child.kill("SIGTERM");
        }
      },
      promise
    };
  }
}
