"use client";

import { useFormStatus } from "react-dom";

type NewMusicalSubmitButtonProps = {
  idleLabel?: string;
  pendingLabel?: string;
  formEncType?: string;
  disabled?: boolean;
};

export default function NewMusicalSubmitButton({
  idleLabel = "צור מחזה",
  pendingLabel = "יוצר מחזה...",
  formEncType,
  disabled = false,
}: NewMusicalSubmitButtonProps) {
  const { pending } = useFormStatus();
  const isDisabled = pending || disabled;

  return (
    <button
      type="submit"
      className="button-primary"
      disabled={isDisabled}
      aria-disabled={isDisabled}
      aria-busy={pending}
      formEncType={formEncType}
      style={{
        minWidth: 180,
        minHeight: 54,
        fontSize: 16,
        fontWeight: 800,
      }}
    >
      {pending ? pendingLabel : idleLabel}
    </button>
  );
}
