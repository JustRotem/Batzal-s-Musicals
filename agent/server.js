"use strict";
// The control panel's agent. Runs on the host (docker, systemctl, disk usage) and answers only to the control panel
// site, which signs people in, checks their permissions and forwards what they may do.
// Safety model: a shared secret on every request (and listening on the local network only); a fixed action allowlist;
// no shell, no free-form commands. The e-mail of the person who asked comes along for the log.
const http = require("http");
const crypto = require("crypto");
const fs = require("fs");
const os = require("os");
const path = require("path");
const tls = require("tls");
const { execFile } = require("child_process");

const CFG = {
  port: Number(process.env.PORT || 3200),
  host: process.env.AGENT_HOST || "127.0.0.1",
  agentToken: process.env.ADMIN_AGENT_TOKEN || "",
  auditFile: process.env.AUDIT_FILE || "/var/lib/admin-panel/audit.log",
  sitesDir: process.env.SITES_DIR || "/etc/nginx/sites-enabled",
  // Files may be deleted only below these folders, and never when the path matches DELETE_DENY.
  deleteRoots: (process.env.STORAGE_DELETE_ROOTS || "/tmp,/var/tmp,/home/rotem").split(",").map((x) => x.trim()).filter(Boolean),
};
// Keys, saved site data and anything of the clinic checklist are never deleted from here.
const DELETE_DENY = /(^|[\\/])(\.ssh|\.gnupg|\.config|\.claude|clinic[^\\/]*|data|\.env[^\\/]*)([\\/]|$)/i;
const BROWSE_SKIP = new Set(["/proc", "/sys", "/dev", "/run"]);

// Host services that may be controlled, and exactly which actions. Must match /etc/sudoers.d/admin-panel.
const SERVICES = {
  nginx: ["reload", "restart"], // never "stop": it would take the panel itself offline
  mariadb: ["start", "stop", "restart"],
  "php8.0-fpm": ["start", "stop", "restart"],
  "php8.1-fpm": ["start", "stop", "restart"],
  "php8.3-fpm": ["start", "stop", "restart"],
  "php8.4-fpm": ["start", "stop", "restart"],
  "redis-server": ["start", "stop", "restart"],
  pteroq: ["start", "stop", "restart"],
  wings: ["restart"],
};
const CONTAINER_ACTIONS = ["start", "stop", "restart"];
const NAME_RE = /^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,127}$/;

// ---------- helpers ----------
const deps = {
  run: (cmd, args, timeout = 20000) =>
    new Promise((resolve) => {
      execFile(cmd, args, { timeout, maxBuffer: 2 * 1024 * 1024 }, (err, stdout, stderr) =>
        resolve({ ok: !err, stdout: String(stdout || ""), stderr: String(stderr || ""), code: err ? err.code : 0 }));
    }),
  fetchSite: async (url) => {
    const t0 = Date.now();
    try {
      const r = await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(7000), headers: { "User-Agent": "admin-panel-check" } });
      return { status: r.status, ms: Date.now() - t0 };
    } catch { return { status: 0, ms: Date.now() - t0 }; }
  },
  certExpiry: (domain) =>
    new Promise((resolve) => {
      const s = tls.connect({ host: "127.0.0.1", port: 443, servername: domain, timeout: 4000 }, () => {
        const c = s.getPeerCertificate();
        s.end();
        resolve(c && c.valid_to ? Math.floor((new Date(c.valid_to) - Date.now()) / 864e5) : null);
      });
      s.on("error", () => resolve(null));
      s.on("timeout", () => { s.destroy(); resolve(null); });
    }),
};

function audit(entry) {
  try {
    fs.mkdirSync(path.dirname(CFG.auditFile), { recursive: true });
    fs.appendFileSync(CFG.auditFile, JSON.stringify({ t: new Date().toISOString(), ...entry }) + "\n", { mode: 0o600 });
  } catch (e) { console.error("audit write failed", e.message); }
}
function readAudit(n = 60) {
  try {
    const lines = fs.readFileSync(CFG.auditFile, "utf8").trim().split("\n").slice(-n).reverse();
    return lines.map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
  } catch { return []; }
}

