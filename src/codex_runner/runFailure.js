import { summarizeText } from "../logging/debugLogger.js";

function looksLikeCommandNotFound(message) {
  return /enoent|not recognized as an internal or external command|spawn .*not found|cannot find the file/i.test(message);
}

function looksLikeAuthFailure(message) {
  return /not authenticated|login|log in|api key|unauthorized|authentication/i.test(message);
}

function looksLikePermissionFailure(message) {
  return /eacces|eperm|permission denied|access is denied/i.test(message);
}

function looksLikeResumeFailure(message) {
  return /resume|thread|session/i.test(message) && /not found|unknown|missing|no such/i.test(message);
}

function looksLikeTimeout(message) {
  return /timed out|timeout|time out/i.test(message);
}

export function classifyCodexFailure(message, { isResume = false } = {}) {
  const normalized = String(message || "").trim();

  if (looksLikeCommandNotFound(normalized)) {
    return {
      code: "cli_not_found",
      summary: "Codex CLI could not be launched from the bot process.",
      suggestion: "Check `codex --help` in the same terminal account, or set `CODEX_EXECUTABLE` to the full CLI path."
    };
  }

  if (looksLikeAuthFailure(normalized)) {
    return {
      code: "auth_required",
      summary: "Codex appears to need authentication before this bot can use it.",
      suggestion: "Open a local terminal, make sure Codex is logged in there, then retry the request."
    };
  }

  if (looksLikePermissionFailure(normalized)) {
    return {
      code: "permission_denied",
      summary: "The run failed because the process did not have permission to do something it needed.",
      suggestion: "Check the selected project path, sandbox setting, and local filesystem permissions."
    };
  }

  if (isResume && looksLikeResumeFailure(normalized)) {
    return {
      code: "resume_failed",
      summary: "The saved Codex session could not be resumed.",
      suggestion: "Try `/new` to start a fresh session, or reselect a different session from `/sessions`."
    };
  }

  if (looksLikeTimeout(normalized)) {
    return {
      code: "timeout",
      summary: "The run timed out or the connection stalled before Codex finished.",
      suggestion: "Retry the request once. If it keeps happening, reduce scope or verify local network access for Codex."
    };
  }

  return {
    code: "unknown",
    summary: "Codex exited unexpectedly.",
    suggestion: "Check the debug log for the full diagnostics and retry with a narrower prompt if needed."
  };
}

export function buildCodexFailureReply(message, { projectName = null, isResume = false } = {}) {
  const classification = classifyCodexFailure(message, { isResume });
  const lines = [];

  lines.push(projectName ? `Codex run failed in ${projectName}.` : "Codex run failed.");
  lines.push("");
  lines.push(classification.summary);
  lines.push(classification.suggestion);

  const technicalSummary = summarizeText(message, 90);
  if (technicalSummary) {
    lines.push("");
    lines.push(`Technical summary: ${technicalSummary}`);
  }

  return {
    classification,
    text: lines.join("\n")
  };
}
