/**
 * Shared Database Module — SQLite layer for CollabNotes (X-MAN encapsulated facade).
 * Legacy API: getDb(), all(), get(), run() — used by shared-notes and sharing.
 * X-MAN API: init, query, insert, update, delete, close — all return { success, data } | { success: false, error }.
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

function getDbPath() {
  return process.env.CNB_DB_PATH || path.join(__dirname, '..', '..', 'collabnotes.db');
}

const ALLOWED_TABLES = new Set([
  'users',
  'notes',
  'shares',
  'sessions',
  'note_versions',
  'note_shares',
]);

function validateTableName(table) {
  if (typeof table !== 'string' || !ALLOWED_TABLES.has(table)) {
    return { ok: false, error: 'Invalid or unsupported table name' };
  }
  return { ok: true };
}

/** Human-readable messages for common SQLite errors (X-MAN callers never receive raw throws). */
function formatSqliteError(err) {
  if (!err) return 'Unknown database error';
  const code = err.code;
  const msg = err.message || String(err);
  if (code === 'SQLITE_CONSTRAINT' || /UNIQUE constraint failed/i.test(msg)) {
    return 'Constraint violation: duplicate unique value or foreign key conflict';
  }
  if (/SQLITE_CONSTRAINT_FOREIGNKEY/i.test(code) || /FOREIGN KEY constraint failed/i.test(msg)) {
    return 'Constraint violation: referenced row missing (foreign key)';
  }
  if (code === 'SQLITE_ERROR' && /no such table/i.test(msg)) {
    return 'SQL error: table does not exist';
  }
  if (code === 'SQLITE_ERROR' && /no such column/i.test(msg)) {
    return 'SQL error: column does not exist';
  }
  return msg;
}

// Singleton — one connection per process (SQLite file semantics).
let instance = null;

class Database {
  constructor() {
    this.db = null;
  }

