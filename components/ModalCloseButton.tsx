"use client";

// The close "X" of every floating window (the same look everywhere). A click outside the window closes it too.
export default function ModalCloseButton({
  onClick,
  label = "סגור",
  disabled = false,
}: {
  onClick: () => void;
  label?: string;
  disabled?: boolean;
}) {
  return (
    <button type="button" className="modal-x" aria-label={label} title={label} onClick={onClick} disabled={disabled}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
        <path d="M6 6l12 12M18 6L6 18" />
      </svg>
    </button>
  );
}
