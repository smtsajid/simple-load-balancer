// ✅ Disable strict SSL verification for local/dev environments
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const express = require('express');
const { createProxyServer } = require('http-proxy');
const axios = require('axios');

const app = express();
const proxy = createProxyServer({});

// ⚙️ List of backend servers (can be HTTPS)
let servers = [
  { url: 'https://fintrack-html.onrender.com', alive: true, connections: 0 }
];

// 🩺 Health check every 5 seconds
async function healthCheck() {
  for (const server of servers) {
    try {
      await axios.get(server.url, { timeout: 2000 });
      if (!server.alive) console.log(`✅ ${server.url} is back online`);
      server.alive = true;
    } catch {
      if (server.alive) console.log(`❌ ${server.url} is offline`);
      server.alive = false;
    }
  }
}
setInterval(healthCheck, 5000);

// 🧠 Choose server with least active connections (among healthy ones)
function getLeastConnectionsServer() {
  const aliveServers = servers.filter(s => s.alive);
  if (aliveServers.length === 0) return null;
  return aliveServers.reduce((prev, curr) =>
    prev.connections <= curr.connections ? prev : curr
  );
}

// 🚀 Handle incoming requests and proxy them
app.use((req, res) => {
  const targetServer = getLeastConnectionsServer();

  if (!targetServer) {
    return res.status(503).send('No backend servers available');
  }

  targetServer.connections++;
  console.log(`➡️ Forwarding ${req.method} to: ${targetServer.url}${req.url}`);

  proxy.web(
    req,
    res,
    { target: targetServer.url, changeOrigin: true, secure: false },
    (err) => {
      console.error(`Error proxying to ${targetServer.url}:`, err.message);
      res.status(502).send('Bad Gateway');
    }
  );

  res.on('finish', () => {
    targetServer.connections--;
  });
});

// 🌐 Status route to monitor servers
app.get('/status', (req, res) => {
  res.json({
    servers: servers.map(s => ({
      url: s.url,
      alive: s.alive,
      activeConnections: s.connections
    }))
  });
});

// 🏁 Start load balancer
const PORT = 8080;
app.listen(PORT, () => {
  console.log(`⚖️ Load Balancer (HTTPS + Least Connections) running on http://localhost:${PORT}`);
});
