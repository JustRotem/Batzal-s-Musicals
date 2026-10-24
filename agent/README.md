# Control panel agent

A small program with no dependencies (Node) that runs **on the server itself**, next to Docker. The control panel (the `admin` mode of the main app, https://admin.batzal.net) cannot touch the server from inside its container, so it asks this agent.

- The agent signs nobody in and does not know who may do what: the panel site does that. The agent only trusts a shared secret (`ADMIN_AGENT_TOKEN`) and does nothing outside its fixed lists (containers: start/stop/restart; services: the allowlist in `SERVICES`; storage: deleting only under a few folders and never keys, `.env` or the clinic data).
- Files: `server.js` (the agent), `test.js` (safety tests with mocks: `node test.js`), `deploy/install.sh` (one-time Node and user setup), `deploy/admin-panel.service` (the systemd unit), `deploy/sudoers-admin-panel.txt` (the exact commands it may run with sudo; must match `SERVICES`).
- On the server: systemd unit `admin-panel`, code in `/opt/admin-panel/server.js`, settings in `/etc/admin-panel.env`:

```
PORT=3200
AGENT_HOST=172.17.0.1          # the Docker bridge address, so the panel container can reach it (never 0.0.0.0)
ADMIN_AGENT_TOKEN=<40+ random characters>   # the same value goes to the panel container
```

- Update after a change: copy `server.js` to `/opt/admin-panel/` and `sudo systemctl restart admin-panel`.
- The log of what was done: `/var/lib/admin-panel/audit.log`.