const hits = new Map();
function limited(ip) {
  const now = Date.now(), w = (hits.get(ip) || []).filter((t) => now - t < 60000);
  w.push(now); hits.set(ip, w);
  return w.length > 120;
}
setInterval(() => { const n = Date.now(); for (const [k, v] of hits) if (!v.some((t) => n - t < 60000)) hits.delete(k); }, 60000).unref();

const send = (res, code, obj, headers = {}) => {
  res.writeHead(code, { "Content-Type": "application/json", "Cache-Control": "no-store", ...headers });
  res.end(JSON.stringify(obj));
};
const readBody = (req) => new Promise((resolve, reject) => {
  let size = 0; const chunks = [];
  req.on("data", (c) => { size += c.length; if (size > 16 * 1024) { reject(new Error("too large")); req.destroy(); } else chunks.push(c); });
  req.on("end", () => { try { resolve(JSON.parse(Buffer.concat(chunks).toString() || "{}")); } catch { reject(new Error("bad json")); } });
  req.on("error", reject);
});

// ---------- data collectors ----------
const cache = new Map();
async function cached(key, ttl, fn) {
  const c = cache.get(key);
  if (c && Date.now() - c.t < ttl) return c.v;
  const v = await fn(); cache.set(key, { t: Date.now(), v }); return v;
}
const parseJsonLines = (s) => s.split("\n").map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);

async function listContainers() {
  const ps = await deps.run("docker", ["ps", "-a", "--format", "{{json .}}"]);
  if (!ps.ok) return [];
  const stats = await cached("dstats", 6000, async () => {
    const r = await deps.run("docker", ["stats", "--no-stream", "--format", "{{json .}}"], 30000);
    return r.ok ? parseJsonLines(r.stdout) : [];
  });
  const byName = Object.fromEntries(stats.map((s) => [s.Name, s]));
  return parseJsonLines(ps.stdout).map((c) => ({
    name: c.Names, image: c.Image, state: c.State, status: c.Status, ports: c.Ports || "",
    cpu: byName[c.Names] ? byName[c.Names].CPUPerc : null,
    mem: byName[c.Names] ? byName[c.Names].MemUsage.split("/")[0].trim() : null,
  })).sort((a, b) => a.name.localeCompare(b.name));
}

async function listServices() {
  const out = [];
  for (const name of Object.keys(SERVICES)) {
    const r = await deps.run("systemctl", ["show", name + ".service", "-p", "LoadState", "-p", "ActiveState", "-p", "SubState", "-p", "MainPID", "-p", "MemoryCurrent", "-p", "ActiveEnterTimestamp", "--no-pager"]);
    const kv = Object.fromEntries(r.stdout.split("\n").filter(Boolean).map((l) => { const i = l.indexOf("="); return [l.slice(0, i), l.slice(i + 1)]; }));
    const mem = Number(kv.MemoryCurrent);
    out.push({
      name, actions: SERVICES[name], installed: kv.LoadState === "loaded",
      active: kv.ActiveState || "unknown", sub: kv.SubState || "",
      since: kv.ActiveEnterTimestamp || "", memMb: Number.isFinite(mem) && mem > 0 && mem < 2 ** 50 ? Math.round(mem / 1048576) : null,
    });
  }
  return out;
}

function siteDomains() {
  const found = new Map();
  let files = [];
  try { files = fs.readdirSync(CFG.sitesDir); } catch { return []; }
  for (const f of files) {
    let txt = "";
    try { txt = fs.readFileSync(path.join(CFG.sitesDir, f), "utf8"); } catch { continue; }
    for (const m of txt.matchAll(/^\s*server_name\s+([^;]+);/gm)) {
      for (const d of m[1].trim().split(/\s+/)) {
        if (/^[a-z0-9]([a-z0-9.-]*[a-z0-9])?$/i.test(d) && d.includes(".") && !found.has(d)) found.set(d, f);
      }
    }
  }
  return [...found].map(([domain, conf]) => ({ domain, conf })).sort((a, b) => a.domain.localeCompare(b.domain));
}
async function listSites() {
  return cached("sites", 30000, async () => {
    const list = siteDomains();
    return Promise.all(list.map(async (s) => {
      const [web, certDays] = await Promise.all([deps.fetchSite("https://" + s.domain + "/"), deps.certExpiry(s.domain)]);
      return { ...s, status: web.status, ms: web.ms, certDays };
    }));
  });
}

