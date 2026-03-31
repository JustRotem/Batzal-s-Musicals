import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { hashEmailVerificationToken } from "@/lib/email-verification";

type VerifyEmailPageProps = {
  searchParams?: Promise<{
    token?: string;
  }>;
};

export default async function VerifyEmailPage(props: VerifyEmailPageProps) {
  const searchParams = await props.searchParams;
  const token = searchParams?.token?.trim();

  if (!token) {
    return (
      <main className="page-shell">
        <div className="orb one" />
        <div className="orb two" />

        <div className="container">
          <section className="card auth-state-card auth-help-card">
            <div className="auth-state-badge auth-state-badge-danger">קישור לא תקין</div>
            <h1 className="viewer-title">חסר קישור אימות תקין</h1>
            <p className="viewer-text">
              הקישור שנפתח לא כולל טוקן אימות תקין. אפשר לבקש מייל אימות חדש ולהמשיך משם.
            </p>

            <div className="button-row auth-actions" style={{ marginTop: 0 }}>
              <Link className="button-secondary" href="/auth/verify-required">
                שלח מייל אימות מחדש
              </Link>
              <Link className="button-primary" href="/auth/login">
                חזרה להתחברות
              </Link>
            </div>
          </section>
        </div>
      </main>
    );
  }

  const tokenHash = hashEmailVerificationToken(token);
  const now = new Date();

  const validUser = await db.user.findFirst({
    where: {
      emailVerificationTokenHash: tokenHash,
      emailVerificationExpires: {
        gt: now,
      },
    },
    select: {
      id: true,
      email: true,
      emailVerified: true,
    },
  });

  if (validUser) {
    if (!validUser.emailVerified) {
      await db.user.update({
        where: { id: validUser.id },
        data: {
          emailVerified: true,
          emailVerificationTokenHash: null,
          emailVerificationExpires: null,
          emailVerificationSentAt: null,
        },
      });
    }

    redirect(`/auth/login?success=email-verified&email=${encodeURIComponent(validUser.email)}`);
  }

  const tokenOwner = await db.user.findFirst({
    where: {
      emailVerificationTokenHash: tokenHash,
    },
    select: {
      email: true,
      emailVerified: true,
      emailVerificationExpires: true,
    },
  });

  if (tokenOwner?.emailVerified) {
    return (
      <main className="page-shell">
        <div className="orb one" />
        <div className="orb two" />

        <div className="container">
          <section className="card auth-state-card auth-help-card">
            <div className="auth-state-badge auth-state-badge-success">כבר מאומת</div>
            <h1 className="viewer-title">כתובת האימייל הזו כבר אומתה</h1>
            <p className="viewer-text">
              החשבון כבר פעיל מבחינת אימות אימייל, כך שאפשר פשוט להמשיך להתחברות.
            </p>

            <div className="button-row auth-actions" style={{ marginTop: 0 }}>
              <Link className="button-primary" href="/auth/login">
                מעבר להתחברות
              </Link>
            </div>
          </section>
        </div>
      </main>
    );
  }

  if (tokenOwner?.emailVerificationExpires && tokenOwner.emailVerificationExpires <= now) {
    return (
      <main className="page-shell">
        <div className="orb one" />
        <div className="orb two" />

        <div className="container">
          <section className="card auth-state-card auth-help-card">
            <div className="auth-state-badge auth-state-badge-danger">פג תוקף</div>
            <h1 className="viewer-title">תוקף קישור האימות פג</h1>
            <p className="viewer-text">
              הקישור שפתחת כבר לא בתוקף. אפשר לשלוח קישור חדש לאותה כתובת אימייל ולהשלים את האימות.
            </p>

            <div className="auth-readonly-card">
              <span className="auth-readonly-label">האימייל של החשבון</span>
              <strong className="auth-readonly-value" dir="ltr">
                {tokenOwner.email}
              </strong>
            </div>

            <div className="button-row auth-actions" style={{ marginTop: 0 }}>
              <Link
                className="button-secondary"
                href={`/auth/verify-required?email=${encodeURIComponent(tokenOwner.email)}`}
              >
                שלח קישור חדש
              </Link>
              <Link className="button-primary" href="/auth/login">
                חזרה להתחברות
              </Link>
            </div>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="page-shell">
      <div className="orb one" />
      <div className="orb two" />

      <div className="container">
        <section className="card auth-state-card auth-help-card">
          <div className="auth-state-badge auth-state-badge-danger">קישור לא תקין</div>
          <h1 className="viewer-title">אי אפשר לאמת עם הקישור הזה</h1>
          <p className="viewer-text">
            ייתכן שהקישור שגוי, שכבר נעשה בו שימוש, או שהוא כבר לא שייך לחשבון פעיל לאימות.
            אפשר לחזור למסך האימות ולשלוח קישור חדש.
          </p>

          <div className="button-row auth-actions" style={{ marginTop: 0 }}>
            <Link className="button-secondary" href="/auth/verify-required">
              למסך האימות
            </Link>
            <Link className="button-primary" href="/auth/login">
              חזרה להתחברות
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
