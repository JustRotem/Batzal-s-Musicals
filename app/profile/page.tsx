import { requireUser } from "@/lib/auth";
import {
  requestEditorAccessAction,
  updateUsernameAction,
} from "@/app/profile/actions";
import { setPreferredLanguageAction } from "@/app/actions";
import { canRequestEditorAccess } from "@/lib/permissions";
import FormSubmitButton from "@/components/FormSubmitButton";
import UserAvatarUploadField from "@/components/UserAvatarUploadField";
import RequestEditorAccessModal from "@/components/RequestEditorAccessModal";
import { getCurrentLanguage } from "@/lib/i18n-server";
import {
  getLanguageLabel,
  getRoleLabel as getLocalizedRoleLabel,
  getTranslations,
} from "@/lib/i18n";

export const dynamic = "force-dynamic";

type ProfilePageProps = {
  searchParams?: Promise<{
    success?: string;
    error?: string;
  }>;
};

const SUCCESS_MESSAGES: Record<"he" | "en", Record<string, string>> = {
  he: {
    "editor-request-sent": "בקשת הגישה לעורך נשלחה לאישור אדמין.",
    "editor-request-pending": "כבר קיימת בקשת עורך ממתינה עבור החשבון הזה.",
    "avatar-updated": "תמונת החשבון עודכנה בהצלחה.",
    "username-updated": "שם המשתמש עודכן.",
  },
  en: {
    "editor-request-sent": "Your editor-access request was sent for admin review.",
    "editor-request-pending": "This account already has a pending editor request.",
    "avatar-updated": "Your profile image was updated successfully.",
    "username-updated": "Your username was updated.",
  },
};

const ERROR_MESSAGES: Record<"he" | "en", Record<string, string>> = {
  he: {
    "username-too-short": "שם המשתמש צריך להכיל לפחות 3 תווים.",
    "username-too-long": "שם המשתמש יכול להכיל עד 30 תווים.",
    "username-invalid": "שם המשתמש יכול להכיל אותיות, ספרות, קו תחתון ורווחים בלבד.",
    "username-exists": "שם המשתמש הזה כבר תפוס. אפשר לנסות שם אחר.",
    "invalid-image-type": "אפשר להעלות רק קבצי JPG, PNG או WEBP.",
    "image-too-large": "גודל התמונה חייב להיות עד 3MB.",
    "missing-avatar": "צריך לבחור תמונה לפני השמירה.",
  },
  en: {
    "username-too-short": "The username must be at least 3 characters.",
    "username-too-long": "The username can be up to 30 characters.",
    "username-invalid": "The username can contain letters, digits, underscores and spaces only.",
    "username-exists": "That username is already taken. Try another one.",
    "invalid-image-type": "Only JPG, PNG, or WEBP files can be uploaded.",
    "image-too-large": "The image size must be up to 3MB.",
    "missing-avatar": "Please choose an image before saving.",
  },
};

const COPY = {
  he: {
    kicker: "החשבון שלי",
    title: "החשבון שלי",
    description: "אותו חשבון בכל האתרים של Batzal. כאן משנים שם משתמש, תמונה ושפה.",
    details: "פרטי החשבון",
    username: "שם משתמש",
    save: "שמור",
    saving: "שומר...",
    email: "אימייל",
    emailHint: "האימייל מגיע מחשבון Google ולא ניתן לשינוי.",
    language: "שפה",
    avatarTitle: "תמונת פרופיל",
    avatarText: "התמונה מוצגת בכל האתרים.",
    avatarLabel: "בחירת תמונה",
    accessTitle: "הגישה שלי",
    accessText: "הגישה לכל אתר מוצגת בנפרד.",
    musicals: "מחזות זמר",
    staff: "הרשאות ניהול",
    requestHint: "אם תרצה לערוך מחזות וקליפים, אפשר לבקש גישת עורך.",
    roleEditor: "אפשר להוסיף ולערוך מחזות, ולנהל קליפים.",
    roleAdmin: "גישת ניהול מלאה: משתמשים, הרשאות ותוכן.",
    roleUser: "צפייה במחזות ותגובה לקליפים.",
  },
  en: {
    kicker: "My account",
    title: "My account",
    description: "The same account on every Batzal site. Change your username, picture and language here.",
    details: "Account details",
    username: "Username",
    save: "Save",
    saving: "Saving...",
    email: "Email",
    emailHint: "The email comes from your Google account and cannot be changed.",
    language: "Language",
    avatarTitle: "Profile picture",
    avatarText: "Your picture is shown on every site.",
    avatarLabel: "Choose a picture",
    accessTitle: "My access",
    accessText: "Access is shown separately for each site.",
    musicals: "Musicals",
    staff: "Admin permissions",
    requestHint: "If you want to edit musicals and clips, you can request editor access.",
    roleEditor: "You can add and edit musicals and manage clips.",
    roleAdmin: "Full admin access: users, permissions and content.",
    roleUser: "You can browse musicals and comment on clips.",
  },
} as const;

