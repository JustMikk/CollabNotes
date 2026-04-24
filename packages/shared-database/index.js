/**
 * Shared Database Module
 * SQLite database layer for CollabNotes
 * Note: This is temporary scaffolding. Leul will enhance this with:
 * - Connection pooling
 * - Migration system
 * - Comprehensive query builders
 * - Backup/restore utilities
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = path.join(__dirname, '..', '..', 'collabnotes.db');

class Database {
  constructor() {
    this.db = null;
  }

  /**
   * Initialize database connection
   */
  async init() {
    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(DB_PATH, (err) => {
        if (err) {
          reject(err);
        } else {
          console.log('[DB] Connected to SQLite:', DB_PATH);
          this.createTables()
            .then(() => resolve(this))
            .catch(reject);
        }
      });
    });
  }

  /**
   * Create necessary tables if they don't exist
   */
  async createTables() {
    return new Promise((resolve, reject) => {
      this.db.serialize(() => {
          // Notes table (includes tags column as JSON text)
          this.db.run(
            `CREATE TABLE IF NOT EXISTS notes (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              title TEXT NOT NULL,
              content TEXT,
              owner_id INTEGER NOT NULL,
              tags TEXT DEFAULT '[]',
              created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`,
            (err) => {
              if (err) reject(err);
              else resolve();
            }
          );
      });
      }).then(async () => {
        // Ensure tags column exists for older DBs: run PRAGMA table_info and ALTER if missing
        try {
          const rows = await this.all(`PRAGMA table_info(notes)`);
          const hasTags = rows && rows.some((r) => r && r.name === 'tags');
          if (!hasTags) {
            await this.run(`ALTER TABLE notes ADD COLUMN tags TEXT DEFAULT '[]'`);
            console.log('[DB] Migrated notes table: added tags column');
          }
        } catch (err) {
          // Non-fatal migration error
          console.warn('[DB] Warning while ensuring tags column:', err && err.message);
        }
        return;
    });
  }

  /**
   * Run a query and return all rows
   */
  all(query, params = []) {
    return new Promise((resolve, reject) => {
      this.db.all(query, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  /**
   * Run a query and return single row
   */
  get(query, params = []) {
    return new Promise((resolve, reject) => {
      this.db.get(query, params, (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  /**
   * Run an INSERT/UPDATE/DELETE query
   */
  run(query, params = []) {
    return new Promise((resolve, reject) => {
      this.db.run(query, params, function (err) {
        if (err) reject(err);
        else resolve({ id: this.lastID, changes: this.changes });
      });
    });
  }

  /**
   * Close database connection
   */
  close() {
    return new Promise((resolve, reject) => {
      if (this.db) {
        this.db.close((err) => {
          if (err) reject(err);
          else resolve();
        });
      } else {
        resolve();
      }
    });
  }
}

// Singleton instance
let instance = null;

/**
 * Get or create database instance
 */
async function getDb() {
  if (!instance) {
    instance = new Database();
    await instance.init();
  }
  return instance;
}

module.exports = {
  getDb,
  Database,
};
