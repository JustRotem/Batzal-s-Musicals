# Single sign-on (SSO)

This app is the identity provider for the other Batzal sites (`qr.batzal.net`, `admin.batzal.net`).
A visitor signs in once here (Google only) and the other sites recognize them through a short-lived signed token.
No cookie is shared between sites: each site keeps its own host-only session.

## Flow

1. The site creates a random `state` (16-128 chars of `A-Za-z0-9_-`), stores it in a host-only cookie, and redirects the browser to
   `https://musicals.batzal.net/auth/sso?return=<site origin>&state=<state>`.
2. If the visitor is not signed in, we send them through Google sign-in and then resume the request.
3. We redirect to `<site origin>/api/sso/callback?token=<token>`.
4. The site verifies the token (below), checks `state` against its cookie, creates its own session, and clears the `state` cookie.

`return` must be an exact, pre-approved origin (`SSO_ALLOWED_ORIGINS`, default `https://qr.batzal.net,https://admin.batzal.net`).
Anything else gets HTTP 400.

## Token

`v1.<payload>.<signature>` where both parts are base64url:

- `payload`: JSON claims
- `signature`: Ed25519 signature over the bytes of `v1.<payload>`

Claims: `iss` (`musicals.batzal.net`), `aud` (the site origin), `sub` (user id), `gsub` (Google subject, may be null),
`email`, `name`, `username`, `picture` (absolute URL or null), `role` (`user|editor|admin|superadmin`), `lang` (`he|en`),
`state`, `jti`, `iat`, `exp` (seconds; lifetime 60 s).

The site MUST check, in this order: signature with the public key, `iss`, `aud` equals its own origin, `exp` in the future,
`state` equals its cookie, and that `jti` was not used before (keep used ids for 2 minutes).

The public key is served at `https://musicals.batzal.net/api/sso/public-key` (PEM). Pin it in the site's configuration
rather than fetching it on every login.

`lib/sso.ts` contains the reference implementation (`verifySsoToken`).

## Operations

- Generate keys: `node scripts/generate-sso-key.mjs`, then set `SSO_PRIVATE_KEY` in the app's environment (never commit it).
- Without `SSO_PRIVATE_KEY`, `/auth/sso` answers 503 and `/api/sso/public-key` answers 404.
- Rotating the key: deploy the new private key, then update the pinned public key on each site.
- Blocked or non-active users never receive a token.
