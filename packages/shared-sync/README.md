# @collabnotes/shared-sync

Real-time collaboration primitives for CollabNotes using WebSockets.

## Connection

Connect to the sync server with an auth token:

`ws://localhost:3002?token=<session-token>`

## Message Protocol

- `join`: `{ "type": "join", "noteId": 123 }`
- `leave`: `{ "type": "leave", "noteId": 123 }`
- `presence`: `{ "type": "presence", "noteId": 123 }`
- `cursor`: `{ "type": "cursor", "noteId": 123, "position": { "line": 5, "ch": 12 } }`
- `edit`: `{ "type": "edit", "noteId": 123, "version": 5, "operations": [...] }`

Server events:

- `presence`: `{ "type": "presence", "noteId": 123, "users": [{ "id": 1, "name": "Alice" }] }`
- `cursor`: `{ "type": "cursor", "noteId": 123, "userId": 1, "position": { "line": 5, "ch": 12 } }`
- `cursor:sync`: `{ "type": "cursor:sync", "noteId": 123, "cursors": [...] }`
- `edit`: `{ "type": "edit", "noteId": 123, "userId": 1, "version": 6, "operations": [...] }`

## Client SDK Example

```js
import { SyncClient } from '@collabnotes/shared-sync/client';

const client = new SyncClient({
  url: 'ws://localhost:3002',
  token: localStorage.getItem('token'),
});

client.on('presence', (message) => {
  console.log('active users', message.users);
});

client.on('cursor', (message) => {
  console.log('cursor update', message.userId, message.position);
});

client.join(123);
client.sendCursor(123, { line: 5, ch: 12 });
```
