# Employee Project Backend (한국어 README)

직원/알바 출퇴근 관리와 급여 정산을 위한 백엔드 서버입니다. Express + Prisma + PostgreSQL 기반이며, Swagger 문서와 Docker 배포, GitHub Actions 자동 배포를 지원합니다.

## 주요 기능
- 인증/인가: JWT 기반 로그인, 리프레시 토큰, 권한(관리자/직원)
- 출퇴근: QR 기반 출근/퇴근 기록, 현재 상태 조회, 커서 기반 페이징 조회
- 관리자: 매장/직원 CRUD, QR 이미지 생성
- 급여: 월별 집계/직원별 상세/엑셀 다운로드
- 대시보드: 오늘 현황, 실시간 근무자, 최근 활동
- 문서화: Swagger UI(`/api/docs`)

## 기술 스택
- 런타임: Node.js 20 + TypeScript
- 서버: Express 5
- ORM: Prisma + PostgreSQL
- 보안: Helmet, Rate limit, CORS, JWT
- 검증: Zod
- 테스트: Jest + Supertest
- 배포: Docker Compose + (옵션) Caddy 리버스 프록시/TLS

## 프로젝트 구조 (백엔드)
```
backend/
├─ src/
│  ├─ app.ts                 # 앱 초기화, 미들웨어, 라우팅, 에러 핸들링
│  ├─ routes/                # 라우트 모듈 (/api 하위)
│  ├─ controllers/           # 컨트롤러 (비즈니스 로직)
│  ├─ middlewares/           # 인증/에러 등 미들웨어
│  ├─ db/prisma.ts           # Prisma 클라이언트
│  ├─ swagger.ts             # OpenAPI 스펙 + Swagger UI 설정
│  └─ utils/                 # 유틸리티(예: JWT)
├─ prisma/
│  ├─ schema.prisma          # DB 스키마
│  └─ migrations/            # 마이그레이션
├─ __tests__/                # 테스트 스위트(Jest + Supertest)
├─ Dockerfile
├─ docker-compose.yml        # backend (+ caddy) 스택
├─ Caddyfile                 # 도메인 리버스 프록시 (선택)
├─ scripts/
│  ├─ setup-server.sh        # 서버 초기 세팅 스크립트
│  └─ deploy.sh              # 서버 배포 스크립트
├─ docs/
│  └─ DEPLOYMENT.md          # 자동 배포 상세 가이드
├─ QUICK_DEPLOY.md           # 1분 배포 요약
├─ jest.config.js
├─ package.json
└─ tsconfig.json
```