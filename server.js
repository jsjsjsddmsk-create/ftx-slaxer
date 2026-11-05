const express = require("express");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = Number(process.env.PORT || 3000);
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || "";
const DATA_DIR = path.join(__dirname, "data");
const DB_FILE = path.join(DATA_DIR, "store.json");

app.disable("x-powered-by");
app.use(express.json({ limit: "256kb" }));

function initialStore() {
  return { projects: [], scripts: [], keys: [], events: [] };
}
function loadStore() {
  try {
    if (!fs.existsSync(DB_FILE)) return initialStore();
    const data = JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
    return { ...initialStore(), ...data };
  } catch (err) {
    console.error("Could not read data store:", err.message);
    return initialStore();
  }
}
let store = loadStore();
function saveStore() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const tmp = DB_FILE + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(store, null, 2), "utf8");
  fs.renameSync(tmp, DB_FILE);
}
function id() { return crypto.randomUUID(); }
function clean(value, max = 100) {
  return String(value ?? "").trim().slice(0, max);
}
function recordEvent(type, detail) {
  store.events.unshift({ id: id(), type, detail: clean(detail, 160), at: new Date().toISOString() });
  store.events = store.events.slice(0, 100);
}
function requireAdmin(req, res, next) {
  if (!ADMIN_TOKEN) {
    return res.status(503).json({ error: "Admin API is disabled. Set ADMIN_TOKEN in the environment." });
  }
  const supplied = (req.get("authorization") || "").replace(/^Bearer\s+/i, "");
  const a = Buffer.from(supplied);
  const b = Buffer.from(ADMIN_TOKEN);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return res.status(401).json({ error: "Invalid admin token." });
  }
  next();
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "PolSec Independent Demo", timestamp: new Date().toISOString() });
});

app.get("/api/stats", (_req, res) => {
  res.json({ data: {
    total_projects: store.projects.length,
    total_scripts: store.scripts.length,
    total_keys: store.keys.length,
    total_executions: 0
  }});
});

app.get("/api/projects", requireAdmin, (_req, res) => {
  res.json({ data: store.projects });
});

app.post("/api/projects", requireAdmin, (req, res) => {
  const name = clean(req.body.name, 64);
  if (!name) return res.status(400).json({ error: "Project name is required." });
  if (store.projects.some(p => p.name.toLowerCase() === name.toLowerCase())) {
    return res.status(409).json({ error: "A project with that name already exists." });
  }
  const project = { id: id(), name, createdAt: new Date().toISOString() };
  store.projects.push(project);
  recordEvent("project_created", name);
  saveStore();
  res.status(201).json({ data: project });
});

app.get("/api/projects/:projectId/scripts", requireAdmin, (req, res) => {
  const project = store.projects.find(p => p.id === req.params.projectId);
  if (!project) return res.status(404).json({ error: "Project not found." });
  res.json({ data: store.scripts.filter(s => s.projectId === project.id) });
});

app.post("/api/projects/:projectId/scripts", requireAdmin, (req, res) => {
  const project = store.projects.find(p => p.id === req.params.projectId);
  if (!project) return res.status(404).json({ error: "Project not found." });
  const name = clean(req.body.scriptName, 64);
  const body = String(req.body.scriptBody ?? "");
  if (!name || !body.trim()) return res.status(400).json({ error: "scriptName and scriptBody are required." });
  if (body.length > 100000) return res.status(413).json({ error: "Script is too large (100 KB maximum)." });
  const script = {
    id: id(), projectId: project.id, scriptName: name,
    scriptVersion: clean(req.body.scriptVersion || "1.0", 24),
    sourceLength: body.length, createdAt: new Date().toISOString(),
    note: "Source metadata demo only; no obfuscation or execution is performed."
  };
  store.scripts.push(script);
  recordEvent("script_registered", `${project.name}/${name}`);
  saveStore();
  res.status(201).json({ data: script });
});

app.get("/api/keys", requireAdmin, (_req, res) => {
  res.json({ data: store.keys.map(({ key, ...safe }) => ({ ...safe, keyPreview: key.slice(0, 5) + "••••••" })) });
});

app.post("/api/keys", requireAdmin, (req, res) => {
  const amount = Number(req.body.amount || 1);
  const durationDays = Number(req.body.durationDays || 30);
  if (!Number.isInteger(amount) || amount < 1 || amount > 25) {
    return res.status(400).json({ error: "amount must be an integer from 1 to 25." });
  }
  if (!Number.isInteger(durationDays) || durationDays < 1 || durationDays > 3650) {
    return res.status(400).json({ error: "durationDays must be from 1 to 3650." });
  }
  const created = [];
  for (let i = 0; i < amount; i++) {
    const key = "POL-" + crypto.randomBytes(12).toString("hex").toUpperCase();
    const item = {
      id: id(), key, status: "active",
      expiresAt: new Date(Date.now() + durationDays * 86400000).toISOString(),
      createdAt: new Date().toISOString()
    };
    store.keys.push(item);
    created.push(item);
  }
  recordEvent("keys_generated", `${amount} license key(s)`);
  saveStore();
  res.status(201).json({ data: created });
});

app.get("/api/activity", requireAdmin, (_req, res) => {
  res.json({ data: store.events });
});

app.use(express.static(path.join(__dirname, "public"), { extensions: ["html"] }));
app.get("*", (_req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: "Internal server error." });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server listening on port ${PORT}`);
});
