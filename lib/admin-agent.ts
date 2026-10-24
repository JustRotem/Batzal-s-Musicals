import { createHash, timingSafeEqual } from "crypto";

// The control panel runs in a container and cannot touch the host. A small agent runs on the host itself (docker, systemctl,
// disk usage) and answers only to this site, with a shared secret and the e-mail of the person who asked (for its log).
const timeoutMs = 120_000;

export function isAgentConfigured() {
  return Boolean(process.env.ADMIN_AGENT_URL?.trim() && (process.env.ADMIN_AGENT_TOKEN?.trim().length ?? 0) >= 32);
}

export async function callAgent(method: "GET" | "POST", path: string, actingEmail: string, body?: unknown) {
  if (!isAgentConfigured()) return { status: 503, body: { error: "not configured" } as unknown };

  try {
    const response = await fetch(`${process.env.ADMIN_AGENT_URL!.trim().replace(/\/$/, "")}${path}`, {
      method,
      cache: "no-store",
      signal: AbortSignal.timeout(timeoutMs),
      headers: {
        Authorization: `Bearer ${process.env.ADMIN_AGENT_TOKEN!.trim()}`,
        "X-Acting-Admin": actingEmail,
        "Content-Type": "application/json",
      },
      body: method === "POST" ? JSON.stringify(body ?? {}) : undefined,
    });

    return { status: response.status, body: (await response.json().catch(() => ({}))) as unknown };
  } catch {
    return { status: 502, body: { error: "agent unreachable" } as unknown };
  }
}

export function safeEqual(a: string, b: string) {
  return timingSafeEqual(createHash("sha256").update(a).digest(), createHash("sha256").update(b).digest());
}
