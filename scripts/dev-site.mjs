// Starts one of the Batzal sites for local work, with the right settings:  node scripts/dev-site.mjs <library|account|home|qr|admin>
// Every site has its own build folder, so they can all run at the same time and reload by themselves when a file changes.
import { spawn } from "node:child_process";

const SITES = {
  library: { port: 3000, env: {} },
  account: { port: 3001, env: { APP_MODE: "account" } },
  home: { port: 4020, env: { APP_MODE: "home" } },
  qr: { port: 4030, env: { APP_MODE: "qr" } },
  admin: { port: 4011, env: { APP_MODE: "admin" } },
};

const name = process.argv[2];
const site = SITES[name];

if (!site) {
  console.error(`Usage: node scripts/dev-site.mjs <${Object.keys(SITES).join("|")}>`);
  process.exit(1);
}

const url = `http://localhost:${site.port}`;
const child = spawn(process.execPath, ["node_modules/next/dist/bin/next", "dev", "-p", String(site.port)], {
  stdio: "inherit",
  env: {
    ...process.env,
    ...site.env,
    APP_URL: url,
    NEXT_PUBLIC_APP_URL: url,
    NEXT_DIST_DIR: name === "library" ? ".next" : `.next-${name}`,
  },
});

child.on("exit", (code) => process.exit(code ?? 0));
