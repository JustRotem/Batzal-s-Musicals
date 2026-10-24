# Home page, QR maker and control panel (one Next.js app, several sites)

The same image serves every Batzal site; `APP_MODE` decides which one a container is:

| Site | `APP_MODE` | Container | Port |
| --- | --- | --- | --- |
| library.batzal.net | (none) | `app` | 3000 |
| account.batzal.net | `account` | `account` | 3001 |
| batzal.net | `home` | `home` | 3002 |
| qr.batzal.net | `qr` | `qr` | 3003 |
| admin.batzal.net | `admin` | `admin` | 3004 |

All of them share the database. `home`, `qr` and `admin` sign people in through the account site, exactly like the library.

## Before the first start

1. **Account site / all containers**: `SSO_ALLOWED_ORIGINS` (if set) must list `https://batzal.net`, `https://qr.batzal.net` and `https://admin.batzal.net`. The default list already has them.
2. **Migrations** (run by the container on start): `20261030_add_game_scores`, `20261031_add_qr_history`, `20261101_add_session_confirmation`.
3. **nginx**: `batzal.net` -> `127.0.0.1:3002` (it currently serves the "blocked" page), `qr.batzal.net` -> `127.0.0.1:3003`, `admin.batzal.net` -> `127.0.0.1:3004`.
4. **Static assets** (`static.batzal.net`): upload the new `batzal-bar.css`, `batzal.css`, `batzal.js` (the bar colours changed and the container pages load them from there). Bump the `?v=` numbers.

## The control panel's agent

The panel container cannot touch the host, so the small agent in `admin-batzal/server.js` keeps running on the host (systemd `admin-panel`) and only answers the panel.

`/etc/admin-panel.env`:

```
PORT=3200
AGENT_HOST=172.17.0.1        # the Docker bridge address, so the container can reach it (never 0.0.0.0)
ADMIN_AGENT_TOKEN=<40+ random characters>
```

The same token goes into the compose environment as `ADMIN_AGENT_TOKEN` (and `ADMIN_AGENT_URL=http://host.docker.internal:3200`). Remove the old `SESSION_SECRET`, `ALLOWED_ORIGIN`, `SSO_*` and `ADMIN_SERVICE_TOKEN` lines; the agent no longer signs anyone in.
Firewall: port 3200 must stay closed to the outside (it is only on the bridge address, and every request needs the token).

## Switching over

1. Deploy the new image and start `home`, `qr`, `admin`; check each `/api/health`.
2. Point nginx at them; reload nginx.
3. Check: batzal.net shows the home page, qr.batzal.net the QR maker (sign in, make a code, see it in the history), admin.batzal.net asks for sign-in and then shows the panel (try a container's logs and a rank change that asks for the Google confirmation).
4. When all is well stop the old `qr-api` container and remove the old static copies of QR and the panel page (`/var/www/qr`, `/var/www/admin`).

QR history kept in the old JSON files is not moved automatically; new codes are saved to the database.
