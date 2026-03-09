import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

const USER_BINDING_SELECT = `
  telegram_user_id AS telegramUserId,
  current_project_name AS currentProjectName,
  active_session_id AS activeSessionId,
  running_session_id AS runningSessionId,
  running_pid AS runningPid,
  running_started_at AS runningStartedAt,
  running_project_name AS runningProjectName,
  running_cwd AS runningCwd,
  running_model AS runningModel,
  running_sandbox AS runningSandbox,
  running_resume_mode AS runningResumeMode,
  running_thread_id AS runningThreadId,
  running_last_event_type AS runningLastEventType,
  running_last_event_text AS runningLastEventText,
  running_last_event_at AS runningLastEventAt,
  updated_at AS updatedAt
`;

const RUN_STATE_FIELD_TO_COLUMN = {
  runningSessionId: "running_session_id",
  runningPid: "running_pid",
  runningStartedAt: "running_started_at",
  runningProjectName: "running_project_name",
  runningCwd: "running_cwd",
  runningModel: "running_model",
  runningSandbox: "running_sandbox",
  runningResumeMode: "running_resume_mode",
  runningThreadId: "running_thread_id",
  runningLastEventType: "running_last_event_type",
  runningLastEventText: "running_last_event_text",
  runningLastEventAt: "running_last_event_at"
};

const RUN_STATE_DEFAULTS = {
  runningSessionId: null,
  runningPid: null,
  runningStartedAt: null,
  runningProjectName: null,
  runningCwd: null,
  runningModel: null,
  runningSandbox: null,
  runningResumeMode: null,
  runningThreadId: null,
  runningLastEventType: null,
  runningLastEventText: null,
  runningLastEventAt: null
};

function nowIso() {
  return new Date().toISOString();
}

