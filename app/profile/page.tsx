import Link from "next/link";
import { requireUser } from "@/lib/auth";
import {
  requestEditorAccessAction,
  sendPhoneVerificationCodeAction,
  updatePhoneAction,
  verifyPhoneCodeAction,
} from "@/app/profile/actions";
import {
  canRequestEditorAccess,
} from "@/lib/permissions";
import FormSubmitButton from "@/components/FormSubmitButton";
import UserAvatarUploadField from "@/components/UserAvatarUploadField";
import ChangePasswordForm from "@/components/ChangePasswordForm";
import RequestEditorAccessModal from "@/components/RequestEditorAccessModal";
import { getCurrentLanguage } from "@/lib/i18n-server";
import { getRoleLabel as getLocalizedRoleLabel, getTranslations } from "@/lib/i18n";
import { formatUserDisplayName } from "@/lib/user-display";

export const dynamic = "force-dynamic";

type AccountSection = "profile" | "security";

type ProfilePageProps = {
  searchParams?: Promise<{
    success?: string;
    error?: string;
    section?: string;
  }>;
};

function normalizeSection(value?: string): AccountSection {
  return value === "security" ? "security" : "profile";
}

function buildSectionHref(section: AccountSection, params?: { success?: string; error?: string }) {
  const search = new URLSearchParams();
  search.set("section", section);

  if (params?.success) {
    search.set("success", params.success);
  }

  if (params?.error) {
    search.set("error", params.error);
  }

  return `/profile?${search.toString()}`;
}

const SUCCESS_MESSAGES: Record<"he" | "en", Record<string, string>> = {
  he: {
    "editor-request-sent": "בקשת הגישה לעורך נשלחה לאישור אדמין.",
    "editor-request-pending": "כבר קיימת בקשת עורך ממתינה עבור החשבון הזה.",
    "phone-updated": "מספר הטלפון נשמר. עכשיו אפשר לשלוח קוד אימות.",
    "phone-cleared": "מספר הטלפון הוסר מהחשבון.",
    "phone-code-sent": "קוד אימות נשלח למסלול הפיתוח של הטלפון.",
    "phone-verified": "מספר הטלפון אומת בהצלחה.",
    "avatar-updated": "תמונת החשבון עודכנה בהצלחה.",
  },
  en: {
    "editor-request-sent": "Your editor-access request was sent for admin review.",
    "editor-request-pending": "This account already has a pending editor request.",
    "phone-updated": "Your phone number was saved. You can now send a verification code.",
    "phone-cleared": "Your phone number was removed from the account.",
    "phone-code-sent": "A verification code was sent through the current development phone flow.",
    "phone-verified": "Your phone number was verified successfully.",
    "avatar-updated": "Your profile image was updated successfully.",
  },
};

const ERROR_MESSAGES: Record<"he" | "en", Record<string, string>> = {
  he: {
    "invalid-phone": "יש להזין מספר טלפון תקין בפורמט מקומי או בינלאומי.",
    "missing-phone": "צריך לשמור מספר טלפון לפני שאפשר לשלוח קוד אימות.",
    "missing-phone-code": "צריך להזין את קוד האימות שנשלח.",
    "phone-code-missing": "אין כרגע קוד אימות פעיל. אפשר לשלוח קוד חדש.",
    "phone-code-expired": "תוקף קוד האימות פג. אפשר לשלוח קוד חדש.",
    "invalid-phone-code": "קוד האימות שהוזן אינו תקין.",
    "phone-delivery-unavailable": "שליחת קוד אימות לטלפון עדיין לא מוגדרת בסביבת הייצור הזו.",
    "invalid-image-type": "אפשר להעלות רק קבצי JPG, PNG או WEBP.",
    "image-too-large": "גודל התמונה חייב להיות עד 3MB.",
    "missing-avatar": "צריך לבחור תמונה לפני השמירה.",
  },
  en: {
    "invalid-phone": "Please enter a valid phone number in local or international format.",
    "missing-phone": "Please save a phone number before sending a verification code.",
    "missing-phone-code": "Please enter the verification code that was sent.",
    "phone-code-missing": "There is no active verification code right now. You can send a new one.",
    "phone-code-expired": "The verification code expired. You can send a new one.",
    "invalid-phone-code": "The verification code is not valid.",
    "phone-delivery-unavailable": "Phone-code delivery is not configured in this production environment yet.",
    "invalid-image-type": "Only JPG, PNG, or WEBP files can be uploaded.",
    "image-too-large": "The image size must be up to 3MB.",
    "missing-avatar": "Please choose an image before saving.",
  },
};