async function serverInfo() {
  const mem = fs.readFileSync("/proc/meminfo", "utf8");
  const g = (k) => Number((new RegExp("^" + k + ":\\s+(\\d+)", "m").exec(mem) || [0, 0])[1]) * 1024;
  const total = g("MemTotal"), avail = g("MemAvailable");
  const df = await deps.run("df", ["-B1", "--output=size,used", "/"]);
  const [size, used] = (df.stdout.trim().split("\n")[1] || "0 0").trim().split(/\s+/).map(Number);
  return { uptimeSec: Math.floor(os.uptime()), load: os.loadavg().map((x) => +x.toFixed(2)), cpus: os.cpus().length,
    memTotal: total, memUsed: total - avail, diskTotal: size || 0, diskUsed: used || 0 };
}

// ---------- storage ----------
const IMAGE_REF_RE = /^[a-zA-Z0-9][a-zA-Z0-9_.:\/@-]{0,200}$/;

// Sizes of what is directly inside a folder, biggest first. `du` is the only thing that can add up folders cheaply.
async function listFolder(dir) {
  if (typeof dir !== "string" || !path.isAbsolute(dir) || dir.includes("\0") || dir.split("/").includes("..")) return { code: 400, body: { error: "bad path" } };
  const clean = path.resolve(dir);
  const norm = clean.replace(/\\/g, "/").replace(/^[A-Za-z]:/, "");
  if (BROWSE_SKIP.has(norm) || [...BROWSE_SKIP].some((x) => norm.startsWith(x + "/"))) return { code: 403, body: { error: "not allowed" } };
  let st;
  try { st = fs.lstatSync(clean); } catch { return { code: 404, body: { error: "not found" } }; }
  if (!st.isDirectory()) return { code: 400, body: { error: "not a folder" } };
  const r = await deps.run("du", ["-x", "-a", "-B1", "-d1", "--", clean], 90000);
  const items = [];
  let total = 0;
  for (const line of r.stdout.split("\n")) {
    const m = /^(\d+)\t(.+)$/.exec(line);
    if (!m) continue;
    if (m[2] === clean) { total = Number(m[1]); continue; }
    let kind = "file";
    try { const x = fs.lstatSync(m[2]); kind = x.isSymbolicLink() ? "link" : x.isDirectory() ? "dir" : "file"; } catch { /* vanished */ }
    items.push({ name: path.basename(m[2]), path: m[2], size: Number(m[1]), kind, deletable: isDeletable(m[2]) });
  }
  items.sort((a, b) => b.size - a.size);
  return { code: 200, body: { path: clean, parent: clean === "/" ? null : path.dirname(clean), total, items: items.slice(0, 300) } };
}
function isDeletable(p) {
  let real;
  try { real = fs.realpathSync(path.dirname(p)); } catch { return false; }
  const target = path.join(real, path.basename(p));
  if (DELETE_DENY.test(target)) return false;
  return CFG.deleteRoots.some((root) => { let r; try { r = fs.realpathSync(root); } catch { return false; } return target.startsWith(r + path.sep) && target !== r; });
}
async function deletePath(p, who) {
  if (typeof p !== "string" || !path.isAbsolute(p) || p.includes("\0") || p.split("/").includes("..")) return { code: 400, body: { error: "bad path" } };
  const clean = path.resolve(p);
  if (!isDeletable(clean)) { audit({ who, type: "storage:delete", target: clean, ok: false, err: "not allowed" }); return { code: 403, body: { error: "not allowed" } }; }
  let st;
  try { st = fs.lstatSync(clean); } catch { return { code: 404, body: { error: "not found" } }; }
  // a folder that holds a protected one inside (for example a backup of the clinic data) is not removed as a whole
  if (st.isDirectory() && (await folderHasProtected(clean))) { audit({ who, type: "storage:delete", target: clean, ok: false, err: "contains protected" }); return { code: 403, body: { error: "contains protected files" } }; }
  try { fs.rmSync(clean, { recursive: true, force: false }); } catch (e) { audit({ who, type: "storage:delete", target: clean, ok: false, err: String(e.message).slice(0, 120) }); return { code: 500, body: { error: "delete failed" } }; }
  audit({ who, type: "storage:delete", target: clean, ok: true, size: st.isDirectory() ? undefined : st.size });
  return { code: 200, body: { ok: true } };
}
async function folderHasProtected(dir) {
  const r = await deps.run("find", [dir, "-maxdepth", "6", "(", "-iname", "clinic*", "-o", "-name", ".ssh", "-o", "-name", ".env*", "-o", "-name", ".gnupg", ")", "-print", "-quit"], 30000);
  return r.stdout.trim().length > 0;
}

