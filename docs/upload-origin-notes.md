# Upload Origin Notes

## Where the 413 comes from

The app-side upload flow now posts clip videos to the dedicated upload origin:

- `https://upload.batzal.net/api/admin/clip-video`

The Next.js app allows large request bodies via:

- [next.config.mjs](/home/rotem/my-musicals/next.config.mjs)
  `experimental.middlewareClientMaxBodySize = "1536mb"`

When this request still fails with `413 Content Too Large`, the rejection is happening before the app handles the request. In this stack, that means the reverse proxy for `upload.batzal.net` is the real source of the 413 unless the live proxy and app limits are aligned.

## What was added

- [deploy/nginx/upload.batzal.net.conf](/home/rotem/my-musicals/deploy/nginx/upload.batzal.net.conf)
  A dedicated Nginx server example for `upload.batzal.net` with:
  - `client_max_body_size 1536m;` at the server level
  - `client_max_body_size 1536m;` again on `/api/admin/clip-video`

- [docker-compose.yml](/home/rotem/my-musicals/docker-compose.yml)
  Added pass-through env wiring for:
  - `CLIP_UPLOAD_BASE_URL`
  - `CLIP_UPLOAD_AUTH_SECRET`

- [docker-entrypoint.sh](/home/rotem/my-musicals/docker-entrypoint.sh)
  Added startup logging so the running container reports whether the upload-origin env is actually present.

## Effective upload limit

The intended effective limit is now:

- `1536 MB` at the Next.js app layer via `middlewareClientMaxBodySize`
- `1536 MB` at the Nginx upload-origin layer via `client_max_body_size`

This is roughly **1.5 GB**, which is above the current real-world test file size of about `741 MB`.

## Live server requirement

If the active `upload.batzal.net` Nginx config is managed outside this repo, repo-only changes are not enough. The live server must also be updated in:

- `/etc/nginx/sites-available/upload.batzal.net`
- or the active equivalent included by your Nginx setup

Otherwise production will keep returning `413 Content Too Large` even if the app code is already correct.

## Deployment note

`upload.batzal.net` should remain **DNS-only / non-proxied** in Cloudflare. If Cloudflare proxying is re-enabled for large uploads, Cloudflare can still reject the request before Nginx or the app sees it.

## Orphan clip upload cleanup

Uploaded clip files are written to disk as soon as the dedicated upload request succeeds, before the final clip record is created. That means an abandoned clip form can leave behind an unused local file.

To keep this safe without risking valid media:

- the clip record remains the source of truth for whether an uploaded file is in use
- cleanup only considers files under `/uploads/clips/...`
- cleanup only deletes local files that are not referenced by any clip record
- cleanup only deletes files older than `24 hours`
- cleanup is throttled to run at most once per hour

The cleanup pass is triggered opportunistically after successful upload/create/update/delete events, and logs under:

- `[clip-video-cleanup] ...`
