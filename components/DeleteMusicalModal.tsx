"use client";

import { useEffect, useState } from "react";
import ModalCloseButton from "@/components/ModalCloseButton";
import { createPortal } from "react-dom";

// Typing the name must not fail on invisible direction marks, extra spaces or letter case.
function normalizeTitle(value: string) {
  return value
    .normalize("NFC")
    .replace(/[‎‏‪-‮⁦-⁩﻿]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase();
}

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
  const copy =
    language === "en"
      ? {
          trigger: "Delete Item",
          title: "Delete Item",
          text: "This will also delete all of the item's clips.",
          target: "Item to Delete",
          confirmLabel: "To delete it, type the item title",
          confirm: "Delete Item",
        }
      : {
          trigger: "מחק פריט",
          title: "מחיקת פריט",
          text: "הפעולה תמחק גם את כל הקטעים של הפריט.",
          target: "הפריט שיימחק",
          confirmLabel: "כדי למחוק, הקלד את שם הפריט",
          confirm: "מחק פריט",
        };

  const canDelete = normalizeTitle(confirmationValue) === normalizeTitle(musicalTitle) && normalizeTitle(musicalTitle) !== "";

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
        setConfirmationValue("");
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
                <ModalCloseButton
                  label={language === "en" ? "Close" : "סגור"}
                  onClick={() => {
                    setOpen(false);
                    setConfirmationValue("");
                  }}
                />
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
                    <div className="show-name" dir="auto" style={{ fontSize: 24 }}>
                      {musicalTitle}
                    </div>
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
