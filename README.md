# Batzal's Musicals

A Hebrew-first Next.js app for managing musicals, clips, accounts, permissions, search, and admin workflows.

## Stack

- Next.js
- React
- Prisma
- PostgreSQL
- Docker / Docker Compose

## Quick Start

### Local development

1. Copy `.env.example` to `.env` and fill in the required values.
2. Start PostgreSQL locally, or use Docker for the database.
3. Install dependencies:

```bash
npm install
```

4. Apply the schema:

```bash
npx prisma db push
```

5. Start the app:

```bash
npm run dev
```

### Docker

1. Copy `.env.docker.example` to `.env.docker` and fill in the required values.
2. Start the stack:

```bash
docker compose --env-file .env.docker up --build
```

3. Open `http://localhost:3000`

Uploads are persisted through the Docker volume mounted to `public/uploads`.

## Environment Files

- `.env.example`: local development template
- `.env.docker.example`: Docker/local deployment template

Never commit real `.env` or `.env.docker` files.

## Helpful Docs

- [Docker deployment](docs/DOCKER_DEPLOYMENT.md)
- [Launch checklist](docs/LAUNCH_CHECKLIST.md)
