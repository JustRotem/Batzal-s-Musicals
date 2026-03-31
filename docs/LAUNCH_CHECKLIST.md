# Batzal's Musicals Launch Checklist

## Required production environment

- `DATABASE_URL`
- `APP_URL`
- `FROM_EMAIL`
- `FROM_EMAIL_NAME`
- `RESEND_API_KEY`

Notes:
- `APP_URL` must be a real public URL in production, not `localhost`.
- Production account emails must use Resend. Mock email logging is development-only.
- The current session model uses random server-generated session tokens stored hashed in the database, so there is no separate session secret env in this version.

## Database and release flow

1. Run `npm run db:validate`
2. Run `npm run db:migrate:deploy`
3. Run `npm run db:generate`
4. Run `npm run release:check`
5. Build and start the production app

Notes:
- There is no automatic seed script in this repo.
- Production deployment should use migrations, not `db push`, for the real release flow.

## Uploads and media

- Posters and avatars are stored on the local filesystem under `public/uploads/...`
- The deployment target must provide persistent writable storage for that path
- If the host uses ephemeral/serverless filesystem storage, uploaded media will not persist across deploys or instance replacement

## Manual launch smoke test

1. Create account
2. Verify email
3. Log in
4. Open profile and confirm avatar fallback renders
5. Upload avatar
6. Request editor access
7. Log in as admin and approve the request
8. Create musical
9. Edit musical
10. Add clip
11. Search for musical title, clip title, and description text
12. Change password from the account security area
13. Request forgot-password email
14. Open reset link and set a new password
15. Spot-check permissions by removing and restoring one admin/content permission

## Known release notes

- Phone verification delivery is not configured for production yet. The UI is present, but real SMS delivery still needs a provider before this feature should be considered launch-complete.
- Admin-only pages and actions are protected server-side, but they should still be spot-checked once in the deployed environment.
