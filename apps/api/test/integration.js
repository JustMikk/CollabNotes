const path = require('path');
const fs = require('fs');
const { getDb } = require('@collabnotes/shared-database');

process.env.CNB_DB_PATH = path.join(__dirname, '..', '..', 'notes_test.db');

const { start } = require('../index');

function assert(condition, message) {
  if (!condition) throw new Error(message || 'Assertion failed');
}

async function req(method, url, token, body) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try {
    json = text ? JSON.parse(text) : null;
  } catch (e) {
    json = null;
  }
  return { status: res.status, json, text };
}

async function preCleanupTestDb() {
  const dbPath = process.env.CNB_DB_PATH;
  if (fs.existsSync(dbPath)) {
    try {
      fs.unlinkSync(dbPath);
    } catch (e) {
      if (!e || e.code !== 'EBUSY') throw e;
    }
  }
}

async function cleanupTestDb() {
  try {
    const db = await getDb();
    await db.close();
  } catch (e) {
    // ignore if db was never initialized in this process
  }
  const dbPath = process.env.CNB_DB_PATH;
  if (fs.existsSync(dbPath)) {
    try {
      fs.unlinkSync(dbPath);
    } catch (e) {
      if (!e || e.code !== 'EBUSY') throw e;
    }
  }
}

(async () => {
  let server;
  try {
    await preCleanupTestDb();
    server = await start();
    const base = 'http://localhost:3001';

    // register users
    const regOwner = await req('POST', `${base}/api/auth/register`, null, { username: 'owner', password: 'pw1' });
    assert(regOwner.status === 201 && regOwner.json && regOwner.json.success, 'owner register failed');

    const regEditor = await req('POST', `${base}/api/auth/register`, null, { username: 'editor', password: 'pw2' });
    assert(regEditor.status === 201 && regEditor.json && regEditor.json.success, 'editor register failed');

    // login users
    const loginOwner = await req('POST', `${base}/api/auth/login`, null, { username: 'owner', password: 'pw1' });
    assert(loginOwner.status === 200 && loginOwner.json && loginOwner.json.success, 'owner login failed');
    const ownerToken = loginOwner.json.data.token;

    const loginEditor = await req('POST', `${base}/api/auth/login`, null, { username: 'editor', password: 'pw2' });
    assert(loginEditor.status === 200 && loginEditor.json && loginEditor.json.success, 'editor login failed');
    const editorToken = loginEditor.json.data.token;
    const editorId = loginEditor.json.data.user.id;

    // create note
    const create = await req('POST', `${base}/api/notes`, ownerToken, {
      title: 'Integration Note',
      content: 'Initial content',
      tags: ['integration', 'team'],
    });
    assert(
      create.status === 201 && create.json && create.json.id,
      `create note failed: status=${create.status}, body=${create.text}`
    );
    const noteId = create.json.id;

    // share note with editor (write permission)
    const share = await req('POST', `${base}/api/shares`, ownerToken, {
      noteId,
      userId: editorId,
      canWrite: true,
    });
    assert(share.status === 201 && share.json && share.json.success, 'share note failed');

    // editor can read shared note
    const getAsEditor = await req('GET', `${base}/api/notes/${noteId}`, editorToken);
    assert(getAsEditor.status === 200 && getAsEditor.json && getAsEditor.json.id === noteId, 'editor read shared note failed');

    // editor updates shared note
    const edit = await req('PUT', `${base}/api/notes/${noteId}`, editorToken, {
      content: 'Edited by shared editor',
      tags: ['integration', 'edited'],
    });
    assert(edit.status === 200 && edit.json && edit.json.content === 'Edited by shared editor', 'editor update failed');

    // owner deletes note
    const del = await req('DELETE', `${base}/api/notes/${noteId}`, ownerToken);
    assert(del.status === 200, 'owner delete failed');

    // editor can no longer access deleted note
    const getAfterDelete = await req('GET', `${base}/api/notes/${noteId}`, editorToken);
    assert(getAfterDelete.status === 404, 'deleted note should not be accessible');

    console.log('Integration test passed: register -> login -> create -> share -> edit -> delete');
  } catch (err) {
    console.error('Integration test failed:', err.message);
    process.exitCode = 1;
  } finally {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    await cleanupTestDb();
  }
})();
