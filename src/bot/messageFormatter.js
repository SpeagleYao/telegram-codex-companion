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

export function formatProjects(projects, currentProjectName) {
  if (projects.length === 0) {
    return "No projects saved yet. Use /project add <name> <path>.";
  }

  return [
    "Projects:",
    ...projects.map((project) => {
      const marker = project.name === currentProjectName ? "*" : "-";
      return `${marker} ${project.name} -> ${project.cwd}`;
    })
  ].join("\n");
}

export function formatSessions(sessions, activeSessionId) {
  if (sessions.length === 0) {
    return "No sessions yet for this project. Use /new and then send a prompt.";
  }

  return [
    "Sessions:",
    ...sessions.map((session, index) => {
      const marker = session.id === activeSessionId ? "*" : "-";
      return `${marker} ${index + 1}. ${session.title} [${session.status}]`;
    })
  ].join("\n");
}

export function formatStatus({ project, session, binding, detachedRunning = false }) {
  if (!project) {
    return "No current project. Use /project add <name> <path> or /projects.";
  }

  const runningLabel = binding?.runningPid
    ? detachedRunning
      ? `yes (tracked from a previous bot instance, pid ${binding.runningPid})`
      : `yes (pid ${binding.runningPid})`
    : "no";

  const lines = [
    `Project: ${project.name}`,
    `Path: ${project.cwd}`,
    `Running: ${runningLabel}`
  ];

  if (session) {
    lines.push(`Session: ${session.title}`);
    lines.push(`Codex session id: ${session.codexSessionId}`);
    lines.push(`Status: ${session.status}`);
  } else {
    lines.push("Session: none selected");
  }

  return lines.join("\n");
}

export function buildHelpText() {
  return [
    "Telegram Codex Companion",
    "",
    "/projects",
    "/project add <name> <path>",
    "/project use <name>",
    "/project current",
    "/new",
    "/sessions",
    "/use <n>",
    "/rename <title>",
    "/rename <n> <title>",
    "/status",
    "/stop",
    "",
    "Send a normal text message to continue the current session."
  ].join("\n");
}

function keyboardRow(buttons) {
  return buttons.map((text) => ({ text }));
}

export function buildMainKeyboard(currentProjectName = null) {
  const rows = [
    keyboardRow(["/projects", "/sessions"]),
    keyboardRow(["/new", "/status", "/stop"])
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

export function buildProjectsKeyboard(projects) {
  const rows = [];

  for (let index = 0; index < projects.length; index += 2) {
    rows.push(
      keyboardRow(
        projects.slice(index, index + 2).map((project) => `/project use ${project.name}`)
      )
    );
  }

  rows.push(keyboardRow(["/new", "/status", "/sessions"]));

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

  return {
    keyboard: rows,
    resize_keyboard: true,
    is_persistent: true
  };
}
