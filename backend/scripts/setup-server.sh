#!/usr/bin/env bash
set -euo pipefail

# === Vars (원하면 바꾸세요) ===
PROJECT_ROOT="/opt/app/my_dream_day"
APP_DIR="$PROJECT_ROOT/backend"

echo "🔧 Server bootstrap (Docker/Compose, UFW, dirs)..."

sudo apt-get update
sudo apt-get install -y ca-certificates curl gnupg lsb-release git ufw

if ! command -v docker >/dev/null 2>&1; then
  echo "📦 Installing Docker + Compose plugin..."
  sudo install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
   | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  echo \
    "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
    https://download.docker.com/linux/ubuntu \
    $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
   | sudo tee /etc/apt/sources.list.d/docker.list >/dev/null
  sudo apt-get update
  sudo apt-get install -y docker-ce docker-ce-cli containerd.io \
                          docker-buildx-plugin docker-compose-plugin
  sudo systemctl enable --now docker
fi

# docker 그룹
if ! id -nG "$USER" | grep -qw docker; then
  sudo usermod -aG docker "$USER"
  echo "✅ Added $USER to docker group (re-login or 'newgrp docker')"
fi

# UFW
sudo ufw allow OpenSSH
sudo ufw allow 80,443/tcp
sudo ufw --force enable

# 프로젝트 디렉터리
sudo mkdir -p "$APP_DIR"
sudo chown -R "$USER:$USER" "$PROJECT_ROOT"

echo "✅ Server setup completed."
echo "Next:"
echo "  1) cd $APP_DIR"
echo "  2) Put your .env (never commit it)"
echo "  3) docker compose up -d"
