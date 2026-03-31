# Docker Deployment Notes

## Files

- `Dockerfile`: production-oriented image for the Next.js app
- `docker-compose.yml`: local production-like stack with app + Postgres
- `.env.docker.example`: sample env file for the Docker stack
- `docker-entrypoint.sh`: applies Prisma migrations, then starts the app

## How to run locally

1. Copy `.env.docker.example` to `.env.docker`
2. Adjust values as needed, especially `APP_URL`, `NEXT_PUBLIC_APP_URL`, and email settings
3. Start the stack:

```bash
docker compose --env-file .env.docker up --build
```

4. Open the app at `http://localhost:3000`

## How the stack works

- `postgres` runs PostgreSQL 16 with a persistent named volume
- `app` builds the production Next.js app and runs it with `next start`
- the app waits for Postgres health before starting
- uploads are persisted in a named Docker volume mounted at `/app/public/uploads`

## Prisma startup/deploy flow

- the container entrypoint runs:

```bash
npx prisma migrate deploy
```

- after migrations succeed, it starts:

```bash
npx next start -H 0.0.0.0 -p 3000
```

This means the containerized app does not rely on manual `db push` during normal startup.

## Persistence

- database data persists in the `postgres_data` volume
- posters and avatars persist in the `uploads_data` volume

Without the uploads volume, media files would be lost when the app container is recreated.

## Health checks

- Postgres uses `pg_isready`
- the app uses `GET /api/health`

## Required environment variables

- `DATABASE_URL`
- `APP_URL`
- `NEXT_PUBLIC_APP_URL`
- `FROM_EMAIL`
- `FROM_EMAIL_NAME`
- `RESEND_API_KEY`

## Notes

- Keep real secrets in `.env.docker` or your deployment secret manager, not in committed files.
- For a real hosted deployment, set `APP_URL` to the public HTTPS URL of the app.
- If you deploy on infrastructure with external object storage later, uploads can move there, but this Docker setup keeps them persistent locally without changing app behavior.
