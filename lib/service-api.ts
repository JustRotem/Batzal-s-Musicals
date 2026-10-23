import { createHash, timingSafeEqual } from "crypto";
import { db } from "@/lib/db";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";

// Server-to-server access for the control panel (admin.batzal.net). The panel sends a shared secret and the e-mail of the
// signed-in super admin; both are checked here, so a leaked secret alone cannot act without a real account that holds the panel_people permission.
function safeEqual(a: string, b: string) {
  const left = createHash("sha256").update(a).digest();
  const right = createHash("sha256").update(b).digest();

  return timingSafeEqual(left, right);
}

export async function authorizeServiceRequest(request: Request) {
  const secret = process.env.ADMIN_SERVICE_TOKEN?.trim();

  if (!secret || secret.length < 32) {
    return null;
  }

  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";

  if (!token || !safeEqual(token, secret)) {
    return null;
  }

  const email = request.headers.get("x-acting-admin")?.trim().toLowerCase();

  if (!email) {
    return null;
  }

  const user = await db.user.findFirst({
    where: { email: { equals: email, mode: "insensitive" }, status: "active" },
    select: { id: true, email: true, username: true, role: true },
  });

  if (!user || !(await hasPermission(user, PERMISSIONS.panelPeople))) {
    return null;
  }

  return user;
}
