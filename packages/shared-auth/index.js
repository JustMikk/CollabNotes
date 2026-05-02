/**
 * CollabNotes authentication — Category 4 (Architectural Units): {@link AuthComponent}, `required.database`, `provided` surface.
 * @module @collabnotes/shared-auth
 */

const crypto = require('crypto');
const bcrypt = require('bcrypt');

let getDb;
try {
  ({ getDb } = require('@collabnotes/shared-database'));
} catch (e) {
  ({ getDb } = require('../shared-database'));
}

const BCRYPT_ROUNDS = 10;
const SESSION_DAYS = 7;

function sessionExpiresAt() {
  return new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000).toISOString();
}

function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Auth component: explicit required service (`database` = `getDb`) and `provided` API map.
 */
class AuthComponent {
  /**
   * @param {{ database: () => Promise<any> }} dependencies `database` must be the async `getDb` from `@collabnotes/shared-database`.
   */
  constructor(dependencies) {
    if (!dependencies || typeof dependencies.database !== 'function') {
      throw new Error('AuthComponent requires dependencies.database (async getDb function)');
    }
    this.required = { database: dependencies.database };

    this.provided = {
      register: (username, password, email) => this.register(username, password, email),
      login: (username, password) => this.login(username, password),
      verifyToken: (token) => this.verifyToken(token),
      logout: (token) => this.logout(token),
      getUserById: (id) => this.getUserById(id),
      updateProfile: (userId, updates) => this.updateProfile(userId, updates),
      changePassword: (userId, oldPassword, newPassword) =>
        this.changePassword(userId, oldPassword, newPassword),
      deleteAccount: (userId) => this.deleteAccount(userId),
      cleanupExpiredSessions: () => this.cleanupExpiredSessions(),
    };
  }

  /** @private */
  async _db() {
    return this.required.database();
  }

  /** Delete expired session rows (also invoked automatically before login and verifyToken).
   * @returns {Promise<{ success: boolean, data?: { cleaned: boolean }, error?: string }>}
   */
  async cleanupExpiredSessions() {
    try {
      const db = await this._db();
      const now = new Date().toISOString();
      await db.run(`DELETE FROM sessions WHERE expires_at < ?`, [now]);
      return { success: true, data: { cleaned: true } };
    } catch (err) {
      return { success: false, error: err && err.message ? err.message : String(err) };
    }
  }

  /**
   * Register a new user with bcrypt-hashed password.
   * @param {string} username Unique username (case-insensitive duplicate check).
   * @param {string} password Plain-text password.
   * @param {string} [email] Optional email.
   * @returns {Promise<{ success: boolean, data?: { id: number, username: string, email: string|null, created_at: string }, error?: string }>}
   */
  async register(username, password, email) {
    try {
      if (!username || !password) {
        return { success: false, error: 'username and password are required' };
      }
      const db = await this._db();
      const key = String(username).trim();
      const existing = await db.get(`SELECT id FROM users WHERE lower(username) = lower(?)`, [key]);
      if (existing) {
        return { success: false, error: 'Username already taken' };
      }
      const hash = await bcrypt.hash(String(password), BCRYPT_ROUNDS);
      const result = await db.run(
        `INSERT INTO users (username, password, email) VALUES (?, ?, ?)`,
        [key, hash, email != null ? String(email) : null]
      );
      const row = await db.get(`SELECT id, username, email, created_at FROM users WHERE id = ?`, [result.id]);
      return { success: true, data: row };
    } catch (err) {
      return { success: false, error: err && err.message ? err.message : String(err) };
    }
  }

  /**
   * Authenticate user and issue a session token (7-day expiry).
   * @param {string} username
   * @param {string} password
   * @returns {Promise<{ success: boolean, data?: { token: string, user: { id: number, username: string, email: string|null } }, error?: string }>}
   */
  async login(username, password) {
    try {
      if (!username || !password) {
        return { success: false, error: 'username and password are required' };
      }
      await this.cleanupExpiredSessions();
      const db = await this._db();
      const key = String(username).trim();
      const row = await db.get(`SELECT * FROM users WHERE lower(username) = lower(?)`, [key]);
      if (!row) {
        return { success: false, error: 'Invalid credentials' };
      }
      const ok = await bcrypt.compare(String(password), row.password);
      if (!ok) {
        return { success: false, error: 'Invalid credentials' };
      }
      const token = generateToken();
      const expiresAt = sessionExpiresAt();
      await db.run(`INSERT INTO sessions (user_id, token, expires_at) VALUES (?, ?, ?)`, [
        row.id,
        token,
        expiresAt,
      ]);
      const user = { id: row.id, username: row.username, email: row.email };
      return { success: true, data: { token, user } };
    } catch (err) {
      return { success: false, error: err && err.message ? err.message : String(err) };
    }
  }

