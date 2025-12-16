# 🐕 Down Boy - URL Watchdog

A simple, no-dependency Node.js server that checks if URLs/sites are responding.

## Quick Start

```bash
# Navigate to the folder
cd down-boy-server

# Run it (no npm install needed!)
node server.js
```

Then open **http://localhost:3000** in your browser.

## Features

- **Direct HTTP checks** - No CORS proxy BS, checks sites directly from the server
- **10 second timeout** - Catches slow/hanging sites like Footprints
- **Self-signed cert support** - Works with internal sites that have self-signed SSL
- **HTTP status codes** - Shows actual response codes (200, 404, 500, etc.)
- **Response time tracking** - See how slow that site really is

## API Endpoints

If you want to script this or integrate elsewhere:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/sites` | GET | List all monitored sites |
| `/api/sites` | POST | Add a site `{ "url": "https://...", "name": "optional" }` |
| `/api/sites/:id` | DELETE | Remove a site |
| `/api/check` | POST | Check a single URL `{ "url": "https://..." }` |
| `/api/check-all` | GET | Check all monitored sites at once |

## Example: Quick CLI Check

```bash
curl -X POST http://localhost:3000/api/check \
  -H "Content-Type: application/json" \
  -d '{"url": "https://footprints.alamo.edu"}'
```

## Running as a Service (Optional)

To keep it running in the background:

```bash
# Using nohup
nohup node server.js > downboy.log 2>&1 &

# Or with PM2 (if installed)
pm2 start server.js --name "down-boy"
```

## Notes

- Sites are stored in memory only - they reset when you restart the server
- Want persistence? Let me know and I can add a JSON file or SQLite store
- Default timeout is 10 seconds (change TIMEOUT_MS in server.js)
