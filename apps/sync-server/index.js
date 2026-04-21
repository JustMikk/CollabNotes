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
    return auth.verifyToken(token);
  },
});

httpServer.listen(PORT, () => {
  console.log(`Sync server running on ws://localhost:${PORT}`);
});
