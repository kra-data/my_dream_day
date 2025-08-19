# 🚀 빠른 배포 가이드

## 📋 1분 요약

1. **서버에서**: `./scripts/setup-server.sh` 실행
2. **GitHub에서**: 5개 Secrets 설정
3. **로컬에서**: `git push origin main`
4. **완료!** 🎉

## 🔑 GitHub Secrets (필수)

| Secret | 값 |
|--------|-----|
| `SERVER_HOST` | 서버 IP |
| `SERVER_USER` | 서버 사용자명 |
| `SERVER_SSH_KEY` | SSH 개인키 |
| `SERVER_PORT` | 22 |
| `PROJECT_PATH` | `/opt/employee_project/backend` |

## 📁 파일 구조

```
.github/workflows/
├── deploy.yml          # 자동 배포 워크플로우
└── rollback.yml        # 롤백 워크플로우

scripts/
├── setup-server.sh     # 서버 초기 설정
└── deploy.sh          # 배포 실행

docs/
└── DEPLOYMENT.md      # 상세 가이드
```

## 🚨 문제 해결

- **SSH 연결 실패**: `chmod 600 ~/.ssh/id_rsa`
- **Docker 권한**: `sudo usermod -aG docker $USER`
- **포트 충돌**: `sudo systemctl stop nginx`

## 📞 지원

- 상세 가이드: `docs/DEPLOYMENT.md`
- GitHub Actions: 저장소 → Actions 탭
- 서버 로그: `docker compose logs -f`
