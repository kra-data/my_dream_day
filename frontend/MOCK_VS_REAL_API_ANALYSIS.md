# Mock 데이터 vs 실제 API 구현 분석

현재 프론트엔드에서 Mock 데이터로 구현된 부분과 실제 API 구현이 필요한 부분을 상세히 분석합니다.

## 📊 현재 구현 상태 개요

### ✅ 실제 API 구현됨 (5개)
1. **로그인 API** - `POST /auth/login`
2. **직원 목록 조회** - `GET /admin/shops/{shopId}/employees`
3. **직원 등록** - `POST /admin/shops/{shopId}/employees`
4. **출근 처리** - `POST /attendance/clock-in`
5. **퇴근 처리** - `POST /attendance/clock-out`

### ⚠️ Mock 데이터로 구현됨 (12개)
1. **토큰 갱신** - `POST /auth/refresh`
2. **현재 근무 상태 조회** - `GET /attendance/current`
3. **출퇴근 기록 조회** - `GET /attendance/records`
4. **수동 출퇴근 처리** - `POST /admin/attendance/manual-*`
5. **급여 대시보드** - `GET /admin/payroll/dashboard`
6. **직원별 급여 목록** - `GET /admin/payroll/employees`
7. **직원 급여 상세** - `GET /admin/payroll/employees/{empId}`
8. **정산 정보 조회** - `GET /payroll/settlement/{empId}`
9. **정산 처리** - `POST /admin/payroll/settlement`
10. **직원 수정** - `PUT /admin/employees/{empId}`
11. **직원 삭제** - `DELETE /admin/employees/{empId}`
12. **통계 및 분석** - 다양한 analytics API

---

## 🔍 상세 분석

### 1. 인증 시스템 (Authentication)

#### ✅ 구현된 기능
- **로그인**: 이름 + 휴대폰 뒷4자리로 JWT 토큰 발급
- **JWT 토큰 디코딩**: 클라이언트에서 토큰 정보 추출
- **자동 로그아웃**: 토큰 만료 시 자동 처리

#### ⚠️ Mock으로 구현된 기능 (우선순위: 높음)
```javascript
// /stores/auth.js - refreshAccessToken()
const refreshAccessToken = async () => {
  // 현재: Mock으로 구현됨
  // 필요: POST /auth/refresh API
}
```

**구현 필요한 API:**
- `POST /auth/refresh`: 리프레시 토큰으로 액세스 토큰 갱신
- `POST /auth/logout`: 서버에서 리프레시 토큰 무효화

**Mock 데이터 위치:** `/stores/auth.js:235-272`

### 2. 출퇴근 관리 (Attendance)

#### ✅ 구현된 기능
- 출근/퇴근 처리: QR 코드 스캔으로 출퇴근 기록

#### ⚠️ Mock으로 구현된 기능 (우선순위: 높음)
```javascript
// /stores/attendance.js
const currentStatus = ref({
  // Mock 데이터로 관리됨
  clockInAt: null,
  clockOutAt: null,
  workedMinutes: 0
})

const employeeRecords = ref([]) // Mock 기록 데이터
```

**구현 필요한 API:**
1. **현재 상태 조회**: `GET /attendance/current`
   - 응답: `{ clockInAt?, clockOutAt?, workedMinutes, status }`
   
2. **기록 조회**: `GET /attendance/records?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD`
   - 응답: `[{ date, clockInAt, clockOutAt, workedMinutes }]`

3. **수동 출퇴근 처리** (관리자용):
   - `POST /admin/attendance/manual-clock-in`
   - `POST /admin/attendance/manual-clock-out`

**Mock 데이터 위치:** `/stores/attendance.js:전체`

### 3. 급여 관리 (Payroll) - 완전 Mock

#### ⚠️ 전체 Mock 구현됨 (우선순위: 중간)
```javascript
// /stores/salary.js - 모든 함수가 Mock
const generateMockPayrollDashboard = (year, month, employees) => {
  // 대시보드 통계 Mock 생성
}

const generateMockEmployeePayrolls = (employees) => {
  // 직원별 급여 Mock 생성
}

const getEmployeeSettlement = async (employeeId) => {
  // 7일 기준 정산 Mock 생성
}
```

**구현 필요한 API:**
1. **급여 대시보드**: `GET /admin/payroll/dashboard?year=2024&month=8`
2. **직원별 급여**: `GET /admin/payroll/employees?year=2024&month=8`
3. **급여 상세**: `GET /admin/payroll/employees/{empId}?year=2024&month=8`
4. **정산 정보**: `GET /payroll/settlement/{empId}`
5. **정산 처리**: `POST /admin/payroll/settlement`

**Mock 데이터 위치:** `/stores/salary.js:48-340`

### 4. 직원 관리 (Employee Management)