  /**
   * Resolve a bearer token to the current user, or `null` if invalid/expired.
   * @param {string|null|undefined} token Session token string.
   * @returns {Promise<{ id: number, username: string, email: string|null }|null>}
   */
  async verifyToken(token) {
    try {
      if (!token) return null;
      await this.cleanupExpiredSessions();
      const db = await this._db();
      const row = await db.get(
        `SELECT u.id, u.username, u.email, s.expires_at AS session_expires
         FROM sessions s
         INNER JOIN users u ON u.id = s.user_id
         WHERE s.token = ?`,
        [token]
      );
      if (!row) return null;
      if (row.session_expires && new Date(row.session_expires) <= new Date()) {
        await db.run(`DELETE FROM sessions WHERE token = ?`, [token]);
        return null;
      }
      return { id: row.id, username: row.username, email: row.email };
    } catch (err) {
      return null;
    }
  }

  /**
   * Revoke a session by token.
   * @param {string} token
   * @returns {Promise<{ success: boolean, data?: null, error?: string }>}
   */
  async logout(token) {
    try {
      if (!token) {
        return { success: false, error: 'token is required' };
      }
      const db = await this._db();
      await db.run(`DELETE FROM sessions WHERE token = ?`, [token]);
      return { success: true, data: null };
    } catch (err) {
      return { success: false, error: err && err.message ? err.message : String(err) };
    }
  }

  /**
   * Load public user fields by id (never includes password hash).
   * @param {number} id User id.
   * @returns {Promise<{ success: boolean, data?: { id: number, username: string, email: string|null, created_at: string }, error?: string }>}
   */
  async getUserById(id) {
    try {
      if (!id) {
        return { success: false, error: 'id is required' };
      }
      const db = await this._db();
      const row = await db.get(`SELECT id, username, email, created_at FROM users WHERE id = ?`, [id]);
      if (!row) {
        return { success: false, error: 'User not found' };
      }
      return { success: true, data: row };
    } catch (err) {
      return { success: false, error: err && err.message ? err.message : String(err) };
    }
  }

  /**
   * Update email and/or password for a user (passwords are re-hashed).
   * @param {number} userId
   * @param {{ email?: string|null, password?: string }} updates
   * @returns {Promise<{ success: boolean, data?: { id: number, username: string, email: string|null, created_at: string }, error?: string }>}
   */
  async updateProfile(userId, updates) {
    try {
      if (!userId || !updates || typeof updates !== 'object') {
        return { success: false, error: 'userId and updates object are required' };
      }
      const db = await this._db();
      const existing = await db.get(`SELECT id FROM users WHERE id = ?`, [userId]);
      if (!existing) {
        return { success: false, error: 'User not found' };
      }
      const fields = [];
      const vals = [];
      if (updates.email !== undefined) {
        fields.push('email = ?');
        vals.push(updates.email === null ? null : String(updates.email));
      }
      if (updates.password !== undefined) {
        const hash = await bcrypt.hash(String(updates.password), BCRYPT_ROUNDS);
        fields.push('password = ?');
        vals.push(hash);
      }
      if (fields.length === 0) {
        return { success: false, error: 'No updatable fields' };
      }
      vals.push(userId);
      await db.run(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, vals);
      const row = await db.get(`SELECT id, username, email, created_at FROM users WHERE id = ?`, [userId]);
      return { success: true, data: row };
    } catch (err) {
      return { success: false, error: err && err.message ? err.message : String(err) };
    }
  }

