"use client";

import { useEffect, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";

type SelectOption = {
  value: string;
  label: string;
};

type AdminSearchToolbarProps = {
  searchParamName?: string;
  initialQuery?: string;
  initialRole?: string;
  initialStatus?: string;
  roleOptions?: SelectOption[];
  statusOptions?: SelectOption[];
  placeholder?: string;
  submitLabel?: string;
};

function buildAdminUrl(
  pathname: string,
  values: {
    q: string;
    role: string;
    status: string;
  },
) {
  const searchParams = new URLSearchParams();

  if (values.q.trim()) {
    searchParams.set("q", values.q.trim());
  }

  if (values.role && values.role !== "all") {
    searchParams.set("role", values.role);
  }

  if (values.status && values.status !== "all") {
    searchParams.set("status", values.status);
  }

  const suffix = searchParams.toString();
  return `${pathname}${suffix ? `?${suffix}` : ""}`;
}

export default function AdminSearchToolbar({
  initialQuery = "",
  initialRole = "all",
  initialStatus = "all",
  roleOptions = [],
  statusOptions = [],
  placeholder = "חיפוש...",
  submitLabel = "סנן",
}: AdminSearchToolbarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [query, setQuery] = useState(initialQuery);
  const [role, setRole] = useState(initialRole);
  const [status, setStatus] = useState(initialStatus);
  const [, startTransition] = useTransition();

  useEffect(() => {
    setQuery(initialQuery);
    setRole(initialRole);
    setStatus(initialStatus);
  }, [initialQuery, initialRole, initialStatus]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      startTransition(() => {
        router.replace(
          buildAdminUrl(pathname || "/admin", {
            q: query,
            role,
            status,
          }),
          { scroll: false },
        );
      });
    }, 350);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [pathname, query, role, router, status]);

  return (
    <form
      method="get"
      className="admin-search-toolbar"
      onSubmit={(event) => {
        event.preventDefault();
        router.push(
          buildAdminUrl(pathname || "/admin", {
            q: query,
            role,
            status,
          }),
        );
      }}
    >
      <div className="search-box-input-wrap">
        <input
          type="search"
          name="q"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="input search-box-input"
          placeholder={placeholder}
          dir="auto"
        />
      </div>

      {roleOptions.length > 0 ? (
        <select
          name="role"
          className="input search-filter-select"
          value={role}
          onChange={(event) => setRole(event.target.value)}
        >
          {roleOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      ) : null}

      {statusOptions.length > 0 ? (
        <select
          name="status"
          className="input search-filter-select"
          value={status}
          onChange={(event) => setStatus(event.target.value)}
        >
          {statusOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      ) : null}

      <button type="submit" className="button-secondary search-box-button">
        {submitLabel}
      </button>
    </form>
  );
}
