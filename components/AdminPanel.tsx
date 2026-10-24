"use client";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import ModalCloseButton from "@/components/ModalCloseButton";
import type { AppLanguage } from "@/lib/i18n";

// The control panel. It talks to /api/admin/* of this same site: people and permissions come from the database,
// everything about the server (containers, services, disk) is done by the small agent that runs on the host.

type Perm = "panel_view" | "panel_control" | "panel_people";

type ServerInfo = { uptimeSec: number; load: number[]; cpus: number; memTotal: number; memUsed: number; diskTotal: number; diskUsed: number };
type Site = { domain: string; status: number; ms: number; certDays: number | null };
type Container = { name: string; image: string; state: string; status: string; ports: string; cpu: string | null; mem: string | null };
type Service = { name: string; actions: string[]; installed: boolean; active: string; sub: string; memMb: number | null };
type AuditItem = { t: string; type?: string; action?: string; name?: string; who?: string; target?: string; detail?: string; ok?: boolean };
type DockerUsage = { type: string; size: string; reclaimable: string };
type DockerImage = { id: string; ref: string; size: string; created: string; dangling: boolean; inUse: boolean };
type Entry = { name: string; path: string; size: number; kind: "file" | "dir" | "link"; deletable: boolean };
type Folder = { path: string; total: number; items: Entry[] };
type Person = { id: string; username: string; email: string; role: string; status: string; permissions: string[] };
type PermDef = { name: string; label: string; description: string; site: string; group: string };
type People = { you: string; superadmin: boolean; users: Person[]; roles: Record<string, string[]>; permissions: Record<AppLanguage, PermDef[]> };

const text = (language: AppLanguage, he: string, en: string) => (language === "he" ? he : en);

const CONTAINER_LABELS: Record<string, [string, string, string, string | null, string | null]> = {
  "batzals-musicals-app": ["אתר הספרייה", "Library site", "", "כיבוי או הפעלה מחדש יורידו את הספרייה מהאוויר לרגע", "Stopping or restarting takes the library offline for a moment"],
  "batzals-musicals-db": ["מסד הנתונים", "Database", "", "כיבוי יפיל את כל האתרים", "Stopping it takes every site down"],
  "qr-api": ["מפיק QR (ישן)", "QR maker (old)", "", null, null],
};
const SERVICE_LABELS: Record<string, [string, string, string | null, string | null]> = {
  nginx: ["nginx", "nginx", "שרת האתרים: הפעלה מחדש יכולה להפריע לרגע לכל האתרים", "The web server: restarting may briefly disturb every site"],
  mariadb: ["MariaDB (MySQL)", "MariaDB (MySQL)", "כיבוי יפיל את phpMyAdmin ואת הפאנל של Pterodactyl", "Stopping it takes down phpMyAdmin and the Pterodactyl panel"],
  "redis-server": ["Redis", "Redis", "נחוץ ל-Pterodactyl", "Needed by Pterodactyl"],
  wings: ["Wings (שרתי משחק)", "Wings (game servers)", "הפעלה מחדש עלולה לנתק שחקנים", "Restarting may disconnect players"],
  pteroq: ["Pterodactyl queue", "Pterodactyl queue", null, null],
};
const RANKS: Record<string, [string, string]> = { user: ["משתמש", "User"], editor: ["עורך", "Editor"], admin: ["מנהל", "Admin"], superadmin: ["מנהל ראשי", "Super admin"] };

const fmtBytes = (n: number) => (n >= 2 ** 30 ? `${(n / 2 ** 30).toFixed(1)} GB` : `${Math.round(n / 2 ** 20)} MB`);
const fmtSize = (n: number) => (n >= 2 ** 30 ? `${(n / 2 ** 30).toFixed(1)} GB` : n >= 2 ** 20 ? `${(n / 2 ** 20).toFixed(1)} MB` : `${Math.round(n / 1024)} KB`);
const parseSize = (value: string) => {
  const match = /^([\d.]+)\s*([KMGT]?B)/i.exec(value || "");

  if (!match) return 0;

  return Number(match[1]) * ({ B: 1, KB: 1e3, MB: 1e6, GB: 1e9, TB: 1e12 }[match[2].toUpperCase()] ?? 1);
};

class LoginRequired extends Error {}

async function call(path: string, init: RequestInit = {}) {
  const response = await fetch(`/api/admin/${path}`, { credentials: "same-origin", ...init, headers: { "Content-Type": "application/json", ...(init.headers ?? {}) } });

  if (response.status === 401) {
    window.location.reload();
    throw new LoginRequired();
  }

  return response;
}

// ---- floating windows (the same look as everywhere on Batzal)
function Window({ title, onClose, children, wide }: { title: string; onClose: () => void; wide?: boolean; children: React.ReactNode }) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    document.addEventListener("keydown", onKey);

    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return createPortal(
    <div className="confirm-modal-overlay" onClick={onClose}>
      <div className={`confirm-modal-card card adm-window${wide ? " wide" : ""}`} role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
        <ModalCloseButton onClick={onClose} />
        <h3 className="panel-title">{title}</h3>
        {children}
      </div>
    </div>,
    document.body,
  );
}

type ConfirmState = { title: string; body?: string; resolve: (value: boolean) => void } | null;