export default async function ProfilePage(props: ProfilePageProps) {
  const user = await requireUser();
  const language = await getCurrentLanguage();
  const t = getTranslations(language);
  const copy = COPY[language];
  const searchParams = await props.searchParams;
  const successMessage = searchParams?.success
    ? SUCCESS_MESSAGES[language][searchParams.success] ?? null
    : null;
  const errorMessage = searchParams?.error ? ERROR_MESSAGES[language][searchParams.error] ?? null : null;
  const canRequestEditor = canRequestEditorAccess(user);
  const isAdmin = user.role === "admin" || user.role === "superadmin";
  const accessDescription = isAdmin ? copy.roleAdmin : user.role === "editor" ? copy.roleEditor : copy.roleUser;

  return (
    <main className="page-shell">
      <div className="orb one" />
      <div className="orb two" />

      <div className="container">
        <section className="card profile-shell">
          <div className="profile-hero profile-hero-compact">
            <div className="profile-hero-copy">
              <span className="profile-kicker">{copy.kicker}</span>
              <h1 className="viewer-title">{copy.title}</h1>
              <p className="viewer-text">{copy.description}</p>
            </div>
          </div>

          {successMessage ? <p className="form-message success">{successMessage}</p> : null}
          {errorMessage ? <p className="form-message error">{errorMessage}</p> : null}

          <div className="profile-section-stack">
            <section className="profile-panel">
              <div className="profile-panel-heading">
                <div>
                  <h2 className="profile-panel-title">{copy.details}</h2>
                </div>
              </div>

              <div className="profile-info-grid">
                <div className="profile-info-card">
                  <form action={updateUsernameAction} className="profile-username-form">
                    <label className="profile-info-label" htmlFor="profile-username">
                      {copy.username}
                    </label>
                    <div className="profile-username-row">
                      <input
                        id="profile-username"
                        className="input"
                        name="username"
                        defaultValue={user.username}
                        minLength={3}
                        maxLength={30}
                        autoComplete="nickname"
                        required
                      />
                      <FormSubmitButton idleLabel={copy.save} pendingLabel={copy.saving} />
                    </div>
                  </form>
                </div>

                <div className="profile-info-card profile-info-card-email">
                  <span className="profile-info-label">{copy.email}</span>
                  <span className="profile-info-value" dir="ltr">
                    {user.email}
                  </span>
                  <p className="profile-access-text" style={{ marginBottom: 0 }}>
                    {copy.emailHint}
                  </p>
                </div>

                <div className="profile-info-card">
                  <span className="profile-info-label">{copy.language}</span>
                  <div className="profile-dropdown-language-actions">
                    {(["he", "en"] as const).map((option) => (
                      <form key={option} action={setPreferredLanguageAction}>
                        <input type="hidden" name="language" value={option} />
                        <input type="hidden" name="redirectTo" value="/profile" />
                        <button
                          type="submit"
                          className={`profile-language-chip ${option === language ? "is-active" : ""}`}
                        >
                          {getLanguageLabel(option)}
                        </button>
                      </form>
                    ))}
                  </div>
                </div>
              </div>
            </section>

            <section className="profile-panel profile-avatar-panel">
              <div className="profile-panel-heading">
                <div>
                  <h2 className="profile-panel-title">{copy.avatarTitle}</h2>
                  <p className="profile-access-text">{copy.avatarText}</p>
                </div>
              </div>

              <div className="form-grid profile-avatar-form">
                <UserAvatarUploadField
                  inputId="profile-avatar"
                  label={copy.avatarLabel}
                  currentAvatarUrl={user.avatarUrl}
                  currentAvatarVersion={user.avatarVersion}
                  previewName={user.username}
                  section="profile"
                  language={language}
                />
              </div>
            </section>

            <section className="profile-panel">
              <div className="profile-panel-heading">
                <div>
                  <h2 className="profile-panel-title">{copy.accessTitle}</h2>
                  <p className="profile-access-text">{copy.accessText}</p>
                </div>
              </div>

              <div className="profile-info-grid">
                <div id="account-access-summary" className="profile-info-card profile-info-card-access">
                  <div className="profile-info-label-row">
                    <span className="profile-info-label">{copy.musicals}</span>
                    <span className={`admin-badge ${user.role}`}>
                      {getLocalizedRoleLabel(
                        user.role as "user" | "editor" | "admin" | "superadmin",
                        language,
                      )}
                    </span>
                  </div>
                  <p className="profile-access-text" style={{ marginBottom: 0 }}>
                    {accessDescription}
                  </p>
                  {canRequestEditor ? (
                    <>
                      <p className="profile-access-text" style={{ marginBottom: 0 }}>
                        {copy.requestHint}
                      </p>
                      <div className="button-row" style={{ marginTop: 0 }}>
                        <RequestEditorAccessModal
                          action={requestEditorAccessAction}
                          section="profile"
                          language={language}
                        />
                      </div>
                    </>
                  ) : null}
                </div>
              </div>
            </section>
          </div>
        </section>
      </div>
    </main>
  );
}
