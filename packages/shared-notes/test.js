const path = require('path');
const fs = require('fs');

// Use test database file
process.env.CNB_DB_PATH = path.join(__dirname, '..', '..', 'notes_test.db');

const { getDb } = require('../shared-database');
const notes = require('./index');
const exportUtil = require('./export');

function assert(cond, msg) {
  if (!cond) throw new Error(msg || 'Assertion failed');
}

async function cleanup() {
  const dbPath = process.env.CNB_DB_PATH;
  try {
    if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
  } catch (e) {
    console.warn('cleanup warning', e && e.message);
  }
}

async function run() {
  await cleanup();
  const db = await getDb();

  console.log('DB initialized at', process.env.CNB_DB_PATH);

  // Test createNote valid
  const r1 = await notes.createNote(1, 'Test Note', 'Hello world', ['work','urgent']);
  assert(r1.success, 'createNote should succeed');
  const note = r1.data;
  assert(note.id, 'note id present');
  assert(Array.isArray(note.tags) && note.tags.includes('work'), 'tags saved');

  // Test createNote invalid
  const rInv = await notes.createNote(null, '', '');
  assert(!rInv.success, 'createNote invalid should fail');

  // Test getUserNotes owner vs non-owner
  const rUser = await notes.getUserNotes(1);
  assert(rUser.success && rUser.data.length >= 1, 'getUserNotes should return notes for owner');

  const rUser2 = await notes.getUserNotes(2);
  assert(rUser2.success && Array.isArray(rUser2.data), 'getUserNotes for other user returns array');

  // Test getNoteById with permissions
  const rGet = await notes.getNoteById(note.id, 1);
  assert(rGet.success && rGet.data.id === note.id, 'owner can get note');

  const rGetFail = await notes.getNoteById(note.id, 2);
  assert(!rGetFail.success, 'non-owner cannot get note');

  // Test updateNote saves version
  const upd = await notes.updateNote(note.id, 1, { title: 'Updated', content: 'Changed', tags: ['personal'] });
  assert(upd.success && upd.data.title === 'Updated', 'updateNote should update title');

  // Check versions saved
  const versions = await notes.getNoteVersions(note.id, 1);
  assert(versions.success && versions.data.length >= 1, 'getNoteVersions should return at least one version');
  const firstVersion = versions.data[0];

  // Test restoreVersion
  const restore = await notes.restoreVersion(note.id, firstVersion.id, 1);
  assert(restore.success, 'restoreVersion should succeed');

  // Test deleteNote owner only
  const r2 = await notes.createNote(2, 'Other Note', 'By user2', []);
  assert(r2.success, 'create other note');
  const delFail = await notes.deleteNote(r2.data.id, 1);
  assert(!delFail.success, 'non-owner cannot delete');
  const delOk = await notes.deleteNote(r2.data.id, 2);
  assert(delOk.success, 'owner can delete');

  // Test getNotesByTag
  await notes.createNote(1, 'Tagged2', 'with tag', ['tagA']);
  const byTag = await notes.getNotesByTag(1, 'tagA');
  assert(byTag.success && byTag.data.length >= 1, 'getNotesByTag should find notes');

  // Test exports
  const noteForExport = (await notes.createNote(1, 'ExportMe', 'ExportContent', ['e'])).data;
  const j = exportUtil.exportToJSON(noteForExport);
  const md = exportUtil.exportToMarkdown(noteForExport);
  const txt = exportUtil.exportToText(noteForExport);
  assert(j && md && txt, 'export outputs present');

  console.log('All tests passed');

  await db.close();
  // cleanup test DB
  await cleanup();
}

run().catch(async (err) => {
  console.error('Test failed:', err && err.message);
  try { const db = await getDb(); await db.close(); } catch (e) {}
  process.exitCode = 1;
});
