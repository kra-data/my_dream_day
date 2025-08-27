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

# -------- Git 강제 최신화(무조건 원격 갱신) --------
if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  GIT_REMOTE="${GIT_REMOTE:-origin}"
  GIT_BRANCH="${GIT_BRANCH:-main}"

  echo "📦 Updating git repo: $GIT_REMOTE/$GIT_BRANCH"
  git fetch "$GIT_REMOTE" --prune

  # 현재 브랜치가 다르거나 없으면 체크아웃
  if ! git rev-parse --verify "$GIT_BRANCH" >/dev/null 2>&1; then
    # 로컬에 브랜치가 없으면 원격 브랜치에서 생성
    git checkout -B "$GIT_BRANCH" "$GIT_REMOTE/$GIT_BRANCH"
  else
    git checkout "$GIT_BRANCH" >/dev/null 2>&1 || git switch "$GIT_BRANCH"
  fi

  # pull 실패(충돌 등) 시 하드 리셋으로 강제 동기화
  if ! git pull --rebase --autostash "$GIT_REMOTE" "$GIT_BRANCH"; then
    echo "⚠️  git pull 실패 → 강제 동기화(git reset --hard $GIT_REMOTE/$GIT_BRANCH)"
    git reset --hard "$GIT_REMOTE/$GIT_BRANCH"
  fi

  # (있다면) 서브모듈도 최신화
  if [ -f .gitmodules ]; then
    git submodule update --init --recursive
    git submodule foreach --recursive 'git fetch --prune || true'
  fi
else
  echo "❌ 현재 디렉터리가 git 리포지토리가 아닙니다. (clone 후 실행하세요)"
  exit 1
fi
# -----------------------------------------------

# 도커 준비 확인
if ! command -v docker >/dev/null 2>&1; then
  echo "❌ Docker not installed"; exit 1
fi
docker info >/dev/null

if ! docker compose version >/dev/null 2>&1; then
  echo "❌ Docker Compose plugin not installed"; exit 1
fi

# 빌드 & 재기동
docker compose down --remove-orphans || true
docker compose up -d --build

# 헬스체크 (엔드포인트 명은 서비스에 맞게 변경)
HEALTH_URL="${HEALTH_URL:-http://localhost/api/health}"
echo "🩺 Health check: $HEALTH_URL"
OK=""
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
