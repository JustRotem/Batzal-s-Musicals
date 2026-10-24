#!/usr/bin/env bash
# Sends the current source files to the live DEV on the server (run on the PC, from anywhere): bash deploy/dev/sync.sh
# The sites there reload by themselves in a second or two. A change in the database schema also restarts them.
set -euo pipefail
cd "$(dirname "$0")/../.."
tar czf - app components lib prisma public/emoji middleware.ts next.config.mjs tsconfig.json package.json \
  | ssh oracle 'set -e; mkdir -p ~/dev/src/public; tar xzf - -C ~/dev/src
    cd ~/dev
    new=$(find src/prisma -type f | sort | xargs md5sum | md5sum)
    old=$(cat src/.prisma-hash 2>/dev/null || true)
    if [ "$new" != "$old" ]; then echo "$new" > src/.prisma-hash; docker compose -f docker-compose.yml -f docker-compose.live.yml restart >/dev/null 2>&1 && echo "database schema changed: sites restarted"; fi'
# the shared header files (served by static-dev) go along, so the header of every DEV site is current too
tar czf - -C shared . | ssh oracle 'sudo tar xzf - -C /var/www/static-dev --no-same-owner --no-same-permissions && sudo chmod -R a+rX /var/www/static-dev'
# open the main pages once so the first visit on the phone does not wait for next dev to compile them
ssh oracle 'for u in 3300/ 3300/library 3301/auth/login 3301/auth/sso 3301/auth/google/start 3301/auth/google/callback 3300/auth/account/start 3300/auth/account/callback 3302/auth/account/start 3302/ 3303/ 3304/; do curl -s -o /dev/null -m 90 "http://127.0.0.1:${u}" & done; wait' >/dev/null 2>&1 || true
echo "synced"