async function dockerStorage() {
  const [df, imgs, ps] = await Promise.all([
    deps.run("docker", ["system", "df", "--format", "{{json .}}"], 60000),
    deps.run("docker", ["images", "--format", "{{json .}}"], 30000),
    deps.run("docker", ["ps", "-a", "--format", "{{.Image}}"], 30000),
  ]);
  const used = new Set(ps.stdout.split("\n").map((x) => x.trim()).filter(Boolean));
  const images = parseJsonLines(imgs.stdout).map((i) => {
    const ref = i.Repository === "<none>" ? i.ID : `${i.Repository}:${i.Tag}`;
    return { id: i.ID, ref, size: i.Size, created: i.CreatedSince, dangling: i.Repository === "<none>", inUse: used.has(ref) || used.has(i.ID) || used.has(i.Repository) };
  });
  return { usage: parseJsonLines(df.stdout).map((r) => ({ type: r.Type, total: r.TotalCount, active: r.Active, size: r.Size, reclaimable: r.Reclaimable })), images };
}
async function dockerCleanup(op, ref, who) {
  let args;
  if (op === "buildCache") args = ["builder", "prune", "-f"];
  else if (op === "dangling") args = ["image", "prune", "-f"];
  else if (op === "removeImage" && typeof ref === "string" && IMAGE_REF_RE.test(ref)) args = ["rmi", ref]; // never -f: an image a container uses is refused
  else return { code: 400, body: { error: "bad request" } };
  const r = await deps.run("docker", args, 600000);
  audit({ who, type: "storage:docker:" + op, target: ref || "", ok: r.ok, err: r.ok ? undefined : r.stderr.slice(0, 200) });
  return { code: r.ok ? 200 : 500, body: { ok: r.ok, output: r.stdout.slice(-400), error: r.ok ? undefined : r.stderr.slice(0, 300) } };
}

// ---------- actions ----------
async function containerAction(name, action, who) {
  if (!NAME_RE.test(name) || !CONTAINER_ACTIONS.includes(action)) return { code: 400, body: { error: "bad request" } };
  const known = (await listContainers()).some((c) => c.name === name);
  if (!known) return { code: 404, body: { error: "unknown container" } };
  const r = await deps.run("docker", [action, name], 90000);
  cache.delete("dstats");
  audit({ who, type: "container", name, action, ok: r.ok, err: r.ok ? undefined : r.stderr.slice(0, 200) });
  return { code: r.ok ? 200 : 500, body: { ok: r.ok, error: r.ok ? undefined : r.stderr.slice(0, 300) } };
}
async function serviceAction(name, action, who) {
  if (!Object.prototype.hasOwnProperty.call(SERVICES, name) || !SERVICES[name].includes(action)) return { code: 403, body: { error: "not allowed" } };
  const r = await deps.run("sudo", ["-n", "systemctl", action, name + ".service"], 60000);
  audit({ who, type: "service", name, action, ok: r.ok, err: r.ok ? undefined : r.stderr.slice(0, 200) });
  return { code: r.ok ? 200 : 500, body: { ok: r.ok, error: r.ok ? undefined : r.stderr.slice(0, 300) } };
}
async function getLogs(type, name, lines) {
  const n = Math.min(500, Math.max(20, Number(lines) || 200));
  let r;
  if (type === "container") {
    if (!NAME_RE.test(name) || !(await listContainers()).some((c) => c.name === name)) return { code: 404, body: { error: "unknown container" } };
    r = await deps.run("docker", ["logs", "--tail", String(n), "--timestamps", name]);
    r.stdout = r.stdout + r.stderr; // docker logs writes app stderr to stderr
  } else if (type === "service") {
    if (!Object.prototype.hasOwnProperty.call(SERVICES, name)) return { code: 404, body: { error: "unknown service" } };
    r = await deps.run("journalctl", ["-u", name + ".service", "-n", String(n), "--no-pager", "-o", "short-iso"]);
  } else return { code: 400, body: { error: "bad request" } };
  return { code: 200, body: { text: r.stdout.slice(-200 * 1024) } };
}


