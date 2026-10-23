"use client";

import { useState, useTransition } from "react";
import { createPortal } from "react-dom";
import ModalCloseButton from "@/components/ModalCloseButton";
import { submitEditorRequestAction } from "@/app/profile/actions";
import { getTranslations, type AppLanguage } from "@/lib/i18n";

// A floating window, opened from the header menu. Closes with the X, a click outside, or Escape.
export default function RequestEditorAccessModal({
  language = "he",
  onClose,
  onSent,
}: {
  language?: AppLanguage;
  onClose: () => void;
  onSent: () => void;
}) {
  const t = getTranslations(language);
  const [message, setMessage] = useState("");
  const [result, setResult] = useState<"sent" | "pending" | "unavailable" | null>(null);
  const [isSending, startSending] = useTransition();

  if (typeof document === "undefined") {
    return null;
  }

  function submit() {
    startSending(async () => {
      const response = await submitEditorRequestAction(message);

      setResult(response.status);

      if (response.status !== "unavailable") {
        onSent();
      }
    });
  }

  const done = result === "sent" || result === "pending";

  return createPortal(
    <div className="confirm-modal-overlay" onClick={onClose}>
      <div
        className="card confirm-modal-card report-modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="editor-request-title"
        onClick={(event) => event.stopPropagation()}
      >
        <ModalCloseButton label={language === "he" ? "סגור" : "Close"} onClick={onClose} disabled={isSending} />
        <div className="confirm-modal-copy">
          <h2 id="editor-request-title" className="panel-title">
            {t.editorRequest.title}
          </h2>
          <p className="viewer-text">
            {done
              ? language === "he"
                ? "הבקשה נשלחה. נעדכן אותך בהתראה כשיהיה מענה."
                : "Your request was sent. You will get a notification when it is answered."
              : t.editorRequest.description}
          </p>
        </div>

        {done ? null : (
          <>
            <div className="field">
              <label className="field-label" htmlFor="editor-request-message">
                {t.editorRequest.label}
              </label>
              <textarea
                id="editor-request-message"
                className="textarea"
                value={message}
                maxLength={1000}
                onChange={(event) => setMessage(event.currentTarget.value)}
                placeholder={t.editorRequest.placeholder}
                disabled={isSending}
              />
              <p className="profile-request-hint">{t.editorRequest.hint}</p>
            </div>

            {result === "unavailable" ? (
              <p className="form-message error" role="alert">
                {language === "he" ? "אי אפשר לשלוח בקשה כרגע." : "A request cannot be sent right now."}
              </p>
            ) : null}

            <div className="button-row confirm-modal-actions">
              <button type="button" className="button-primary" disabled={isSending} onClick={submit}>
                {isSending ? t.editorRequest.pending : t.editorRequest.submit}
              </button>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}
