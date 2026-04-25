const assert = require('assert');
const WebSocket = require('ws');
const { createSyncServer } = require('./index');
const { transformOperations } = require('./ot');

function waitForOpen(ws) {
  return new Promise((resolve) => ws.on('open', resolve));
}

function waitForMessage(ws, type, timeoutMs = 1500) {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      ws.off('message', onMessage);
      resolve(null);
    }, timeoutMs);

    function onMessage(raw) {
      const parsed = JSON.parse(raw.toString());
      if (!type || parsed.type === type) {
        clearTimeout(timer);
        ws.off('message', onMessage);
        resolve(parsed);
      }
    }

    ws.on('message', onMessage);
  });
}

async function run() {
  const sync = createSyncServer({
    port: 3012,
    heartbeatIntervalMs: 1000,
    authenticate: async (req) => {
      const url = new URL(req.url, 'http://localhost');
      const token = url.searchParams.get('token');
      if (!token) return null;
      return { id: Number(token), name: `user-${token}` };
    },
  });

  const c1 = new WebSocket('ws://localhost:3012?token=1');
  const c2 = new WebSocket('ws://localhost:3012?token=2');
  await Promise.all([waitForOpen(c1), waitForOpen(c2)]);

  c1.send(JSON.stringify({ type: 'join', noteId: 99 }));
  c2.send(JSON.stringify({ type: 'join', noteId: 99 }));
  const p = await waitForMessage(c1, 'presence');
  assert.equal(p.noteId, 99);
  assert.ok(Array.isArray(p.users));
  assert.ok(p.users.length >= 1);

  c1.send(JSON.stringify({ type: 'cursor', noteId: 99, position: { line: 2, ch: 3 } }));
  const cursor = await waitForMessage(c2, 'cursor');
  assert.equal(cursor.userId, 1);
  assert.equal(cursor.position.line, 2);

  const c3 = new WebSocket('ws://localhost:3012?token=3');
  await waitForOpen(c3);
  c3.send(JSON.stringify({ type: 'join', noteId: 99 }));
  const cursorSync = await waitForMessage(c3, 'cursor:sync');
  assert.ok(cursorSync && Array.isArray(cursorSync.cursors));
  assert.ok(cursorSync.cursors.some((entry) => entry.userId === 1));

  c1.send(
    JSON.stringify({
      type: 'edit',
      noteId: 99,
      userId: 1,
      version: 0,
      operations: [{ insert: 'hello' }],
    })
  );
  const edit = await waitForMessage(c2, 'edit');
  assert.equal(edit.version, 1);
  assert.equal(edit.operations[0].insert, 'hello');

  const t = transformOperations([{ retain: 2 }, { insert: 'X' }], [{ insert: 'A' }]);
  assert.equal(t[0].retain, 1);

  c2.close();
  const p2 = await waitForMessage(c1, 'presence');
  assert.ok(p2 && Array.isArray(p2.users));
  assert.ok(p2.users.some((user) => user.id === 1));
  assert.ok(!p2.users.some((user) => user.id === 2));

  c1.send(JSON.stringify({ type: 'leave', noteId: 99 }));
  c1.close();
  c3.close();
  sync.close();
}

run()
  .then(() => {
    console.log('shared-sync tests passed');
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