// ---------- server ----------
const tokenOk = (header) => {
  const given = String(header || "").startsWith("Bearer ") ? String(header).slice(7) : "";
  if (!given || CFG.agentToken.length < 32) return false;
  const a = crypto.createHash("sha256").update(given).digest(), b = crypto.createHash("sha256").update(CFG.agentToken).digest();
  return crypto.timingSafeEqual(a, b);
};

const server = http.createServer(async (req, res) => {
  const ip = String(req.socket.remoteAddress || "?");
  if (limited(ip)) return send(res, 429, { error: "rate limited" });
  const url = new URL(req.url, "http://x");
  const p = url.pathname;

  try {
    if (p === "/api/health") return send(res, 200, { ok: true });
    if (!tokenOk(req.headers.authorization)) return send(res, 401, { error: "unauthorized" });

    const who = String(req.headers["x-acting-admin"] || "").slice(0, 200) || "unknown";

    if (req.method === "GET") {
      if (p === "/api/server") return send(res, 200, await serverInfo());
      if (p === "/api/containers") return send(res, 200, { items: await listContainers() });
      if (p === "/api/services") return send(res, 200, { items: await listServices() });
      if (p === "/api/sites") return send(res, 200, { items: await listSites() });
      if (p === "/api/audit") return send(res, 200, { items: readAudit() });
      if (p === "/api/logs") {
        const r = await getLogs(url.searchParams.get("type"), url.searchParams.get("name") || "", url.searchParams.get("lines"));
        return send(res, r.code, r.body);
      }
      if (p === "/api/storage") return send(res, 200, await dockerStorage());
      if (p === "/api/storage/list") {
        const r = await listFolder(url.searchParams.get("path") || "/");
        return send(res, r.code, r.body);
      }
    }

    if (req.method === "POST") {
      const m = /^\/api\/(containers|services)\/([^/]+)\/([a-z]+)$/.exec(p);
      if (m) {
        const r = m[1] === "containers" ? await containerAction(decodeURIComponent(m[2]), m[3], who) : await serviceAction(decodeURIComponent(m[2]), m[3], who);
        return send(res, r.code, r.body);
      }
      if (p === "/api/storage/delete") {
        const r = await deletePath((await readBody(req)).path, who);
        return send(res, r.code, r.body);
      }
      if (p === "/api/storage/docker") {
        const input = await readBody(req);
        const r = await dockerCleanup(input.op, input.ref, who);
        return send(res, r.code, r.body);
      }
      // the panel site writes what it did with people and permissions into the same log
      if (p === "/api/audit-note") {
        const input = await readBody(req);
        audit({ who, type: String(input.type || "note").slice(0, 60), target: String(input.target || "").slice(0, 120), detail: String(input.detail || "").slice(0, 120), ok: input.ok === true });
        return send(res, 200, { ok: true });
      }
    }

    send(res, 404, { error: "not found" });
  } catch (e) {
    send(res, e.message === "too large" ? 413 : 500, { error: "error" });
  }
});

module.exports = { server, deps, CFG, SERVICES, isDeletable };

if (require.main === module) {
  if (CFG.agentToken.length < 32) { console.error("ADMIN_AGENT_TOKEN (32+ chars) is required"); process.exit(1); }
  server.listen(CFG.port, CFG.host, () => console.log("admin agent on", CFG.host, CFG.port));
}
