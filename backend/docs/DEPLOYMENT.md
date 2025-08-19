# 🚀 자동 배포 가이드 (GitHub Actions)

GitHub에 코드를 푸시할 때마다 자동으로 서버에 배포되도록 설정하는 방법입니다.

## 📋 사전 준비사항

### 1. 서버 준비
- Ubuntu 24.04 서버
- 도메인: `mydreamday.shop`
- SSH 접속 가능
- 80, 443 포트 열림

### 2. GitHub 저장소
- 코드가 GitHub에 푸시되어 있어야 함
- GitHub Actions 권한 필요

## 🔧 서버 설정

### 1단계: 서버에 스크립트 실행
```bash
# 서버에 SSH 접속
ssh username@your-server-ip

# 스크립트 다운로드 및 실행
curl -O https://raw.githubusercontent.com/YOUR_USERNAME/employee_project/main/backend/scripts/setup-server.sh
chmod +x setup-server.sh
./setup-server.sh
```

### 2단계: 환경 변수 설정
```bash
cd /opt/employee_project/backend
nano .env
```

`.env` 파일 내용:
```env
NODE_ENV=production
PORT=3001
DATABASE_URL=postgresql://postgres:postgres@postgres:5432/employee_db?schema=public
JWT_SECRET=your_very_secure_jwt_secret_here
SWAGGER_SERVER_URL=https://mydreamday.shop
```

### 3단계: SSH 키 생성
```bash
# 서버에서 SSH 키 생성
ssh-keygen -t rsa -b 4096 -C "github-actions@mydreamday.shop"

# 공개키를 authorized_keys에 추가
cat ~/.ssh/id_rsa.pub >> ~/.ssh/authorized_keys

# 개인키 내용 확인 (GitHub Secrets에 추가할 키)
cat ~/.ssh/id_rsa
```

## 🔑 GitHub Secrets 설정

GitHub 저장소 → Settings → Secrets and variables → Actions에서 다음 값들을 추가:

### 필수 Secrets
| Secret 이름 | 설명 | 예시 값 |
|-------------|------|---------|
| `SERVER_HOST` | 서버 IP 주소 | `123.456.789.012` |
| `SERVER_USER` | 서버 사용자명 | `ubuntu` |
| `SERVER_SSH_KEY` | SSH 개인키 | `-----BEGIN OPENSSH PRIVATE KEY-----...` |
| `SERVER_PORT` | SSH 포트 | `22` |
| `PROJECT_PATH` | 프로젝트 경로 | `/opt/employee_project/backend` |

### 설정 방법
1. GitHub 저장소로 이동
2. **Settings** 탭 클릭
3. 왼쪽 메뉴에서 **Secrets and variables** → **Actions** 클릭
4. **New repository secret** 버튼 클릭
5. 위의 Secret들을 하나씩 추가

## 🚀 배포 테스트

### 1단계: 수동 배포 테스트
```bash
# 서버에서
cd /opt/employee_project/backend
./scripts/deploy.sh
```

### 2단계: GitHub에 푸시
```bash
# 로컬에서
git add .
git commit -m "Add automatic deployment setup"
git push origin main
```

### 3단계: GitHub Actions 확인
1. GitHub 저장소 → **Actions** 탭 클릭
2. **Deploy to Production Server** 워크플로우 실행 확인
3. 각 단계별 실행 상태 모니터링

## 📊 배포 모니터링

### GitHub Actions 로그 확인
- Actions 탭에서 실시간 로그 확인
- 실패 시 상세한 에러 메시지 확인

### 서버 상태 확인
```bash
# 서버에서
cd /opt/employee_project/backend

# 컨테이너 상태
docker compose ps

# 로그 확인
docker compose logs -f backend

# 헬스체크
curl http://localhost:3001/api/health
```

## 🔄 롤백 (긴급 상황)

### 자동 롤백
GitHub Actions에서 **Rollback Deployment** 워크플로우 실행:
1. Actions 탭에서 **Rollback Deployment** 선택
2. **Run workflow** 클릭
3. 필요시 특정 커밋 SHA 입력
4. **Run workflow** 클릭

### 수동 롤백
```bash
# 서버에서
cd /opt/employee_project/backend

# 이전 커밋으로 되돌리기
git reset --hard HEAD~1
git clean -fd

# 재배포
docker compose down
docker compose up -d --build
```

## 🛠️ 문제 해결

### 일반적인 문제들

#### 1. SSH 연결 실패
```bash
# 서버에서 SSH 서비스 상태 확인
sudo systemctl status ssh

# SSH 키 권한 확인
chmod 600 ~/.ssh/id_rsa
chmod 644 ~/.ssh/id_rsa.pub
```

#### 2. Docker 권한 문제
```bash
# Docker 그룹에 사용자 추가
sudo usermod -aG docker $USER

# 로그아웃 후 재로그인
exit
# 다시 SSH 접속
```

#### 3. 포트 충돌
```bash
# 사용 중인 포트 확인
sudo netstat -tlnp | grep :80
sudo netstat -tlnp | grep :443

# 충돌하는 서비스 중지
sudo systemctl stop nginx  # 예시
```

#### 4. 메모리 부족
```bash
# Docker 시스템 정리
docker system prune -a

# 디스크 공간 확인
df -h
```

## 📈 고급 설정

### 환경별 배포
- `main` 브랜치 → 프로덕션 서버
- `develop` 브랜치 → 스테이징 서버
- `feature/*` 브랜치 → 테스트 서버

### 알림 설정
- Slack, Discord, 이메일 등으로 배포 결과 알림
- 실패 시 즉시 알림

### 백업 전략
- 데이터베이스 자동 백업
- 코드 롤백을 위한 태그 관리

## 🎯 성공 지표

✅ **배포 성공 시 확인사항**
- GitHub Actions: 모든 단계 성공 (초록색)
- 서버 헬스체크: `200 OK` 응답
- 도메인 접속: `https://mydreamday.shop` 정상 작동
- Swagger 문서: `/api/docs` 접근 가능

## 📞 지원

문제가 발생하면:
1. GitHub Actions 로그 확인
2. 서버 로그 확인: `docker compose logs`
3. 헬스체크: `curl http://localhost:3001/api/health`
4. 필요시 롤백 워크플로우 실행

---

**🎉 자동 배포 설정이 완료되었습니다!** 이제 `git push origin main`만 하면 자동으로 서버에 배포됩니다.