const getSuccessMessage = (success: string | undefined, language: "he" | "en") => {
  return success ? SUCCESS_MESSAGES[language][success] ?? null : null;
};

const getErrorMessage = (error: string | undefined, language: "he" | "en") => {
  return error ? ERROR_MESSAGES[language][error] ?? null : null;
};

const PERMISSION_STATE_COPY = {
  he: {
    admin: {
      badge: "מנהל מערכת",
      title: "יש לך גישת ניהול מלאה.",
      description: "אפשר להיכנס לאזור הניהול, לבדוק בקשות עורך, ולעדכן הרשאות משתמשים לפי הצורך.",
      tone: "admin",
    },
    editor: {
      badge: "עורך פעיל",
      title: "יש לך גישת עורך פעילה.",
      description: "אפשר להוסיף ולערוך מחזות, לנהל קליפים ולעבוד עם תוכן המערכת בלי להמתין לאישור נוסף.",
      tone: "editor",
    },
    pending: {
      badge: "בקשה ממתינה",
      title: "בקשת גישת העורך שלך ממתינה לאישור.",
      description:
        "עד שהבקשה תאושר או תידחה אפשר להמשיך להשתמש בחשבון כרגיל. אין צורך לשלוח בקשה נוספת.",
      tone: "pending",
    },
    default: {
      badge: "גישה רגילה",
      title: "החשבון שלך פעיל עם הרשאות רגילות.",
      description:
        "אפשר להשתמש באפליקציה כרגיל. אם תרצה לערוך מחזות וקליפים, אפשר לשלוח מכאן בקשת גישת עורך.",
      tone: "default",
    },
  },
  en: {
    admin: {
      badge: "Admin access",
      title: "You currently have full admin access.",
      description: "You can open the admin area, review editor requests, and update user permissions as needed.",
      tone: "admin",
    },
    editor: {
      badge: "Active editor",
      title: "You currently have active editor access.",
      description: "You can add and edit musicals, manage clips, and work with content without waiting for another approval.",
      tone: "editor",
    },
    pending: {
      badge: "Request pending",
      title: "Your editor-access request is waiting for review.",
      description:
        "You can keep using the account normally while the request is pending. There is no need to submit another request.",
      tone: "pending",
    },
    default: {
      badge: "Regular access",
      title: "Your account is active with regular access.",
      description:
        "You can use the app normally. If you want to edit musicals and clips, you can request editor access from here.",
      tone: "default",
    },
  },
} as const;

const getPermissionState = (
  user: { role: string; status: string },
  language: "he" | "en",
) => {
  const copy = PERMISSION_STATE_COPY[language];

  if (user.role === "admin" || user.role === "superadmin") {
    return copy.admin;
  }

  if (user.role === "editor") {
    return copy.editor;
  }

  if (user.role === "user" && user.status === "pending") {
    return copy.pending;
  }

  return copy.default;
};

