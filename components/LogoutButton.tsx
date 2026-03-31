"use client";

import { useTransition } from "react";
import { logoutAction } from "@/app/auth/logout/actions";

export default function LogoutButton({
  className,
}: {
  className?: string;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      className={className}
      disabled={pending}
      onClick={() => {
        startTransition(async () => {
          await logoutAction();
        });
      }}
    >
      {pending ? "מתנתק..." : "התנתקות"}
    </button>
  );
}