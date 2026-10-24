import AdminPanel from "@/components/AdminPanel";
import BatzalLogo from "@/components/BatzalLogo";
import GoogleAuthButton from "@/components/GoogleAuthButton";
import { getCurrentUser } from "@/lib/auth";
import type { AppLanguage } from "@/lib/i18n";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";

const text = (language: AppLanguage, he: string, en: string) => (language === "he" ? he : en);

// The control panel page: sign in first, then only people who hold the panel permission get in.
export default async function AdminGate({ language }: { language: AppLanguage }) {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <main className="adm-login">
        <div className="card adm-login-card">
          <div className="adm-login-logo"><BatzalLogo /></div>
          <h1>{text(language, "לוח בקרה", "Control panel")}</h1>
          <p>{text(language, "ניהול האתרים, השרת והמשתמשים של Batzal", "Manage Batzal's sites, server and people")}</p>
          <ul>
            <li>🖥️ {text(language, "מצב השרת והאתרים", "Server and site status")}</li>
            <li>▶️ {text(language, "הפעלה וכיבוי של שירותים", "Start and stop services")}</li>
            <li>👥 {text(language, "משתמשים והרשאות", "People and permissions")}</li>
          </ul>
          <GoogleAuthButton language={language} href="/auth/account/start" />
          <small>{text(language, "הכניסה למורשים בלבד, לפי הרשאות בחשבון Batzal", "Authorized people only, based on Batzal account permissions")}</small>
        </div>
      </main>
    );
  }

  const [view, control, people] = await Promise.all([
    hasPermission(user, PERMISSIONS.panelView),
    hasPermission(user, PERMISSIONS.panelControl),
    hasPermission(user, PERMISSIONS.panelPeople),
  ]);

  if (!view) {
    return (
      <main className="adm-login">
        <div className="card adm-login-card">
          <h1>{text(language, "אין גישה", "No access")}</h1>
          <p>{text(language, "החשבון הזה אינו מורשה ללוח הבקרה.", "This account is not allowed in the control panel.")}</p>
        </div>
      </main>
    );
  }

  const perms = [view && "panel_view", control && "panel_control", people && "panel_people"].filter(Boolean) as ("panel_view" | "panel_control" | "panel_people")[];

  return <AdminPanel language={language} perms={perms} you={user.id} />;
}
