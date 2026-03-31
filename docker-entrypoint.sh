#!/bin/sh
set -eu

mkdir -p /app/public/uploads/musicals /app/public/uploads/avatars /app/public/uploads/clips

echo "Applying Prisma migrations..."
npx prisma migrate deploy

APP_URL_STATUS="missing"
if [ -n "${APP_URL:-}" ]; then
  APP_URL_STATUS="$APP_URL"
fi

echo "Runtime email env summary: APP_URL=${APP_URL_STATUS} NEXT_PUBLIC_APP_URL=${NEXT_PUBLIC_APP_URL:-missing} FROM_EMAIL_CONFIGURED=$( [ -n "${FROM_EMAIL:-}" ] && printf "true" || printf "false" ) FROM_EMAIL_NAME_CONFIGURED=$( [ -n "${FROM_EMAIL_NAME:-}" ] && printf "true" || printf "false" ) RESEND_API_KEY_CONFIGURED=$( [ -n "${RESEND_API_KEY:-}" ] && printf "true" || printf "false" )"
echo "Runtime upload env summary: CLIP_UPLOAD_BASE_URL=${CLIP_UPLOAD_BASE_URL:-missing} CLIP_UPLOAD_AUTH_SECRET_CONFIGURED=$( [ -n "${CLIP_UPLOAD_AUTH_SECRET:-}" ] && printf "true" || printf "false" )"
echo "Starting Batzal's Musicals with auth email diagnostics enabled..."
exec npx next start -H 0.0.0.0 -p "${PORT:-3000}"
