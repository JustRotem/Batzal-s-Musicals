// One codebase, several sites: the musicals site (the library), the account site (sign-in, settings, users and
// permissions) and the Batzal home page. Each container runs with APP_MODE=musicals (default), account or home.
export type AppMode = "musicals" | "account" | "home" | "qr" | "admin";

export function getAppMode(): AppMode {
  const mode = process.env.APP_MODE?.trim();

  return mode === "account" || mode === "home" || mode === "qr" || mode === "admin" ? mode : "musicals";
}

export function isAdminMode() {
  return getAppMode() === "admin";
}

export function isQrMode() {
  return getAppMode() === "qr";
}

export function isHomeMode() {
  return getAppMode() === "home";
}

export function isAccountMode() {
  return getAppMode() === "account";
}

function readUrl(name: string, productionDefault: string, developmentDefault: string) {
  const value = process.env[name]?.trim();

  if (value) {
    return value.replace(/\/$/, "");
  }

  return process.env.NODE_ENV === "production" ? productionDefault : developmentDefault;
}

// Where the account site lives (identity provider for every Batzal site).
export function getAccountUrl() {
  return readUrl("ACCOUNT_URL", "https://account.batzal.net", "http://localhost:3001");
}

// Where the control panel lives (users and permissions are managed there).
export function getAdminUrl() {
  return readUrl("ADMIN_URL", "https://admin.batzal.net", "http://localhost:4011");
}

// Where the musicals site lives.
export function getMusicalsUrl() {
  return readUrl("MUSICALS_URL", "https://library.batzal.net", "http://localhost:3000");
}

// The Batzal home page (what the logo leads to on every site).
export function getHomeUrl() {
  return readUrl("HOME_URL", "https://batzal.net", "http://localhost:4020");
}

// Where the QR maker lives.
export function getQrUrl() {
  return readUrl("QR_URL", "https://qr.batzal.net", "http://localhost:4030");
}
