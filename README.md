FTX DUMPER — CHERRY BLOSSOM INTRO EDITION

FILES
- s200.txt -> rename to server.js
- json.txt -> rename to package.json
- gui.txt -> rename to index.html
- assets/spiderman.mp4 -> keep at assets/spiderman.mp4
- assets/cherry-blossom.jpg -> keep at assets/cherry-blossom.jpg

The site now opens with a full-screen Spider-Man video. Tap anywhere to skip and enter the site. The video is muted/autoplay-enabled for mobile browser compatibility; autoplay may still depend on browser settings. The cherry-blossom photo is used as the site-wide background. The video is slightly zoomed to crop a small amount from its edges; this may not remove a TikTok watermark if it moves or is embedded away from the cropped edge.

RENDER SETTINGS
- Runtime: Node
- Build command: npm install
- Start command: npm start
- Node version: 20 or newer
- Set OWNER_KEY in Render Environment. Change the development key before deployment.
- Keep the assets folder alongside server.js and index.html.
- For persistent API-key/IP activity records, attach a persistent disk and mount it at /opt/render/project/src.

IMPORTANT SECURITY NOTE
The owner key must be set as a private environment variable. Do not publish it in the README or client-side HTML.
