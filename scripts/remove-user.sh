#!/bin/bash
# Removes a user account from the musicals database (the app UI cannot delete a superadmin).
# Run it yourself on the server:   ./remove-user.sh someone@example.com            (asks before deleting)
# Preview only (changes nothing):  ./remove-user.sh someone@example.com --dry-run
#
# Safety: takes a database backup first, refuses to delete the last superadmin, and runs in one transaction.
set -euo pipefail

EMAIL="${1:-}"
MODE="${2:-}"
DB_CONTAINER="${DB_CONTAINER:-batzals-musicals-db}"
DB_NAME="${DB_NAME:-musicals}"
BACKUP_SCRIPT="${BACKUP_SCRIPT:-/var/backups/musicals/backup.sh}"

if [[ ! "$EMAIL" =~ ^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$ ]]; then
  echo "usage: $0 <email> [--dry-run]" >&2
  exit 2
fi

psql_run() { docker exec -i "$DB_CONTAINER" psql -U postgres -d "$DB_NAME" -v ON_ERROR_STOP=1 -v email="$EMAIL" "$@"; }

echo "== account"
psql_run <<'SQL'
SELECT username, email, role, status FROM "User" WHERE lower(email) = lower(:'email');
SELECT (SELECT count(*) FROM "Musical" WHERE "createdById" = u.id) AS musicals_kept_without_creator,
       (SELECT count(*) FROM "Clip" WHERE "createdById" = u.id) AS clips_kept_without_creator,
       (SELECT count(*) FROM "Comment" WHERE "userId" = u.id) AS comments_deleted,
       (SELECT count(*) FROM "Session" WHERE "userId" = u.id) AS sessions_deleted
FROM "User" u WHERE lower(u.email) = lower(:'email');
SQL

if [[ "$MODE" == "--dry-run" ]]; then
  echo "== dry run: the delete is executed and rolled back"
  psql_run <<'SQL'
BEGIN;
DELETE FROM "User" u WHERE lower(u.email) = lower(:'email')
  AND (u.role <> 'superadmin' OR EXISTS (SELECT 1 FROM "User" o WHERE o.role = 'superadmin' AND o.id <> u.id));
ROLLBACK;
SQL
  echo "nothing was changed."
  exit 0
fi

read -r -p "Delete this account permanently? Type the email to confirm: " CONFIRM
if [[ "${CONFIRM,,}" != "${EMAIL,,}" ]]; then
  echo "cancelled." >&2
  exit 1
fi

echo "== backup"
"$BACKUP_SCRIPT"

echo "== delete"
psql_run <<'SQL'
BEGIN;
DELETE FROM "User" u WHERE lower(u.email) = lower(:'email')
  AND (u.role <> 'superadmin' OR EXISTS (SELECT 1 FROM "User" o WHERE o.role = 'superadmin' AND o.id <> u.id));
SELECT username, email, role FROM "User" ORDER BY "createdAt";
COMMIT;
SQL
echo "done. (If the account was not listed as removed above, it was kept: it was the last superadmin or the email did not match.)"