  /**
   * Change password after verifying the current password.
   * @param {number} userId
   * @param {string} oldPassword
   * @param {string} newPassword
   * @returns {Promise<{ success: boolean, data?: { id: number }, error?: string }>}
   */
  async changePassword(userId, oldPassword, newPassword) {
    try {
      if (!userId || !oldPassword || !newPassword) {
        return { success: false, error: 'userId, oldPassword and newPassword are required' };
      }
      const db = await this._db();
      const row = await db.get(`SELECT * FROM users WHERE id = ?`, [userId]);
      if (!row) {
        return { success: false, error: 'User not found' };
      }
      const ok = await bcrypt.compare(String(oldPassword), row.password);
      if (!ok) {
        return { success: false, error: 'Invalid credentials' };
      }
      const hash = await bcrypt.hash(String(newPassword), BCRYPT_ROUNDS);
      await db.run(`UPDATE users SET password = ? WHERE id = ?`, [hash, userId]);
      return { success: true, data: { id: userId } };
    } catch (err) {
      return { success: false, error: err && err.message ? err.message : String(err) };
    }
  }

  /**
   * Delete the user and cascade-related rows (sessions, shares, owned notes, versions, note_shares).
   * @param {number} userId
   * @returns {Promise<{ success: boolean, data?: null, error?: string }>}
   */
  async deleteAccount(userId) {
    try {
      if (!userId) {
        return { success: false, error: 'userId is required' };
      }
      const db = await this._db();
      const row = await db.get(`SELECT id FROM users WHERE id = ?`, [userId]);
      if (!row) {
        return { success: false, error: 'User not found' };
      }

      await db.run('BEGIN IMMEDIATE');
      try {
        await db.run(`DELETE FROM sessions WHERE user_id = ?`, [userId]);
        await db.run(
          `DELETE FROM note_versions WHERE note_id IN (SELECT id FROM notes WHERE owner_id = ?)`,
          [userId]
        );
        await db.run(`DELETE FROM note_versions WHERE updated_by = ?`, [userId]);
        await db.run(
          `DELETE FROM note_shares WHERE owner_id = ? OR shared_with_id = ? OR note_id IN (SELECT id FROM notes WHERE owner_id = ?)`,
          [userId, userId, userId]
        );
        await db.run(
          `DELETE FROM shares WHERE user_id = ? OR note_id IN (SELECT id FROM notes WHERE owner_id = ?)`,
          [userId, userId]
        );
        await db.run(`DELETE FROM notes WHERE owner_id = ?`, [userId]);
        await db.run(`DELETE FROM users WHERE id = ?`, [userId]);
        await db.run('COMMIT');
      } catch (e) {
        try {
          await db.run('ROLLBACK');
        } catch (r) {
          /* ignore */
        }
        throw e;
      }
      return { success: true, data: null };
    } catch (err) {
      return { success: false, error: err && err.message ? err.message : String(err) };
    }
  }
}

/**
 * Factory for tests or alternate DB injection.
 * @param {{ database: () => Promise<any> }} dependencies
 */
function createAuth(dependencies) {
  return new AuthComponent(dependencies);
}

const defaultAuth = new AuthComponent({ database: getDb });

/**
 * Same as {@link AuthComponent#register} but omits email (REST `/register` compatibility).
 */
async function registerUser(username, password) {
  return defaultAuth.register(username, password, undefined);
}

/**
 * Same as {@link AuthComponent#login} (REST `/login` compatibility).
 */
async function loginUser(username, password) {
  return defaultAuth.login(username, password);
}

module.exports = {
  AuthComponent,
  createAuth,
  register: defaultAuth.register.bind(defaultAuth),
  login: defaultAuth.login.bind(defaultAuth),
  verifyToken: defaultAuth.verifyToken.bind(defaultAuth),
  logout: defaultAuth.logout.bind(defaultAuth),
  getUserById: defaultAuth.getUserById.bind(defaultAuth),
  updateProfile: defaultAuth.updateProfile.bind(defaultAuth),
  changePassword: defaultAuth.changePassword.bind(defaultAuth),
  deleteAccount: defaultAuth.deleteAccount.bind(defaultAuth),
  registerUser,
  loginUser,
  cleanupExpiredSessions: defaultAuth.cleanupExpiredSessions.bind(defaultAuth),
};
