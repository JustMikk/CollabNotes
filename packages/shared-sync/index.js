const { WebSocketServer } = require('ws');
const { transformOperations, applyOperations } = require('./ot');

function safeSend(ws, payload) {
  if (!ws || ws.readyState !== 1) return;
  ws.send(JSON.stringify(payload));
}

class SyncServer {
  constructor(options = {}) {
    this.wss = options.server
      ? new WebSocketServer({ server: options.server })
      : new WebSocketServer({ port: options.port || 3002 });
    this.authenticate = options.authenticate || (async () => null);
    this.rooms = new Map();
    this.noteVersions = new Map();
    this.noteHistory = new Map();
    this.heartbeatIntervalMs = options.heartbeatIntervalMs || 30000;
    this.heartbeat = null;
    this.setup();
  }

  setup() {
    this.wss.on('connection', async (ws, req) => {
      ws.isAlive = true;
      ws.rooms = new Set();
      ws.user = await this.authenticate(req);
      if (!ws.user) {
        safeSend(ws, { type: 'error', error: 'Unauthorized' });
        ws.close(1008, 'Unauthorized');
        return;
      }

      ws.on('pong', () => {
        ws.isAlive = true;
        ws.lastPongAt = Date.now();
      });

      ws.on('message', (raw) => this.handleMessage(ws, raw));
      ws.on('close', () => this.handleDisconnect(ws));
      ws.on('error', () => this.handleDisconnect(ws));
    });

    this.heartbeat = setInterval(() => {
      this.wss.clients.forEach((client) => {
        if (!client.isAlive) {
          this.handleDisconnect(client);
          client.terminate();
          return;
        }
        client.isAlive = false;
        client.ping();
      });
    }, this.heartbeatIntervalMs);
  }

  parseMessage(raw) {
    try {
      return JSON.parse(raw.toString());
    } catch (_error) {
      return null;
    }
  }

  roomFor(noteId) {
    if (!this.rooms.has(noteId)) {
      this.rooms.set(noteId, {
        clients: new Set(),
        users: new Map(),
        cursors: new Map(),
      });
    }
    return this.rooms.get(noteId);
  }

  broadcast(noteId, payload, exceptWs = null) {
    const room = this.rooms.get(noteId);
    if (!room) return;
    room.clients.forEach((client) => {
      if (client !== exceptWs) safeSend(client, payload);
    });
  }

  broadcastPresence(noteId) {
    const users = this.getActiveUsers(noteId);
    this.broadcast(noteId, { type: 'presence', noteId, users });
  }

  getActiveUsers(noteId) {
    const room = this.rooms.get(noteId);
    if (!room) return [];
    return Array.from(room.users.values()).map((entry) => entry.user);
  }

  joinRoom(ws, noteId) {
    const room = this.roomFor(noteId);
    room.clients.add(ws);
    room.users.set(ws, {
      user: { id: ws.user.id, name: ws.user.name || ws.user.username },
      lastSeenAt: Date.now(),
    });
    ws.rooms.add(noteId);

    const cursors = Array.from(room.cursors.entries()).map(([userId, position]) => ({
      userId,
      position,
    }));
    safeSend(ws, { type: 'cursor:sync', noteId, cursors });
    this.broadcastPresence(noteId);
  }

  leaveRoom(ws, noteId) {
    const room = this.rooms.get(noteId);
    if (!room) return;
    room.clients.delete(ws);
    room.users.delete(ws);
    room.cursors.delete(ws.user.id);
    ws.rooms.delete(noteId);
    if (room.clients.size === 0) {
      this.rooms.delete(noteId);
    } else {
      this.broadcastPresence(noteId);
    }
  }

  refreshPresence(ws) {
    if (!ws || !ws.rooms) return;
    const now = Date.now();
    Array.from(ws.rooms).forEach((noteId) => {
      const room = this.rooms.get(noteId);
      if (!room) return;
      const entry = room.users.get(ws);
      if (!entry) return;
      entry.lastSeenAt = now;
    });
  }

  broadcastCursor(noteId, userId, position) {
    const room = this.rooms.get(noteId);
    if (!room) return;
    room.cursors.set(userId, position);
    this.broadcast(noteId, { type: 'cursor', noteId, userId, position });
  }

  processEdit(ws, message) {
    const { noteId, userId, version = 0, operations = [] } = message;
    if (!Array.isArray(operations)) return;
    const serverVersion = this.noteVersions.get(noteId) || 0;
    const history = this.noteHistory.get(noteId) || [];
    let transformed = operations;

    if (version < serverVersion) {
      const pending = history.slice(version);
      pending.forEach((remoteOps) => {
        transformed = transformOperations(transformed, remoteOps);
      });
    }

    const nextVersion = serverVersion + 1;
    const nextHistory = history.concat([transformed]).slice(-100);
    this.noteVersions.set(noteId, nextVersion);
    this.noteHistory.set(noteId, nextHistory);

    const content = applyOperations('', transformed);
    this.broadcast(noteId, {
      type: 'edit',
      noteId,
      userId: userId || ws.user.id,
      version: nextVersion,
      operations: transformed,
      content,
    });
  }

  handleMessage(ws, raw) {
    const message = this.parseMessage(raw);
    if (!message || !message.type) {
      safeSend(ws, { type: 'error', error: 'Invalid message' });
      return;
    }
    this.refreshPresence(ws);

    const noteId = Number(message.noteId);
    if (Number.isNaN(noteId) || noteId <= 0) {
      safeSend(ws, { type: 'error', error: 'Invalid noteId' });
      return;
    }

    switch (message.type) {
      case 'join':
        this.joinRoom(ws, noteId);
        break;
      case 'leave':
        this.leaveRoom(ws, noteId);
        break;
      case 'presence':
        this.broadcastPresence(noteId);
        break;
      case 'cursor':
        this.broadcastCursor(noteId, ws.user.id, message.position);
        break;
      case 'edit':
        this.processEdit(ws, message);
        break;
      default:
        safeSend(ws, { type: 'error', error: `Unsupported type: ${message.type}` });
    }
  }

  handleDisconnect(ws) {
    if (!ws.rooms) return;
    Array.from(ws.rooms).forEach((noteId) => this.leaveRoom(ws, noteId));
  }

  close() {
    if (this.heartbeat) clearInterval(this.heartbeat);
    this.wss.close();
  }
}

function createSyncServer(options) {
  return new SyncServer(options);
}

module.exports = {
  SyncServer,
  createSyncServer,
};
