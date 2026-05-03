class SyncClient {
  constructor({ url, token, maxReconnectDelay = 15000 } = {}) {
    this.url = url || 'ws://localhost:3002';
    this.token = token;
    this.maxReconnectDelay = maxReconnectDelay;
    this.ws = null;
    this.handlers = new Map();
    this.reconnectAttempt = 0;
    this.closedManually = false;
    this.connect();
  }

  endpoint() {
    const query = this.token ? `?token=${encodeURIComponent(this.token)}` : '';
    return `${this.url}${query}`;
  }

  connect() {
    this.closedManually = false;
    this.ws = new WebSocket(this.endpoint());
    this.ws.addEventListener('open', () => {
      this.reconnectAttempt = 0;
      this.emit('open');
    });
    this.ws.addEventListener('message', (event) => {
      try {
        const message = JSON.parse(event.data);
        this.emit(message.type, message);
      } catch (_error) {
        this.emit('error', { type: 'error', error: 'Invalid server message' });
      }
    });
    this.ws.addEventListener('close', () => {
      this.emit('close');
      if (!this.closedManually) this.scheduleReconnect();
    });
    this.ws.addEventListener('error', (error) => this.emit('error', error));
  }

  scheduleReconnect() {
    const delay = Math.min(500 * 2 ** this.reconnectAttempt, this.maxReconnectDelay);
    this.reconnectAttempt += 1;
    setTimeout(() => this.connect(), delay);
  }

  close() {
    this.closedManually = true;
    if (this.ws) this.ws.close();
  }

  on(event, handler) {
    const list = this.handlers.get(event) || new Set();
    list.add(handler);
    this.handlers.set(event, list);
    return () => list.delete(handler);
  }

  emit(event, payload) {
    const list = this.handlers.get(event);
    if (!list) return;
    list.forEach((handler) => handler(payload));
  }

  send(payload) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify(payload));
  }

  join(noteId) {
    this.send({ type: 'join', noteId });
  }

  leave(noteId) {
    this.send({ type: 'leave', noteId });
  }

  sendCursor(noteId, position) {
    this.send({ type: 'cursor', noteId, position });
  }

  sendEdit(noteId, version, operations) {
    this.send({ type: 'edit', noteId, version, operations });
  }
}

module.exports = {
  SyncClient,
};
