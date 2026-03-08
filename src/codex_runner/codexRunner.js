import { spawn } from "node:child_process";
import path from "node:path";
import readline from "node:readline";

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

export class CodexRunner {
  constructor(config, options = {}) {
    this.config = config;
    this.spawnImpl = options.spawnImpl ?? spawn;
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

    if (resumeSessionId) {
      args.push("resume", resumeSessionId, prompt);
    } else {
      args.push(prompt);
    }

    return args;
  }

  spawnChild(cwd, args) {
    const executable = normalizeExecutable(this.config.codexExecutable);

    if (process.platform === "win32") {
      const command = [executable, ...args].map(quoteForShell).join(" ");
      return this.spawnImpl(command, {
        cwd,
        env: process.env,
        windowsHide: true,
        shell: true
      });
    }

    return this.spawnImpl(executable, args, {
      cwd,
      env: process.env,
      windowsHide: true
    });
  }

  startRun({ cwd, prompt, resumeSessionId = null, onThreadId = null, onEvent = null }) {
    const args = this.buildArgs(prompt, resumeSessionId);
    const child = this.spawnChild(cwd, args);

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
        reject(error);
      });

      child.on("exit", (code, signal) => {
        stdoutReader.close();
        const output = agentMessages.filter(Boolean).join("\n\n").trim();

        if (code === 0) {
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