const SECURITY_STATUS_COPY = {
  he: {
    emailVerification: {
      title: "אימות אימייל",
      verified: "כתובת האימייל אומתה והחשבון רשאי להתחבר למערכת.",
      unverified: "כתובת האימייל עדיין לא אומתה, ולכן החיבור למערכת מוגבל עד להשלמת האימות.",
    },
    phoneVerification: {
      title: "אימות טלפון",
      verified: "מספר הטלפון אומת ויכול לשמש בעתיד כמסלול שחזור בטוח.",
      unverified: "מספר הטלפון שמור, אבל עדיין לא אומת ולכן אינו זמין לשחזור חשבון.",
      missing: "עדיין לא נוסף טלפון לחשבון, ולכן אין עדיין אפשרות לשחזור עתידי דרך טלפון.",
    },
    accountRecovery: {
      title: "שחזור חשבון",
      ready: "החשבון כבר מוכן למסלול שחזור מבוסס טלפון ברגע שהתמיכה תופעל.",
      notReady: "נכון לעכשיו שחזור עתידי דרך טלפון יהיה זמין רק אחרי הוספת מספר ואימותו.",
    },
    twoFactor: {
      title: "אימות דו-שלבי",
      body:
        "עדיין לא הופעל. המבנה מוכן כדי שבהמשך יהיה אפשר להפעיל 2FA, לבחור שיטה, ולנהל אותה מתוך אותו אזור אבטחה.",
    },
  },
  en: {
    emailVerification: {
      title: "Email verification",
      verified: "Your email address is verified and the account is allowed to sign in.",
      unverified: "Your email address is not verified yet, so access remains limited until verification is completed.",
    },
    phoneVerification: {
      title: "Phone verification",
      verified: "Your phone number is verified and can later be used as a secure recovery path.",
      unverified: "Your phone number is saved, but not verified yet, so it cannot be used for account recovery.",
      missing: "No phone number has been added yet, so future phone-based recovery is not available.",
    },
    accountRecovery: {
      title: "Account recovery",
      ready: "The account is already ready for future phone-based recovery as soon as support is enabled.",
      notReady: "Future phone recovery will be available only after adding and verifying a phone number.",
    },
    twoFactor: {
      title: "Two-factor authentication",
      body:
        "This is not active yet. The structure is ready so 2FA can later be enabled, configured, and managed from the same security area.",
    },
  },
} as const;

const getSecurityStatusNotes = ({
  language,
  emailVerified,
  hasPhone,
  phoneVerified,
  canUsePhoneForRecovery,
}: {
  language: "he" | "en";
  emailVerified: boolean;
  hasPhone: boolean;
  phoneVerified: boolean;
  canUsePhoneForRecovery: boolean;
}) => {
  const copy = SECURITY_STATUS_COPY[language];
  const phoneStatus = hasPhone
    ? phoneVerified
      ? copy.phoneVerification.verified
      : copy.phoneVerification.unverified
    : copy.phoneVerification.missing;

  return [
    {
      title: copy.emailVerification.title,
      body: emailVerified ? copy.emailVerification.verified : copy.emailVerification.unverified,
    },
    {
      title: copy.phoneVerification.title,
      body: phoneStatus,
    },
    {
      title: copy.accountRecovery.title,
      body: canUsePhoneForRecovery ? copy.accountRecovery.ready : copy.accountRecovery.notReady,
    },
    {
      title: copy.twoFactor.title,
      body: copy.twoFactor.body,
    },
  ];
};

