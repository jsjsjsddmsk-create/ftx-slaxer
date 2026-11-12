FTX V50 — MULTI-LANGUAGE SOURCE INSPECTOR

FILES (rename before deployment)
S50.txt -> server.js
pa50.txt -> package.json
in50.txt -> index.html
Ra50.txt -> README.txt

RENDER
Runtime: Node.js 20+
Build Command: npm install
Start Command: npm start
Root Directory: blank if files are in repository root.

FEATURES
- Auto-detection for common source types: HTML, CSS, JavaScript, TypeScript, Python, PHP, Lua/Luau, Java, C/C++, C#, Ruby, Go, Rust, JSON, XML and text.
- 51 static checks for common code-quality and security-review patterns.
- Multi-file upload and source editor.
- Base64, hex, URL, Unicode escape, HTML entity decoders and JSON formatter.
- Safe whitespace cleanup; submitted source is never executed.
- Public website scan: initial HTML plus up to 12 same-origin public JavaScript/CSS assets.
- Copy, source download and report export.

IMPORTANT LIMITS
A website URL exposes only resources the remote server sends to a browser. Python, PHP, Ruby, Java and other server-side source normally remain private on the server. Upload source files you own or are authorized to inspect to analyze those languages.
This tool does not bypass authentication, paywalls, bot protections, encryption or access controls. It cannot guarantee original-source reconstruction or an error-free website.

SERVER SAFETY
HTTP/HTTPS only; local/private destinations blocked; redirect, rate, request-size, response-size and asset-count limits applied. Use only on sites and code you own or have permission to inspect.
