FTX DUMPER 2027 — IMAGE-FREE UI EDITION

FILES IN THIS DOWNLOAD (all .txt as requested)
- s200.txt  -> rename to server.js
- json.txt  -> rename to package.json
- gui.txt   -> rename to index.html
- read.txt  -> rename to README.md (optional for Render)

RENDER SETTINGS
- Runtime: Node
- Build command: npm install
- Start command: npm start
- Node version: 20 or newer
- Set OWNER_KEY in Render Environment. The supplied development owner key is: ftx-dumper-ontop
- For persistent API-key/IP activity records, attach a persistent disk and mount it at /opt/render/project/src.

WHAT CHANGED
- Removed the large embedded artwork from the top hero section.
- Removed the artwork from the intro screen and replaced it with a simple FTX 👓👓 text mark.
- Kept the animated intro text and the existing API-key/owner flow.
- The server records the public IP and last-seen time when an API key or owner key successfully signs in. The sign-in screen discloses this logging.

IMPORTANT
Rename the files exactly as listed before deploying; Node and Render will not treat .txt files as executable project filenames. Do not expose the owner key publicly. Use a long random OWNER_KEY for a production deployment. The inspector only analyzes public resources you are authorized to inspect; it does not bypass access controls or retrieve private server-side source.
