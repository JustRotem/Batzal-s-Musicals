# Batzal's Musicals

Batzal's Musicals is a Hebrew-first Next.js application for managing musicals, clips, accounts, permissions, search, and admin workflows.

The project supports both local development and Docker-based deployment, with a strong focus on bilingual UI (Hebrew + English), media handling, and mobile-friendly behavior.

---

## Main Features

- Musical library management
- Clip management for both YouTube and uploaded/local videos
- Image upload and cropping flows
- Account system with roles and admin workflows
- Hebrew + English user interface
- Search and filtering
- Responsive UI with strong mobile focus

---

## Tech Stack

- Next.js (App Router)
- React
- Prisma
- PostgreSQL
- Docker / Docker Compose
- Nginx (production)

---

## Development Workflow

> Important: development should be done in **local DEV first**, not directly on the live production server.

Recommended workflow:

1. Run PostgreSQL locally (Docker is recommended)
2. Run the app locally with `npm run dev`
3. Test changes in local DEV
4. Only deploy after the change is verified

This helps protect the live site and keeps production stable.

---

## Local Development

### 1. Install dependencies

```bash
npm install
```

### 2. Create your local environment file

Copy the example env file:

```bash
cp .env.example .env
```

On Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

Then update the values for your local setup.

### 3. Start PostgreSQL

You can use a local PostgreSQL instance or run one through Docker.

Example Docker container:

```bash
docker run -d \
  --name musicals-dev-postgres \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=musicals_dev \
  -p 5432:5432 \
  postgres:16
```

### 4. Apply the Prisma schema

```bash
npx prisma db push
```

### 5. Start the app

```bash
npm run dev
```

### 6. Open the app

- App: `http://localhost:3000`
- Prisma Studio: `http://localhost:5555` (after running `npx prisma studio`)

---

## Prisma Studio

To open Prisma Studio:

```bash
npx prisma studio
```

Make sure your PostgreSQL database is running first.

---

## Docker

Docker is mainly used for database/dev support locally and for deployment workflows.

If you are running the full app stack with Docker Compose:

```bash
docker compose up --build
```

Then open:

```text
http://localhost:3000
```

---

## Uploads and Media

Media files such as uploads, thumbnails, posters, and avatars should be handled carefully.

Recommended approach:

- Keep local DEV media separate from production media
- Do not test directly against production uploads
- Avoid mixing production and development storage

---

## Environment Files

- `.env.example` — example configuration for local development
- `.env` — active local environment file (do not commit real secrets)

Never commit real secrets or private environment files.

---

## Helpful Commands

### Start local dev app

```bash
npm run dev
```

### Apply Prisma schema

```bash
npx prisma db push
```

### Open Prisma Studio

```bash
npx prisma studio
```

### Check running Docker containers

```bash
docker ps
```

### Start local PostgreSQL container

```bash
docker start musicals-dev-postgres
```

### Stop local PostgreSQL container

```bash
docker stop musicals-dev-postgres
```

---

## Deployment Note

Production deployment should happen only after the feature or fix is tested locally.

Recommended production flow:

1. Develop locally
2. Verify behavior in DEV
3. Build/deploy intentionally
4. Keep production environment stable

---

## Documentation

- [Docker deployment](docs/DOCKER_DEPLOYMENT.md)
- [Launch checklist](docs/LAUNCH_CHECKLIST.md)

---

## Notes

- Prefer root-cause fixes over temporary patches
- Keep changes minimal and surgical where possible
- Preserve working behavior when refactoring
- Be especially careful with mobile UI and bilingual layout behavior