const PHONE_PANEL_COPY = {
  he: {
    badge: {
      none: "אין טלפון",
      verified: "טלפון מאומת",
      unverified: "טלפון לא מאומת",
    },
    currentState: {
      title: "מצב נוכחי",
      none: "עדיין לא נוסף מספר טלפון לחשבון.",
      verified: "הטלפון אומת ויוכל לשמש בעתיד לשחזור חשבון.",
      unverified:
        "הטלפון נשמר בחשבון אבל עדיין לא אומת, ולכן הוא עדיין לא נחשב כאמצעי שחזור פעיל.",
    },
    futureRecovery: {
      title: "שימוש עתידי בשחזור",
      ready: "החשבון כבר מוכן לשילוב עתידי של שחזור דרך טלפון, ברגע שהתמיכה תתווסף.",
      notReady: "עד שלא יושלם אימות טלפון, המערכת לא תציג את המספר כאפשרות שחזור.",
    },
    phoneInput: {
      label: "מספר טלפון",
      placeholder: "למשל 0501234567 או +972501234567",
      hint: "שינוי מספר הטלפון מאפס את מצב האימות ודורש שליחת קוד חדש.",
    },
    phoneActions: {
      add: "הוסף טלפון",
      save: "שמור טלפון",
      saving: "שומר...",
      sendCode: "שלח קוד אימות",
      sendingCode: "שולח קוד...",
      verify: "אמת טלפון",
      verifying: "מאמת...",
    },
    verification: {
      verifiedTitle: "מספר הטלפון מאומת.",
      verifiedBody:
        "המספר שמור בחשבון ויוכל להשתלב בהמשך במסלולי שחזור אמיתיים ברגע שתתווסף תמיכת ספק SMS.",
      pendingTitle: "צריך לאמת את מספר הטלפון.",
      pendingBody:
        "כרגע הקוד נשלח בצורה בטוחה ללוג השרת בסביבת הפיתוח בלבד, כדי להכין את הזרימה לספק SMS אמיתי בהמשך.",
    },
    codeInput: {
      label: "קוד אימות",
      placeholder: "הזן את הקוד שנשלח",
    },
  },
  en: {
    badge: {
      none: "No phone",
      verified: "Verified phone",
      unverified: "Unverified phone",
    },
    currentState: {
      title: "Current state",
      none: "No phone number has been added to the account yet.",
      verified: "The phone number is verified and can later be used for account recovery.",
      unverified:
        "The phone number is saved on the account, but it is not verified yet, so it is not considered an active recovery method.",
    },
    futureRecovery: {
      title: "Future recovery use",
      ready: "The account is already ready for future phone recovery as soon as support is added.",
      notReady: "Until phone verification is completed, the system will not show the number as a recovery option.",
    },
    phoneInput: {
      label: "Phone number",
      placeholder: "For example 0501234567 or +972501234567",
      hint: "Changing the phone number resets verification and requires sending a new code.",
    },
    phoneActions: {
      add: "Add phone",
      save: "Save phone",
      saving: "Saving...",
      sendCode: "Send verification code",
      sendingCode: "Sending code...",
      verify: "Verify phone",
      verifying: "Verifying...",
    },
    verification: {
      verifiedTitle: "The phone number is verified.",
      verifiedBody:
        "The number is saved on the account and can later be used in real recovery flows once SMS-provider support is added.",
      pendingTitle: "This phone number still needs verification.",
      pendingBody:
        "Right now the code is delivered safely to the server log in development only, so the flow is ready for a real SMS provider later.",
    },
    codeInput: {
      label: "Verification code",
      placeholder: "Enter the code that was sent",
    },
  },
} as const;

const getPhonePanelCopy = ({
  language,
  hasPhone,
  phoneVerified,
  canUsePhoneForRecovery,
}: {
  language: "he" | "en";
  hasPhone: boolean;
  phoneVerified: boolean;
  canUsePhoneForRecovery: boolean;
}) => {
  const copy = PHONE_PANEL_COPY[language];
  const badge = !hasPhone ? copy.badge.none : phoneVerified ? copy.badge.verified : copy.badge.unverified;
  const currentState = !hasPhone
    ? copy.currentState.none
    : phoneVerified
      ? copy.currentState.verified
      : copy.currentState.unverified;
  const futureRecovery = canUsePhoneForRecovery ? copy.futureRecovery.ready : copy.futureRecovery.notReady;

  return {
    badge,
    currentState,
    futureRecovery,
    phoneInput: copy.phoneInput,
    phoneActions: copy.phoneActions,
    verification: copy.verification,
    codeInput: copy.codeInput,
    titles: {
      currentState: copy.currentState.title,
      futureRecovery: copy.futureRecovery.title,
    },
  };
};

