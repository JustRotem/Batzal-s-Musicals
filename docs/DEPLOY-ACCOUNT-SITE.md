# Deployment plan: account site, library site and control panel

Built and tested locally, **not deployed**. Nothing here runs on the server until you say so.

The same image runs two containers:

- `app` (default mode) is the library site, `library.batzal.net`. It signs people in through the account site.
- `account` (`APP_MODE=account`) is `account.batzal.net`: sign-in with Google, the profile (username, email, language, appearance, picture), and the service API the control panel uses.

Both use the same Postgres database. Tokens are signed by the account site; the other sites only hold its public key.

## What you do yourself

- Google Cloud Console, Web client ("Batzal Web Client"): add the authorized redirect URI `https://account.batzal.net/auth/google/callback`.
  Remove `https://musicals.batzal.net/auth/google/callback` and `http://localhost:3000/auth/google/callback` from this client once the account site is live (localhost belongs to the "Local Dev" client). No JavaScript origins are needed.
- Cloudflare: add proxied DNS records for `account` and `library` (same target as `musicals`).

## Server steps, in this order

1. **Backup**: run the database backup, tag the running image for rollback (`docker tag ... :rollback-<date>`), keep `.bak` copies of compose, `.env` and the nginx sites.
2. **nginx and certificates**: add `account.batzal.net` (proxy to `127.0.0.1:3001`) and `library.batzal.net` (proxy to the app on `127.0.0.1:3000`) with certbot, the same pattern as the other sites.
   `musicals.batzal.net` stays, but becomes a `301` redirect to `https://library.batzal.net$request_uri`, so old links keep working. (A second hostname must not serve the app directly: the sign-in token is issued for one site address.)
3. **Environment** (`/var/www/musicals/.env`):
   - app container: `APP_URL=https://library.batzal.net`, `NEXT_PUBLIC_APP_URL=https://library.batzal.net`, `ACCOUNT_URL=https://account.batzal.net`, `ADMIN_URL=https://admin.batzal.net`, `SSO_PUBLIC_KEY` (from `https://account.batzal.net/api/sso/public-key`).
   - account container only: `SSO_PRIVATE_KEY` (moves from the app container), `ADMIN_SERVICE_TOKEN` (new, 32+ random characters), `APP_URL=https://account.batzal.net`.
   - cookies shared by every site are set on `.batzal.net` automatically in production (`SHARED_COOKIE_DOMAIN` overrides).
4. **Compose**: add the `account` service (same image, `APP_MODE=account`, port 3001, same uploads volume so avatars are shared). `docker compose pull`, then start `account`, check `/api/health`, then restart the app.
5. **Database migrations** run with the image (`prisma migrate deploy`): theme per account, panel permissions, shared sign-in group, library categories (creates "Musicals" and files every existing item under it).
6. **Small sites**:
   - QR API container: `SSO_ISSUER_URL=https://account.batzal.net`, the same `SSO_PUBLIC_KEY`, and `ALLOWED_ORIGIN` unchanged.
   - Control panel (`/etc/admin-panel.env`): `SSO_ISSUER_URL`, `SSO_PUBLIC_KEY`, `ADMIN_SERVICE_TOKEN` (same value as the account container), `ACCOUNT_SERVICE_URL=https://account.batzal.net` (or `http://127.0.0.1:3001`). `ADMIN_EMAILS` is no longer used: access is by permission.
   - Upload the pages and the shared files (`batzal.css`, `batzal-bar.css`, `batzal.js`, version `?v=19`) to static.batzal.net, purge the Cloudflare cache.
7. Tokens for the QR and control panel are now issued by `account.batzal.net` (the issuer changes), so step 6 must follow step 4 closely: until then sign-in on those two sites is unavailable (about a minute). The control panel stays reachable over SSH.
8. Give yourself the panel permissions if you are not a super admin (super admins have them all): Control panel permissions are in the panel under "People and permissions".

## Checks

- Sign in at `library.batzal.net`; the header shows your username and rank, the account menu opens `account.batzal.net/profile`.
- Sign in on one site and open the others: you are signed in everywhere. Sign out on one: signed out everywhere.
- Language and appearance chosen as a guest on one site hold on the others.
- `musicals.batzal.net/anything` redirects to `library.batzal.net/anything`; `/musicals/...` paths redirect to `/library/...`.
- Control panel: opens only with permission; view-only people see no action buttons; "Delete" appears only for super admins.
- QR sign-in and history work.

## Rollback

Restore the previous image tag and the `.bak` files, restart. The account site can simply be stopped, and nginx for `musicals.batzal.net` can serve the app again.
