# Deployment plan: dedicated account site (account.batzal.net)

Built and tested locally, not deployed. The same image runs two containers:

- `musicals` (default) serves the musicals and signs people in through the account site.
- `account` (`APP_MODE=account`) serves sign-in with Google, the profile (username, email, language, picture) and users and permissions.

Both use the same Postgres database. Tokens are signed by the account site; the other sites only hold its public key.

## What you need to do yourself

- Google Cloud Console, Web client: add the authorized redirect URI `https://account.batzal.net/auth/google/callback`.
  (Remove `https://musicals.batzal.net/auth/google/callback` later, once nothing uses it.)

## Server steps (in this order)

1. DNS (Cloudflare): `account` A record, proxied. nginx site `account.conf` proxying to `127.0.0.1:3001`, Let's Encrypt certificate (same pattern as the other sites).
2. Keys: the existing `SSO_PRIVATE_KEY` moves from the musicals container to the account container. Put it only in the account container's environment. The musicals container gets `SSO_PUBLIC_KEY` (from `https://account.batzal.net/api/sso/public-key`) and `ACCOUNT_URL=https://account.batzal.net`.
3. Compose (server copy): add the `account` service (same image, `APP_MODE=account`, `APP_URL=https://account.batzal.net`, port 3001, same uploads volume so avatars are shared).
4. Backup the database, tag the running image for rollback, push to GitHub, wait for the build, pull.
5. Start `account` first and check `/api/health` and `/auth/login`. Then restart `musicals`.
6. The small sites: set `SSO_ISSUER_URL=https://account.batzal.net` and `SSO_PUBLIC_KEY` (the same key) for the QR API and the control panel, then restart them. Upload the updated pages and the shared files (`batzal.css`, `batzal-bar.css`, `batzal.js`).
7. Tokens for the QR and control panel are now issued by `account.batzal.net` (issuer changes), so step 6 must follow step 5 closely: until then sign-in on those two sites is unavailable (about a minute). The control panel can still be reached over SSH.

## Checks

- Sign in at `musicals.batzal.net` (goes through the account site and back), the header menu shows your username, "My account and settings" opens `account.batzal.net/profile`.
- `account.batzal.net/admin/permissions` shows permissions grouped by site.
- QR and control panel sign-in work; the control panel still requires `superadmin`.
- `musicals.batzal.net/profile` and `/admin/permissions` redirect to the account site.

## Rollback

Restore the previous image tag and compose file (kept as `.bak`), restart; the old musicals-only behavior returns. The account site can simply be stopped.
