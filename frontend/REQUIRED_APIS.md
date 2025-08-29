# 필수 API 목록 (구현 필요)

이 문서는 현재 프론트엔드가 필요로 하는 백엔드 API 목록입니다. Mock 데이터로 임시 구현되어 있지만, 실제 운영을 위해서는 이 API들이 백엔드에 구현되어야 합니다.

## 1. 인증 관련 API

### 1.1 로그인 (구현됨)
- `POST /auth/login`
- 요청: `{ username, password }`
- 응답: `{ token, user: { empId, name, role, shopId, ... } }`

### 1.2 토큰 갱신 (구현 필요)
- `POST /auth/refresh`  
- 요청: `{ refreshToken }`
- 응답: `{ accessToken, refreshToken }`

## 2. 직원 관리 API

### 2.1 직원 목록 조회 (구현됨)
- `GET /admin/shops/{shopId}/employees`
- 응답: `[{ id, name, position, section, pay, payUnit, phone, ... }]`

### 2.2 직원 등록 (구현됨)
- `POST /admin/shops/{shopId}/employees`
- 요청: `{ name, nationalId, phone, position, section, pay, payUnit, ... }`

### 2.3 직원 수정 (구현 필요)
- `PUT /admin/employees/{empId}`
- 요청: `{ name, phone, position, section, pay, payUnit, ... }`

### 2.4 직원 삭제 (구현 필요)
- `DELETE /admin/employees/{empId}`

## 3. 출퇴근 관리 API

### 3.1 출근 처리 (구현됨)
- `POST /attendance/clock-in`
- 요청: `{ shopId }`
- 응답: `{ clockInAt, message }`

### 3.2 퇴근 처리 (구현됨)  
- `POST /attendance/clock-out`
- 요청: `{ shopId }`
- 응답: `{ clockOutAt, workedMinutes, message }`

### 3.3 현재 근무 상태 조회 (구현 필요)
- `GET /attendance/current`
- 응답: `{ clockInAt?, clockOutAt?, workedMinutes, status }`

### 3.4 출퇴근 기록 조회 (구현 필요)
- `GET /attendance/records`
- 쿼리: `?startDate=2024-01-01&endDate=2024-01-31`
- 응답: `[{ date, clockInAt, clockOutAt, workedMinutes }]`

### 3.5 관리자 수동 출퇴근 처리 (구현 필요)
- `POST /admin/attendance/manual-clock-in`
- 요청: `{ empId, shopId, clockInAt }`
- `POST /admin/attendance/manual-clock-out` 
- 요청: `{ empId, shopId, clockOutAt }`

## 4. 급여(Payroll) 관리 API (프론트엔드 연동 완료, 백엔드 구현 필요)

### 4.1 급여 대시보드 조회
- `GET /admin/shops/{shopId}/payroll/dashboard`
- 쿼리: `?year=2024&month=8`
- 응답: `{ year, month, expectedExpense, lastMonthExpense, employeeCount, totalWorkedMinutes }`

### 4.2 직원별 급여 목록 조회
- `GET /admin/shops/{shopId}/payroll/employees`
- 쿼리: `?year=2024&month=8`
- 응답: `[{ employeeId, name, position, salary, workedMinutes, daysWorked, ... }]`

### 4.3 직원 급여 상세 조회
- `GET /admin/shops/{shopId}/payroll/employees/{empId}`
- 쿼리: `?year=2024&month=8`
- 응답: `{ employee: { name, position }, salary, logs: [{ date, clockInAt, clockOutAt, workedMinutes }] }`

### 4.4 직원 정산 정보 조회 (7일 기준)
- `GET /admin/shops/{shopId}/payroll/settlement/{empId}`
- 응답: `{ currentPeriod: { amount, startDate, endDate, settled }, lastSettlement: { amount, settlementDate, settled } }`

### 4.5 정산 처리
- `POST /admin/shops/{shopId}/payroll/settlement`
- 요청: `{ startDate, endDate, totalAmount, employees: [{ employeeId, amount, workedMinutes }] }`

## 5. 통계 및 분석 API (구현 필요)

### 5.1 월별 출근 통계
- `GET /admin/analytics/attendance`
- 쿼리: `?year=2024&month=8`
- 응답: `{ totalWorkDays, avgWorkHours, lateCount, absentCount, overtimeCount }`

### 5.2 직원별 출근율 분석
- `GET /admin/analytics/employee-attendance`
- 쿼리: `?year=2024&month=8`
- 응답: `[{ empId, name, workDays, lateCount, absentCount, attendanceRate }]`

## 6. 매장 관리 API (구현 필요)

### 6.1 매장 정보 조회
- `GET /admin/shops/{shopId}`
- 응답: `{ id, name, qrCode, settings: { workStartTime, workEndTime } }`

### 6.2 매장 설정 업데이트
- `PUT /admin/shops/{shopId}/settings`
- 요청: `{ workStartTime, workEndTime, overtimeRate, ... }`

## 7. 에러 처리 및 상태 코드

모든 API는 다음 HTTP 상태 코드를 사용해야 합니다:
- `200`: 성공
- `201`: 생성 성공
- `400`: 잘못된 요청
- `401`: 인증 실패
- `403`: 권한 없음
- `404`: 리소스 없음
- `429`: 요청 제한 (Rate Limiting)
- `500`: 서버 오류

에러 응답 형식:
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "입력 데이터가 올바르지 않습니다",
    "details": ["이름은 필수 항목입니다"]
  }
}
```

## 8. 우선순위

### 높음 (즉시 구현 필요)
1. 토큰 갱신 API
2. 현재 근무 상태 조회 API
3. 출퇴근 기록 조회 API
4. 관리자 수동 출퇴근 처리 API

### 중간 (2주 내 구현)
1. ✅ **Payroll 관리 관련 모든 API** (프론트엔드 연동 완료)
2. 직원 수정/삭제 API
3. 매장 정보 관련 API

### 낮음 (1개월 내 구현)
1. 통계 및 분석 API
2. 고급 기능들

## 9. 현재 상태

✅ **구현됨**: 로그인, 직원 목록 조회, 직원 등록, 출퇴근 처리  
✅ **프론트엔드 연동 완료**: Payroll 관리 시스템 (백엔드 API 구현 대기 중)  
⚠️ **Mock 데이터 사용**: 통계 분석  
❌ **미구현**: 토큰 갱신, 수동 출퇴근, 직원 수정/삭제

---

**참고**: Payroll 관리 시스템은 프론트엔드에서 실제 API 엔드포인트로 연동되어 있으며, 백엔드에서 해당 API들이 구현되면 즉시 사용 가능합니다. 적절한 에러 처리와 404 처리도 포함되어 있습니다.