"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

type DeleteClipModalProps = {
  action: (formData: FormData) => void | Promise<void>;
  clipId: string;
  clipTitle: string;
  currentSlug: string;
  language?: "he" | "en";
};

const DELETE_CLIP_COPY = {
  en: {
    trigger: "Delete Clip",
    title: "Delete Clip",
    text: "Delete this clip?",
    cancel: "Cancel",
    confirm: "Delete Clip",
  },
  he: {
    trigger: "מחק קליפ",
    title: "מחיקת קליפ",
    text: "האם למחוק את הקליפ הזה?",
    cancel: "ביטול",
    confirm: "מחק קליפ",
  },
} as const;

const getDeleteClipCopy = (language: "he" | "en") => {
  return DELETE_CLIP_COPY[language];
};

export default function DeleteClipModal({
  action,
  clipId,
  clipTitle,
  currentSlug,
  language = "he",
}: DeleteClipModalProps) {
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

  const copy = getDeleteClipCopy(language);

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
              onClick={() => setOpen(false)}
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
                aria-labelledby="delete-clip-title"
                onClick={(event) => event.stopPropagation()}
              >
                <div>
                  <h2
                    id="delete-clip-title"
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
                  <div
                    className="show-name"
                    dir="auto"
                    style={{ fontSize: 24 }}
                  >
                    {clipTitle}
                  </div>
                </div>

                <form action={action} style={{ display: "grid", gap: 14 }}>
                  <input type="hidden" name="clipId" value={clipId} />
                  <input type="hidden" name="currentSlug" value={currentSlug} />

                  <div className="button-row" style={{ marginTop: 0 }}>
                    <button
                      type="button"
                      className="button-secondary"
                      onClick={() => setOpen(false)}
                    >
                      {copy.cancel}
                    </button>
                    <button type="submit" className="button-danger">
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
