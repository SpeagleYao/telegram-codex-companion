function stripBotSuffix(commandName) {
  return commandName.split("@")[0];
}

export function parseIncomingText(text) {
  const trimmed = (text || "").trim();
  if (!trimmed) {
    return { type: "empty" };
  }

  if (!trimmed.startsWith("/")) {
    return { type: "prompt", prompt: trimmed };
  }

  const firstSpace = trimmed.indexOf(" ");
  const rawCommand = firstSpace === -1 ? trimmed : trimmed.slice(0, firstSpace);
  const command = stripBotSuffix(rawCommand);
  const rest = firstSpace === -1 ? "" : trimmed.slice(firstSpace + 1).trim();

  if (command === "/project") {
    const addMatch = /^add\s+([^\s]+)(?:\s+(.+))?$/u.exec(rest);
    if (addMatch) {
      return {
        type: "command",
        command: "project_add",
        name: addMatch[1],
        path: addMatch[2] ?? null
      };
    }

    const defaultMatch = /^default(?:\s+(.+))?$/u.exec(rest);
    if (defaultMatch) {
      return {
        type: "command",
        command: defaultMatch[1] ? "project_default_set" : "project_default_show",
        path: defaultMatch[1] ?? null
      };
    }

    const useMatch = /^use\s+([^\s]+)$/u.exec(rest);
    if (useMatch) {
      return {
        type: "command",
        command: "project_use",
        name: useMatch[1]
      };
    }

    if (rest === "current") {
      return {
        type: "command",
        command: "project_current"
      };
    }

    return {
      type: "command",
      command: "project_help"
    };
  }

  if (command === "/use") {
    return {
      type: "command",
      command: "use",
      index: Number.parseInt(rest, 10)
    };
  }

  if (command === "/rename") {
    const numberedMatch = /^(\d+)\s+(.+)$/u.exec(rest);
    if (numberedMatch) {
      return {
        type: "command",
        command: "rename_index",
        index: Number.parseInt(numberedMatch[1], 10),
        title: numberedMatch[2].trim()
      };
    }

    if (rest) {
      return {
        type: "command",
        command: "rename_current",
        title: rest
      };
    }

    return {
      type: "command",
      command: "rename_help"
    };
  }

  return {
    type: "command",
    command: command.slice(1),
    args: rest
  };
}