  /**
   * X-MAN: open DB, create tables. Returns { success, data: this } or { success: false, error }.
   */
  async init() {
    try {
      if (this.db) {
        return { success: true, data: this };
      }
      const DB_PATH = getDbPath();
      await new Promise((resolve, reject) => {
        this.db = new sqlite3.Database(DB_PATH, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
      console.log('[DB] Connected to SQLite:', DB_PATH);
      await this._createTablesInternal();
      return { success: true, data: this };
    } catch (err) {
      this.db = null;
      return { success: false, error: err && err.message ? err.message : String(err) };
    }
  }

  async _createTablesInternal() {
    await this.run(
      `CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        email TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`
    );

    await this.run(
      `CREATE TABLE IF NOT EXISTS notes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        content TEXT,
        owner_id INTEGER NOT NULL,
        tags TEXT DEFAULT '[]',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`
    );

    await this.run(
      `CREATE TABLE IF NOT EXISTS shares (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        note_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        permission TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`
    );

    await this.run(
      `CREATE TABLE IF NOT EXISTS sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        token TEXT UNIQUE NOT NULL,
        expires_at DATETIME
      )`
    );

    await this.run(
      `CREATE TABLE IF NOT EXISTS note_versions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        note_id INTEGER NOT NULL,
        title TEXT NOT NULL,
        content TEXT,
        updated_by INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`
    );

    await this.run(
      `CREATE TABLE IF NOT EXISTS note_shares (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        note_id INTEGER NOT NULL,
        owner_id INTEGER NOT NULL,
        shared_with_id INTEGER NOT NULL,
        can_write INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(note_id, shared_with_id)
      )`
    );

    try {
      const rows = await this.all(`PRAGMA table_info(notes)`);
      const hasTags = rows && rows.some((r) => r && r.name === 'tags');
      if (!hasTags) {
        await this.run(`ALTER TABLE notes ADD COLUMN tags TEXT DEFAULT '[]'`);
        console.log('[DB] Migrated notes table: added tags column');
      }
    } catch (err) {
      console.warn('[DB] Warning while ensuring tags column:', err && err.message);
    }
  }

  /**
   * X-MAN: run SELECT; returns { success, data: rows }.
   */
  async query(sql, params = []) {
    try {
      if (!this.db) {
        return { success: false, error: 'Database not initialized' };
      }
      if (typeof sql !== 'string' || !sql.trim()) {
        return { success: false, error: 'Invalid SQL' };
      }
      const rows = await this.all(sql, params);
      return { success: true, data: rows };
    } catch (err) {
      return { success: false, error: formatSqliteError(err) };
    }
  }

  /**
   * X-MAN: fetch one row by primary key `id`.
   */
  async getById(table, id) {
    try {
      const v = validateTableName(table);
      if (!v.ok) return { success: false, error: v.error };
      if (id === undefined || id === null) {
        return { success: false, error: 'id is required' };
      }
      const row = await this.get(`SELECT * FROM ${table} WHERE id = ?`, [id]);
      return { success: true, data: row != null ? row : null };
    } catch (err) {
      return { success: false, error: formatSqliteError(err) };
    }
  }

  /**
   * X-MAN: check sqlite_master for a table (identifier must be safe).
   */
  async tableExists(table) {
    try {
      if (typeof table !== 'string' || !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(table)) {
        return { success: false, error: 'Invalid table identifier' };
      }
      if (!this.db) {
        return { success: false, error: 'Database not initialized' };
      }
      const row = await this.get(
        `SELECT 1 as ok FROM sqlite_master WHERE type = 'table' AND name = ?`,
        [table]
      );
      return { success: true, data: !!row };
    } catch (err) {
      return { success: false, error: formatSqliteError(err) };
    }
  }

  /**
   * X-MAN: insert row object into table; returns { success, data: { id, changes } }.
   */
  async insert(table, row) {
    try {
      const v = validateTableName(table);
      if (!v.ok) return { success: false, error: v.error };
      if (!row || typeof row !== 'object') {
        return { success: false, error: 'Row must be a non-null object' };
      }
      const keys = Object.keys(row).filter((k) => row[k] !== undefined);
      if (keys.length === 0) {
        return { success: false, error: 'No columns to insert' };
      }
      const placeholders = keys.map(() => '?').join(', ');
      const cols = keys.join(', ');
      const vals = keys.map((k) => row[k]);
      const sql = `INSERT INTO ${table} (${cols}) VALUES (${placeholders})`;
      const result = await this.run(sql, vals);
      return { success: true, data: result };
    } catch (err) {
      return { success: false, error: formatSqliteError(err) };
    }
  }

  /**
   * X-MAN: update by primary key id; returns { success, data: { changes } }.
   */
  async update(table, id, patch) {
    try {
      const v = validateTableName(table);
      if (!v.ok) return { success: false, error: v.error };
      if (id === undefined || id === null) {
        return { success: false, error: 'id is required' };
      }
      if (!patch || typeof patch !== 'object') {
        return { success: false, error: 'patch must be an object' };
      }
      const keys = Object.keys(patch).filter((k) => patch[k] !== undefined && k !== 'id');
      if (keys.length === 0) {
        return { success: false, error: 'No fields to update' };
      }
      const sets = keys.map((k) => `${k} = ?`).join(', ');
      const vals = keys.map((k) => patch[k]);
      vals.push(id);
      const sql = `UPDATE ${table} SET ${sets} WHERE id = ?`;
      const result = await this.run(sql, vals);
      return { success: true, data: { changes: result.changes } };
    } catch (err) {
      return { success: false, error: formatSqliteError(err) };
    }
  }

  /**
   * X-MAN: delete by primary key id; returns { success, data: { changes } }.
   */
  async delete(table, id) {
    try {
      const v = validateTableName(table);
      if (!v.ok) return { success: false, error: v.error };
      if (id === undefined || id === null) {
        return { success: false, error: 'id is required' };
      }
      const result = await this.run(`DELETE FROM ${table} WHERE id = ?`, [id]);
      return { success: true, data: { changes: result.changes } };
    } catch (err) {
      return { success: false, error: formatSqliteError(err) };
    }
  }

  /**
   * X-MAN: close connection; clears singleton if this instance was active.
   */
  async close() {
    try {
      if (this.db) {
        await new Promise((resolve, reject) => {
          this.db.close((err) => {
            if (err) reject(err);
            else resolve();
          });
        });
        this.db = null;
      }
      if (instance === this) {
        instance = null;
      }
      return { success: true, data: null };
    } catch (err) {
      return { success: false, error: err && err.message ? err.message : String(err) };
    }
  }

  /**
   * Legacy: run a query and return all rows (may reject).
   */
  all(query, params = []) {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }
      this.db.all(query, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  /**
   * Legacy: run a query and return single row (may reject).
   */
  get(query, params = []) {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }
      this.db.get(query, params, (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  /**
   * Legacy: run INSERT/UPDATE/DELETE (may reject).
   */
  run(query, params = []) {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }
      this.db.run(query, params, function (err) {
        if (err) reject(err);
        else resolve({ id: this.lastID, changes: this.changes });
      });
    });
  }
}

/**
 * Get or create database singleton.
 */
async function getDb() {
  if (!instance) {
    const db = new Database();
    const result = await db.init();
    if (!result.success) {
      throw new Error(result.error);
    }
    instance = db;
  }
  return instance;
}

/**
 * Reset singleton (e.g. tests after close).
 */
function resetDbSingleton() {
  instance = null;
}

module.exports = {
  getDb,
  Database,
  resetDbSingleton,
};