#### ✅ 구현된 기능
- 직원 목록 조회
- 직원 등록

#### ⚠️ Mock으로 구현된 기능 (우선순위: 중간)
```javascript
// /stores/employees.js
const updateEmployee = async (empId, employeeData) => {
  // API 호출은 있지만 실제 백엔드에서 미구현
}

const deleteEmployee = async (empId) => {
  // API 호출은 있지만 실제 백엔드에서 미구현
}
```

**구현 필요한 API:**
- `PUT /admin/employees/{empId}`: 직원 정보 수정
- `DELETE /admin/employees/{empId}`: 직원 삭제

**Mock 데이터 위치:** `/stores/employees.js:46-94` (개발용 임시 데이터)

### 5. 통계 및 분석 (Analytics) - 프론트엔드에서 계산

#### ⚠️ 클라이언트 계산으로 구현됨 (우선순위: 낮음)
```javascript
// /views/AdminAnalyticsView.vue
computed: {
  monthlyAttendanceStats() {
    // 출퇴근 데이터를 클라이언트에서 집계
    return attendanceRecords.reduce((stats, record) => {
      // 통계 계산 로직
    }, initialStats)
  }
}
```

**향후 구현 필요한 API:**
- `GET /admin/analytics/attendance`: 월별 출근 통계
- `GET /admin/analytics/employee-performance`: 직원별 성과 분석

---

## 🚨 즉시 구현 필요 (우선순위 높음)

### 1. 토큰 갱신 API
**현재 문제**: 토큰 만료 시 자동 로그아웃되어 사용성 저하
```
POST /auth/refresh
Request: { refreshToken: string }
Response: { accessToken: string, refreshToken?: string }
```

### 2. 현재 근무 상태 조회 API
**현재 문제**: 페이지 새로고침 시 출퇴근 상태 초기화
```
GET /attendance/current
Response: { 
  clockInAt?: string, 
  clockOutAt?: string, 
  workedMinutes: number,
  status: 'not_started' | 'working' | 'finished'
}
```

### 3. 출퇴근 기록 조회 API
**현재 문제**: 과거 출퇴근 기록을 볼 수 없음
```
GET /attendance/records?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
Response: [{ date: string, clockInAt: string, clockOutAt?: string, workedMinutes: number }]
```

---

## 📋 구현 우선순위

### Phase 1: 핵심 기능 (1-2주)
1. ✅ ~~로그인 API~~ (완료)
2. **토큰 갱신 API** ⚠️ (미구현)
3. **현재 근무 상태 조회** ⚠️ (미구현)
4. **출퇴근 기록 조회** ⚠️ (미구현)
5. **수동 출퇴근 처리** ⚠️ (미구현)

### Phase 2: 급여 관리 (2-3주)
1. **급여 대시보드 API** ⚠️ (미구현)
2. **직원별 급여 API** ⚠️ (미구현)
3. **정산 시스템 API** ⚠️ (미구현)

### Phase 3: 관리 기능 (3-4주)
1. **직원 수정/삭제 API** ⚠️ (미구현)
2. **통계 분석 API** ⚠️ (미구현)

---

## 💻 프론트엔드 수정 방법

각 Mock 구현을 실제 API로 교체할 때 수정해야 할 파일들:

### 1. 인증 관련
```javascript
// /stores/auth.js
// 수정 필요: refreshAccessToken() 함수
// 현재 Mock → 실제 API 호출로 변경
```

### 2. 출퇴근 관리
```javascript
// /stores/attendance.js
// 수정 필요: 전체 store 로직
// Mock 데이터 제거 → 실제 API 연동
```

### 3. 급여 관리
```javascript
// /stores/salary.js
// 수정 필요: generateMock* 함수들 제거
// 실제 API 호출로 교체
```

---

## 🔧 Mock → Real API 교체 가이드라인

1. **점진적 교체**: 한 번에 하나의 API씩 교체
2. **Fallback 유지**: API 실패 시 기본값 제공
3. **로딩/에러 상태**: 사용자 경험을 위한 상태 관리
4. **데이터 검증**: API 응답 데이터 구조 검증
5. **캐싱 고려**: 불필요한 API 호출 방지

---

## 📈 현재 시스템의 장점

1. **완전한 기능**: 모든 기능이 Mock이지만 완전히 동작함
2. **실제 UX**: 사용자는 완성된 시스템으로 인식
3. **개발 생산성**: 백엔드 완성 전에도 프론트엔드 완성도 높음
4. **테스트 가능**: 모든 시나리오 테스트 가능
5. **명확한 스펙**: API 스펙이 코드로 문서화됨

이러한 Mock 구현 방식으로 인해 실제 백엔드 API가 완성되면 빠르게 교체할 수 있는 기반이 마련되어 있습니다.