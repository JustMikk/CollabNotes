const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const dbPath = path.join(os.tmpdir(), `collabnotes-sharing-${Date.now()}.db`);
process.env.CNB_DB_PATH = dbPath;

const { getDb, resetDbSingleton } = require('@collabnotes/shared-database');
const sharing = require('./index');

async function seed(db) {
  await db.run(`INSERT INTO users (username, password, email) VALUES ('owner', 'x', 'owner@mail.com')`);
  await db.run(`INSERT INTO users (username, password, email) VALUES ('alice', 'x', 'alice@mail.com')`);
  await db.run(`INSERT INTO users (username, password, email) VALUES ('bob', 'x', 'bob@mail.com')`);
  await db.run(`INSERT INTO notes (title, content, owner_id, tags) VALUES ('N1', 'Body', 1, '[]')`);
}

async function run() {
  resetDbSingleton();
  const db = await getDb();
  await seed(db);

  let r = await sharing.shareNote(1, 1, 'alice', 'read');
  assert.equal(r.success, true);

  r = await sharing.shareNote(1, 1, 'missing', 'read');
  assert.equal(r.success, false);

  r = await sharing.shareNote(1, 1, 'alice', 'write');
  assert.equal(r.success, true);
  assert.equal(r.data.permission, 'write');

  r = await sharing.getNoteAccessList(1, 1);
  assert.equal(r.success, true);
  assert.ok(r.data.length >= 1);

  r = await sharing.getNoteAccessList(1, 2);
  assert.equal(r.success, false);

  const permissionOwner = await sharing.getUserPermission(1, 1);
  const permissionShared = await sharing.getUserPermission(1, 2);
  const permissionNone = await sharing.getUserPermission(1, 3);
  assert.equal(permissionOwner, 'write');
  assert.equal(permissionShared, 'write');
  assert.equal(permissionNone, null);

  r = await sharing.getNotesSharedWithUser(2);
  assert.equal(r.success, true);
  assert.equal(r.data.length, 1);

  r = await sharing.revokeAccess(1, 2, 2);
  assert.equal(r.success, false);

  r = await sharing.revokeAccess(1, 1, 2);
  assert.equal(r.success, true);

  const canWriteAfterRevoke = await sharing.canWrite(1, 2);
  assert.equal(canWriteAfterRevoke, false);

  r = await sharing.shareNote(1, 1, 'alice', 'read');
  assert.equal(r.success, true);
  const note = await require('@collabnotes/shared-notes').getNoteById(1, 2);
  assert.equal(note.success, true);
  const update = await require('@collabnotes/shared-notes').updateNote(1, 2, { title: 'x' });
  assert.equal(update.success, false);

  await db.close();
  resetDbSingleton();
  if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
  console.log('shared-sharing tests passed');
}

run().catch(async (error) => {
  console.error(error);
  try {
    const db = await getDb();
    await db.close();
    resetDbSingleton();
  } catch (_e) {
    // ignore cleanup errors
  }
  if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
  process.exit(1);
});
