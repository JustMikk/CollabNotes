/**
 * shared-database tests — isolated DB file via CNB_DB_PATH.
 */

const path = require('path');
const fs = require('fs');
const assert = require('assert');

const TEST_DB = path.join(__dirname, 'test.db');
process.env.CNB_DB_PATH = TEST_DB;

const { Database, getDb, resetDbSingleton } = require('./index.js');

async function wipe() {
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
    await wipe();

    const db = await getDb();

    const tex = await db.tableExists('users');
    assert.strictEqual(tex.success, true);
    assert.strictEqual(tex.data, true);

    const badTbl = await db.tableExists('users; DROP TABLE users--');
    assert.strictEqual(badTbl.success, false);

    const ins = await db.insert('users', {
      username: 'u1',
      password: 'x',
      email: 'u@x.com',
    });
    assert.strictEqual(ins.success, true);
    assert.ok(ins.data.id);

    const dup = await db.insert('users', {
      username: 'u1',
      password: 'y',
      email: 'z@z.com',
    });
    assert.strictEqual(dup.success, false);
    assert.ok(String(dup.error).includes('Constraint') || dup.error.includes('UNIQUE'));

    const gid = await db.getById('users', ins.data.id);
    assert.strictEqual(gid.success, true);
    assert.strictEqual(gid.data.username, 'u1');

    const missing = await db.getById('users', 999999);
    assert.strictEqual(missing.success, true);
    assert.strictEqual(missing.data, null);

    const upd = await db.update('users', ins.data.id, { email: 'new@x.com' });
    assert.strictEqual(upd.success, true);

    const q = await db.query('SELECT email FROM users WHERE id = ?', [ins.data.id]);
    assert.strictEqual(q.success, true);
    assert.strictEqual(q.data[0].email, 'new@x.com');

    const del = await db.delete('users', ins.data.id);
    assert.strictEqual(del.success, true);

    await db.close();
    resetDbSingleton();

    const db2 = await getDb();
    const again = await db2.insert('users', {
      username: 'after_reopen',
      password: 'p',
      email: null,
    });
    assert.strictEqual(again.success, true);

    await wipe();
    console.log('shared-database tests: all passed');
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
})();
