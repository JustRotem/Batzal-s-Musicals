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
echo "synced"
