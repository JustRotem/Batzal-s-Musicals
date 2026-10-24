# DEV environment (next to production)

A full copy of the Batzal network on the same server, for trying things before they reach production. No ports to remember: every site has an address.

| DEV address | Site |
| --- | --- |
| https://dev.batzal.net | home page |
| https://library-dev.batzal.net | library |
| https://account-dev.batzal.net | account (sign-in) |
| https://qr-dev.batzal.net | QR maker |
| https://admin-dev.batzal.net | control panel (people and permissions only) |
| https://static-dev.batzal.net | shared header files |

Everything asks for a browser password first (user `dev`, the password is kept on the server in `~/dev/.dev-password`).

## How it works

- **Branches:** `main` is production, `dev` is DEV. Pushing to `dev` builds the image `ghcr.io/justrotem/batzals-musicals:dev`; pushing to `main` builds `:latest`. To release: merge `dev` into `main`.
- **Updating DEV:** `bash ~/dev/update.sh` on the server (pulls the newest `:dev` image and restarts; database migrations run automatically).
- **Data:** a copy of production, taken once when DEV was created. DEV has its own database (`dev-db`), uploads (`/var/www/musicals-dev`) and sign-in keys. Nothing done in DEV touches production.
- **E-mails:** never sent from DEV (the copy holds real addresses).
- **The panel:** the DEV control panel manages DEV people and permissions. It has no host agent, so it cannot touch any production container.
- **Reset DEV data:** `cd ~/dev && docker compose down -v` and run `setup-server.sh` again (it copies production again).

## One-time Google step

Sign-in with Google needs the DEV address allowed once, in Google Cloud Console (APIs and services > Credentials > the OAuth client > Authorized redirect URIs), add:

```
https://account-dev.batzal.net/auth/google/callback
```

## Setting it up again from scratch

1. DNS (Cloudflare, proxied A records to the server): `dev`, `library-dev`, `account-dev`, `qr-dev`, `admin-dev`, `static-dev` under batzal.net.
2. Copy `deploy/dev/` to `~/dev` on the server and run `bash setup-server.sh` (it creates the settings, copies uploads and static files, writes the nginx sites, copies the database and starts everything).
3. Upload the newest `batzal-shared` files to `/var/www/static-dev`.
