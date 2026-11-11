FTX V50.1 — Owner/API Key Edition

FILES
- server.js
- package.json
- index.html

RENDER
Runtime: Node
Build: npm install
Start: npm start
Set environment variable OWNER_KEY to the owner key you supplied: ftx-dumper-ontop. Do not put the owner key in frontend code.
For persistent keys, attach a Render persistent disk and mount it at /opt/render/project/src (or change DB path in server.js). Without a persistent disk, JSON data can reset on redeploy/restart.

FEATURES
- API key entry screen; remembers a key in this browser until logout/revocation/expiry.
- Owner menu, create API key with expiry days and optional HWID binding, list keys, blacklist keys, logout.
- API key validation is performed on the server. Only key hashes are stored. A newly created raw key is displayed once.
- Public-site scan progress indicator.
- Requests to https://ftx-t8a9.onrender.com are rejected with “This was owner app”.
- Existing public HTML/JS/CSS inspection and static analysis are retained.

SECURITY NOTES
- HWID supplied by a browser is a device identifier, not strong hardware attestation; a determined user can spoof it.
- Keep OWNER_KEY private and rotate it if exposed. The supplied owner key is a weak, guessable secret; use a long random value in production.
- Do not claim a website is impossible to deobfuscate. Browser-delivered code can be copied or analyzed. Keep sensitive logic and secrets server-side. This app does not bypass encryption or access controls and does not retrieve private server-side source code.
- JSON persistence requires a persistent disk on Render.


FTX DUMPER WINTER EDITION UPDATE
- Intro screen: FTX DUMPER + CONTINUE, followed by API-key entry.
- Christmas/winter green-and-gold theme.
- Owner-only key creation with LIFETIME, DAYS, or HOURS expiry.
- Copy button for newly generated keys (raw key is shown once).
- Optional Discord username association; owner can blacklist a username and revoke linked keys.
- Owner-only key activity view includes last-seen IP and timestamp. Users are informed that IPs may be logged for access security.

RENDER ENVIRONMENT
Set OWNER_KEY to your owner key in Render Environment. For production, use a long random secret rather than a short predictable key. Attach a persistent disk for data.json.
