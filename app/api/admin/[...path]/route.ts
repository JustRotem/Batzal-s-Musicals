import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, isIdentityConfirmed } from "@/lib/auth";
import { ACCOUNT_SSO_STATE_COOKIE, createAccountSsoState, getOwnOrigin } from "@/lib/account-sso";
import { getAccountUrl, isAdminMode } from "@/lib/app-mode";
import { applyPeopleOp, listPeople, needsConfirmation, type PeopleBody } from "@/lib/admin-people";
import { callAgent } from "@/lib/admin-agent";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";

export const dynamic = "force-dynamic";

const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });

// Read-only views need panel_view; everything that changes the server, its files or its logs needs panel_control;
// people and permissions need panel_people. The host agent only does what this route forwards.
const VIEW = new Set(["server", "sites", "containers", "services"]);
const CONTROL_GET = new Set(["audit", "logs", "storage", "storage/list"]);

function sameSite(request: NextRequest) {
  const origin = request.headers.get("origin");

  return !origin || origin === getOwnOrigin();
}

async function handle(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  if (!isAdminMode()) return json({ error: "not found" }, 404);

  const { path: parts } = await context.params;
  const path = parts.join("/");
  const method = request.method;

  if (method !== "GET" && !sameSite(request)) return json({ error: "forbidden" }, 403);

  const user = await getCurrentUser();

  // The panel's own sign-in: send the person to the account site, asking for a fresh Google confirmation.
  if (path === "confirm/start" && method === "GET") {
    if (!user) return json({ error: "login required" }, 401);

    const state = createAccountSsoState();
    const url = new URL("/auth/confirm", getAccountUrl());

    url.searchParams.set("return", getOwnOrigin());
    url.searchParams.set("state", state);

    const response = NextResponse.redirect(url.toString());

    response.cookies.set(ACCOUNT_SSO_STATE_COOKIE, state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 300,
    });
    response.headers.set("Cache-Control", "no-store");

    return response;
  }

  if (!user || user.status !== "active") return json({ error: "login required" }, 401);

  const [canView, canControl, canPeople] = await Promise.all([
    hasPermission(user, PERMISSIONS.panelView),
    hasPermission(user, PERMISSIONS.panelControl),
    hasPermission(user, PERMISSIONS.panelPeople),
  ]);

  if (!canView) return json({ error: "forbidden" }, 403);

  if (path === "me" && method === "GET") {
    return json({
      user: { name: user.username, email: user.email, role: user.role },
      perms: [canView && "panel_view", canControl && "panel_control", canPeople && "panel_people"].filter(Boolean),
      confirmed: await isIdentityConfirmed(),
    });
  }

  // ---- people and permissions: the database of this app, no agent involved
  if (path === "people") {
    if (!canPeople) return json({ error: "forbidden" }, 403);

    if (method === "GET") {
      const result = await listPeople(user);

      return json(result.body, result.status);
    }

    if (method === "POST") {
      const input = (await request.json().catch(() => null)) as PeopleBody | null;
      const allowed = ["setRole", "setStatus", "setUserPermissions", "setRolePermissions", "deleteUser"];

      if (!input?.op || !allowed.includes(input.op)) return json({ error: "bad request" }, 400);
      // permanent deletion is for super admins only, whatever other permissions someone holds
      if (input.op === "deleteUser" && user.role !== "superadmin") return json({ error: "forbidden" }, 403);

      if (needsConfirmation(input) && !(await isIdentityConfirmed())) return json({ error: "confirm-required" }, 403);

      const result = await applyPeopleOp(user, input);

      await callAgent("POST", "/api/audit-note", user.email, {
        type: `people:${input.op}`,
        target: input.userId || input.role || "",
        detail: input.role || input.status || "",
        ok: result.status === 200,
      });

      return json(result.body, result.status);
    }
  }

  // ---- everything that needs the host: forwarded to the agent
  const first = parts[0];
  const forwarded = `/api/${path}${request.nextUrl.search}`;

  if (method === "GET" && (VIEW.has(first) || CONTROL_GET.has(path) || CONTROL_GET.has(first))) {
    if (!VIEW.has(first) && !canControl) return json({ error: "forbidden" }, 403);

    const result = await callAgent("GET", forwarded, user.email);

    return json(result.body, result.status);
  }

  if (method === "POST" && (first === "containers" || first === "services" || first === "storage")) {
    if (!canControl) return json({ error: "forbidden" }, 403);

    const body = first === "storage" ? await request.json().catch(() => ({})) : {};
    const result = await callAgent("POST", forwarded, user.email, body);

    return json(result.body, result.status);
  }

  return json({ error: "not found" }, 404);
}

export { handle as GET, handle as POST };
