function formatDurationFromMs(durationMs) {
  if (!Number.isFinite(durationMs) || durationMs < 1000) {
    return "less than 1s";
  }

  const totalSeconds = Math.floor(durationMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const parts = [];

  if (hours > 0) {
    parts.push(`${hours}h`);
  }
  if (minutes > 0) {
    parts.push(`${minutes}m`);
  }
  if (seconds > 0 || parts.length === 0) {
    parts.push(`${seconds}s`);
  }

  return parts.join(" ");
}

function formatElapsed(isoText) {
  if (!isoText) {
    return null;
  }

  const startedAt = Date.parse(isoText);
  if (!Number.isFinite(startedAt)) {
    return null;
  }

  return formatDurationFromMs(Date.now() - startedAt);
}

function formatRunMode(mode) {
  if (mode === "resume") {
    return "resumed existing session";
  }
  if (mode === "fresh") {
    return "fresh session";
  }
  return null;
}

function formatAbsoluteTime(isoText) {
  if (!isoText) {
    return null;
  }

  const value = new Date(isoText);
  if (Number.isNaN(value.getTime())) {
    return null;
  }

  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  const hours = String(value.getHours()).padStart(2, "0");
  const minutes = String(value.getMinutes()).padStart(2, "0");
  const seconds = String(value.getSeconds()).padStart(2, "0");
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

export const PROJECTS_PAGE_SIZE = 8;

export function chunkText(text, maxLength) {
  const normalized = (text || "").trim();
  if (!normalized) {
    return ["Codex finished without a text response."];
  }

  if (normalized.length <= maxLength) {
    return [normalized];
  }

  const chunks = [];
  let remaining = normalized;

  while (remaining.length > maxLength) {
    let splitIndex = remaining.lastIndexOf("\n", maxLength);
    if (splitIndex < Math.floor(maxLength * 0.6)) {
      splitIndex = remaining.lastIndexOf(" ", maxLength);
    }
    if (splitIndex < Math.floor(maxLength * 0.4)) {
      splitIndex = maxLength;
    }

    chunks.push(remaining.slice(0, splitIndex).trim());
    remaining = remaining.slice(splitIndex).trim();
  }

  if (remaining) {
    chunks.push(remaining);
  }

  return chunks.filter(Boolean);
}

export function formatProjects(projects, currentProjectName, { page = 1, totalPages = 1, totalProjects = projects.length } = {}) {
  if (totalProjects === 0) {
    return "No projects saved yet. Use /project add <name> [path].";
  }

  const title = totalPages > 1
    ? `Projects (page ${page}/${totalPages}, ${totalProjects} total):`
    : "Projects:";
  const lines = [
    title,
    ...projects.map((project) => {
      const marker = project.name === currentProjectName ? "*" : "-";
      return `${marker} ${project.name} -> ${project.cwd}`;
    })
  ];

  if (totalPages > 1) {
    lines.push(`Use /projects <page>. Current page: ${page}.`);
  }

  return lines.join("\n");
}

export function formatSessions(sessions, activeSessionId, runningSessionId = null) {
  if (sessions.length === 0) {
    return "No sessions yet for this project. Use /new and then send a prompt.";
  }

  return [
    "Sessions:",
    ...sessions.map((session, index) => {
      const marker = session.id === activeSessionId ? "*" : "-";
      const status = session.id === runningSessionId ? "running" : session.status;
      return `${marker} ${index + 1}. ${session.title} [${status}]`;
    })
  ].join("\n");
}

export function formatStatus({ project, session, binding, detachedRunning = false, defaultProjectRoot = null }) {
  if (!project) {
    return "No current project. Use /project add <name> [path] or /projects.";
  }

  const runningLabel = binding?.runningPid
    ? detachedRunning
      ? `yes (tracked from a previous bot instance, pid ${binding.runningPid})`
      : `yes (pid ${binding.runningPid})`
    : "no";

  const lines = [
    `Project: ${project.name}`,
    `Path: ${project.cwd}`,
    `Default project root: ${defaultProjectRoot || "not set"}`,
    `Running: ${runningLabel}`
  ];

  if (session) {
    lines.push(`Session: ${session.title}`);
    lines.push(`Codex session id: ${session.codexSessionId}`);
    lines.push(`Status: ${session.status}`);
  } else {
    lines.push("Session: none selected");
  }

  if (binding?.runningPid) {
    const runMode = formatRunMode(binding.runningResumeMode);
    const elapsed = formatElapsed(binding.runningStartedAt);
    const startedAt = formatAbsoluteTime(binding.runningStartedAt);
    lines.push(`Run project: ${binding.runningProjectName || project.name}`);
    lines.push(`Run cwd: ${binding.runningCwd || project.cwd}`);
    lines.push(`Model: ${binding.runningModel || "default"}`);
    lines.push(`Sandbox: ${binding.runningSandbox || "default"}`);
    if (runMode) {
      lines.push(`Run mode: ${runMode}`);
    }
    if (binding.runningThreadId && binding.runningThreadId !== session?.codexSessionId) {
      lines.push(`Running thread id: ${binding.runningThreadId}`);
    }
    if (startedAt) {
      lines.push(`Started: ${startedAt}`);
    }
    if (elapsed) {
      lines.push(`Elapsed: ${elapsed}`);
    }
    if (binding.runningLastEventText) {
      const lastEventAge = formatElapsed(binding.runningLastEventAt);
      const lastEventAt = formatAbsoluteTime(binding.runningLastEventAt);
      lines.push(
        lastEventAge
          ? `Last progress: ${binding.runningLastEventText} (${lastEventAge} ago)`
          : `Last progress: ${binding.runningLastEventText}`
      );
      if (lastEventAt) {
        lines.push(`Last progress at: ${lastEventAt}`);
      }
    }
  }

  return lines.join("\n");
}

export function buildHelpText() {
  return [
    "Telegram Codex Companion",
    "",
    "Project commands",
    "/projects [page] - list saved projects",
    "/project add <name> [path] - add a local folder as a project",
    "/project use <name> - switch to a saved project",
    "/project delete <name> - remove a saved project record and its sessions",
    "/project current - show the current project and path",
    "/project default - show the default project root",
    "/project default <path> - set the default project root",
    "",
    "Session commands",
    "/new - start fresh on the next normal message",
    "/sessions - list sessions for the current project",
    "/use <n> - switch to a session from /sessions",
    "/rename <title> - rename the active session",
    "/rename <n> <title> - rename a listed session",
    "",
    "Run commands",
    "/status - show current project, session, and run state",
    "/stop - request stop for the current run",
    "/help - show this help",
    "",
    "How to use",
    "1. /project default E:\\codex project",
    "2. /project add demo",
    "3. /project use demo",
    "4. /new",
    "5. Send a normal text message to start or continue a session."
  ].join("\n");
}

function keyboardRow(buttons) {
  return buttons.map((text) => ({ text }));
}

export function buildMainKeyboard(currentProjectName = null) {
  const rows = [
    keyboardRow(["/projects", "/sessions"]),
    keyboardRow(["/new", "/status", "/stop"]),
    keyboardRow(["/project default", "/help"])
  ];

  if (currentProjectName) {
    rows.unshift(keyboardRow(["/project current", `/project use ${currentProjectName}`]));
  }

  return {
    keyboard: rows,
    resize_keyboard: true,
    is_persistent: true
  };
}

export function buildProjectsKeyboard(projects, { page = 1, totalPages = 1 } = {}) {
  const rows = [];

  for (let index = 0; index < projects.length; index += 2) {
    rows.push(
      keyboardRow(
        projects.slice(index, index + 2).map((project) => `/project use ${project.name}`)
      )
    );
  }

  if (totalPages > 1) {
    const navButtons = [];
    if (page > 1) {
      navButtons.push(`/projects ${page - 1}`);
    }
    if (page < totalPages) {
      navButtons.push(`/projects ${page + 1}`);
    }
    if (navButtons.length > 0) {
      rows.push(keyboardRow(navButtons));
    }
  }

  rows.push(keyboardRow(["/new", "/status", "/sessions"]));
  rows.push(keyboardRow(["/project default", "/help"]));

  return {
    keyboard: rows,
    resize_keyboard: true,
    is_persistent: true
  };
}

export function buildSessionsKeyboard(sessions) {
  const rows = [];

  for (let index = 0; index < sessions.length; index += 2) {
    rows.push(
      keyboardRow(
        sessions.slice(index, index + 2).map((_, offset) => `/use ${index + offset + 1}`)
      )
    );
  }

  rows.push(keyboardRow(["/new", "/status", "/projects"]));
  rows.push(keyboardRow(["/project default", "/help"]));

  return {
    keyboard: rows,
    resize_keyboard: true,
    is_persistent: true
  };
}
