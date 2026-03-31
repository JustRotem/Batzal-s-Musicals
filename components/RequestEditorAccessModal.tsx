"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import AuthSubmitButton from "@/components/AuthSubmitButton";
import { getTranslations, type AppLanguage } from "@/lib/i18n";

type RequestEditorAccessModalProps = {
  action: (formData: FormData) => void | Promise<void>;
  section?: "profile" | "permissions" | "security";
  language?: AppLanguage;
};

export default function RequestEditorAccessModal({
  action,
  section = "profile",
  language = "he",
}: RequestEditorAccessModalProps) {
  const t = getTranslations(language);
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("keydown", handleEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        className="button-primary"
        onClick={() => setOpen(true)}
      >
        {t.profile.editorRequestButton}
      </button>

      {mounted && open
        ? createPortal(
            <div className="crop-modal-overlay" onClick={() => setOpen(false)}>
              <div
                className="card crop-modal-card profile-request-modal"
                role="dialog"
                aria-modal="true"
                aria-labelledby="editor-request-title"
                onClick={(event) => event.stopPropagation()}
              >
                <div className="crop-modal-header">
                  <div>
                    <h2 id="editor-request-title" className="panel-title">
                      {t.editorRequest.title}
                    </h2>
                    <p className="show-meta" style={{ marginTop: 0 }}>
                      {t.editorRequest.description}
                    </p>
                  </div>
                </div>

                <form action={action} className="form-grid profile-request-form" style={{ marginTop: 0 }}>
                  <input type="hidden" name="section" value={section} />
                  <div className="field">
                    <label className="field-label" htmlFor="editor-request-message">
                      {t.editorRequest.label}
                    </label>
                    <textarea
                      id="editor-request-message"
                      className="textarea"
                      name="requestMessage"
                      placeholder={t.editorRequest.placeholder}
                    />
                    <p className="profile-request-hint">
                      {t.editorRequest.hint}
                    </p>
                  </div>

                  <div className="button-row profile-action-row" style={{ marginTop: 0 }}>
                    <button
                      type="button"
                      className="button-secondary"
                      onClick={() => setOpen(false)}
                    >
                      {t.common.cancel}
                    </button>
                    <AuthSubmitButton
                      idleLabel={t.editorRequest.submit}
                      pendingLabel={t.editorRequest.pending}
                    />
                  </div>
                </form>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
