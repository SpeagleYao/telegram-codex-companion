import fs from "node:fs";
import path from "node:path";
import {
  buildHelpText,
  buildMainKeyboard,
  buildProjectsKeyboard,
  buildSessionsKeyboard,
  chunkText,
  formatProjects,
  formatSessions,
  formatStatus
} from "./messageFormatter.js";
import { parseIncomingText } from "./commandParser.js";
import { summarizeText } from "../logging/debugLogger.js";

function isValidProjectName(name) {
  return /^[A-Za-z0-9._-]+$/u.test(name);
}

function buildSessionTitle(prompt) {
  const compact = prompt.replace(/\s+/gu, " ").trim();
  if (compact.length <= 60) {
    return compact;
  }
  return `${compact.slice(0, 57)}...`;
}

function normalizeTitle(title) {
  const compact = title.replace(/\s+/gu, " ").trim();
  if (!compact) {
    return null;
  }
  return compact.slice(0, 120);
}

function formatItemType(itemType) {
  return String(itemType || "work").replace(/_/gu, " ");
}

const LONG_PROMPT_MERGE_MIN_LENGTH = 3500;
const LONG_PROMPT_MERGE_WINDOW_MS = 1500;

function defaultProcessUtils() {
  return {
    isPidAlive(pid) {
      try {
        process.kill(pid, 0);
        return true;
      } catch (error) {
        return error?.code === "EPERM";
      }
    },
    killPid(pid) {
      process.kill(pid, "SIGTERM");
    }
  };
}

export class TelegramCompanionService {
  constructor({ config, store, runner, telegramApi, processUtils = defaultProcessUtils(), debugLogger = null }) {
    this.config = config;
    this.store = store;
    this.runner = runner;
    this.telegramApi = telegramApi;
    this.processUtils = processUtils;
    this.debugLogger = debugLogger;
    this.activeRuns = new Map();
    this.pendingPromptBatches = new Map();
  }

  async recoverRunningState() {
    const bindings = this.store.listBindingsWithRunState();

    for (const binding of bindings) {
      const alive = binding.runningPid ? this.processUtils.isPidAlive(binding.runningPid) : false;
      if (alive) {
        if (binding.runningSessionId) {
          this.store.updateSessionStatus(binding.runningSessionId, "running");
        }
        continue;
      }

      if (binding.runningSessionId) {
        this.store.updateSessionStatus(binding.runningSessionId, "interrupted");
      }
      this.store.clearRunState(binding.telegramUserId);
    }
  }

  async handleUpdate(update) {
    const message = update?.message;
    if (!message?.text || !message.from || !message.chat) {
      return;
    }

    const userId = message.from.id;
    const chatId = message.chat.id;

    this.debugLogger?.log("telegram.message.received", {
      updateId: update.update_id ?? null,
      messageId: message.message_id ?? null,
      userId,
      chatId,
      textLength: message.text.length,
      textPreview: summarizeText(message.text)
    });

    if (!this.config.allowedUserIds.has(userId)) {
      await this.safeSend(chatId, "Unauthorized Telegram user.");
      return;
    }

    if (message.chat.type !== "private") {
      await this.safeSend(chatId, "This bot only accepts private chats.");
      return;
    }

    this.store.ensureUserBinding(userId);

    const parsed = parseIncomingText(message.text);
    this.debugLogger?.log("telegram.message.parsed", {
      userId,
      chatId,
      parsedType: parsed.type,
      command: parsed.command ?? null,
      promptLength: parsed.prompt?.length ?? null
    });

    if (parsed.type === "empty") {
      return;
    }

    if (parsed.type === "prompt") {
      await this.enqueuePrompt({ userId, chatId, prompt: parsed.prompt });
      return;
    }

    await this.flushPendingPrompt(userId);
    await this.handleCommand({ userId, chatId, parsed });
  }

  shouldDelayPrompt(prompt) {
    return prompt.length >= LONG_PROMPT_MERGE_MIN_LENGTH;
  }

