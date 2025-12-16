const http = require('http');
const https = require('https');
const { URL } = require('url');
const fs = require('fs');
const path = require('path');

const PORT = 3000;
const TIMEOUT_MS = 10000;
const DATA_FILE = path.join(__dirname, 'sites-data.json');

// Load or initialize data store
function loadData() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    }
  } catch (err) {
    console.error('Error loading data file:', err.message);
  }
  return { users: {} };
}

function saveData(data) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('Error saving data file:', err.message);
  }
}

function getUserSites(userId) {
  const data = loadData();
  if (!data.users[userId]) {
    data.users[userId] = { sites: [] };
    saveData(data);
  }
  return data.users[userId].sites;
}

function setUserSites(userId, sites) {
  const data = loadData();
  if (!data.users[userId]) {
    data.users[userId] = {};
  }
  data.users[userId].sites = sites;
  saveData(data);
}

async function checkSite(siteUrl, method = 'HEAD') {
  return new Promise((resolve) => {
    const startTime = Date.now();
    
    try {
      const parsedUrl = new URL(siteUrl);
      const protocol = parsedUrl.protocol === 'https:' ? https : http;
      
      const req = protocol.request({
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
        path: parsedUrl.pathname + parsedUrl.search,
        method: method,
        timeout: TIMEOUT_MS,
        rejectUnauthorized: false,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
        }
      }, (res) => {
        // Consume response data to free up memory
        res.resume();
        
        const responseTime = Date.now() - startTime;
        
        // If HEAD request got 403/405, retry with GET
        if (method === 'HEAD' && (res.statusCode === 403 || res.statusCode === 405)) {
          resolve(checkSite(siteUrl, 'GET'));
          return;
        }
        
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
        // If HEAD request failed entirely, retry with GET
        if (method === 'HEAD') {
          resolve(checkSite(siteUrl, 'GET'));
          return;
        }
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

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-User-Id');
  
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }
  
  // Get user ID from header
  const userId = req.headers['x-user-id'];
  
  // API Routes
  if (url.pathname === '/api/sites' && req.method === 'GET') {
    if (!userId) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'X-User-Id header required' }));
      return;
    }
    const sites = getUserSites(userId);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(sites));
    return;
  }
  
  if (url.pathname === '/api/sites' && req.method === 'POST') {
    if (!userId) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'X-User-Id header required' }));
      return;
    }
    try {
      const { url: siteUrl, name } = await parseBody(req);
      const sites = getUserSites(userId);
      const newSite = {
        id: Date.now(),
        url: siteUrl,
        name: name || new URL(siteUrl).hostname
      };
      sites.push(newSite);
      setUserSites(userId, sites);
      res.writeHead(201, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(newSite));
    } catch (err) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid JSON' }));
    }
    return;
  }
  
  if (url.pathname.startsWith('/api/sites/') && req.method === 'DELETE') {
    if (!userId) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'X-User-Id header required' }));
      return;
    }
    const id = parseInt(url.pathname.split('/')[3]);
    let sites = getUserSites(userId);
    sites = sites.filter(s => s.id !== id);
    setUserSites(userId, sites);
    res.writeHead(204);
    res.end();
    return;
  }
  
  if (url.pathname === '/api/check' && req.method === 'POST') {
    try {
      const { url: siteUrl } = await parseBody(req);
      const result = await checkSite(siteUrl);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result));
    } catch (err) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }
  
  if (url.pathname === '/api/check-all' && req.method === 'GET') {
    if (!userId) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'X-User-Id header required' }));
      return;
    }
    const sites = getUserSites(userId);
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
  
  // Get list of all users (for admin/visibility)
  if (url.pathname === '/api/users' && req.method === 'GET') {
    const data = loadData();
    const users = Object.keys(data.users).map(id => ({
      id,
      siteCount: data.users[id].sites?.length || 0
    }));
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(users));
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
  ║                                           ║
  ║  Data stored in: sites-data.json          ║
  ╚═══════════════════════════════════════════╝
  `);
});
