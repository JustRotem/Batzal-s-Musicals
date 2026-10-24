"use client";

import { useEffect, useRef, useState } from "react";
import FormSubmitButton from "@/components/FormSubmitButton";

type Labels = { title: string; edit: string; save: string; saving: string; cancel: string };

// The username is shown as text. The input exists only after "Edit" is pressed, so the page never opens with a field
// in focus (and password managers have no field to offer anything for).
export default function UsernameEditor({
  action,
  username,
  labels,
}: {
  action: (formData: FormData) => void | Promise<void>;
  username: string;
  labels: Labels;
}) {
  const [editing, setEditing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  return (
    <div className="profile-username-form">
      <span className="profile-info-label">{labels.title}</span>

      {editing ? (
        <form action={action} className="profile-username-row">
          <input
            ref={inputRef}
            className="input"
            name="displayHandle"
            defaultValue={username}
            minLength={3}
            maxLength={30}
            autoComplete="off"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            data-lpignore="true"
            data-1p-ignore="true"
            data-bwignore="true"
            data-form-type="other"
            required
          />
          <FormSubmitButton idleLabel={labels.save} pendingLabel={labels.saving} />
          <button type="button" className="button-secondary" onClick={() => setEditing(false)}>
            {labels.cancel}
          </button>
        </form>
      ) : (
        <div className="profile-username-row">
          <strong className="profile-username-text" dir="auto">
            {username}
          </strong>
          <button type="button" className="button-secondary" onClick={() => setEditing(true)}>
            {labels.edit}
          </button>
        </div>
      )}
    </div>
  );
}