  schedulePromptBatchFlush(userId) {
    return setTimeout(() => {
      void this.flushPendingPrompt(userId).catch((error) => {
        const message = error instanceof Error ? error.message : String(error);
        this.debugLogger?.log("telegram.prompt.batch_flush_failed", {
          userId,
          errorPreview: summarizeText(message)
        });
        console.error("Failed to flush pending Telegram prompt: " + message);
      });
    }, LONG_PROMPT_MERGE_WINDOW_MS);
  }

  async enqueuePrompt({ userId, chatId, prompt }) {
    const existingBatch = this.pendingPromptBatches.get(userId);
    this.debugLogger?.log("telegram.prompt.enqueue", {
      userId,
      chatId,
      promptLength: prompt.length,
      promptPreview: summarizeText(prompt),
      delayed: this.shouldDelayPrompt(prompt),
      hasExistingBatch: Boolean(existingBatch)
    });

    if (existingBatch) {
      existingBatch.parts.push(prompt);
      clearTimeout(existingBatch.timer);
      existingBatch.timer = this.schedulePromptBatchFlush(userId);
      this.debugLogger?.log("telegram.prompt.batch_extended", {
        userId,
        chatId,
        batchedParts: existingBatch.parts.length,
        mergedLength: existingBatch.parts.join("").length
      });
      return;
    }

    if (!this.shouldDelayPrompt(prompt)) {
      await this.handlePrompt({ userId, chatId, prompt });
      return;
    }

    const batch = {
      chatId,
      parts: [prompt],
      timer: this.schedulePromptBatchFlush(userId)
    };
    this.pendingPromptBatches.set(userId, batch);
    this.debugLogger?.log("telegram.prompt.batch_started", {
      userId,
      chatId,
      batchedParts: 1,
      mergedLength: prompt.length
    });
  }

  async flushPendingPrompt(userId) {
    const batch = this.pendingPromptBatches.get(userId);
    if (!batch) {
      return;
    }

    this.pendingPromptBatches.delete(userId);
    clearTimeout(batch.timer);
    const mergedPrompt = batch.parts.join("");
    this.debugLogger?.log("telegram.prompt.batch_flushed", {
      userId,
      chatId: batch.chatId,
      batchedParts: batch.parts.length,
      mergedLength: mergedPrompt.length,
      promptPreview: summarizeText(mergedPrompt)
    });
    await this.handlePrompt({
      userId,
      chatId: batch.chatId,
      prompt: mergedPrompt
    });
  }

