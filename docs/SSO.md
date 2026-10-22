# Single sign-on (SSO)

The account site (`account.batzal.net`, this code running with `APP_MODE=account`) is the identity provider for every Batzal site:
the musicals site, `qr.batzal.net` and `admin.batzal.net`. People sign in once there (Google only) and the other sites recognize them
through a short-lived signed token. No cookie is shared between sites: each site keeps its own host-only session.

## Flow

1. The site creates a random `state` (16-128 chars of `A-Za-z0-9_-`), stores it in a host-only cookie, and redirects the browser to
   `https://account.batzal.net/auth/sso?return=<site origin>&state=<state>`.
2. If the visitor is not signed in, the account site sends them through Google sign-in and then resumes the request.
3. The account site redirects to the site's callback with the token: `<site origin>/api/sso/callback?token=<token>`
   (the musicals site uses `/auth/account/callback`).
4. The site verifies the token (below), checks `state` against its cookie, creates its own session, and clears the `state` cookie.

`return` must be an exact, pre-approved origin (`SSO_ALLOWED_ORIGINS`; default: musicals, qr and admin). Anything else gets HTTP 400.

## Token

`v1.<payload>.<signature>` where both parts are base64url:

- `payload`: JSON claims
- `signature`: Ed25519 signature over the bytes of `v1.<payload>`

Claims: `iss` (`account.batzal.net`), `aud` (the site origin), `sub` (user id), `gsub` (Google subject, may be null),
`email`, `name` (the username), `username`, `picture` (absolute URL or null), `role` (`user|editor|admin|superadmin`), `lang` (`he|en`),
`state`, `jti`, `iat`, `exp` (seconds; lifetime 60 s).

The site MUST check, in this order: signature with the public key, `iss`, `aud` equals its own origin, `exp` in the future,
`state` equals its cookie, and that `jti` was not used before (keep used ids for 2 minutes).

The public key is served at `https://account.batzal.net/api/sso/public-key` (PEM). Pin it in the site's configuration
(`SSO_PUBLIC_KEY`) rather than fetching it on every login. `lib/sso.ts` has the reference implementation (`verifySsoToken`).

## Sites and what they do with the token

- Musicals site: shares the user table, so `sub` is a user id; it creates a regular session row for that user (`lib/account-sso.ts`).
- QR and control panel: keep their own small signed session cookie. The control panel additionally requires `role = superadmin`
  and an email on its allowlist (`ADMIN_EMAILS`).

## Operations

- Generate keys: `node scripts/generate-sso-key.mjs`; set `SSO_PRIVATE_KEY` only in the account container's environment (never commit it).
- Without `SSO_PRIVATE_KEY`, `/auth/sso` answers 503 and `/api/sso/public-key` answers 404.
- Rotating the key: deploy the new private key, then update `SSO_PUBLIC_KEY` on each site.
- Blocked or non-active users never receive a token.
