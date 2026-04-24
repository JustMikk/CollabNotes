/**
 * shared-auth tests — uses isolated test.db (see CNB_DB_PATH).
 */

const path = require('path');
const fs = require('fs');
const assert = require('assert');

const TEST_DB = path.join(__dirname, 'test.db');

process.env.CNB_DB_PATH = TEST_DB;

const { getDb, resetDbSingleton } = require('@collabnotes/shared-database');
const {
  register,
  login,
  verifyToken,
  logout,
  cleanupExpiredSessions,
} = require('./index.js');

async function wipeDb() {
  try {
    const db = await getDb();
    await db.close();
  } catch (e) {
    // ignore
  }
  resetDbSingleton();
  if (fs.existsSync(TEST_DB)) {
    try {
      fs.unlinkSync(TEST_DB);
    } catch (e) {
      if (!e || e.code !== 'EBUSY') throw e;
    }
  }
}

(async () => {
  try {
    await wipeDb();

    // Register success
    const r1 = await register('alice', 'secret1', 'a@ex.com');
    assert.strictEqual(r1.success, true, 'register should succeed');
    assert.strictEqual(r1.data.username, 'alice');

    // Duplicate username
    const r2 = await register('Alice', 'x', null);
    assert.strictEqual(r2.success, false, 'duplicate register should fail');

    // Login success
    const l1 = await login('alice', 'secret1');
    assert.strictEqual(l1.success, true, 'login should succeed');
    const token = l1.data.token;
    assert.ok(token && token.length > 8, 'token present');

    // Login wrong password
    const l2 = await login('alice', 'wrong');
    assert.strictEqual(l2.success, false, 'wrong password should fail');

    // Verify valid token
    const u1 = await verifyToken(token);
    assert.ok(u1 && u1.id, 'verify valid token should return user');
    assert.strictEqual(u1.username, 'alice');

    // Logout
    const out = await logout(token);
    assert.strictEqual(out.success, true, 'logout should succeed');
    const u2 = await verifyToken(token);
    assert.strictEqual(u2, null, 'token should be invalid after logout');

    // Invalid token
    const u3 = await verifyToken('nope');
    assert.strictEqual(u3, null, 'invalid token should be null');

    // Expired session: new login, then force expiry
    const l3 = await login('alice', 'secret1');
    assert.strictEqual(l3.success, true);
    const t2 = l3.data.token;
    const db = await getDb();
    await db.run(`UPDATE sessions SET expires_at = ? WHERE token = ?`, [
      new Date(Date.now() - 1000).toISOString(),
      t2,
    ]);
    const u4 = await verifyToken(t2);
    assert.strictEqual(u4, null, 'expired session should not verify');

    // cleanupExpiredSessions should be safe
    const c = await cleanupExpiredSessions();
    assert.strictEqual(c.success, true, 'cleanup should succeed');

    await wipeDb();
    console.log('shared-auth tests: all passed');
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
})();
