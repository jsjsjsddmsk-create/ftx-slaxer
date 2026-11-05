# POLSEC Independent Node.js Demo

A standalone Express starter inspired by common Lua project/license dashboards. It is **not** PolSec's source code and does not connect to polsec.net.

## Files
- `package.json` — dependencies and start scripts
- `server.js` — Express server and JSON-backed API
- `public/index.html` — responsive frontend

## Run locally
1. Install Node.js 18 or newer.
2. In this folder run `npm install`.
3. Set an admin token:
   - macOS/Linux: `export ADMIN_TOKEN="choose-a-long-random-secret"`
   - Windows PowerShell: `$env:ADMIN_TOKEN="choose-a-long-random-secret"`
4. Run `npm start`.
5. Open `http://localhost:3000`.

## Render deployment
- Create a **Web Service** from this project/repository.
- Build command: `npm install`
- Start command: `npm start`
- Add environment variable `ADMIN_TOKEN` with a long random value.
- No public directory setting is needed; Express serves `public/` itself.
- Use a persistent disk mounted at `/opt/render/project/src/data` if you need JSON data to survive redeploys. For production, replace the JSON store with PostgreSQL.

## API
Public:
- `GET /api/health`
- `GET /api/stats`

Admin routes require `Authorization: Bearer YOUR_ADMIN_TOKEN`:
- `GET /api/projects`
- `POST /api/projects` with `{ "name": "My project" }`
- `GET /api/projects/:projectId/scripts`
- `POST /api/projects/:projectId/scripts` with `{ "scriptName": "Main", "scriptBody": "print('hello')" }`
- `GET /api/keys`
- `POST /api/keys` with `{ "amount": 2, "durationDays": 30 }`
- `GET /api/activity`

## Important limitations
This is a working Node.js foundation, not a recreation of PolSec's private backend. The supplied report contains a compiled browser bundle and CSS, not the original server implementation. This demo stores metadata and generates sample keys; it does not execute, protect, or obfuscate Lua scripts, and generated keys are not connected to any Roblox executor or external whitelist.