export default function AdminPanel({ language, perms, you }: { language: AppLanguage; perms: Perm[]; you: string }) {
  const T = (he: string, en: string) => text(language, he, en);
  const can = (permission: Perm) => perms.includes(permission);
  const [mounted, setMounted] = useState(false);
  const [server, setServer] = useState<ServerInfo | null>(null);
  const [sites, setSites] = useState<Site[]>([]);
  const [containers, setContainers] = useState<Container[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [audit, setAudit] = useState<AuditItem[]>([]);
  const [people, setPeople] = useState<People | null>(null);
  const [search, setSearch] = useState("");
  const [toast, setToast] = useState<{ message: string; bad: boolean } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<ConfirmState>(null);
  const [logs, setLogs] = useState<{ type: "container" | "service"; name: string; label: string } | null>(null);
  const [deleting, setDeleting] = useState<Person | null>(null);
  const [permsFor, setPermsFor] = useState<{ kind: "user"; person: Person } | { kind: "role" } | null>(null);
  const toastTimer = useRef<number | undefined>(undefined);

  useEffect(() => setMounted(true), []);

  const say = useCallback((message: string, bad = false) => {
    setToast({ message, bad });
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 3200);
  }, []);

  const ask = useCallback((title: string, body?: string) => new Promise<boolean>((resolve) => setConfirm({ title, body, resolve })), []);

  const load = useCallback(async <T,>(path: string): Promise<T | null> => {
    try {
      const response = await call(path);

      return response.ok ? ((await response.json()) as T) : null;
    } catch {
      return null;
    }
  }, []);

  const refreshFast = useCallback(async () => {
    const [info, ctr, svc] = await Promise.all([load<ServerInfo>("server"), load<{ items: Container[] }>("containers"), load<{ items: Service[] }>("services")]);

    if (info) setServer(info);
    if (ctr) setContainers(ctr.items);
    if (svc) setServices(svc.items);
  }, [load]);
  const refreshSites = useCallback(async () => {
    const result = await load<{ items: Site[] }>("sites");

    if (result) setSites(result.items);
  }, [load]);
  const refreshAudit = useCallback(async () => {
    if (!can("panel_control")) return;

    const result = await load<{ items: AuditItem[] }>("audit");

    if (result) setAudit(result.items);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load]);
  const refreshPeople = useCallback(async () => {
    if (!can("panel_people")) return;

    const result = await load<People>("people");

    if (result) setPeople(result);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load]);

  useEffect(() => {
    void refreshFast();
    void refreshSites();
    void refreshAudit();
    void refreshPeople();

    const fast = window.setInterval(() => void refreshFast(), 10_000);
    const slow = window.setInterval(() => void refreshSites(), 60_000);

    return () => {
      window.clearInterval(fast);
      window.clearInterval(slow);
    };
  }, [refreshFast, refreshSites, refreshAudit, refreshPeople]);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("confirmed")) {
      window.history.replaceState(null, "", window.location.pathname);
      window.setTimeout(() => say(T("הזהות אושרה. אפשר לבצע את השינוי עכשיו", "Identity confirmed. You can make the change now")), 700);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- server actions
  const verb = (action: string) => ({ start: T("הפעל", "Start"), stop: T("כבה", "Stop"), restart: T("הפעל מחדש", "Restart"), reload: T("טען מחדש", "Reload") })[action] ?? action;

  const act = async (kind: "containers" | "services", name: string, action: string, label: string, hint: string | null) => {
    if (action !== "start" && !(await ask(`${verb(action)}: ${label}?`, hint ?? undefined))) return;

    setBusy(`${kind}/${name}/${action}`);

    try {
      const response = await call(`${kind}/${encodeURIComponent(name)}/${action}`, { method: "POST", body: "{}" });
      const data = (await response.json().catch(() => ({}))) as { error?: string };

      if (response.ok) say(`${label}: ${T("בוצע", "done")}`);
      else say(`${label}: ${T("נכשל", "failed")}${data.error ? ` (${data.error.slice(0, 80)})` : ""}`, true);
    } catch {
      say(T("שגיאת תקשורת", "Connection error"), true);
    }

    setBusy(null);
    await Promise.all([refreshFast(), refreshAudit()]);
  };

  // ---- people
  const peopleCall = async (body: Record<string, unknown>, okMessage: string) => {
    try {
      const response = await call("people", { method: "POST", body: JSON.stringify(body) });
      const data = (await response.json().catch(() => ({}))) as { error?: string };

      if (data.error === "confirm-required") {
        if (await ask(T("אישור זהות", "Confirm your identity"), T("כדי לתת הרשאות גבוהות או דרגת מנהל צריך להתחבר שוב עם Google ולאשר שזה באמת אתה. אחרי האישור יש 10 דקות לבצע שינויים.", "To grant high permissions or an admin rank you sign in with Google again to confirm it is really you. After that you have 10 minutes to make changes."))) {
          window.location.href = "/api/admin/confirm/start";
        }

        return;
      }

      if (response.ok) say(okMessage);
      else say(data.error === "self" ? T("אי אפשר לשנות את החשבון שלך כאן", "You cannot change your own account here") : T("הפעולה נכשלה", "The action failed"), true);
    } catch {
      say(T("שגיאת תקשורת", "Connection error"), true);
    }

    await Promise.all([refreshPeople(), refreshAudit()]);
  };

  const shownPeople = useMemo(() => {
    const query = search.trim().toLowerCase();

    return (people?.users ?? []).filter((person) => !query || person.username.toLowerCase().includes(query) || person.email.toLowerCase().includes(query));
  }, [people, search]);

  const rank = (value: string) => (RANKS[value] ? T(RANKS[value][0], RANKS[value][1]) : value);

  const containerLabel = (name: string): [string, string | null] => {
    const known = CONTAINER_LABELS[name];

    if (known) return [T(known[0], known[1]), known[3] ? T(known[3], known[4] ?? known[3]) : null];

    return /^[0-9a-f]{8}-[0-9a-f]{4}-/.test(name)
      ? [T("שרת משחק", "Game server"), T("שרת Minecraft/Pterodactyl. כיבוי מנתק שחקנים", "Minecraft/Pterodactyl server. Stopping it disconnects players")]
      : [name, null];
  };

  const up = sites.filter((site) => site.status >= 200 && site.status < 400).length;
  const running = containers.filter((container) => container.state === "running").length;

  const auditAction = (item: AuditItem) => {
    if (item.type === "login") return T("התחברות", "Sign-in");
    if (item.type === "confirm") return T("אישור זהות", "Identity confirmed");
    if (item.type?.startsWith("people:")) return `${T("משתמשים והרשאות", "People and permissions")}: ${item.type.slice(7)}`;
    if (item.type?.startsWith("storage:")) return `${T("אחסון", "Storage")}: ${item.type.slice(8)}`;

    return item.action ? verb(item.action) : item.type ?? "";
  };

  return (
    <main className="adm-page">
      <div className="adm-grid">
        <Stat label={T("זמן פעילות", "Uptime")} value={server ? uptime(server.uptimeSec, language) : "…"} />
        <Stat label={T("עומס מעבד", "CPU load")} value={server ? `${server.load[0]} / ${server.cpus} ${T("ליבות", "cores")}` : "…"} pct={server ? (server.load[0] / server.cpus) * 100 : undefined} />
        <Stat label={T("זיכרון", "Memory")} value={server ? `${fmtBytes(server.memUsed)} ${T("מתוך", "of")} ${fmtBytes(server.memTotal)}` : "…"} pct={server ? (server.memUsed / server.memTotal) * 100 : undefined} />
        <Stat label={T("דיסק", "Disk")} value={server ? `${fmtBytes(server.diskUsed)} ${T("מתוך", "of")} ${fmtBytes(server.diskTotal)}` : "…"} pct={server ? (server.diskUsed / server.diskTotal) * 100 : undefined} />
      </div>

      <h2>
        {T("אתרים", "Sites")} <span className="sub">{sites.length ? `${up} ${T("מתוך", "of")} ${sites.length} ${T("פעילים", "up")}` : ""}</span>
        <button type="button" className="button-secondary" onClick={() => void refreshSites()}>
          {T("בדוק שוב", "Check again")}
        </button>
      </h2>
      <div className="card adm-table">
        <table>
          <thead>
            <tr>
              <th>{T("כתובת", "Address")}</th>
              <th>{T("מצב", "Status")}</th>
              <th>{T("תגובה", "Response")}</th>
              <th>{T("תעודת SSL", "SSL certificate")}</th>
            </tr>
          </thead>
          <tbody>
            {sites.map((site) => {
              const ok = site.status >= 200 && site.status < 400;
              const kind = ok ? "ok" : site.status >= 400 && site.status < 500 ? "warn" : "bad";

              return (
                <tr key={site.domain}>
                  <td className="ltr">
                    <a href={`https://${site.domain}`} target="_blank" rel="noopener noreferrer">
                      {site.domain}
                    </a>
                  </td>
                  <td>
                    <span className={`adm-pill ${kind}`}>{site.status ? site.status : T("לא עונה", "No response")}</span>
                  </td>
                  <td>{site.ms} ms</td>
                  <td>
                    {site.certDays == null ? <span className="adm-pill">{T("לא ידוע", "Unknown")}</span> : <span className={`adm-pill ${site.certDays < 7 ? "bad" : site.certDays < 21 ? "warn" : "ok"}`}>{site.certDays} {T("ימים", "days")}</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <h2>
        {T("קונטיינרים", "Containers")} <span className="sub">{containers.length ? `${running} ${T("מתוך", "of")} ${containers.length} ${T("רצים", "running")}` : ""}</span>
      </h2>
      <div className="adm-grid">
        {containers.map((container) => {
          const [label, hint] = containerLabel(container.name);
          const isRunning = container.state === "running";
          const kind = isRunning ? (/unhealthy/.test(container.status) ? "warn" : "ok") : container.state === "exited" ? "bad" : "warn";

          return (
            <div className="card adm-item" key={container.name}>
              <div className="head">
                <span className={`adm-dot ${kind}`} />
                <span className="title" title={container.name}>{label}</span>
              </div>
              <div className="meta" title={container.name}>{container.name !== label ? container.name : container.image}</div>
              <div className="nums">
                <span>{container.status}</span>
                {container.cpu ? <span>CPU {container.cpu}</span> : null}
                {container.mem ? <span>{container.mem}</span> : null}
              </div>
              {can("panel_control") ? (
                <div className="actions">
                  <button type="button" className="button-primary" disabled={isRunning || busy !== null} onClick={() => void act("containers", container.name, "start", label, hint)}>▶ {T("הפעל", "Start")}</button>
                  <button type="button" className="button-secondary" disabled={busy !== null} onClick={() => void act("containers", container.name, "restart", label, hint)}>↻ {T("מחדש", "Restart")}</button>
                  <button type="button" className="button-danger" disabled={!isRunning || busy !== null} onClick={() => void act("containers", container.name, "stop", label, hint)}>■ {T("כבה", "Stop")}</button>
                  <button type="button" className="button-secondary" onClick={() => setLogs({ type: "container", name: container.name, label })}>📜 {T("לוגים", "Logs")}</button>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      {can("panel_people") ? (
        <>
          <h2>
            {T("משתמשים והרשאות", "People and permissions")} <span className="sub">{people ? `${people.users.length} ${T("משתמשים", "users")}` : ""}</span>
            <button type="button" className="button-secondary" onClick={() => people && setPermsFor({ kind: "role" })}>
              {T("ניהול הרשאות לדרגות", "Rank permissions")}
            </button>
          </h2>
          <input className="input adm-search" type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={T("חיפוש לפי שם משתמש או אימייל", "Search by username or email")} aria-label={T("חיפוש משתמשים", "Search users")} />
          <div className="card adm-table">
            <table>
              <thead>
                <tr>
                  <th>{T("משתמש", "User")}</th>
                  <th>{T("דרגה", "Rank")}</th>
                  <th>{T("מצב", "Status")}</th>
                  <th>{T("הרשאות נוספות", "Extra permissions")}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {shownPeople.map((person) => {
                  const me = person.id === you;
                  const blocked = person.status === "blocked";

                  return (
                    <tr key={person.id}>
                      <td>
                        <strong>{person.username}{me ? ` ${T("(אתה)", "(you)")}` : ""}</strong>
                        <div className="adm-hint ltr">{person.email}</div>
                      </td>
                      <td>
                        <select
                          className="adm-select"
                          value={person.role}
                          disabled={me}
                          aria-label={T("דרגה", "Rank")}
                          onChange={async (event) => {
                            const value = event.target.value;

                            if (await ask(T(`לשנות את הדרגה של ${person.username} ל-${rank(value)}?`, `Change the rank of ${person.username} to ${rank(value)}?`), T("הדרגה קובעת אילו הרשאות יש למשתמש בכל האתרים.", "The rank decides which permissions the user has on every site."))) {
                              await peopleCall({ op: "setRole", userId: person.id, role: value }, T("הדרגה עודכנה", "Rank updated"));
                            }
                          }}
                        >
                          {Object.keys(RANKS).map((value) => (
                            <option key={value} value={value}>{rank(value)}</option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <span className={`adm-pill ${blocked ? "bad" : person.status === "pending" ? "warn" : "ok"}`}>{blocked ? T("חסום", "Blocked") : person.status === "pending" ? T("ממתין", "Pending") : T("פעיל", "Active")}</span>
                      </td>
                      <td>
                        <button type="button" className="button-secondary" onClick={() => setPermsFor({ kind: "user", person })}>
                          {person.permissions.length ? `${person.permissions.length} ${T("הרשאות", "permissions")}` : T("הוספה", "Add")}
                        </button>
                      </td>
                      <td className="adm-acts">
                        <button
                          type="button"
                          className={blocked ? "button-secondary" : "button-danger"}
                          disabled={me}
                          onClick={async () => {
                            if (await ask(blocked ? T(`לבטל את החסימה של ${person.username}?`, `Unblock ${person.username}?`) : T(`לחסום את ${person.username}?`, `Block ${person.username}?`), blocked ? undefined : T("המשתמש יתנתק מיד ולא יוכל להתחבר לאף אתר.", "They are signed out immediately and cannot sign in to any site."))) {
                              await peopleCall({ op: "setStatus", userId: person.id, status: blocked ? "active" : "blocked" }, blocked ? T("החסימה בוטלה", "Block removed") : T("המשתמש נחסם", "User blocked"));
                            }
                          }}
                        >
                          {blocked ? T("בטל חסימה", "Unblock") : T("חסום", "Block")}
                        </button>
                        {people?.superadmin && !me && person.role !== "superadmin" ? (
                          <button type="button" className="button-danger" onClick={() => setDeleting(person)}>
                            {T("מחק", "Delete")}
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      ) : null}

      {can("panel_control") ? <Storage language={language} ask={ask} say={say} refreshAudit={refreshAudit} /> : null}

      <h2>{T("שירותים בשרת", "Server services")}</h2>
      <div className="adm-grid">
        {services.filter((service) => service.installed).map((service) => {
          const known = SERVICE_LABELS[service.name];
          const label = known ? T(known[0], known[1]) : service.name;
          const hint = known && known[2] ? T(known[2], known[3] ?? known[2]) : null;
          const isRunning = service.active === "active";

          return (
            <div className="card adm-item" key={service.name}>
              <div className="head">
                <span className={`adm-dot ${isRunning ? "ok" : service.active === "failed" ? "bad" : "warn"}`} />
                <span className="title">{label}</span>
              </div>
              <div className="nums">
                <span>{service.active}{service.sub ? ` / ${service.sub}` : ""}</span>
                {service.memMb != null ? <span>{service.memMb} MB</span> : null}
              </div>
              {can("panel_control") ? (
                <div className="actions">
                  {service.actions.includes("start") ? <button type="button" className="button-primary" disabled={isRunning || busy !== null} onClick={() => void act("services", service.name, "start", label, hint)}>▶ {T("הפעל", "Start")}</button> : null}
                  {service.actions.includes("restart") ? <button type="button" className="button-secondary" disabled={busy !== null} onClick={() => void act("services", service.name, "restart", label, hint)}>↻ {T("מחדש", "Restart")}</button> : null}
                  {service.actions.includes("reload") ? <button type="button" className="button-secondary" disabled={busy !== null} onClick={() => void act("services", service.name, "reload", label, hint)}>⟳ {T("טען מחדש", "Reload")}</button> : null}
                  {service.actions.includes("stop") ? <button type="button" className="button-danger" disabled={!isRunning || busy !== null} onClick={() => void act("services", service.name, "stop", label, hint)}>■ {T("כבה", "Stop")}</button> : null}
                  <button type="button" className="button-secondary" onClick={() => setLogs({ type: "service", name: service.name, label })}>📜 {T("לוגים", "Logs")}</button>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      {can("panel_control") ? (
        <>
          <h2>{T("יומן פעולות", "Action log")}</h2>
          <div className="card adm-table">
            <table>
              <thead>
                <tr>
                  <th>{T("זמן", "Time")}</th>
                  <th>{T("פעולה", "Action")}</th>
                  <th>{T("יעד", "Target")}</th>
                  <th>{T("תוצאה", "Result")}</th>
                </tr>
              </thead>
              <tbody>
                {audit.length ? (
                  audit.map((item, index) => (
                    <tr key={`${item.t}-${index}`}>
                      <td>{new Date(item.t).toLocaleString(language === "he" ? "he-IL" : "en-GB")}</td>
                      <td>{auditAction(item)}</td>
                      <td className="ltr">{item.type === "login" || item.type === "confirm" ? item.who : [item.name, item.target, item.detail].filter(Boolean).join(" → ")}</td>
                      <td><span className={`adm-pill ${item.ok ? "ok" : "bad"}`}>{item.ok ? T("הצליח", "Succeeded") : T("נכשל", "Failed")}</span></td>
                    </tr>
                  ))
                ) : (
                  <tr><td colSpan={4}>{T("אין פעולות עדיין", "No actions yet")}</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      ) : null}

      {mounted && confirm
        ? (
          <Window title={confirm.title} onClose={() => { confirm.resolve(false); setConfirm(null); }}>
            {confirm.body ? <p className="adm-hint">{confirm.body}</p> : null}
            <div className="adm-row">
              <button type="button" className="button-primary" onClick={() => { confirm.resolve(true); setConfirm(null); }}>{T("אישור", "OK")}</button>
            </div>
          </Window>
        )
        : null}

      {mounted && deleting ? (
        <DeleteUserWindow
          language={language}
          person={deleting}
          onClose={() => setDeleting(null)}
          onConfirm={async (email) => {
            const person = deleting;

            setDeleting(null);
            await peopleCall({ op: "deleteUser", userId: person.id, confirmEmail: email }, T("המשתמש נמחק", "User deleted"));
          }}
        />
      ) : null}

      {mounted && logs ? <LogsWindow language={language} logs={logs} onClose={() => setLogs(null)} /> : null}

      {mounted && permsFor && people ? (
        <PermsWindow
          language={language}
          people={people}
          target={permsFor}
          rank={rank}
          onClose={() => setPermsFor(null)}
          onSave={async (calls) => {
            setPermsFor(null);

            for (const body of calls) await peopleCall(body, T("ההרשאות נשמרו", "Permissions saved"));
          }}
        />
      ) : null}

      {toast ? <div className={`adm-toast show${toast.bad ? " bad" : ""}`} role="status">{toast.message}</div> : null}
    </main>
  );
}

// Deleting someone is final: the e-mail has to be typed in, the same way deleting an item in the library asks for its name.
function DeleteUserWindow({ language, person, onClose, onConfirm }: { language: AppLanguage; person: Person; onClose: () => void; onConfirm: (email: string) => Promise<void> }) {
  const T = (he: string, en: string) => text(language, he, en);
  const [typed, setTyped] = useState("");
  const [working, setWorking] = useState(false);
  const matches = typed.trim().toLowerCase() === person.email.toLowerCase();

  return (
    <Window title={T("מחיקת משתמש", "Delete user")} onClose={onClose}>
      <p className="adm-hint">
        {T(`החשבון של ${person.username}, התגובות והנתונים שלו יימחקו לצמיתות ולא ניתן לשחזר. אם רק רוצים למנוע כניסה, עדיף לחסום.`, `${person.username}'s account, comments and data are deleted for good and cannot be restored. To only stop them signing in, block them instead.`)}
      </p>
      <label className="adm-hint" htmlFor="adm-delete-email">
        {T("כדי לאשר, כתבו את האימייל של המשתמש:", "To confirm, type the user's e-mail:")}
      </label>
      <div className="adm-email-target ltr">{person.email}</div>
      <input
        id="adm-delete-email"
        className="input ltr"
        dir="ltr"
        autoComplete="off"
        spellCheck={false}
        value={typed}
        onChange={(event) => setTyped(event.target.value)}
        onPaste={(event) => event.preventDefault()}
        placeholder={person.email}
      />
      <div className="adm-row">
        <button type="button" className="button-secondary" onClick={onClose}>{T("ביטול", "Cancel")}</button>
        <button
          type="button"
          className="button-danger"
          disabled={!matches || working}
          onClick={async () => {
            setWorking(true);
            await onConfirm(typed.trim());
          }}
        >
          {T("מחק לצמיתות", "Delete permanently")}
        </button>
      </div>
    </Window>
  );
}

function uptime(seconds: number, language: AppLanguage) {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);

  return days ? `${days} ${text(language, "ימים", "days")} ${hours} ${text(language, "שעות", "hours")}` : `${hours} ${text(language, "שעות", "hours")}`;
}

function Stat({ label, value, pct }: { label: string; value: string; pct?: number }) {
  return (
    <div className="card adm-stat">
      <div className="k">{label}</div>
      <div className="v">{value}</div>
      {pct != null ? <div className="adm-bar"><i style={{ width: `${Math.min(100, pct)}%` }} /></div> : null}
    </div>
  );
}

function LogsWindow({ language, logs, onClose }: { language: AppLanguage; logs: { type: string; name: string; label: string }; onClose: () => void }) {
  const [content, setContent] = useState(text(language, "טוען…", "Loading…"));
  const [auto, setAuto] = useState(false);
  const pre = useRef<HTMLPreElement>(null);

  const refresh = useCallback(async () => {
    try {
      const response = await call(`logs?type=${logs.type}&name=${encodeURIComponent(logs.name)}&lines=300`);
      const data = (await response.json()) as { text?: string };
      const element = pre.current;
      const atEnd = !element || element.scrollTop + element.clientHeight >= element.scrollHeight - 30;

      setContent(data.text || text(language, "(ריק)", "(empty)"));

      if (atEnd) window.setTimeout(() => pre.current && (pre.current.scrollTop = pre.current.scrollHeight), 0);
    } catch {
      // keep what is shown
    }
  }, [logs, language]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!auto) return;

    const timer = window.setInterval(() => void refresh(), 3000);

    return () => window.clearInterval(timer);
  }, [auto, refresh]);

  return (
    <Window wide title={`${text(language, "לוגים", "Logs")}: ${logs.label}`} onClose={onClose}>
      <div className="adm-row start">
        <button type="button" className="button-secondary" onClick={() => void refresh()}>{text(language, "רענן", "Refresh")}</button>
        <label className="adm-hint"><input type="checkbox" checked={auto} onChange={(event) => setAuto(event.target.checked)} /> {text(language, "רענון אוטומטי", "Auto refresh")}</label>
      </div>
      <pre className="adm-log" ref={pre}>{content}</pre>
    </Window>
  );
}

type PeopleCall = Record<string, unknown>;

function PermsWindow({
  language,
  people,
  target,
  rank,
  onClose,
  onSave,
}: {
  language: AppLanguage;
  people: People;
  target: { kind: "user"; person: Person } | { kind: "role" };
  rank: (value: string) => string;
  onClose: () => void;
  onSave: (calls: PeopleCall[]) => Promise<void>;
}) {
  const T = (he: string, en: string) => text(language, he, en);
  const isRole = target.kind === "role";
  const ranks = ["user", "editor", "admin"];
  const [current, setCurrent] = useState("user");
  const [drafts, setDrafts] = useState<Record<string, Set<string>>>(() => Object.fromEntries(ranks.map((name) => [name, new Set(people.roles[name])])));
  const [chosen, setChosen] = useState<Set<string>>(() => new Set(target.kind === "user" ? target.person.permissions : []));
  const inherited = useMemo(() => new Set(target.kind === "user" ? people.roles[target.person.role] ?? [] : []), [target, people]);
  const defs = people.permissions[language];
  const groups = useMemo(() => {
    const map = new Map<string, PermDef[]>();

    for (const def of defs) {
      const key = `${def.site} · ${def.group}`;

      map.set(key, [...(map.get(key) ?? []), def]);
    }

    return [...map];
  }, [defs]);
  const active = isRole ? drafts[current] : chosen;

  const toggle = (name: string, on: boolean) => {
    const next = new Set(active);

    if (on) next.add(name);
    else next.delete(name);

    if (isRole) setDrafts({ ...drafts, [current]: next });
    else setChosen(next);
  };

  const save = () => {
    if (target.kind === "role") {
      const calls: PeopleCall[] = [];

      for (const name of ranks) {
        const before = new Set(people.roles[name]);
        const now = drafts[name];

        if (before.size === now.size && [...now].every((item) => before.has(item))) continue;

        calls.push({ op: "setRolePermissions", role: name, permissions: [...now] });
      }

      return onSave(calls);
    }

    return onSave([{ op: "setUserPermissions", userId: target.person.id, permissions: [...chosen].filter((item) => !inherited.has(item)) }]);
  };

  return (
    <Window wide title={target.kind === "role" ? T("ניהול הרשאות לדרגות", "Rank permissions") : `${T("הרשאות נוספות", "Extra permissions")}: ${target.person.username}`} onClose={onClose}>
      <p className="adm-hint">
        {target.kind === "role"
          ? T("בחר דרגה ושנה מה מותר לה. השינוי חל על כל מי שבדרגה הזו.", "Pick a rank and change what it may do. The change applies to everyone with that rank.")
          : T(`הרשאות שמתווספות מעל חבילת הדרגה (${rank(target.person.role)}). מה שסומן באפור כבר כלול בדרגה.`, `Permissions added on top of the rank bundle (${rank(target.person.role)}). Greyed items are already included in the rank.`)}
      </p>
      {isRole ? (
        <div className="adm-tabs" role="tablist">
          {ranks.map((name) => (
            <button key={name} type="button" role="tab" aria-selected={name === current} className={name === current ? "on" : ""} onClick={() => setCurrent(name)}>{rank(name)}</button>
          ))}
        </div>
      ) : null}
      <div className="adm-perms">
        {groups.map(([key, items]) => (
          <fieldset className="adm-group" key={key}>
            <legend>{key}</legend>
            {items.map((def) => {
              const locked = inherited.has(def.name);

              return (
                <label className="adm-perm" key={def.name}>
                  <input type="checkbox" checked={active.has(def.name) || locked} disabled={locked} onChange={(event) => toggle(def.name, event.target.checked)} />
                  <span><strong>{def.label}</strong><small className="adm-hint">{def.description}</small></span>
                </label>
              );
            })}
          </fieldset>
        ))}
      </div>
      <div className="adm-row">
        <button type="button" className="button-primary" onClick={() => void save()}>{T("שמור", "Save")}</button>
      </div>
    </Window>
  );
}

// ---- storage: what fills the disk, and a safe way to clean up
function Storage({ language, ask, say, refreshAudit }: { language: AppLanguage; ask: (title: string, body?: string) => Promise<boolean>; say: (message: string, bad?: boolean) => void; refreshAudit: () => Promise<void> }) {
  const T = (he: string, en: string) => text(language, he, en);
  const [usage, setUsage] = useState<DockerUsage[]>([]);
  const [images, setImages] = useState<DockerImage[]>([]);
  const [folder, setFolder] = useState<Folder | null>(null);
  const [loadingFolder, setLoadingFolder] = useState(false);

  const loadDocker = useCallback(async () => {
    try {
      const response = await call("storage");

      if (!response.ok) return;

      const data = (await response.json()) as { usage: DockerUsage[]; images: DockerImage[] };

      setUsage(data.usage);
      setImages(data.images.slice().sort((a, b) => parseSize(b.size) - parseSize(a.size)));
    } catch {
      // not available
    }
  }, []);

  useEffect(() => {
    void loadDocker();
  }, [loadDocker]);

  const browse = useCallback(async (dir: string) => {
    setLoadingFolder(true);

    try {
      const response = await call(`storage/list?path=${encodeURIComponent(dir)}`);
      const data = (await response.json()) as Folder & { error?: string };

      if (!response.ok) say(data.error === "not allowed" ? T("אין גישה לתיקייה הזו", "No access to this folder") : T("הפעולה נכשלה", "The action failed"), true);
      else setFolder(data);
    } catch {
      say(T("שגיאת תקשורת", "Connection error"), true);
    }

    setLoadingFolder(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [say]);

  const run = async (path: string, body: Record<string, unknown>) => {
    try {
      const response = await call(path, { method: "POST", body: JSON.stringify(body) });
      const data = (await response.json().catch(() => ({}))) as { error?: string };

      if (response.ok) say(T("בוצע", "Done"));
      else say(`${T("הפעולה נכשלה", "The action failed")}${data.error ? ` (${data.error.slice(0, 80)})` : ""}`, true);

      return response.ok;
    } catch {
      say(T("שגיאת תקשורת", "Connection error"), true);

      return false;
    } finally {
      void refreshAudit();
    }
  };

  // Old versions: every deploy leaves a new image of the site and a "rollback" copy. The two newest rollback copies are kept.
  const keepRollback = new Set(images.filter((image) => !image.inUse && /:rollback-/.test(image.ref)).map((image) => image.ref).sort().reverse().slice(0, 2));
  const oldImages = images.filter((image) => !image.inUse && !image.dangling && !keepRollback.has(image.ref));
  const danglingCount = images.filter((image) => image.dangling && !image.inUse).length;
  const cache = usage.find((row) => /cache/i.test(row.type));

  const smartClean = async () => {
    const list = oldImages.map((image) => `• ${image.ref} (${image.size})`).join("\n");
    const ok = await ask(
      T("ניקוי חכם של הדיסק", "Smart disk cleanup"),
      T(
        `יימחקו: כל מטמון הבנייה${cache ? ` (${cache.size})` : ""}, ${danglingCount} תמונות יתומות (גרסאות ישנות בלי שם)${oldImages.length ? `, ו-${oldImages.length} תמונות ישנות עם שם:\n${list}` : ""}.\n\nלא ייגעו: האתרים שרצים עכשיו, שני גיבויי השחזור החדשים ביותר, מסדי הנתונים והקבצים שהועלו.`,
        `Deleted: the whole build cache${cache ? ` (${cache.size})` : ""}, ${danglingCount} dangling images (old unnamed versions)${oldImages.length ? `, and ${oldImages.length} old named images:\n${list}` : ""}.\n\nNot touched: the sites running now, the two newest rollback backups, the databases and uploaded files.`,
      ),
    );

    if (!ok) return;

    say(T("מנקה… זה יכול לקחת דקה", "Cleaning… this can take a minute"));
    await run("storage/docker", { op: "buildCache" });
    await run("storage/docker", { op: "dangling" });

    for (const image of oldImages) await run("storage/docker", { op: "removeImage", ref: image.ref });

    await loadDocker();
    say(T("הניקוי הסתיים", "Cleanup finished"));
  };

  const parts = folder ? folder.path.split("/").filter(Boolean) : [];
  const max = Math.max(1, ...(folder?.items.map((item) => item.size) ?? [1]));

  return (
    <>
      <h2>
        {T("אחסון", "Storage")} <span className="sub">{folder ? `${folder.path}: ${fmtSize(folder.total)}` : ""}</span>
        <button type="button" className="button-secondary" onClick={() => { void loadDocker(); if (folder) void browse(folder.path); }}>{T("רענן", "Refresh")}</button>
      </h2>
      <div className="adm-grid">
        {usage.map((row) => (
          <div className="card adm-stat" key={row.type}>
            <div className="k">{row.type}</div>
            <div className="v">{row.size}</div>
            <div className="adm-hint">{T("ניתן לפנות", "Reclaimable")}: {row.reclaimable}</div>
          </div>
        ))}
      </div>
      <div className="card adm-explain">
        <strong>{T("לאן הולך הדיסק?", "Where does the disk go?")}</strong>
        <p>
          {T(
            "כמעט הכול הוא Docker. בכל העלאה של האתר נשמרת תמונה חדשה של האתר (בערך 1.1GB), נשמר גם עותק גיבוי לשחזור, ובכל בנייה נשאר מטמון. רוב זה גרסאות ישנות שאף אחד כבר לא משתמש בהן. המסדים, הקבצים שהועלו והאתרים עצמם קטנים בהרבה.",
            "Almost all of it is Docker. Every deploy of the site keeps a new image of it (about 1.1GB), a rollback copy, and a build cache. Most of that is old versions nobody uses any more. The databases, uploaded files and the sites themselves are far smaller.",
          )}
        </p>
        <button type="button" className="button-primary" onClick={() => void smartClean()}>{T("ניקוי חכם (מומלץ)", "Smart cleanup (recommended)")}</button>
      </div>
      <div className="adm-actions-row">
        <button type="button" className="button-secondary" onClick={async () => { if (await ask(T("לנקות את מטמון הבנייה?", "Clear the build cache?"), T("מוחק רק מטמון של בניית תמונות. האתרים לא מושפעים; בנייה הבאה תהיה איטית יותר.", "Only deletes cached image builds. The sites are not affected; the next build is slower."))) { if (await run("storage/docker", { op: "buildCache" })) void loadDocker(); } }}>
          {T("ניקוי מטמון בנייה", "Clear build cache")}
        </button>
        <button type="button" className="button-secondary" onClick={async () => { if (await ask(T("להסיר תמונות יתומות?", "Remove dangling images?"), T("תמונות בלי שם שאף קונטיינר לא משתמש בהן.", "Unnamed images no container uses."))) { if (await run("storage/docker", { op: "dangling" })) void loadDocker(); } }}>
          {T("הסרת תמונות יתומות", "Remove dangling images")}
        </button>
      </div>

      <h3 className="adm-subhead">{T("תמונות Docker לפי גודל", "Docker images by size")}</h3>
      <div className="card adm-table">
        <table>
          <thead>
            <tr>
              <th>{T("תמונה", "Image")}</th>
              <th>{T("גודל", "Size")}</th>
              <th>{T("נוצרה", "Created")}</th>
              <th>{T("מצב", "Status")}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {images.map((image) => (
              <tr key={image.id + image.ref}>
                <td className="ltr">{image.ref}</td>
                <td className="num">{image.size}</td>
                <td>{image.created}</td>
                <td>{image.inUse ? T("בשימוש", "In use") : image.dangling ? T("יתומה", "Dangling") : /rollback/.test(image.ref) ? T("גיבוי שחזור", "Rollback backup") : T("לא בשימוש", "Unused")}</td>
                <td>
                  {image.inUse ? null : (
                    <button
                      type="button"
                      className="button-danger"
                      onClick={async () => {
                        if (await ask(T(`למחוק את התמונה ${image.ref}?`, `Delete the image ${image.ref}?`), /rollback/.test(image.ref) ? T("זו תמונת שחזור: אחרי המחיקה אי אפשר לחזור לגרסה הקודמת של האתר.", "This is a rollback image: afterwards the previous version of the site cannot be restored.") : T("אם משהו עדיין צריך אותה, Docker יסרב.", "If something still needs it, Docker refuses."))) {
                          if (await run("storage/docker", { op: "removeImage", ref: image.dangling ? image.id : image.ref })) void loadDocker();
                        }
                      }}
                    >
                      {T("מחק", "Delete")}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h3 className="adm-subhead">{T("סייר קבצים", "File explorer")}</h3>
      <div className="adm-crumbs">
        {(folder ? ["/", ...parts] : ["/", "/var", "/home", "/opt", "/tmp"]).map((part, index) => {
          const path = folder ? (index === 0 ? "/" : `/${parts.slice(0, index).join("/")}`) : part;

          return <button key={`${part}-${index}`} type="button" className="button-secondary" onClick={() => void browse(path)}>{part}</button>;
        })}
      </div>
      {loadingFolder ? <p className="adm-hint">{T("סורק…", "Scanning…")}</p> : null}
      {folder ? (
        <div className="card adm-table">
          <table>
            <thead>
              <tr>
                <th>{T("שם", "Name")}</th>
                <th>{T("גודל", "Size")}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {folder.items.map((item) => (
                <tr key={item.path}>
                  <td>
                    {item.kind === "dir" ? <button type="button" className="adm-link" onClick={() => void browse(item.path)}>📁 {item.name}</button> : <span>{item.kind === "link" ? "🔗" : "📄"} {item.name}</span>}
                    <div className="adm-sizebar" style={{ width: `${Math.max(1, Math.round((item.size / max) * 100))}%` }} />
                  </td>
                  <td className="num">{fmtSize(item.size)}</td>
                  <td>
                    {item.deletable ? (
                      <button
                        type="button"
                        className="button-danger"
                        onClick={async () => {
                          if (await ask(T(`למחוק את ${item.name}?`, `Delete ${item.name}?`), `${item.path} (${fmtSize(item.size)}). ${T("המחיקה סופית ולא ניתן לשחזר.", "This is permanent and cannot be undone.")}`)) {
                            if (await run("storage/delete", { path: item.path })) void browse(folder.path);
                          }
                        }}
                      >
                        {T("מחק", "Delete")}
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </>
  );
}
