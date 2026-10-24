#!/usr/bin/env bash
# Update the DEV sites to the newest image built from the `dev` branch (database migrations run on start).
set -euo pipefail
cd "$(dirname "$0")"
docker compose pull
docker compose up -d
docker image prune -f >/dev/null
docker compose ps
