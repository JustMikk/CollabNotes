const { createServer } = require('http');
const { createSyncServer } = require('@collabnotes/shared-sync');
const auth = require('@collabnotes/shared-auth');

const PORT = Number(process.env.SYNC_PORT || 3002);

function tokenFromReq(req) {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    return url.searchParams.get('token');
  } catch (_error) {
    return null;
  }
}

const httpServer = createServer((_req, res) => {
  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({ status: 'ok', service: 'sync-server' }));
});

createSyncServer({
  server: httpServer,
  authenticate: async (req) => {
    const token = tokenFromReq(req);
    if (!token) return null;
    if (typeof auth.authenticateToken === 'function') {
      const result = await auth.authenticateToken(token);
      if (!result || !result.success || !result.data) return null;
      return {
        id: result.data.id,
        username: result.data.username,
        name: result.data.username,
        email: result.data.email || null,
      };
    }
    const user = await auth.verifyToken(token);
    if (!user) return null;
    return {
      id: user.id,
      username: user.username,
      name: user.username,
      email: user.email || null,
    };
  },
});

httpServer.listen(PORT, () => {
  console.log(`Sync server running on ws://localhost:${PORT}`);
});
