#!/usr/bin/env bash
set -euo pipefail

# 스크립트가 있는 위치 기준(예: scripts/에서 실행 시 리포 루트로 이동)
cd "$(dirname "$0")/.."

echo "🚀 Deploy start: $(date -Is)"

# .env 로드(있으면)
if [ -f .env ]; then
  set -a
  . ./.env
  set +a
fi

# 도커 준비 확인
if ! command -v docker >/dev/null 2>&1; then
  echo "❌ Docker not installed"; exit 1
fi
docker info >/dev/null

if ! docker compose version >/dev/null 2>&1; then
  echo "❌ Docker Compose plugin not installed"; exit 1
fi

# (선택) 깃 최신화: 서버에서 git 관리한다면
if [ -d .git ]; then
  git fetch origin main || true
  git reset --hard origin/main || true
fi

# 빌드 & 재기동
docker compose down --remove-orphans || true
docker compose up -d --build

# 헬스체크 (엔드포인트 명은 서비스에 맞게 변경)
HEALTH_URL="${HEALTH_URL:-http://localhost:3001/api/health}"
echo "🩺 Health check: $HEALTH_URL"
for i in {1..30}; do
  if curl -fsS "$HEALTH_URL" >/dev/null 2>&1; then
    echo "✅ Healthy!"
    OK=1; break
  fi
  sleep 2
done
if [ -z "${OK:-}" ]; then
  echo "❌ Health check failed. Recent logs:"
  docker compose logs --tail=200 backend || true
  exit 1
fi

# Caddy 포트 확인(선택)
if curl -fsS http://localhost:80 >/dev/null 2>&1; then
  echo "🌐 Caddy OK (port 80)"
else
  echo "⚠️  Caddy not responding on :80 (check logs)"
fi

echo "🎉 Deploy done: $(date -Is)"
