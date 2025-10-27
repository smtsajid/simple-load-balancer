// disable strict SSL verification 
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const express = require('express');
const { createProxyServer } = require('http-proxy');
const axios = require('axios');

const app = express();
const proxy = createProxyServer({});

// List of  servers
let servers = [
  { url: 'https://fintrack-html.onrender.com', alive: true, connections: 0 },
  { url: 'http://localhost:3001', alive: true, connections: 0 },
  { url: 'http://localhost:3002', alive: true, connections: 0 }
];

// health check 
async function healthCheck() {
  for (const server of servers) {
    try {
      await axios.get(server.url, { timeout: 2000 });
      if (!server.alive) console.log(` ${server.url} is back online`);
      server.alive = true;
    } catch {
      if (server.alive) console.log(` ${server.url} is offline`);
      server.alive = false;
    }
  }
}
setInterval(healthCheck, 5000);


function getLeastConnectionsServer() {
  const aliveServers = servers.filter(s => s.alive);
  if (aliveServers.length === 0) return null;
  return aliveServers.reduce((prev, curr) =>
    prev.connections <= curr.connections ? prev : curr
  );
}

// handle incoming requests 
app.use((req, res) => {
  const targetServer = getLeastConnectionsServer();

  if (!targetServer) {
    return res.status(503).send('n0 servers available');
  }

  targetServer.connections++;
  

  proxy.web(
    req,
    res,
    { target: targetServer.url, changeOrigin: true, secure: false },

  );

  res.on('finish', () => {
    targetServer.connections--;
  });
});


//start
const PORT = 8080;
app.listen(PORT, () => {
  console.log(` Load balancer running on http://localhost:${PORT}`);
});
