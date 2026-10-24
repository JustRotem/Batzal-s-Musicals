#!/bin/bash
# One-time install on the server (Ubuntu aarch64). Run as a sudo-capable user from the project dir.
set -euo pipefail
NODE_VER=$(curl -fsSL https://nodejs.org/dist/latest-v20.x/SHASUMS256.txt | grep -o 'node-v20[0-9.]*-linux-arm64.tar.xz' | head -1 | sed 's/node-//; s/-linux.*//')
echo "node $NODE_VER"
if [ ! -x /opt/node/bin/node ]; then
  cd /tmp && curl -fsSLO "https://nodejs.org/dist/$NODE_VER/node-$NODE_VER-linux-arm64.tar.xz"
  curl -fsSL "https://nodejs.org/dist/$NODE_VER/SHASUMS256.txt" | grep "node-$NODE_VER-linux-arm64.tar.xz" | sha256sum -c -
  sudo mkdir -p /opt/node && sudo tar -xJf "node-$NODE_VER-linux-arm64.tar.xz" -C /opt/node --strip-components=1
  rm -f "node-$NODE_VER-linux-arm64.tar.xz"
fi
/opt/node/bin/node -v
id admin-panel >/dev/null 2>&1 || sudo useradd --system --no-create-home --shell /usr/sbin/nologin admin-panel
sudo usermod -aG docker,systemd-journal admin-panel
sudo mkdir -p /opt/admin-panel /var/lib/admin-panel /var/www/admin
sudo chown admin-panel:admin-panel /var/lib/admin-panel && sudo chmod 700 /var/lib/admin-panel
