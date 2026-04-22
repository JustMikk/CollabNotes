/**
 * Shared Auth — register, login, sessions (Objects-as-components; refactor in Iteration 7).
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
 * @param {string} username
 * @param {string} password
 * @param {string} [email]
 * @returns {Promise<{ success: boolean, data?: object, error?: string }>}
 */
async function register(username, password, email) {
  try {
    if (!username || !password) {
      return { success: false, error: 'username and password are required' };
    }
    const db = await getDb();
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
 * @param {string} username
 * @param {string} password
 * @returns {Promise<{ success: boolean, data?: { token: string, user: object }, error?: string }>}
 */
async function login(username, password) {
  try {
    if (!username || !password) {
      return { success: false, error: 'username and password are required' };
    }
    const db = await getDb();
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
 * Validate session token. Returns user object for middleware, or null.
 * @param {string} token
 * @returns {Promise<object|null>}
 */
async function verifyToken(token) {
  try {
    if (!token) return null;
    const db = await getDb();
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
 * @param {string} token
 * @returns {Promise<{ success: boolean, data?: null, error?: string }>}
 */
async function logout(token) {
  try {
    if (!token) {
      return { success: false, error: 'token is required' };
    }
    const db = await getDb();
    await db.run(`DELETE FROM sessions WHERE token = ?`, [token]);
    return { success: true, data: null };
  } catch (err) {
    return { success: false, error: err && err.message ? err.message : String(err) };
  }
}

/**
 * @param {number} id
 * @returns {Promise<{ success: boolean, data?: object, error?: string }>}
 */
async function getUserById(id) {
  try {
    if (!id) {
      return { success: false, error: 'id is required' };
    }
    const db = await getDb();
    const row = await db.get(`SELECT id, username, email, created_at FROM users WHERE id = ?`, [id]);
    if (!row) {
      return { success: false, error: 'User not found' };
    }
    return { success: true, data: row };
  } catch (err) {
    return { success: false, error: err && err.message ? err.message : String(err) };
  }
}

/** API alias — email omitted */
async function registerUser(username, password) {
  return register(username, password, undefined);
}

async function loginUser(username, password) {
  return login(username, password);
}

module.exports = {
  register,
  login,
  verifyToken,
  logout,
  getUserById,
  registerUser,
  loginUser,
};
