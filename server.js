const http = require('http');
const https = require('https');
const { URL } = require('url');
const fs = require('fs');
const path = require('path');

const PORT = 3000;
const TIMEOUT_MS = 10000;

// Sites to monitor - add yours here
let sites = [
  { id: 1, url: 'https://footprints.alamo.edu', name: 'Footprints' }
];

async function checkSite(siteUrl) {
  return new Promise((resolve) => {
    const startTime = Date.now();
    
    try {
      const parsedUrl = new URL(siteUrl);
      const protocol = parsedUrl.protocol === 'https:' ? https : http;
      
      const req = protocol.request({
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
        path: parsedUrl.pathname + parsedUrl.search,
        method: 'HEAD',
        timeout: TIMEOUT_MS,
        rejectUnauthorized: false // Allow self-signed certs (common in internal sites)
      }, (res) => {
        const responseTime = Date.now() - startTime;
        resolve({
          status: res.statusCode < 400 ? 'up' : 'down',
          statusCode: res.statusCode,
          responseTime,
          lastChecked: new Date().toISOString()
        });
      });
      
      req.on('timeout', () => {
        req.destroy();
        resolve({
          status: 'timeout',
          statusCode: null,
          responseTime: Date.now() - startTime,
          lastChecked: new Date().toISOString()
        });
      });
      
      req.on('error', (err) => {
        resolve({
          status: 'error',
          statusCode: null,
          responseTime: Date.now() - startTime,
          error: err.message,
          lastChecked: new Date().toISOString()
        });
      });
      
      req.end();
    } catch (err) {
      resolve({
        status: 'error',
        statusCode: null,
        responseTime: Date.now() - startTime,
        error: err.message,
        lastChecked: new Date().toISOString()
      });
    }
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }
  
  // API Routes
  if (url.pathname === '/api/sites' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(sites));
    return;
  }
  
  if (url.pathname === '/api/sites' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const { url: siteUrl, name } = JSON.parse(body);
        const newSite = {
          id: Date.now(),
          url: siteUrl,
          name: name || new URL(siteUrl).hostname
        };
        sites.push(newSite);
        res.writeHead(201, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(newSite));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON' }));
      }
    });
    return;
  }
  
  if (url.pathname.startsWith('/api/sites/') && req.method === 'DELETE') {
    const id = parseInt(url.pathname.split('/')[3]);
    sites = sites.filter(s => s.id !== id);
    res.writeHead(204);
    res.end();
    return;
  }
  
  if (url.pathname === '/api/check' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const { url: siteUrl } = JSON.parse(body);
        const result = await checkSite(siteUrl);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }
  
  if (url.pathname === '/api/check-all' && req.method === 'GET') {
    const results = await Promise.all(
      sites.map(async (site) => ({
        ...site,
        ...(await checkSite(site.url))
      }))
    );
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(results));
    return;
  }
  
  // Serve the frontend
  if (url.pathname === '/' || url.pathname === '/index.html') {
    const htmlPath = path.join(__dirname, 'index.html');
    fs.readFile(htmlPath, (err, data) => {
      if (err) {
        res.writeHead(500);
        res.end('Error loading page');
        return;
      }
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(data);
    });
    return;
  }
  
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

server.listen(PORT, () => {
  console.log(`
  ╔═══════════════════════════════════════════╗
  ║            🐕 DOWN BOY 🐕                 ║
  ║         URL Watchdog Server               ║
  ╠═══════════════════════════════════════════╣
  ║  Server running at:                       ║
  ║  http://localhost:${PORT}                     ║
  ╚═══════════════════════════════════════════╝
  `);
});