  async handleCommand({ userId, chatId, parsed }) {
    switch (parsed.command) {
      case "start":
      case "help": {
        const binding = this.store.getUserBinding(userId);
        await this.safeSend(chatId, buildHelpText(), {
          reply_markup: buildMainKeyboard(binding?.currentProjectName ?? null)
        });
        return;
      }
      case "projects": {
        const binding = this.store.getUserBinding(userId);
        const projects = this.store.listProjects();
        await this.safeSend(chatId, formatProjects(projects, binding?.currentProjectName ?? null), {
          reply_markup:
            projects.length > 0
              ? buildProjectsKeyboard(projects)
              : buildMainKeyboard(binding?.currentProjectName ?? null)
        });
        return;
      }
      case "project_add": {
        if (!isValidProjectName(parsed.name)) {
          await this.safeSend(chatId, "Project names can only use letters, numbers, dot, dash, and underscore.");
          return;
        }

        const targetPath = path.resolve(parsed.path);
        if (!fs.existsSync(targetPath) || !fs.statSync(targetPath).isDirectory()) {
          await this.safeSend(chatId, `Path does not exist or is not a directory: ${targetPath}`);
          return;
        }

        if (this.store.getProject(parsed.name)) {
          await this.safeSend(chatId, `Project ${parsed.name} already exists.`);
          return;
        }

        const project = this.store.addProject({ name: parsed.name, cwd: targetPath });
        const binding = this.store.getUserBinding(userId);
        if (!binding?.currentProjectName) {
          this.store.setCurrentProject(userId, project.name, null);
        }

        await this.safeSend(chatId, `Saved project ${project.name} -> ${project.cwd}`, {
          reply_markup: buildMainKeyboard(project.name)
        });
        return;
      }
      case "project_use": {
        const project = this.store.getProject(parsed.name);
        if (!project) {
          await this.safeSend(chatId, `Unknown project: ${parsed.name}`);
          return;
        }

        if (!fs.existsSync(project.cwd)) {
          await this.safeSend(chatId, `Project path no longer exists: ${project.cwd}`);
          return;
        }

        this.store.setCurrentProject(userId, project.name, project.activeSessionId ?? null);
        const text = project.activeSessionId
          ? `Current project: ${project.name}. Restored the latest session.`
          : `Current project: ${project.name}. Use /new and then send a prompt.`;
        await this.safeSend(chatId, text, {
          reply_markup: buildMainKeyboard(project.name)
        });
        return;
      }
      case "project_current": {
        const binding = this.store.getUserBinding(userId);
        const project = binding?.currentProjectName
          ? this.store.getProject(binding.currentProjectName)
          : null;
        await this.safeSend(
          chatId,
          project ? `Current project: ${project.name}\n${project.cwd}` : "No current project selected.",
          {
            reply_markup: buildMainKeyboard(project?.name ?? null)
          }
        );
        return;
      }
      case "project_help": {
        const binding = this.store.getUserBinding(userId);
        await this.safeSend(
          chatId,
          "Use /project add <name> <path>, /project use <name>, or /project current.",
          {
            reply_markup: buildMainKeyboard(binding?.currentProjectName ?? null)
          }
        );
        return;
      }
      case "new": {
        if (this.activeRuns.has(userId)) {
          await this.safeSend(chatId, "A Codex run is already in progress. Use /stop first if needed.");
          return;
        }

        const binding = this.store.getUserBinding(userId);
        if (!binding?.currentProjectName) {
          await this.safeSend(chatId, "Select a project first with /project use <name>.");
          return;
        }

        this.store.clearActiveSession(userId);
        await this.safeSend(chatId, "New session armed. Send the next message to start it.", {
          reply_markup: buildMainKeyboard(binding.currentProjectName)
        });
        return;
      }
      case "sessions": {
        const binding = this.store.getUserBinding(userId);
        if (!binding?.currentProjectName) {
          await this.safeSend(chatId, "Select a project first.");
          return;
        }

        const sessions = this.store.listSessionsForProject(binding.currentProjectName);
        await this.safeSend(chatId, formatSessions(sessions, binding.activeSessionId), {
          reply_markup:
            sessions.length > 0
              ? buildSessionsKeyboard(sessions)
              : buildMainKeyboard(binding.currentProjectName)
        });
        return;
      }
      case "use": {
        if (!Number.isFinite(parsed.index) || parsed.index < 1) {
          await this.safeSend(chatId, "Use /use <n> with the number from /sessions.");
          return;
        }

        const binding = this.store.getUserBinding(userId);
        if (!binding?.currentProjectName) {
          await this.safeSend(chatId, "Select a project first.");
          return;
        }

        const sessions = this.store.listSessionsForProject(binding.currentProjectName);
        const target = sessions[parsed.index - 1];
        if (!target) {
          await this.safeSend(chatId, `Session ${parsed.index} is not available.`);
          return;
        }

        this.store.setActiveSession(userId, target.id);
        await this.safeSend(chatId, `Active session: ${target.title}`, {
          reply_markup: buildMainKeyboard(binding.currentProjectName)
        });
        return;
      }
      case "rename_current": {
        const binding = this.store.getUserBinding(userId);
        if (!binding?.activeSessionId) {
          await this.safeSend(chatId, "No active session selected. Use /sessions or start one first.");
          return;
        }

        const title = normalizeTitle(parsed.title);
        if (!title) {
          await this.safeSend(chatId, "Session title cannot be empty.");
          return;
        }

        const session = this.store.renameSession(binding.activeSessionId, title);
        await this.safeSend(chatId, `Renamed current session to: ${session.title}`, {
          reply_markup: buildMainKeyboard(binding.currentProjectName ?? null)
        });
        return;
      }
      case "rename_index": {
        const binding = this.store.getUserBinding(userId);
        if (!binding?.currentProjectName) {
          await this.safeSend(chatId, "Select a project first.");
          return;
        }

        const title = normalizeTitle(parsed.title);
        if (!title) {
          await this.safeSend(chatId, "Session title cannot be empty.");
          return;
        }

        const sessions = this.store.listSessionsForProject(binding.currentProjectName);
        const target = sessions[parsed.index - 1];
        if (!target) {
          await this.safeSend(chatId, `Session ${parsed.index} is not available.`);
          return;
        }

        const session = this.store.renameSession(target.id, title);
        await this.safeSend(chatId, `Renamed session ${parsed.index} to: ${session.title}`, {
          reply_markup: buildMainKeyboard(binding.currentProjectName)
        });
        return;
      }
      case "rename_help": {
        const binding = this.store.getUserBinding(userId);
        await this.safeSend(chatId, "Use /rename <title> for the active session or /rename <n> <title> for a session from /sessions.", {
          reply_markup: buildMainKeyboard(binding?.currentProjectName ?? null)
        });
        return;
      }
      case "status": {
        const binding = this.store.getUserBinding(userId);
        const project = binding?.currentProjectName
          ? this.store.getProject(binding.currentProjectName)
          : null;
        const session = binding?.activeSessionId ? this.store.getSessionById(binding.activeSessionId) : null;
        const detachedRunning = Boolean(binding?.runningPid) && !this.activeRuns.has(userId);
        await this.safeSend(chatId, formatStatus({ project, session, binding, detachedRunning }), {
          reply_markup: buildMainKeyboard(project?.name ?? null)
        });
        return;
      }
      case "stop": {
        const activeRun = this.activeRuns.get(userId);
        if (activeRun) {
          activeRun.stop();
          const binding = this.store.getUserBinding(userId);
          await this.safeSend(chatId, "Stop requested for the current Codex run.", {
            reply_markup: buildMainKeyboard(binding?.currentProjectName ?? null)
          });
          return;
        }

        const binding = this.store.getUserBinding(userId);
        if (!binding?.runningPid) {
          await this.safeSend(chatId, "No active Codex run.");
          return;
        }

        try {
          this.processUtils.killPid(binding.runningPid);
          if (binding.runningSessionId) {
            this.store.updateSessionStatus(binding.runningSessionId, "interrupted");
          }
          this.store.clearRunState(userId);
          await this.safeSend(chatId, `Stop requested for detached Codex process ${binding.runningPid}.`, {
            reply_markup: buildMainKeyboard(binding.currentProjectName ?? null)
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          await this.safeSend(chatId, `Could not stop detached process ${binding.runningPid}.\n\n${message}`, {
            reply_markup: buildMainKeyboard(binding.currentProjectName ?? null)
          });
        }
        return;
      }
      default: {
        const binding = this.store.getUserBinding(userId);
        await this.safeSend(chatId, buildHelpText(), {
          reply_markup: buildMainKeyboard(binding?.currentProjectName ?? null)
        });
      }
    }
  }

  createProgressTracker(chatId, messageId, replyMarkup) {
    return {
      chatId,
      messageId,
      replyMarkup,
      lastText: null,
      lastUpdatedAt: 0,
      useSendFallback: false
    };
  }

  describeProgressEvent(event) {
    switch (event?.type) {
      case "thread.started":
        return "Session started. Gathering context...";
      case "turn.started":
        return "Thinking...";
      case "turn.completed":
        return "Wrapping up the response...";
      case "turn.failed":
        return "Run failed. Collecting the error...";
      case "item.started":
        return `Working on ${formatItemType(event.item?.type)}...`;
      case "item.completed":
        if (event.item?.type === "agent_message") {
          return "Drafting the reply...";
        }
        return `Finished ${formatItemType(event.item?.type)}.`;
      default:
        return null;
    }
  }

  scheduleProgressUpdate(progressTracker, nextText, force = false) {
    if (!progressTracker || !nextText) {
      return;
    }

    const now = Date.now();
    if (!force && nextText === progressTracker.lastText) {
      return;
    }

    if (!force && now - progressTracker.lastUpdatedAt < 1200) {
      return;
    }

    progressTracker.lastText = nextText;
    progressTracker.lastUpdatedAt = now;
    if (progressTracker.useSendFallback) {
      void this.telegramApi
        .sendMessage(progressTracker.chatId, nextText, {
          reply_markup: progressTracker.replyMarkup
        })
        .then((message) => {
          progressTracker.messageId = message.message_id;
        })
        .catch((error) => {
          const message = error instanceof Error ? error.message : String(error);
          this.debugLogger?.log("telegram.progress.send_failed", {
            chatId: progressTracker.chatId,
            errorPreview: summarizeText(message)
          });
          console.error("Failed to send Telegram progress message: " + message);
        });
      return;
    }

    void this.telegramApi
      .editMessageText(progressTracker.chatId, progressTracker.messageId, nextText)
      .catch((error) => {
        const message = error instanceof Error ? error.message : String(error);
        this.debugLogger?.log("telegram.progress.edit_failed", {
          chatId: progressTracker.chatId,
          messageId: progressTracker.messageId,
          errorPreview: summarizeText(message)
        });
        progressTracker.useSendFallback = true;
        console.error("Failed to edit Telegram progress message: " + message);
        return this.telegramApi.sendMessage(progressTracker.chatId, nextText, {
          reply_markup: progressTracker.replyMarkup
        }).then((sentMessage) => {
          progressTracker.messageId = sentMessage.message_id;
        });
      })
      .catch((error) => {
        const message = error instanceof Error ? error.message : String(error);
        this.debugLogger?.log("telegram.progress.fallback_failed", {
          chatId: progressTracker.chatId,
          errorPreview: summarizeText(message)
        });
        console.error("Failed to send Telegram progress fallback message: " + message);
      });
  }

  async handlePrompt({ userId, chatId, prompt }) {
    if (this.activeRuns.has(userId)) {
      await this.safeSend(chatId, "A Codex run is already in progress. Wait for it to finish or use /stop.", {
        reply_markup: buildMainKeyboard(this.store.getUserBinding(userId)?.currentProjectName ?? null)
      });
      return;
    }

    const binding = this.store.getUserBinding(userId);
    if (!binding?.currentProjectName) {
      await this.safeSend(chatId, "No current project selected. Use /project add <name> <path> or /project use <name>.", {
        reply_markup: buildMainKeyboard()
      });
      return;
    }

    const project = this.store.getProject(binding.currentProjectName);
    if (!project) {
      await this.safeSend(chatId, "The current project no longer exists in state. Use /projects.", {
        reply_markup: buildMainKeyboard()
      });
      return;
    }

    if (!fs.existsSync(project.cwd) || !fs.statSync(project.cwd).isDirectory()) {
      await this.safeSend(chatId, `Project path no longer exists: ${project.cwd}`, {
        reply_markup: buildMainKeyboard(project.name)
      });
      return;
    }

    const activeSession = binding.activeSessionId ? this.store.getSessionById(binding.activeSessionId) : null;
    this.debugLogger?.log("telegram.prompt.dispatch", {
      userId,
      chatId,
      projectName: project.name,
      activeSessionId: activeSession?.id ?? null,
      resumeSessionId: activeSession?.codexSessionId ?? null,
      promptLength: prompt.length,
      promptPreview: summarizeText(prompt)
    });

    const isResume = Boolean(activeSession);
    const pendingTitle = buildSessionTitle(prompt);
    let createdSessionId = null;
    let runHandle = null;
    const replyMarkup = buildMainKeyboard(project.name);

    const progressMessage = await this.telegramApi.sendMessage(
      chatId,
      isResume ? `Resuming session in ${project.name}...` : `Starting a new session in ${project.name}...`
    );
    const progressTracker = this.createProgressTracker(chatId, progressMessage.message_id, replyMarkup);

    try {
      runHandle = this.runner.startRun({
        cwd: project.cwd,
        prompt,
        resumeSessionId: activeSession?.codexSessionId ?? null,
        onThreadId: (threadId) => {
          if (!isResume && !createdSessionId && threadId) {
            const session = this.store.createSession({
              codexSessionId: threadId,
              projectName: project.name,
              title: pendingTitle,
              status: "running"
            });
            createdSessionId = session.id;
            this.store.setActiveSession(userId, session.id);
            this.debugLogger?.log("telegram.session.created", {
              userId,
              chatId,
              sessionId: session.id,
              codexSessionId: threadId,
              title: pendingTitle
            });
            this.store.setRunState(userId, {
              runningSessionId: session.id,
              runningPid: runHandle?.pid ?? null
            });
          }
        },
        onEvent: (event) => {
          const progressText = this.describeProgressEvent(event);
          if (progressText) {
            this.debugLogger?.log("telegram.progress.event", {
              userId,
              chatId,
              eventType: event.type,
              progressText
            });
          }
          this.scheduleProgressUpdate(progressTracker, progressText);
        }
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.debugLogger?.log("telegram.prompt.start_failed", {
        userId,
        chatId,
        projectName: project.name,
        errorPreview: summarizeText(message)
      });
      this.scheduleProgressUpdate(progressTracker, `Codex could not start.\n\n${message}`, true);
      return;
    }

    const runningSessionId = activeSession?.id ?? null;
    if (runningSessionId) {
      this.store.updateSessionStatus(runningSessionId, "running");
      this.store.setRunState(userId, { runningSessionId, runningPid: runHandle.pid });
    } else if (createdSessionId) {
      this.store.setRunState(userId, { runningSessionId: createdSessionId, runningPid: runHandle.pid });
    } else {
      this.store.setRunState(userId, { runningSessionId: null, runningPid: runHandle.pid });
    }

    this.activeRuns.set(userId, runHandle);

    runHandle.promise
      .then(async (result) => {
        const finalSessionId = createdSessionId ?? activeSession?.id ?? null;
        if (finalSessionId) {
          this.store.updateSessionStatus(finalSessionId, "idle");
          this.store.setActiveSession(userId, finalSessionId);
        }
        this.store.clearRunState(userId);
        this.activeRuns.delete(userId);

        this.debugLogger?.log("telegram.prompt.completed", {
          userId,
          chatId,
          projectName: project.name,
          sessionId: finalSessionId,
          outputLength: result.output.length,
          outputPreview: summarizeText(result.output)
        });
        this.scheduleProgressUpdate(progressTracker, `Completed in ${project.name}.`, true);
        await this.safeSend(chatId, result.output, {
          reply_markup: replyMarkup
        });
      })
      .catch(async (error) => {
        const sessionId = createdSessionId ?? activeSession?.id ?? null;
        if (sessionId) {
          this.store.updateSessionStatus(sessionId, "error");
        }
        this.store.clearRunState(userId);
        this.activeRuns.delete(userId);

        const message = error instanceof Error ? error.message : String(error);
        this.debugLogger?.log("telegram.prompt.failed", {
          userId,
          chatId,
          projectName: project.name,
          sessionId,
          errorPreview: summarizeText(message)
        });
        this.scheduleProgressUpdate(progressTracker, `Run failed in ${project.name}.`, true);
        await this.safeSend(chatId, `Codex run failed.\n\n${message}`, {
          reply_markup: replyMarkup
        });
      });
  }

  async safeSend(chatId, text, options = {}) {
    const chunks = chunkText(text, this.config.defaultReplyChunkSize);
    this.debugLogger?.log("telegram.message.send", {
      chatId,
      totalLength: text.length,
      chunkCount: chunks.length,
      firstChunkLength: chunks[0]?.length ?? 0,
      textPreview: summarizeText(text)
    });
    for (const [index, chunk] of chunks.entries()) {
      await this.telegramApi.sendMessage(chatId, chunk, index === 0 ? options : {});
    }
  }
}

