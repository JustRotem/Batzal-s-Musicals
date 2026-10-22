// One codebase, two sites: the musicals site and the dedicated account site (sign-in, settings, users and permissions).
// Each container runs with APP_MODE=musicals (default) or APP_MODE=account.
export type AppMode = "musicals" | "account";

export function getAppMode(): AppMode {
  return process.env.APP_MODE?.trim() === "account" ? "account" : "musicals";
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

// Where the musicals site lives.
export function getMusicalsUrl() {
  return readUrl("MUSICALS_URL", "https://musicals.batzal.net", "http://localhost:3000");
}
