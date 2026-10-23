"use client";

import { useFormStatus } from "react-dom";

type NewMusicalSubmitButtonProps = {
  idleLabel?: string;
  pendingLabel?: string;
  formEncType?: string;
  disabled?: boolean;
  // Lets one form have two ways to submit, for example "publish" and "save as draft".
  name?: string;
  value?: string;
  variant?: "primary" | "secondary";
};

export default function NewMusicalSubmitButton({
  idleLabel = "צור פריט",
  pendingLabel = "יוצר פריט...",
  formEncType,
  disabled = false,
  name,
  value,
  variant = "primary",
}: NewMusicalSubmitButtonProps) {
  const { pending } = useFormStatus();
  const isDisabled = pending || disabled;

  return (
    <button
      type="submit"
      name={name}
      value={value}
      className={variant === "primary" ? "button-primary" : "button-secondary"}
      disabled={isDisabled}
      aria-disabled={isDisabled}
      aria-busy={pending}
      formEncType={formEncType}
      style={{
        minWidth: variant === "primary" ? 180 : 140,
        minHeight: variant === "primary" ? 54 : 48,
        fontSize: 16,
        fontWeight: 800,
      }}
    >
      {pending ? pendingLabel : idleLabel}
    </button>
  );
}
