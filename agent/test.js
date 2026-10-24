const os = require("os"), path = require("path"), fs = require("fs");
const TOKEN = "t".repeat(40);
process.env.ADMIN_AGENT_TOKEN = TOKEN;
process.env.AUDIT_FILE = path.join(os.tmpdir(), "audit-" + Date.now() + ".log");
process.env.SITES_DIR = path.join(os.tmpdir(), "nosites");
const assert = require("assert");
const { server, deps, CFG } = require("./server");

// The agent never decides who may do what (the control panel site does); it only trusts the shared secret and does
// nothing outside its allowlists.
const calls = [];
deps.run = async (cmd, args) => {
  calls.push([cmd, ...args]);
  if (cmd === "docker" && args[0] === "ps") return { ok: true, stdout: JSON.stringify({ Names: "web", Image: "x", State: "running", Status: "Up", Ports: "" }) + "\n", stderr: "" };
  if (cmd === "docker" && args[0] === "stats") return { ok: true, stdout: "", stderr: "" };
  if (cmd === "systemctl") return { ok: true, stdout: "LoadState=loaded\nActiveState=active\nSubState=running\n", stderr: "" };
  if (cmd === "du") { const d = args[args.length - 1]; return { ok: true, stdout: `300\t${d}/small.log\n9000\t${d}/big.bin\n9400\t${d}\n`, stderr: "" }; }
  if (cmd === "find") return { ok: true, stdout: args[0].includes("holdsclinic") ? args[0] + "/clinic-x\n" : "", stderr: "" };
  if (cmd === "docker" && args[0] === "system") return { ok: true, stdout: JSON.stringify({ Type: "Images", TotalCount: "3", Active: "2", Size: "60GB", Reclaimable: "47GB" }) + "\n", stderr: "" };
  if (cmd === "docker" && args[0] === "images") return { ok: true, stdout: JSON.stringify({ ID: "abc123", Repository: "x", Tag: "old", Size: "1GB", CreatedSince: "2 days ago" }) + "\n", stderr: "" };
  if (cmd === "df") return { ok: true, stdout: "1B-blocks Used\n1000 400\n", stderr: "" };
  return { ok: true, stdout: "log line", stderr: "" };
};
const H = { Authorization: "Bearer " + TOKEN, "X-Acting-Admin": "rotem.lau@gmail.com", "Content-Type": "application/json" };

