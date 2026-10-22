# Deployment plan: Google-only sign-in, single sign-on, shared account menu

Everything below is already built and tested locally. Nothing has been deployed. Do the phases in order.
Each phase has a check and a way back. Total user-visible downtime: the musicals app about 45 seconds; QR and the control panel a few seconds each.

## Before you start

- [ ] Commits to publish (local, not pushed): `1e1dfa5` Google-only + per-account language, `dd5c775` SSO identity provider, `64f6dca` username update, plus the compose change in this commit.
- [ ] Optional: remove the old superadmin with `scripts/remove-user.sh irot3m.lau@gmail.com` (use `--dry-run` first). It is not required for the rollout.
- [ ] Sign in to musicals with `rotem.lau@gmail.com` and confirm you can open `/admin/permissions` (proves the superadmin upgrade).

## Phase 1: musicals app (identity provider)

1. `git push origin main`, wait for the GitHub Actions image build (about 12 minutes).
2. On the server, generate the signing key (it is never printed or committed):
   `openssl genpkey -algorithm ed25519 | base64 -w0` and store it as `SSO_PRIVATE_KEY=<value>` in `/var/www/musicals/.env` (chmod 600). Remove the unused `TURNSTILE_*` lines there.
3. In `/var/www/musicals/docker-compose.yml` replace the two `TURNSTILE_*` lines with `SSO_PRIVATE_KEY: ${SSO_PRIVATE_KEY:-}` and `SSO_ALLOWED_ORIGINS: ${SSO_ALLOWED_ORIGINS:-}` (keep a `.bak` copy first).
4. Database backup (`/var/backups/musicals/backup.sh`), tag the running image for rollback, `docker compose pull app`, `docker compose up -d app`.
5. Check: `/api/health` 200; `/auth/login` shows only the Google button; `curl https://musicals.batzal.net/api/sso/public-key` returns a PEM; sign in with Google and open the profile (username field present).
   Rollback: `docker tag batzals-musicals:rollback-<date> ghcr.io/justrotem/batzals-musicals:latest && docker compose up -d app`.

## Phase 2: shared files (static.batzal.net)

Upload `batzal.css`, `batzal-bar.css`, `batzal.js` (new account menu + sign-in link). The old pages keep working with them.
Check: `https://static.batzal.net/batzal.js` contains `BatzalAccount`. Rollback: re-upload the previous copies (keep them as `.bak` first).

## Phase 3: QR

1. Save the current `/var/www/qr/index.html` and `/var/www/qr-api/server.js` as `.bak`.
2. Upload the new `server.js` and `index.html`; in `/var/www/qr-api/.env` add `SSO_PUBLIC_KEY=<base64 of the public PEM from Phase 1>` and delete the `GOOGLE_CLIENT_ID` line.
3. `docker restart qr-api`.
4. Check: `https://qr.batzal.net` shows "התחברות"; sign in; make a QR and copy it; it appears in the history (existing history is keyed by the same Google id).
   Rollback: put the `.bak` files back and restart.

## Phase 4: control panel (admin)

1. Save `/opt/admin-panel/server.js` and `/var/www/admin/index.html` as `.bak`.
2. Upload the new files; in `/etc/admin-panel.env` set `ADMIN_EMAILS=rotem.lau@gmail.com`, add `SSO_PUBLIC_KEY=...`, delete `GOOGLE_CLIENT_ID` and `ADMIN_EMAIL`.
3. `sudo systemctl restart admin-panel`.
4. Check: sign in at `https://admin.batzal.net` (it sends you through musicals); the "users and permissions" section appears; a restart of `qr-api` works.
   If it fails you can still use SSH (`ssh oracle`). Rollback: restore the `.bak` files and restart the service.

## Phase 5: cleanup (after a few days of normal use)

- Google Cloud Console, Web client: remove `https://qr.batzal.net` and `https://admin.batzal.net` from the authorized JavaScript origins (only musicals' redirect URI is needed now).
- Delete the `.bak` files and the old rollback image tag.
