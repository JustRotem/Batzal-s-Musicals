import { getAccountEmailConfig } from "@/lib/account-email";

type AccountEmailTemplateInput = {
  preheader?: string;
  eyebrow?: string;
  title: string;
  intro: string;
  details?: string[];
  ctaLabel: string;
  ctaUrl: string;
  ctaHint?: string;
  fallbackLabel?: string;
  noteTitle?: string;
  noteText?: string;
  footerText: string;
  closingTitle?: string;
  closingText?: string;
};

type AccountEmailTemplateResult = {
  subjectReadyHtml: string;
  subjectReadyText: string;
};

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function renderParagraphs(values: string[] | undefined, styles: string) {
  if (!values?.length) {
    return "";
  }

  return values
    .map(
      (value) => `
        <tr>
          <td style="${styles}">
            ${escapeHtml(value)}
          </td>
        </tr>
      `,
    )
    .join("");
}

export function renderAccountEmailTemplate(
  input: AccountEmailTemplateInput,
): AccountEmailTemplateResult {
  const { fromName } = getAccountEmailConfig();
  const fallbackLabel =
    input.fallbackLabel ?? "אם הכפתור לא נפתח, אפשר להעתיק את הקישור הבא:";
  const eyebrow = input.eyebrow ?? "Transactional Email";
  const preheader = input.preheader ?? input.intro;

  const subjectReadyHtml = `
    <!DOCTYPE html>
    <html lang="he" dir="rtl">
      <body style="margin:0; padding:0; background-color:#eef2ff;">
        <div style="display:none; max-height:0; overflow:hidden; opacity:0; color:transparent;">
          ${escapeHtml(preheader)}
        </div>

        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse; background:linear-gradient(180deg,#0f172a 0%,#111827 100%);">
          <tr>
            <td align="center" style="padding:32px 14px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse; max-width:640px;">
                <tr>
                  <td style="padding:0 0 18px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
                      <tr>
                        <td align="right" style="padding:0;">
                          <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
                            <tr>
                              <td style="width:52px; height:52px; border-radius:18px; background:#38bdf8; background-image:linear-gradient(135deg,#38bdf8 0%,#8b5cf6 100%); color:#ffffff; text-align:center; font-size:22px; font-weight:800; font-family:Arial,'Helvetica Neue',Helvetica,sans-serif;">
                                BM
                              </td>
                              <td style="padding-right:12px; font-family:Arial,'Helvetica Neue',Helvetica,sans-serif;">
                                <div style="font-size:11px; line-height:1.5; letter-spacing:0.12em; text-transform:uppercase; color:#93c5fd; font-weight:700;">
                                  ${escapeHtml(eyebrow)}
                                </div>
                                <div style="font-size:24px; line-height:1.3; color:#f8fafc; font-weight:800;">
                                  ${escapeHtml(fromName)}
                                </div>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <tr>
                  <td>
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse; background-color:#ffffff; border-radius:28px; overflow:hidden;">
                      <tr>
                        <td style="padding:34px 30px 30px; font-family:Arial,'Helvetica Neue',Helvetica,sans-serif; color:#0f172a;">
                          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
                            <tr>
                              <td style="font-size:32px; line-height:1.2; font-weight:800; color:#0f172a; padding:0 0 14px;">
                                ${escapeHtml(input.title)}
                              </td>
                            </tr>

                            <tr>
                              <td style="font-size:16px; line-height:1.9; color:#334155; padding:0 0 18px;">
                                ${escapeHtml(input.intro)}
                              </td>
                            </tr>

                            ${renderParagraphs(
                              input.details,
                              "font-size:15px; line-height:1.9; color:#475569; padding:0 0 12px;",
                            )}

                            <tr>
                              <td style="padding:10px 0 8px;">
                                <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
                                  <tr>
                                    <td align="center" bgcolor="#2563eb" style="border-radius:999px; background:#2563eb; background-image:linear-gradient(135deg,#2563eb 0%,#7c3aed 100%);">
                                      <a href="${input.ctaUrl}" style="display:inline-block; padding:14px 24px; font-size:16px; line-height:1.2; font-weight:800; color:#ffffff; text-decoration:none; font-family:Arial,'Helvetica Neue',Helvetica,sans-serif;">
                                        ${escapeHtml(input.ctaLabel)}
                                      </a>
                                    </td>
                                  </tr>
                                </table>
                              </td>
                            </tr>

                            ${
                              input.ctaHint
                                ? `
                              <tr>
                                <td style="font-size:13px; line-height:1.8; color:#64748b; padding:8px 0 0;">
                                  ${escapeHtml(input.ctaHint)}
                                </td>
                              </tr>
                            `
                                : ""
                            }

                            <tr>
                              <td style="padding:20px 0 0;">
                                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse; background:#f8fafc; border:1px solid #e2e8f0; border-radius:18px;">
                                  <tr>
                                    <td style="padding:16px 18px;">
                                      <div style="font-size:13px; line-height:1.8; color:#475569; font-weight:700; margin:0 0 8px; font-family:Arial,'Helvetica Neue',Helvetica,sans-serif;">
                                        ${escapeHtml(fallbackLabel)}
                                      </div>
                                      <div dir="ltr" style="font-size:13px; line-height:1.8; color:#0f172a; word-break:break-all; font-family:Arial,'Helvetica Neue',Helvetica,sans-serif;">
                                        ${escapeHtml(input.ctaUrl)}
                                      </div>
                                    </td>
                                  </tr>
                                </table>
                              </td>
                            </tr>

                            ${
                              input.noteTitle && input.noteText
                                ? `
                              <tr>
                                <td style="padding:18px 0 0;">
                                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse; background:#eff6ff; border:1px solid #bfdbfe; border-radius:18px;">
                                    <tr>
                                      <td style="padding:16px 18px;">
                                        <div style="font-size:13px; line-height:1.7; color:#1d4ed8; font-weight:800; margin:0 0 6px; font-family:Arial,'Helvetica Neue',Helvetica,sans-serif;">
                                          ${escapeHtml(input.noteTitle)}
                                        </div>
                                        <div style="font-size:14px; line-height:1.9; color:#1e3a8a; font-family:Arial,'Helvetica Neue',Helvetica,sans-serif;">
                                          ${escapeHtml(input.noteText)}
                                        </div>
                                      </td>
                                    </tr>
                                  </table>
                                </td>
                              </tr>
                            `
                                : ""
                            }

                            ${
                              input.closingTitle || input.closingText
                                ? `
                              <tr>
                                <td style="padding:18px 0 0;">
                                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
                                    ${
                                      input.closingTitle
                                        ? `
                                      <tr>
                                        <td style="font-size:15px; line-height:1.8; color:#0f172a; font-weight:800; padding:0 0 4px; font-family:Arial,'Helvetica Neue',Helvetica,sans-serif;">
                                          ${escapeHtml(input.closingTitle)}
                                        </td>
                                      </tr>
                                    `
                                        : ""
                                    }
                                    ${
                                      input.closingText
                                        ? `
                                      <tr>
                                        <td style="font-size:14px; line-height:1.9; color:#475569; font-family:Arial,'Helvetica Neue',Helvetica,sans-serif;">
                                          ${escapeHtml(input.closingText)}
                                        </td>
                                      </tr>
                                    `
                                        : ""
                                    }
                                  </table>
                                </td>
                              </tr>
                            `
                                : ""
                            }
                          </table>
                        </td>
                      </tr>

                      <tr>
                        <td style="padding:18px 30px 24px; border-top:1px solid #e2e8f0; background:#f8fafc; font-family:Arial,'Helvetica Neue',Helvetica,sans-serif;">
                          <div style="font-size:13px; line-height:1.9; color:#64748b;">
                            ${escapeHtml(input.footerText)}
                          </div>
                          <div style="font-size:12px; line-height:1.8; color:#94a3b8; margin-top:8px;">
                            Batzal&apos;s Musicals
                          </div>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>
  `.trim();

  const subjectReadyText = [
    fromName,
    input.title,
    "",
    input.intro,
    ...(input.details?.length ? ["", ...input.details] : []),
    "",
    `${input.ctaLabel}:`,
    input.ctaUrl,
    input.ctaHint ? `\n${input.ctaHint}` : null,
    "",
    `${fallbackLabel}`,
    input.ctaUrl,
    input.noteTitle && input.noteText ? `\n${input.noteTitle}: ${input.noteText}` : null,
    input.closingTitle ? `\n${input.closingTitle}` : null,
    input.closingText ?? null,
    "",
    input.footerText,
    "Batzal's Musicals",
  ]
    .filter(Boolean)
    .join("\n");

  return {
    subjectReadyHtml,
    subjectReadyText,
  };
}