server.listen(0, async () => {
  const B = "http://127.0.0.1:" + server.address().port;
  const get = (p, h = H) => fetch(B + p, { headers: h });
  const post = (p, body = {}, h = H) => fetch(B + p, { method: "POST", headers: h, body: JSON.stringify(body) });
  try {
    // --- only the shared secret opens the door
    assert.equal((await get("/api/health", {})).status, 200, "health is open");
    assert.equal((await get("/api/containers", {})).status, 401, "no secret");
    assert.equal((await get("/api/containers", { Authorization: "Bearer " + "x".repeat(40) })).status, 401, "wrong secret");
    assert.equal((await get("/api/containers", { Authorization: "Bearer " })).status, 401, "empty secret");
    assert.equal((await get("/api/containers")).status, 200);
    assert.equal((await get("/api/services")).status, 200);
    if (process.platform === "linux") assert.equal((await get("/api/server")).status, 200); // reads /proc

    // --- containers
    calls.length = 0;
    assert.equal((await post("/api/containers/web/restart")).status, 200);
    assert.deepEqual(calls.find((c) => c[1] === "restart"), ["docker", "restart", "web"]);
    assert.equal((await post("/api/containers/ghost/restart")).status, 404, "unknown container");
    assert.equal((await post("/api/containers/web/rm")).status, 400, "rm not allowed");
    assert.equal((await post("/api/containers/web/exec")).status, 400);
    assert.equal((await post("/api/containers/" + encodeURIComponent("web;id") + "/stop")).status, 400, "injection");
    assert.equal((await post("/api/containers/" + encodeURIComponent("--all") + "/stop")).status, 400, "flag-like name");

    // --- services
    calls.length = 0;
    assert.equal((await post("/api/services/nginx/reload")).status, 200);
    assert.deepEqual(calls.pop(), ["sudo", "-n", "systemctl", "reload", "nginx.service"]);
    assert.equal((await post("/api/services/nginx/stop")).status, 403, "nginx stop blocked");
    assert.equal((await post("/api/services/wings/stop")).status, 403, "wings stop blocked");
    assert.equal((await post("/api/services/ssh/restart")).status, 403, "unlisted service");
    assert.equal((await post("/api/services/docker/stop")).status, 403, "docker blocked");
    assert.equal((await post("/api/services/__proto__/restart")).status, 403, "proto");
    assert.equal((await post("/api/services/constructor/restart")).status, 403);

    // --- logs
    assert.equal((await get("/api/logs?type=container&name=web")).status, 200);
    assert.equal((await get("/api/logs?type=container&name=ghost")).status, 404);
    assert.equal((await get("/api/logs?type=service&name=ssh")).status, 404);
    assert.equal((await get("/api/logs?type=file&name=/etc/passwd")).status, 400);

    // --- storage
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "stor-"));
    CFG.deleteRoots = [root];
    fs.mkdirSync(path.join(root, "sub"));
    fs.writeFileSync(path.join(root, "big.bin"), "x");
    fs.mkdirSync(path.join(root, ".ssh")); fs.writeFileSync(path.join(root, ".ssh", "id"), "k");
    fs.mkdirSync(path.join(root, "holdsclinic")); fs.mkdirSync(path.join(root, "holdsclinic", "clinic-x"));
    const stor = await (await get("/api/storage")).json();
    assert.equal(stor.usage[0].reclaimable, "47GB");
    assert.equal(stor.images[0].ref, "x:old");
    const listing = await (await get("/api/storage/list?path=" + encodeURIComponent(root))).json();
    assert.equal(listing.items[0].name, "big.bin", "biggest first");
    assert.equal(listing.items[0].deletable, true);
    assert.equal((await get("/api/storage/list?path=" + encodeURIComponent("/proc"))).status, 403);
    assert.equal((await get("/api/storage/list?path=" + encodeURIComponent(root + "/../.."))).status, 400, "dotdot");
    assert.equal((await get("/api/storage/list?path=relative")).status, 400);
    assert.equal((await post("/api/storage/delete", { path: root })).status, 403, "root itself");
    assert.equal((await post("/api/storage/delete", { path: "/etc/passwd" })).status, 403, "outside the roots");
    assert.equal((await post("/api/storage/delete", { path: root + "/../x" })).status, 400, "dotdot delete");
    assert.equal((await post("/api/storage/delete", { path: path.join(root, ".ssh") })).status, 403, "keys are protected");
    assert.equal((await post("/api/storage/delete", { path: path.join(root, "holdsclinic") })).status, 403, "protected content inside");
    assert.ok(fs.existsSync(path.join(root, ".ssh", "id")) && fs.existsSync(path.join(root, "holdsclinic", "clinic-x")));
    assert.equal((await post("/api/storage/delete", { path: path.join(root, "big.bin") })).status, 200);
    assert.ok(!fs.existsSync(path.join(root, "big.bin")), "deleted");
    calls.length = 0;
    assert.equal((await post("/api/storage/docker", { op: "buildCache" })).status, 200);
    assert.deepEqual(calls.pop(), ["docker", "builder", "prune", "-f"]);
    assert.equal((await post("/api/storage/docker", { op: "removeImage", ref: "abc123" })).status, 200);
    assert.deepEqual(calls.pop(), ["docker", "rmi", "abc123"], "never forced");
    assert.equal((await post("/api/storage/docker", { op: "removeImage", ref: "--force x" })).status, 400, "flag-like image");
    assert.equal((await post("/api/storage/docker", { op: "system-prune-all" })).status, 400, "unknown cleanup");
    fs.rmSync(root, { recursive: true, force: true });

    // --- audit: who asked is written down, also for what the panel site did with people
    assert.equal((await post("/api/audit-note", { type: "people:setRole", target: "u1", detail: "admin", ok: true })).status, 200);
    const a = await (await get("/api/audit")).json();
    assert.ok(a.items.some((i) => i.action === "restart" && i.name === "web" && i.who === "rotem.lau@gmail.com"));
    assert.ok(a.items.some((i) => i.type === "people:setRole" && i.target === "u1" && i.who === "rotem.lau@gmail.com"));
    assert.equal((await post("/api/audit-note", { type: "x" }, {})).status, 401, "notes need the secret too");

    // --- the old sign-in and people routes are gone
    for (const gone of ["/api/me", "/api/sso/start", "/api/people", "/api/confirm/start"]) assert.equal((await get(gone)).status, 404, gone);

    console.log("ALL AGENT TESTS PASSED");
  } catch (e) { console.error("FAIL", e); process.exitCode = 1; } finally { server.close(); }
});
