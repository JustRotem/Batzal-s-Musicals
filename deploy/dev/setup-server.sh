#!/usr/bin/env bash
# One-time setup of the DEV network on the server (safe to run again: it never overwrites what exists).
# Run it in ~/dev after copying this folder there:  bash setup-server.sh
# What it does: creates the DEV settings (.env with its own secrets and sign-in keys), copies the uploads and the shared
# static files, sets the browser password, writes the nginx sites and starts the containers with a copy of the
# production database. DNS records (*-dev.batzal.net) are created separately, from the Cloudflare API.
set -euo pipefail

cd "$(dirname "$0")"
PROD=/var/www/musicals
DEVROOT=/var/www/musicals-dev
HOSTS="dev library-dev account-dev qr-dev admin-dev static-dev"

if [ ! -f .env ]; then
  echo "== creating .env"
  umask 077
  DB_PASSWORD=$(openssl rand -hex 16)
  openssl genpkey -algorithm ed25519 -out /tmp/dev-sso.pem
  PRIVATE=$(base64 -w0 /tmp/dev-sso.pem)
  PUBLIC=$(openssl pkey -in /tmp/dev-sso.pem -pubout | base64 -w0)
  rm -f /tmp/dev-sso.pem
  grab() { sudo grep -E "^$1=" "$PROD/.env" | head -1 | cut -d= -f2-; }
  {
    echo "DB_PASSWORD=$DB_PASSWORD"
    echo "GOOGLE_CLIENT_ID=$(grab GOOGLE_CLIENT_ID)"
    echo "GOOGLE_CLIENT_SECRET=$(grab GOOGLE_CLIENT_SECRET)"
    echo "SSO_PRIVATE_KEY=$PRIVATE"
    echo "SSO_PUBLIC_KEY=$PUBLIC"
    echo "CLIP_UPLOAD_AUTH_SECRET=$(openssl rand -hex 16)"
    echo "FROM_EMAIL_NAME=Batzal DEV"
    echo "FROM_EMAIL=no-reply@batzal.net"
  } > .env
fi

echo "== uploads and shared files"
sudo mkdir -p "$DEVROOT/public"
if [ ! -d "$DEVROOT/public/uploads" ]; then sudo cp -a "$PROD/public/uploads" "$DEVROOT/public/uploads"; fi
if [ ! -d /var/www/static-dev ]; then sudo cp -a /var/www/static /var/www/static-dev; fi

echo "== browser password"
if [ ! -f /etc/nginx/dev.htpasswd ]; then
  PASS=$(openssl rand -base64 12 | tr -d '/+=' | cut -c1-14)
  printf 'dev:%s\n' "$(openssl passwd -apr1 "$PASS")" | sudo tee /etc/nginx/dev.htpasswd >/dev/null
  echo "$PASS" > .dev-password
  chmod 600 .dev-password
  echo "   user: dev   password: $PASS   (kept in ~/dev/.dev-password)"
fi

echo "== nginx"
CONF=/etc/nginx/sites-available/dev.conf
{
  cat <<'EOT'
# DEV network: *-dev.batzal.net. Everything is behind a browser password, except the few endpoints other DEV sites call
# from the browser (they only answer with a session and carry nothing secret).
EOT
  proxy_block() { # name port extra
    cat <<EOT
server {
    server_name $1.batzal.net;
    listen 443 ssl;
    listen [::]:443 ssl;
    ssl_certificate /etc/ssl/cloudflare/batzal.net.pem;
    ssl_certificate_key /etc/ssl/cloudflare/batzal.net.key;

    client_max_body_size 300M;
    proxy_read_timeout 600s;
    add_header X-Robots-Tag "noindex, nofollow" always;
$3
    location / {
        auth_basic "Batzal DEV";
        auth_basic_user_file /etc/nginx/dev.htpasswd;
        proxy_pass http://127.0.0.1:$2;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
    # the endpoints other DEV sites call from the browser
    location ~ ^/(api/(preferences|scores|logout|notifications)\$|uploads/avatars/) {
        proxy_pass http://127.0.0.1:$2;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOT
  }
  proxy_block dev 3102 ""
  proxy_block library-dev 3100 "    location /uploads/ { alias $DEVROOT/public/uploads/; expires 30d; auth_basic off; }"
  proxy_block account-dev 3101 ""
  proxy_block qr-dev 3103 ""
  proxy_block admin-dev 3104 ""
  cat <<EOT
server {
    server_name static-dev.batzal.net;
    listen 443 ssl;
    listen [::]:443 ssl;
    ssl_certificate /etc/ssl/cloudflare/batzal.net.pem;
    ssl_certificate_key /etc/ssl/cloudflare/batzal.net.key;
    root /var/www/static-dev;
    add_header Access-Control-Allow-Origin "*" always;
    add_header X-Robots-Tag "noindex, nofollow" always;
    add_header Cache-Control "no-cache" always;
    location / { try_files \$uri =404; }
}
EOT
} | sudo tee "$CONF" >/dev/null
sudo ln -sf "$CONF" /etc/nginx/sites-enabled/dev.conf
sudo nginx -t
sudo systemctl reload nginx

echo "== containers"
docker compose up -d postgres
until docker exec dev-db pg_isready -U postgres -d musicals >/dev/null 2>&1; do sleep 2; done

# copy of production data, only when the DEV database is still empty
HAS=$(docker exec dev-db psql -U postgres -d musicals -tAc "select count(*) from information_schema.tables where table_schema='public'")
if [ "$HAS" = "0" ]; then
  echo "== copying the production database"
  docker exec batzals-musicals-db pg_dump -U postgres -d musicals --no-owner | docker exec -i dev-db psql -q -U postgres -d musicals >/dev/null
fi

docker compose pull
docker compose up -d
docker compose ps