function ensureParentDirectory(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function listColumnNames(db, tableName) {
  return db
    .prepare(`PRAGMA table_info(${tableName})`)
    .all()
    .map((row) => row.name);
}

export class CompanionStateStore {
  constructor({ projectsDbPath, stateDbPath }) {
    ensureParentDirectory(projectsDbPath);
    ensureParentDirectory(stateDbPath);

    this.projectsDb = new DatabaseSync(projectsDbPath);
    this.stateDb = new DatabaseSync(stateDbPath);

    this.projectsDb.exec("PRAGMA journal_mode = WAL;");
    this.stateDb.exec("PRAGMA journal_mode = WAL;");

    this.createProjectsSchema();
    this.createStateSchema();
    this.migrateStateSchema();
  }

  close() {
    this.projectsDb.close();
    this.stateDb.close();
  }

  createProjectsSchema() {
    this.projectsDb.exec(`
      CREATE TABLE IF NOT EXISTS projects (
        name TEXT PRIMARY KEY,
        cwd TEXT NOT NULL,
        active_session_id INTEGER,
        last_used_at TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);
  }

  createStateSchema() {
    this.stateDb.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        codex_session_id TEXT NOT NULL UNIQUE,
        project_name TEXT NOT NULL,
        title TEXT NOT NULL,
        status TEXT NOT NULL,
        last_used_at TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS user_bindings (
        telegram_user_id INTEGER PRIMARY KEY,
        current_project_name TEXT,
        active_session_id INTEGER,
        running_session_id INTEGER,
        running_pid INTEGER,
        running_started_at TEXT,
        running_project_name TEXT,
        running_cwd TEXT,
        running_model TEXT,
        running_sandbox TEXT,
        running_resume_mode TEXT,
        running_thread_id TEXT,
        running_last_event_type TEXT,
        running_last_event_text TEXT,
        running_last_event_at TEXT,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS bot_meta (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);
  }

  migrateStateSchema() {
    const userBindingColumns = listColumnNames(this.stateDb, "user_bindings");
    const requiredColumns = {
      running_started_at: "TEXT",
      running_project_name: "TEXT",
      running_cwd: "TEXT",
      running_model: "TEXT",
      running_sandbox: "TEXT",
      running_resume_mode: "TEXT",
      running_thread_id: "TEXT",
      running_last_event_type: "TEXT",
      running_last_event_text: "TEXT",
      running_last_event_at: "TEXT"
    };

    for (const [columnName, columnType] of Object.entries(requiredColumns)) {
      if (!userBindingColumns.includes(columnName)) {
        this.stateDb.exec(`ALTER TABLE user_bindings ADD COLUMN ${columnName} ${columnType};`);
      }
    }
  }

  listProjects() {
    return this.projectsDb
      .prepare(`
        SELECT name, cwd, active_session_id AS activeSessionId, last_used_at AS lastUsedAt
        FROM projects
        ORDER BY last_used_at DESC, name ASC
      `)
      .all();
  }

  getProject(name) {
    return (
      this.projectsDb
        .prepare(`
          SELECT name, cwd, active_session_id AS activeSessionId, last_used_at AS lastUsedAt
          FROM projects
          WHERE name = ?
        `)
        .get(name) ?? null
    );
  }

  addProject({ name, cwd }) {
    const timestamp = nowIso();
    this.projectsDb
      .prepare(`
        INSERT INTO projects (name, cwd, active_session_id, last_used_at, created_at, updated_at)
        VALUES (?, ?, NULL, ?, ?, ?)
      `)
      .run(name, cwd, timestamp, timestamp, timestamp);

    return this.getProject(name);
  }

  updateProjectUsage(name, activeSessionId = undefined) {
    const current = this.getProject(name);
    if (!current) {
      return null;
    }

    const timestamp = nowIso();
    const nextActiveSessionId =
      activeSessionId === undefined ? current.activeSessionId : activeSessionId;

    this.projectsDb
      .prepare(`
        UPDATE projects
        SET active_session_id = ?, last_used_at = ?, updated_at = ?
        WHERE name = ?
      `)
      .run(nextActiveSessionId, timestamp, timestamp, name);

    return this.getProject(name);
  }

  ensureUserBinding(telegramUserId) {
    const existing = this.getUserBinding(telegramUserId);
    if (existing) {
      return existing;
    }

    const timestamp = nowIso();
    this.stateDb
      .prepare(`
        INSERT INTO user_bindings (
          telegram_user_id,
          current_project_name,
          active_session_id,
          running_session_id,
          running_pid,
          updated_at
        )
        VALUES (?, NULL, NULL, NULL, NULL, ?)
      `)
      .run(telegramUserId, timestamp);

    return this.getUserBinding(telegramUserId);
  }

  getUserBinding(telegramUserId) {
    return (
      this.stateDb
        .prepare(`
          SELECT
            ${USER_BINDING_SELECT}
          FROM user_bindings
          WHERE telegram_user_id = ?
        `)
        .get(telegramUserId) ?? null
    );
  }

  listBindingsWithRunState() {
    return this.stateDb
      .prepare(`
        SELECT
          ${USER_BINDING_SELECT}
        FROM user_bindings
        WHERE running_pid IS NOT NULL
      `)
      .all();
  }

  setCurrentProject(telegramUserId, projectName, activeSessionId = null) {
    this.ensureUserBinding(telegramUserId);
    const timestamp = nowIso();

    this.stateDb
      .prepare(`
        UPDATE user_bindings
        SET current_project_name = ?, active_session_id = ?, updated_at = ?
        WHERE telegram_user_id = ?
      `)
      .run(projectName, activeSessionId, timestamp, telegramUserId);

    return this.getUserBinding(telegramUserId);
  }

  clearActiveSession(telegramUserId) {
    this.ensureUserBinding(telegramUserId);
    const binding = this.getUserBinding(telegramUserId);
    const timestamp = nowIso();

    this.stateDb
      .prepare(`
        UPDATE user_bindings
        SET active_session_id = NULL, updated_at = ?
        WHERE telegram_user_id = ?
      `)
      .run(timestamp, telegramUserId);

    if (binding?.currentProjectName) {
      this.updateProjectUsage(binding.currentProjectName, null);
    }

    return this.getUserBinding(telegramUserId);
  }

  createSession({ codexSessionId, projectName, title, status }) {
    const timestamp = nowIso();
    const result = this.stateDb
      .prepare(`
        INSERT INTO sessions (
          codex_session_id,
          project_name,
          title,
          status,
          last_used_at,
          created_at,
          updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `)
      .run(codexSessionId, projectName, title, status, timestamp, timestamp, timestamp);

    return this.getSessionById(result.lastInsertRowid);
  }

  listSessionsForProject(projectName, limit = 10) {
    return this.stateDb
      .prepare(`
        SELECT
          id,
          codex_session_id AS codexSessionId,
          project_name AS projectName,
          title,
          status,
          last_used_at AS lastUsedAt,
          created_at AS createdAt
        FROM sessions
        WHERE project_name = ?
        ORDER BY last_used_at DESC, id DESC
        LIMIT ?
      `)
      .all(projectName, limit);
  }

  getSessionById(id) {
    return (
      this.stateDb
        .prepare(`
          SELECT
            id,
            codex_session_id AS codexSessionId,
            project_name AS projectName,
            title,
            status,
            last_used_at AS lastUsedAt,
            created_at AS createdAt
          FROM sessions
          WHERE id = ?
        `)
        .get(id) ?? null
    );
  }

  renameSession(id, title) {
    const timestamp = nowIso();
    this.stateDb
      .prepare(`
        UPDATE sessions
        SET title = ?, updated_at = ?, last_used_at = ?
        WHERE id = ?
      `)
      .run(title, timestamp, timestamp, id);

    return this.getSessionById(id);
  }

  updateSessionStatus(id, status) {
    const timestamp = nowIso();
    this.stateDb
      .prepare(`
        UPDATE sessions
        SET status = ?, last_used_at = ?, updated_at = ?
        WHERE id = ?
      `)
      .run(status, timestamp, timestamp, id);

    return this.getSessionById(id);
  }

  setActiveSession(telegramUserId, sessionId) {
    this.ensureUserBinding(telegramUserId);
    const binding = this.getUserBinding(telegramUserId);
    const session = this.getSessionById(sessionId);
    if (!session) {
      return null;
    }

    const timestamp = nowIso();
    this.stateDb
      .prepare(`
        UPDATE user_bindings
        SET active_session_id = ?, current_project_name = ?, updated_at = ?
        WHERE telegram_user_id = ?
      `)
      .run(sessionId, session.projectName, timestamp, telegramUserId);

    this.updateProjectUsage(session.projectName, sessionId);
    this.updateSessionStatus(sessionId, session.status);

    if (binding?.currentProjectName && binding.currentProjectName !== session.projectName) {
      this.updateProjectUsage(binding.currentProjectName);
    }

    return this.getUserBinding(telegramUserId);
  }

  setRunState(telegramUserId, fields = {}) {
    return this.updateRunState(telegramUserId, {
      ...RUN_STATE_DEFAULTS,
      ...fields
    });
  }

  updateRunState(telegramUserId, fields) {
    this.ensureUserBinding(telegramUserId);
    const entries = Object.entries(fields).filter(([, value]) => value !== undefined);
    if (entries.length === 0) {
      return this.getUserBinding(telegramUserId);
    }

    const timestamp = nowIso();
    const assignments = [];
    const values = [];

    for (const [fieldName, value] of entries) {
      const columnName = RUN_STATE_FIELD_TO_COLUMN[fieldName];
      if (!columnName) {
        continue;
      }

      assignments.push(`${columnName} = ?`);
      values.push(value);
    }

    if (assignments.length === 0) {
      return this.getUserBinding(telegramUserId);
    }

    assignments.push("updated_at = ?");
    values.push(timestamp, telegramUserId);

    this.stateDb
      .prepare(`
        UPDATE user_bindings
        SET ${assignments.join(", ")}
        WHERE telegram_user_id = ?
      `)
      .run(...values);

    return this.getUserBinding(telegramUserId);
  }

  clearRunState(telegramUserId) {
    return this.updateRunState(telegramUserId, RUN_STATE_DEFAULTS);
  }

  getUpdateOffset() {
    const row =
      this.stateDb
        .prepare(`
          SELECT value
          FROM bot_meta
          WHERE key = 'telegram_update_offset'
        `)
        .get() ?? null;

    if (!row) {
      return null;
    }

    const parsed = Number.parseInt(row.value, 10);
    return Number.isFinite(parsed) ? parsed : null;
  }

  setUpdateOffset(offset) {
    const timestamp = nowIso();
    this.stateDb
      .prepare(`
        INSERT INTO bot_meta (key, value, updated_at)
        VALUES ('telegram_update_offset', ?, ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
      `)
      .run(String(offset), timestamp);
  }
}
