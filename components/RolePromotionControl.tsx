"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useFormStatus } from "react-dom";

type PromotionOption = {
  value: "user" | "editor" | "admin" | "superadmin";
  label: string;
  description: string;
};

type RolePromotionControlProps = {
  action: (formData: FormData) => void | Promise<void>;
  userId: string;
  options: PromotionOption[];
  triggerLabel?: string;
  dialogTitle?: string;
  dialogDescription?: string;
  cancelLabel?: string;
  pendingDescriptionLabel?: string;
};

function RolePromotionSubmitButton({
  option,
  pendingDescriptionLabel,
}: {
  option: PromotionOption;
  pendingDescriptionLabel: string;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      name="targetRole"
      value={option.value}
      className="role-option-button"
      disabled={pending}
    >
      <strong>{option.label}</strong>
      <span>{pending ? pendingDescriptionLabel : option.description}</span>
    </button>
  );
}

export default function RolePromotionControl({
  action,
  userId,
  options,
  triggerLabel = "קדם",
  dialogTitle = "בחר דרגה",
  dialogDescription = "בחר לאיזו דרגה לקדם את המשתמש. השינוי יתעדכן מיד בכרטיס וברשימת החשבונות.",
  cancelLabel = "ביטול",
  pendingDescriptionLabel = "מעדכן...",
}: RolePromotionControlProps) {
  const [open, setOpen] = useState(false);
  const availableOptions = useMemo(() => options, [options]);

  useEffect(() => {
    if (!open) {
      return;
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [open]);

  if (availableOptions.length === 0) {
    return null;
  }

  return (
    <>
      <button
        type="button"
        className="button-secondary button-small"
        onClick={() => setOpen(true)}
      >
        {triggerLabel}
      </button>

      {open ? (
        <div className="confirm-modal-overlay" onClick={() => setOpen(false)}>
          <div
            className="card confirm-modal-card role-picker-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="role-picker-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="confirm-modal-copy">
              <h2 id="role-picker-title" className="panel-title">
                {dialogTitle}
              </h2>
              <p className="viewer-text">{dialogDescription}</p>
            </div>

            <form
              action={action}
              className="role-picker-options"
              onSubmit={() => {
                setOpen(false);
              }}
            >
              <input type="hidden" name="userId" value={userId} />
              {availableOptions.map((option) => (
                <div key={option.value}>
                  <RolePromotionSubmitButton
                    option={option}
                    pendingDescriptionLabel={pendingDescriptionLabel}
                  />
                </div>
              ))}
            </form>

            <div className="button-row confirm-modal-actions">
              <button
                type="button"
                className="button-secondary"
                onClick={() => setOpen(false)}
              >
                {cancelLabel}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
