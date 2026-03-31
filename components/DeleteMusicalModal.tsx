"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

type DeleteMusicalModalProps = {
  action: (formData: FormData) => void | Promise<void>;
  musicalId: string;
  musicalTitle: string;
  language?: "he" | "en";
};

export default function DeleteMusicalModal({
  action,
  musicalId,
  musicalTitle,
  language = "he",
}: DeleteMusicalModalProps) {
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [confirmationValue, setConfirmationValue] = useState("");
  const [copied, setCopied] = useState(false);
  const copyTimeoutRef = useRef<number | null>(null);
  const copy =
    language === "en"
      ? {
          trigger: "Delete Musical",
          title: "Delete Musical",
          text: "This will also delete all of the musical's clips.",
          target: "Musical to Delete",
          confirmLabel: "To delete it, type the musical title",
          cancel: "Cancel",
          confirm: "Delete Musical",
        }
      : {
          trigger: "מחק מחזה",
          title: "מחיקת מחזה",
          text: "הפעולה תמחק גם את כל הקטעים של המחזה.",
          target: "המחזה שיימחק",
          confirmLabel: "כדי למחוק, הקלד את שם המחזה",
          cancel: "ביטול",
          confirm: "מחק מחזה",
        };

  const canDelete = confirmationValue === musicalTitle;

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) {
      if (copyTimeoutRef.current) {
        window.clearTimeout(copyTimeoutRef.current);
        copyTimeoutRef.current = null;
      }
      setCopied(false);
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        setConfirmationValue("");
      }
    }

    document.addEventListener("keydown", handleEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) {
        window.clearTimeout(copyTimeoutRef.current);
      }
    };
  }, []);

  async function handleCopyTitle() {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(musicalTitle);
      } else {
        const input = document.createElement("textarea");
        input.value = musicalTitle;
        input.setAttribute("readonly", "true");
        input.style.position = "fixed";
        input.style.top = "-1000px";
        input.style.opacity = "0";
        document.body.appendChild(input);
        input.select();
        document.execCommand("copy");
        document.body.removeChild(input);
      }

      setCopied(true);
      if (copyTimeoutRef.current) {
        window.clearTimeout(copyTimeoutRef.current);
      }
      copyTimeoutRef.current = window.setTimeout(() => {
        setCopied(false);
        copyTimeoutRef.current = null;
      }, 1600);
    } catch {
      setCopied(false);
    }
  }

  return (
    <>
      <button
        type="button"
        className="button-danger"
        onClick={() => setOpen(true)}
      >
        {copy.trigger}
      </button>

      {mounted && open
        ? createPortal(
            <div
              style={{
                position: "fixed",
                inset: 0,
                background: "rgba(2, 6, 23, 0.72)",
                backdropFilter: "blur(8px)",
                WebkitBackdropFilter: "blur(8px)",
                display: "grid",
                placeItems: "center",
                padding: 24,
                overflowY: "auto",
                isolation: "isolate",
                zIndex: 9999,
              }}
              onClick={() => {
                setOpen(false);
                setConfirmationValue("");
              }}
            >
              <div
                className="card"
                style={{
                  width: "min(100%, 560px)",
                  padding: 24,
                  display: "grid",
                  gap: 14,
                  position: "relative",
                  zIndex: 10000,
                }}
                role="dialog"
                aria-modal="true"
                aria-labelledby="delete-musical-title"
                onClick={(event) => event.stopPropagation()}
              >
                <div>
                  <h2
                    id="delete-musical-title"
                    className="panel-title"
                    style={{ marginBottom: 10 }}
                  >
                    {copy.title}
                  </h2>
                  <p className="show-meta" style={{ marginTop: 0 }}>
                    {copy.text}
                  </p>
                </div>

                <div
                  style={{
                    padding: 16,
                    borderRadius: 18,
                    background: "rgba(255, 255, 255, 0.04)",
                    border: "1px solid rgba(255, 255, 255, 0.08)",
                  }}
                >
                  <div className="field-label" style={{ paddingInline: 0 }}>
                    {copy.target}
                  </div>
                  <div className="delete-musical-title-row">
                    <div
                      className="show-name"
                      dir="auto"
                      style={{ fontSize: 24 }}
                    >
                      {musicalTitle}
                    </div>
                    <button
                      type="button"
                      className={`copy-title-button ${copied ? "is-copied" : ""}`}
                      onClick={handleCopyTitle}
                      aria-label={language === "en" ? "Copy musical title" : "העתק שם מחזה"}
                      title={language === "en" ? "Copy musical title" : "העתק שם מחזה"}
                    >
                      {copied ? (
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                          <path
                            d="M20.25 6.75 9.75 17.25 4 11.5"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      ) : (
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                          <rect
                            x="9"
                            y="9"
                            width="10"
                            height="10"
                            rx="2"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.8"
                          />
                          <rect
                            x="5"
                            y="5"
                            width="10"
                            height="10"
                            rx="2"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.8"
                            opacity="0.6"
                          />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>

                <form action={action} style={{ display: "grid", gap: 14 }}>
                  <input type="hidden" name="musicalId" value={musicalId} />

                  <div className="field">
                    <label className="field-label" htmlFor="delete-musical-confirmation">
                      {copy.confirmLabel}
                    </label>
                    <input
                      id="delete-musical-confirmation"
                      className="input"
                      value={confirmationValue}
                      onChange={(event) => setConfirmationValue(event.currentTarget.value)}
                      dir="auto"
                      autoComplete="off"
                    />
                  </div>

                  <div className="button-row" style={{ marginTop: 0 }}>
                    <button
                      type="button"
                      className="button-secondary"
                      onClick={() => {
                        setOpen(false);
                        setConfirmationValue("");
                      }}
                    >
                      {copy.cancel}
                    </button>
                    <button
                      type="submit"
                      className="button-danger"
                      disabled={!canDelete}
                    >
                      {copy.confirm}
                    </button>
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
