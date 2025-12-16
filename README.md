# 🐕 Down Boy v2 - URL Watchdog

A simple, zero-dependency Node.js server for checking if URLs/sites are responding.  
**Now with per-user watchlists!**

## Quick Start

```bash
cd down-boy-v2
node server.js
```

Open **http://localhost:3000** (or your server IP) in a browser.

## What's New in v2

- **Per-user site lists** - Each team member gets their own watchlist
- **Persistent storage** - Sites saved to `sites-data.json`, survives restarts
- **User identification** - Simple name-based login (no passwords)

## How It Works

```
┌──────────────┐                    ┌──────────────┐                  ┌─────────────┐
│   Browser    │  ──── HTTP ────►   │  Down Boy    │  ── HTTP HEAD ─► │ Target Site │
│  (Frontend)  │  X-User-Id header  │   Server     │   Direct check   │             │
└──────────────┘                    └──────────────┘                  └─────────────┘
                                           │
                                           ▼
                                    ┌──────────────┐
                                    │ sites-data   │
                                    │    .json     │
                                    └──────────────┘
```

1. User enters their name (stored in browser localStorage)
2. All API requests include `X-User-Id` header
3. Server stores each user's sites separately in JSON file
4. Site checks are direct HTTP HEAD requests (no CORS issues)

## Team Deployment

Run on a shared server everyone can access:

```bash
# On a server (e.g., 10.0.0.50)
node server.js

# Team members access via browser:
# http://10.0.0.50:3000
```

Each person enters their name and gets their own watchlist.

## Data Storage

Sites are stored in `sites-data.json`:

```json
{
  "users": {
    "andrew": {
      "sites": [
        { "id": 1234567890, "url": "https://footprints.alamo.edu", "name": "Footprints" }
      ]
    },
    "mike": {
      "sites": [
        { "id": 1234567891, "url": "https://example.com", "name": "example.com" }
      ]
    }
  }
}
```

## API Reference

All endpoints require `X-User-Id` header (except `/api/check` and `/api/users`).

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/sites` | GET | Get current user's sites |
| `/api/sites` | POST | Add site: `{ "url": "https://...", "name": "optional" }` |
| `/api/sites/:id` | DELETE | Remove a site |
| `/api/check` | POST | Check any URL: `{ "url": "https://..." }` |
| `/api/check-all` | GET | Check all of current user's sites |
| `/api/users` | GET | List all users and site counts |

### CLI Examples

```bash
# Check a site (no auth needed)
curl -X POST http://localhost:3000/api/check \
  -H "Content-Type: application/json" \
  -d '{"url": "https://footprints.alamo.edu"}'

# Get a user's sites
curl http://localhost:3000/api/sites \
  -H "X-User-Id: andrew"

# Add a site for a user
curl -X POST http://localhost:3000/api/sites \
  -H "Content-Type: application/json" \
  -H "X-User-Id: andrew" \
  -d '{"url": "https://google.com"}'

# See all users
curl http://localhost:3000/api/users
```

## Running as a Service

```bash
# Simple background process
nohup node server.js > downboy.log 2>&1 &

# With PM2 (if installed)
pm2 start server.js --name "down-boy"

# As a systemd service (create /etc/systemd/system/downboy.service)
```

## Configuration

Edit these constants in `server.js`:

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 3000 | HTTP port |
| `TIMEOUT_MS` | 10000 | Request timeout (10 seconds) |
| `DATA_FILE` | `./sites-data.json` | Storage location |

## Notes

- No authentication (yet) - anyone with the URL can access
- User IDs are normalized (lowercase, spaces → dashes)
- Sites survive server restarts via JSON file
- Self-signed SSL certs are accepted (common for internal sites)