export default async function ProfilePage(props: ProfilePageProps) {
  const user = await requireUser();
  const language = await getCurrentLanguage();
  const t = getTranslations(language);
  const searchParams = await props.searchParams;
  const activeSection = normalizeSection(searchParams?.section);
  const successMessage = getSuccessMessage(searchParams?.success, language);
  const errorMessage = getErrorMessage(searchParams?.error, language);
  const canRequestEditor = canRequestEditorAccess(user);
  const fullName = formatUserDisplayName(user.firstName, user.lastName, user.username);
  const permissionState = getPermissionState(user, language);
  const hasPhone = Boolean(user.phone);
  const canUsePhoneForRecovery = Boolean(user.phone && user.phoneVerified);
  const emailVerified = Boolean(user.emailVerified);
  const securityStatusNotes = getSecurityStatusNotes({
    language,
    emailVerified,
    hasPhone,
    phoneVerified: user.phoneVerified,
    canUsePhoneForRecovery,
  });
  const phonePanelCopy = getPhonePanelCopy({
    language,
    hasPhone,
    phoneVerified: user.phoneVerified,
    canUsePhoneForRecovery,
  });

  return (
    <main className="page-shell">
      <div className="orb one" />
      <div className="orb two" />

      <div className="container">
        <section className="card profile-shell">
          <div className="profile-hero profile-hero-compact">
            <div className="profile-hero-copy">
              <span className="profile-kicker">{t.profile.kicker}</span>
              <h1 className="viewer-title">{t.profile.title}</h1>
              <p className="viewer-text">{t.profile.description}</p>
            </div>
          </div>

          <nav className="account-section-nav" aria-label={t.profile.navAria}>
            <Link
              href={buildSectionHref("profile")}
              className={`account-section-tab ${activeSection === "profile" ? "is-active" : ""}`}
              aria-current={activeSection === "profile" ? "page" : undefined}
              scroll={false}
            >
              {t.common.profile}
            </Link>
            <Link
              href={buildSectionHref("security")}
              className={`account-section-tab ${activeSection === "security" ? "is-active" : ""}`}
              aria-current={activeSection === "security" ? "page" : undefined}
              scroll={false}
            >
              {t.common.security}
            </Link>
          </nav>

          {successMessage ? <p className="form-message success">{successMessage}</p> : null}
          {errorMessage ? <p className="form-message error">{errorMessage}</p> : null}

          {activeSection === "profile" ? (
            <div className="profile-section-stack">
              <section className="profile-panel">
                <div className="profile-panel-heading">
                  <div>
                    <h2 className="profile-panel-title">{t.profile.accountDetails}</h2>
                    <p className="profile-access-text">{t.profile.accountDetailsText}</p>
                  </div>
                </div>

                <div className="profile-info-grid">
                  <div className="profile-info-card">
                    <span className="profile-info-label">{t.profile.fullName}</span>
                    <span className="profile-info-value">
                      {fullName || (language === "he" ? "לא הוגדר" : "Not set")}
                    </span>
                  </div>
                  <div className="profile-info-card">
                    <span className="profile-info-label">{t.profile.username}</span>
                    <span className="profile-info-value">{user.username}</span>
                  </div>
                  <div className="profile-info-card profile-info-card-email">
                    <span className="profile-info-label">{t.profile.email}</span>
                    <span className="profile-info-value" dir="ltr">
                      {user.email}
                    </span>
                  </div>
                  <div
                    id="account-access-summary"
                    className={`profile-info-card profile-info-card-access profile-info-card-access-${permissionState.tone}`}
                  >
                    <div className="profile-info-label-row">
                      <span className="profile-info-label">{t.common.account}</span>
                      <span className={`admin-badge ${user.role}`}>
                        {getLocalizedRoleLabel(
                          user.role as "user" | "editor" | "admin" | "superadmin",
                          language,
                        )}
                      </span>
                    </div>
                    <p className="profile-access-text" style={{ marginBottom: 0 }}>
                      {permissionState.description}
                    </p>
                    {canRequestEditor ? (
                      <div className="button-row" style={{ marginTop: 0 }}>
                        <RequestEditorAccessModal
                          action={requestEditorAccessAction}
                          section="profile"
                          language={language}
                        />
                      </div>
                    ) : null}
                  </div>
                </div>
              </section>

              <section className="profile-panel profile-avatar-panel">
                <div className="profile-panel-heading">
                  <div>
                    <h2 className="profile-panel-title">{t.profile.avatarTitle}</h2>
                    <p className="profile-access-text">{t.profile.avatarText}</p>
                  </div>
                </div>

                <div className="form-grid profile-avatar-form">
                  <UserAvatarUploadField
                    inputId="profile-avatar"
                    label={t.profile.avatarLabel}
                    currentAvatarUrl={user.avatarUrl}
                    currentAvatarVersion={user.avatarVersion}
                    previewName={fullName || user.username}
                    section="profile"
                    language={language}
                  />
                </div>
              </section>

            </div>
          ) : (
            <div className="profile-section-stack">
              <section className="profile-panel profile-security-panel">
                <div className="profile-phone-header">
                  <div>
                    <h2 className="profile-panel-title">{t.profile.securityTitle}</h2>
                    <p className="profile-access-text">{t.profile.securityText}</p>
                  </div>
                  <span className="profile-state-badge profile-phone-badge-verified">
                    {t.profile.securityBadge}
                  </span>
                </div>

                <div className="profile-phone-grid">
                  {securityStatusNotes.map((note) => (
                    <div key={note.title} className="profile-state-note">
                      <strong>{note.title}</strong>
                      <span>{note.body}</span>
                    </div>
                  ))}
                </div>

                <div className="profile-security-grid">
                  <section className="profile-security-card">
                    <div>
                      <h3 className="profile-panel-title" style={{ marginBottom: 8 }}>
                        {language === "he" ? "שינוי סיסמה" : "Change password"}
                      </h3>
                      <p className="profile-access-text" style={{ marginBottom: 0 }}>
                        {language === "he"
                          ? "כדי לעדכן סיסמה צריך לאשר את הסיסמה הנוכחית ולבחור סיסמה חדשה שעומדת בכללי האבטחה של המערכת."
                          : "To update the password, confirm the current password and choose a new one that meets the system security rules."}
                      </p>
                    </div>

                    <ChangePasswordForm language={language} />
                  </section>

                  <section className="profile-security-card profile-security-placeholder">
                    <div>
                      <h3 className="profile-panel-title" style={{ marginBottom: 8 }}>
                        {language === "he" ? "אימות דו-שלבי" : "Two-Factor Authentication"}
                      </h3>
                      <p className="profile-access-text" style={{ marginBottom: 0 }}>
                        {language === "he"
                          ? "בקרוב יהיה אפשר להפעיל שכבת אבטחה נוספת לחשבון, לנהל שיטות אימות, ולראות האם 2FA מופעל או כבוי."
                          : "Soon you will be able to add another protection layer to the account, manage verification methods, and see whether 2FA is enabled or off."}
                      </p>
                    </div>

                    <div className="profile-state-note">
                      <strong>{language === "he" ? "מה יהיה כאן בהמשך?" : "What will appear here later?"}</strong>
                      <span>
                        {language === "he"
                          ? "הפעלה וכיבוי של 2FA, בחירת שיטה, וקבלת תמונת מצב ברורה של הגנת החשבון."
                          : "Enable and disable 2FA, choose a method, and get a clear status view of account protection."}
                      </span>
                    </div>

                    <div className="button-row" style={{ marginTop: 0 }}>
                      <button type="button" className="button-secondary" disabled>
                        {language === "he" ? "בקרוב" : "Coming soon"}
                      </button>
                    </div>
                  </section>
                </div>
              </section>

              <section className="profile-panel profile-phone-panel">
                <div className="profile-phone-header">
                  <div>
                    <h2 className="profile-panel-title">
                      {language === "he" ? "טלפון ואימות" : "Phone and verification"}
                    </h2>
                    <p className="profile-access-text">
                      {language === "he"
                        ? "מספר הטלפון אינו חלק מיצירת החשבון. זהו שלב אבטחה משלים שאפשר להוסיף כאן אחרי אימות האימייל, ורק טלפון מאומת יוכל לשמש בעתיד לשחזור חשבון."
                        : "A phone number is not part of account creation. It is an extra security step you can add here after email verification, and only a verified phone can later be used for recovery."}
                    </p>
                  </div>
                  <span
                    className={`profile-state-badge ${
                      user.phoneVerified
                        ? "profile-phone-badge-verified"
                        : "profile-phone-badge-unverified"
                    }`}
                  >
                    {phonePanelCopy.badge}
                  </span>
                </div>

                <div className="profile-phone-grid">
                  <div className="profile-state-note">
                    <strong>{phonePanelCopy.titles.currentState}</strong>
                    <span>{phonePanelCopy.currentState}</span>
                  </div>

                  <div className="profile-state-note">
                    <strong>{phonePanelCopy.titles.futureRecovery}</strong>
                    <span>{phonePanelCopy.futureRecovery}</span>
                  </div>
                </div>

                <form action={updatePhoneAction} className="form-grid profile-phone-form">
                  <input type="hidden" name="section" value="security" />
                  <div className="field">
                    <label className="field-label" htmlFor="profile-phone">
                      {phonePanelCopy.phoneInput.label}
                    </label>
                    <input
                      id="profile-phone"
                      className="input"
                      name="phone"
                      type="tel"
                      dir="ltr"
                      defaultValue={user.phone ?? ""}
                      placeholder={phonePanelCopy.phoneInput.placeholder}
                    />
                    <p className="profile-request-hint">
                      {phonePanelCopy.phoneInput.hint}
                    </p>
                  </div>

                  <div className="button-row profile-action-row">
                    <FormSubmitButton
                      idleLabel={hasPhone ? phonePanelCopy.phoneActions.save : phonePanelCopy.phoneActions.add}
                      pendingLabel={phonePanelCopy.phoneActions.saving}
                    />
                  </div>
                </form>

                {hasPhone ? (
                  <div className="profile-phone-verification">
                    {user.phoneVerified ? (
                      <div className="profile-state-note profile-state-note-success">
                        <strong>{phonePanelCopy.verification.verifiedTitle}</strong>
                        <span>{phonePanelCopy.verification.verifiedBody}</span>
                      </div>
                    ) : (
                      <>
                        <form action={sendPhoneVerificationCodeAction} className="form-grid profile-phone-send-form">
                          <input type="hidden" name="section" value="security" />
                          <div className="profile-state-note profile-state-note-pending">
                            <strong>{phonePanelCopy.verification.pendingTitle}</strong>
                            <span>{phonePanelCopy.verification.pendingBody}</span>
                          </div>

                          <div className="button-row profile-action-row">
                            <FormSubmitButton
                              idleLabel={phonePanelCopy.phoneActions.sendCode}
                              pendingLabel={phonePanelCopy.phoneActions.sendingCode}
                            />
                          </div>
                        </form>

                        <form action={verifyPhoneCodeAction} className="form-grid profile-phone-code-form">
                          <input type="hidden" name="section" value="security" />
                          <div className="field">
                            <label className="field-label" htmlFor="phone-verification-code">
                              {phonePanelCopy.codeInput.label}
                            </label>
                            <input
                              id="phone-verification-code"
                              className="input"
                              name="verificationCode"
                              inputMode="numeric"
                              dir="ltr"
                              placeholder={phonePanelCopy.codeInput.placeholder}
                            />
                          </div>

                          <div className="button-row profile-action-row">
                            <FormSubmitButton
                              idleLabel={phonePanelCopy.phoneActions.verify}
                              pendingLabel={phonePanelCopy.phoneActions.verifying}
                            />
                          </div>
                        </form>
                      </>
                    )}
                  </div>
                ) : null}
              </section>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
