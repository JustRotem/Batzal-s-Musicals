"use client";

import { useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";

type AdminActionButtonProps = {
  idleLabel: string;
  pendingLabel: string;
  className: string;
  confirmTitle?: string;
  confirmMessage?: string;
  confirmLabel?: string;
};

export default function AdminActionButton({
  idleLabel,
  pendingLabel,
  className,
  confirmTitle,
  confirmMessage,
  confirmLabel,
}: AdminActionButtonProps) {
  const { pending } = useFormStatus();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!confirmOpen) {
      return;
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setConfirmOpen(false);
      }
    }

    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("keydown", handleEscape);
    };
  }, [confirmOpen]);

  useEffect(() => {
    if (pending) {
      setConfirmOpen(false);
    }
  }, [pending]);

  const requiresConfirm = Boolean(confirmTitle && confirmMessage);

  return (
    <>
      <button
        ref={buttonRef}
        className={className}
        type={requiresConfirm ? "button" : "submit"}
        disabled={pending}
        aria-disabled={pending}
        aria-busy={pending}
        onClick={() => {
          if (requiresConfirm) {
            setConfirmOpen(true);
          }
        }}
      >
        {pending ? pendingLabel : idleLabel}
      </button>

      {confirmOpen ? (
        <div className="confirm-modal-overlay" onClick={() => setConfirmOpen(false)}>
          <div
            className="card confirm-modal-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-confirm-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="confirm-modal-copy">
              <h2 id="admin-confirm-title" className="panel-title">
                {confirmTitle}
              </h2>
              <p className="viewer-text">{confirmMessage}</p>
            </div>

            <div className="button-row confirm-modal-actions">
              <button
                type="button"
                className="button-secondary"
                onClick={() => setConfirmOpen(false)}
              >
                ביטול
              </button>
              <button
                type="button"
                className={className}
                onClick={() => {
                  buttonRef.current?.form?.requestSubmit();
                }}
              >
                {confirmLabel ?? idleLabel}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
