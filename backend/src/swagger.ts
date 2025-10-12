import { RequestHandler } from 'express';
import swaggerUi from 'swagger-ui-express';
const SWAGGER_BASE = process.env.SWAGGER_BASE_URL || '/';
// Minimal OpenAPI spec for current endpoints
export const swaggerDocument: any = {
  openapi: '3.0.0',
  info: {
    title: 'Employee Project API',
    version: '1.0.0',
    description: 'API documentation for the Employee Project backend'
  },
  servers: [
    { url: SWAGGER_BASE, description: 'Same-origin via reverse proxy' }
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT'
      }
    },
    schemas: {
      TokenPair: {
        type: 'object',
        properties: {
          accessToken: { type: 'string' },
          refreshToken: { type: 'string' }
        }
      },
      RefreshRequest: {
        type: 'object',
        required: ['token'],
        properties: { token: { type: 'string' } }
      },
      LogoutRequest: {
        type: 'object',
        required: ['token'],
        properties: { token: { type: 'string' } }
      },
      AttendanceRecord: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          date: { type: 'string', format: 'date' },
          clockInAt: { type: 'string', format: 'date-time' },
          clockOutAt: { type: 'string', format: 'date-time' },
          workedMinutes: { type: 'integer' },
          extraMinutes: { type: 'integer' },
          // 기존 components.schemas.AttendanceRecord.properties 에 아래 한 줄 추가
          settlementId: { type: 'integer', nullable: true, description: '정산 스냅샷 ID(있으면 정산됨)' }

        }
      },


      WorkShiftEmployeeUpdateRequest: {
        type: 'object',
        properties: {
          startAt: { type: 'string', format: 'date-time' },
          endAt:   { type: 'string', format: 'date-time' },
          memo: { type: 'string', maxLength: 500 }
        },
        description: 'startAt / endAt / memo 중 최소 1개 필요'
      },
      WorkShiftEmployeeUpdateResponse: {
        type: 'object',
        properties: {
          ok: { type: 'boolean', example: true },
          shift: {
            type: 'object',
            properties: {
              id: { type: 'integer' },
              shopId: { type: 'integer' },
              employeeId: { type: 'integer' },
              startAt: { type: 'string', format: 'date-time' },
             endAt:   { type: 'string', format: 'date-time', nullable: true },
              status:  { $ref: '#/components/schemas/WorkShiftStatus' },
              reviewReason: { $ref: '#/components/schemas/ShiftReviewReason', nullable: true },
              memo:   { type: 'string', nullable: true },
              updatedAt:    { type: 'string', format: 'date-time' }
            }
          }
        }
      },
      // ───────────────────────────────
      // Shifts (근무일정) 스키마 추가
      // ───────────────────────────────
      WorkShiftStatus: {
        type: 'string',
        enum: ['SCHEDULED','IN_PROGRESS','COMPLETED','CANCELED','REVIEW']
      },
      ShiftReviewReason: {
        type: 'string',
        enum: ['LATE_IN','EARLY_OUT','LATE_OUT','EXTENDED','NO_ATTENDANCE']
      },
WorkShift: {
  type: 'object',
  properties: {
    id:          { type: 'integer', example: 101 },
    shopId:      { type: 'integer', example: 1 },
    employeeId:  { type: 'integer', example: 42 },
    startAt:     { type: 'string', format: 'date-time', example: '2025-09-01T02:00:00.000Z' },
    endAt:       { type: 'string', format: 'date-time', nullable: true, example: '2025-09-01T10:00:00.000Z' },
    status:      { $ref: '#/components/schemas/WorkShiftStatus' },
          reviewReason:  { $ref: '#/components/schemas/ShiftReviewReason', nullable: true },
          memo:    { type: 'string', nullable: true },
          reviewResolvedAt: { type: 'string', format: 'date-time', nullable: true },
          finalPayAmount: { type: 'integer', nullable: true, example: 96000, description: '시급제: 확정 금액(원). 월급제: null' },

    // ✅ 실적 필드
    actualInAt:  { type: 'string', format: 'date-time', nullable: true },
    actualOutAt: { type: 'string', format: 'date-time', nullable: true },
    late:        { type: 'boolean', nullable: true, example: false },
    leftEarly:   { type: 'boolean', nullable: true, example: false },
adminChecked: { type: 'boolean', example: false, description: '관리자 체크 여부' },
    // ✅ 산출값(OUT 시 저장)
    workedMinutes: { type: 'integer', nullable: true, example: 480, description: '지급 인정 분(시프트 교집합)' },

    // ✅ 정산 연결
    settlementId: { type: 'integer', nullable: true, example: 123, description: 'PayrollSettlement.id' },

    // 메타
    createdBy:   { type: 'integer', nullable: true, example: 42 },
    updatedBy:   { type: 'integer', nullable: true, example: 1 },
    createdAt:   { type: 'string', format: 'date-time', nullable: true },
    updatedAt:   { type: 'string', format: 'date-time', nullable: true },
    notes:       { type: 'string', nullable: true }
  }
},// ✅ 새 요청 스키마 추가
ResolveReviewScheduleRequest: {
  type: 'object',
  required: ['startAt', 'endAt'],
  properties: {
    startAt: { type: 'string', format: 'date-time', example: '2025-09-09T10:00:00.000Z' },
    endAt:   { type: 'string', format: 'date-time', example: '2025-09-09T13:00:00.000Z' },
    memo:    { type: 'string', nullable: true, maxLength: 500, example: '종료시간 30분 보정' }
  }
},


      WorkShiftEmployeeLite: {
        type: 'object',
        properties: {
          name:     { type: 'string', example: '김직원' },
          position: { type: 'string', example: 'STAFF' },
          section:  { type: 'string', example: 'HALL' },
          pay:      { type: 'integer', nullable: true, example: 20000 },
          payUnit:  { type: 'string', nullable: true, enum: ['HOURLY','MONTHLY'], example: 'HOURLY' },
          personalColor: { type: 'string', nullable: true, pattern: '^#[0-9A-Fa-f]{6}$', example: '#1F6FEB' }
        }
      },
      WorkShiftWithEmployee: {
        allOf: [
          { $ref: '#/components/schemas/WorkShift' },
          {
            type: 'object',
            properties: {
              employee: { $ref: '#/components/schemas/WorkShiftEmployeeLite' }
            }
          }
        ]
      },
      // 생성 요청: ISO 모드
      WorkShiftCreateByIso: {
        type: 'object',
        required: ['startAt', 'endAt'],
        properties: {
          startAt: { type: 'string', format: 'date-time', example: '2025-09-01T02:00:00.000Z' },
          endAt:   { type: 'string', format: 'date-time', example: '2025-09-01T10:00:00.000Z' }
        }
      },
      // 생성 요청: Local(HH:MM) 모드
      WorkShiftCreateByLocal: {
        type: 'object',
        required: ['date', 'start', 'end'],
        properties: {
          date:  { type: 'string', example: '2025-09-01', description: 'KST 기준 날짜 (YYYY-MM-DD)' },
          start: { type: 'string', example: '11:00', description: 'KST HH:MM' },
          end:   { type: 'string', example: '19:00', description: 'KST HH:MM' }
        }
      },
      // 생성 요청: oneOf
      WorkShiftCreateRequest: {
        oneOf: [
          { $ref: '#/components/schemas/WorkShiftCreateByIso' },
          { $ref: '#/components/schemas/WorkShiftCreateByLocal' }
        ]
      },
      // 수정 요청
      WorkShiftUpdateRequest: {
        type: 'object',
        properties: {
          startAt: { type: 'string', format: 'date-time' },
          endAt:   { type: 'string', format: 'date-time' },
          status:  { $ref: '#/components/schemas/WorkShiftStatus' },
          actualInAt:  { type: 'string', format: 'date-time', description: '관리자 보정용: 실제 출근 시각' },
          actualOutAt: { type: 'string', format: 'date-time', description: '관리자 보정용: 실제 퇴근 시각' },
          late:        { type: 'boolean', description: '관리자 보정용: 지각 여부' },
          leftEarly:   { type: 'boolean', description: '관리자 보정용: 조퇴 여부' }
        }
      },
PayrollSettlement: {
  type: 'object',
  properties: {
    id:            { type: 'integer', example: 10 },
    shopId:        { type: 'integer', example: 1 },
    employeeId:    { type: 'integer', example: 42 },
    cycleStart:    { type: 'string', format: 'date-time', example: '2025-09-07T00:00:00.000Z' },
    cycleEnd:      { type: 'string', format: 'date-time', example: '2025-10-06T23:59:59.999Z' },
    workedMinutes: { type: 'integer', example: 13200 },
    basePay:       { type: 'integer', example: 2640000 },
    totalPay:      { type: 'integer', example: 2640000 },

    // 공제(프리랜서 3.3% 등) + 실지급
    incomeTax:      { type: 'integer', example: 79200, description: '소득세(원)' },
    localIncomeTax: { type: 'integer', example: 7920,  description: '지방소득세(원)' },
    otherTax:       { type: 'integer', example: 0 },
    netPay:         { type: 'integer', example: 2560880, description: '실지급액 = totalPay - (incomeTax+localIncomeTax+otherTax)' },

    // 메타
    settledAt:    { type: 'string', format: 'date-time', example: '2025-10-01T09:12:34.000Z' },
    processedBy:  { type: ['integer', 'null'], example: 1 },
    note:         { type: ['string', 'null'], example: '9월 정산' }
  }
},
SettlePreviousResponse: {
  type: 'object',
  properties: {
    ok: { type: 'boolean', example: true },
    settlement: { $ref: '#/components/schemas/PayrollSettlement' }
  }
},
PayrollCycleV2: {
  type: 'object',
  properties: {
    start:    { type: 'string', format: 'date-time', example: '2025-09-07T00:00:00.000Z' },
    end:      { type: 'string', format: 'date-time', example: '2025-10-06T23:59:59.999Z' },
    label:    { type: 'string', example: '9월 7일 ~ 10월 6일' },
    startDay: { type: 'integer', minimum: 1, maximum: 28, example: 7 }
  }
},
EmployeeSettlementStatus: {
  type: 'object',
  properties: {
    status: { type: 'string', enum: ['PENDING','PAID'], example: 'PENDING' },
    settlementId: { type: ['integer','null'], example: null },
    settledAt: { type: ['string','null'], format: 'date-time', example: null }
  }
},
PayrollEmployeeStatusListItem: {
  type: 'object',
  properties: {
    employeeId:   { type: 'integer', example: 1 },
    name:         { type: 'string',  example: '김철수' },
    position:     { type: 'string',  example: '매니저' },
    payUnit:      { type: 'string',  enum: ['HOURLY','MONTHLY'], example: 'HOURLY' },
    pay:          { type: ['integer','null'], example: 12000, description: '시급(원) 또는 월급(원)' },

    // 금액: 기본급만 (연장급액 제거)
    amount:       { type: 'integer', example: 2100000, description: '표시 급여액(세전). HOURLY는 확정합(sum finalPayAmount), MONTHLY는 월급' },

    // 근무량: 추가근무(초과분) 제거
    workedMinutes:{ type: 'integer', example: 10560, description: '지급 인정 분(payable) 합계' },
    daysWorked:   { type: 'integer', example: 22 },

    settlement: { $ref: '#/components/schemas/EmployeeSettlementStatus' }
  }
},
PayrollEmployeeStatusSummary: {
  type: 'object',
  properties: {
    employeeCount: { type: 'integer', example: 5 },
    paidCount:     { type: 'integer', example: 2 },
    pendingCount:  { type: 'integer', example: 3 },
    totalAmount:   { type: 'integer', example: 8360000, description: 'amount 합계(세전)' }
  }
},
PayrollEmployeeStatusListResponse: {
  type: 'object',
  properties: {
    year:  { type: 'integer', example: 2025 },
    month: { type: 'integer', example: 9 },
    cycle: { $ref: '#/components/schemas/PayrollCycleV2' },
    summary: { $ref: '#/components/schemas/PayrollEmployeeStatusSummary' },
    items: {
      type: 'array',
      items: { $ref: '#/components/schemas/PayrollEmployeeStatusListItem' }
    }
  }
},
PayrollEmployeeShiftLog: {
  type: 'object',
  properties: {
    id:            { type: 'integer', example: 901 },
    date:          { type: 'string', format: 'date', example: '2025-09-03' },
    plannedStart:  { type: 'string', format: 'date-time', example: '2025-09-03T00:00:00.000Z' },
    plannedEnd:    { type: 'string', format: 'date-time', example: '2025-09-03T08:00:00.000Z' },
    actualInAt:    { type: ['string','null'], format: 'date-time', example: '2025-09-03T00:03:00.000Z' },
    actualOutAt:   { type: ['string','null'], format: 'date-time', example: '2025-09-03T08:05:00.000Z' },
status:        { $ref: '#/components/schemas/WorkShiftStatus' },
    workedMinutes: { type: ['integer','null'], example: 480, description: '지급 인정 분' },
    finalPayAmount:{ type: ['integer','null'], example: 96000, description: '시급제: 확정 금액, 월급제: null' },
    settlementId:  { type: ['integer','null'], example: null }
  }
},
PayrollEmployeeStatusDetailResponse: {
  type: 'object',
  properties: {
    year:  { type: 'integer', example: 2025 },
    month: { type: 'integer', example: 9 },
    cycle: { $ref: '#/components/schemas/PayrollCycleV2' },
    settlement: { $ref: '#/components/schemas/EmployeeSettlementStatus' },
    employee: {
      type: 'object',
      properties: {
        id:       { type: 'integer', example: 1 },
        name:     { type: 'string',  example: '김철수' },
        position: { type: 'string',  example: '매니저' },
        payUnit:  { type: 'string',  enum: ['HOURLY','MONTHLY'], example: 'HOURLY' },
        pay:      { type: ['integer','null'], example: 12000 },
        accountNumber: { type: 'string',  example: '1234423321' },
                bank: { type: 'string',  example: '국민은행' },
      }
    },
    workedMinutes: { type: 'integer', example: 10560 },
    daysWorked:    { type: 'integer', example: 22 },
    amount:        { type: 'integer', example: 2100000, description: '표시 급여액(세전). 연장급액 없음' },
    logs: {
      type: 'array',
      items: { $ref: '#/components/schemas/PayrollEmployeeShiftLog' }
    }
  }
},
   AttendanceAdminRecord: {
     type: 'object',
     properties: {
       id: { type: 'integer' },
       shopId: { type: 'integer' },
       employeeId: { type: 'integer' },
       type: { $ref: '#/components/schemas/AttendanceType' },  // 'IN' | 'OUT'
       clockInAt:  { type: 'string', format: 'date-time', nullable: true },
       clockOutAt: { type: 'string', format: 'date-time', nullable: true },
       workedMinutes:  { type: 'integer', nullable: true, description: '저장된 지급인정 분 (없으면 교집합 보조계산)' },
       finalPayAmount: { type: 'integer', nullable: true, description: '시급제 확정 금액(원). 월급/미확정은 null' },
       extraMinutes: { type: 'integer', example: 0 },
       paired: { type: 'boolean', example: true, description: 'OUT 기록 존재 여부' },
       shiftId: { type: 'integer' },
       status: { $ref: '#/components/schemas/WorkShiftStatus' },
       memo: { type: 'string', nullable: true }
     }
   },
   CursorAttendanceAdminPage: {
     type: 'object',
     properties: {
       items: {
         type: 'array',
         items: { $ref: '#/components/schemas/AttendanceAdminRecord' }
       },
       nextCursor: { type: ['integer','null'], example: 987 }
     }
   },
// 필요 시 비고/옵션 입력용(바디 없이도 동작하게 optional)
SettleEmployeeRequest: {
  type: 'object',
  properties: {
    note: { type: 'string', maxLength: 500, nullable: true, example: '사장 확인 완료' }
  }
},
WorkShiftUpdateSummary: {
  type: 'object',
  properties: {
    workedMinutes: { type: 'integer', nullable: true, example: 480 },
    late:          { type: 'boolean', nullable: true, example: false },
    leftEarly:     { type: 'boolean', nullable: true, example: false },
    finalPayAmount:{ type: 'integer', nullable: true, example: 96000 },
    status:        { $ref: '#/components/schemas/WorkShiftStatus', nullable: true }
  }
},
WorkShiftUpdateResponse: {
  type: 'object',
  properties: {
    ok:    { type: 'boolean', example: true },
    shift: { $ref: '#/components/schemas/WorkShift' },
    summary: { $ref: '#/components/schemas/WorkShiftUpdateSummary' }
  }
},CursorWorkShiftPage: {
  type: 'object',
  properties: {
    items: {
      type: 'array',
      items: { $ref: '#/components/schemas/WorkShift' }
    },
    nextCursor: { type: ['integer', 'null'], example: 123 }
  }
},
CursorWorkShiftWithEmployeePage: {
  type: 'object',
  properties: {
    items: {
      type: 'array',
      items: { $ref: '#/components/schemas/WorkShiftWithEmployee' }
    },
    nextCursor: { type: ['integer', 'null'], example: 987 }
  }
},

      WorkShiftListResponse: {
        type: 'array',
        items: { $ref: '#/components/schemas/WorkShift' }
      },
      WorkShiftListWithEmployeeResponse: {
        type: 'array',
        items: { $ref: '#/components/schemas/WorkShiftWithEmployee' }
      },
      DashboardTodaySummary: {
        type: 'object',
        properties: {
          totalShifts: { type: 'integer', example: 17 },
          checkedIn:      { type: 'integer', example: 9 },
          late:           { type: 'integer', example: 2 },
          absent:         { type: 'integer', example: 1 }
        }
      },
      AttendanceType: {
        type: 'string',
        enum: ['IN','OUT']
      },
// 기존 ActiveEmployee 스키마를 아래로 교체
ActiveEmployee: {
  type: 'object',
  properties: {
    employeeId: { type: 'integer', example: 42 },
    name:       { type: 'string',  example: '김직원' },
    position:   { type: 'string',  nullable: true, example: '파트타이머' },
    section:    { type: 'string',  nullable: true, example: '홀' },

    // ✅ 새 필드
    status: {
      type: 'string',
      enum: ['ON_DUTY','REVIEW','OFF'],
      example: 'ON_DUTY',
      description: '현재 상태 코드'
    },
    statusLabel: {
      type: 'string',
      example: '출근중',
      description: 'UI용 라벨(출근중/리뷰상태/퇴근)'
    },

    // (선택) 출근중일 때만 존재
    clockInAt: {
      type: 'string',
      format: 'date-time',
      nullable: true,
      example: '2025-08-27T09:03:12.000Z',
      description: 'status=ON_DUTY일 때만 존재'
    }
  }
},

/** ✅ 생성 전용 요청 스키마 (nationalId 포함) */
EmployeeCreateRequest: {
  type: 'object',
  required: ['name','accountNumber','nationalId','bank','phone'],
  properties: {
    name:          { type: 'string', minLength: 1 },
    accountNumber: { type: 'string', minLength: 1, description: '계좌번호' },
    nationalId: {
      type: 'string',
      description: '주민등록번호(서버 측 암호화/마스킹 처리). 패턴: 6자리-7자리 또는 하이픈 없이 13자리',
      pattern: '^\\d{6}-?\\d{7}$',
      example: '900101-1234567'
    },
    bank:          { type: 'string', minLength: 1 },
    phone:         { type: 'string', minLength: 1, example: '010-1234-5678' },
    /** schedule은 any이지만, 권장 포맷을 명시하기 위해 oneOf 사용 */
    schedule: {
      description: '권장: WeeklySchedule. (서버는 any 허용)',
      oneOf: [
        { $ref: '#/components/schemas/WeeklySchedule' },
        { type: 'object', additionalProperties: true }
      ]
    },
    position:      { $ref: '#/components/schemas/Position' },
    section:       { $ref: '#/components/schemas/Section' },
    pay:           { type: 'number', minimum: 0, nullable: true },
    payUnit:       { $ref: '#/components/schemas/PayUnit', nullable: true },
    personalColor: {
      type: 'string',
      nullable: true,
      pattern: '^#[0-9A-Fa-f]{6}$',
      description: 'HEX 색상. 미지정 시 서버 기본값/NULL'
    }
  }
},

/** ✅ 수정 전용 요청 스키마 (nationalId 없음) */
EmployeeUpdateRequest: {
  type: 'object',
  description: '부분 업데이트: 보낸 필드만 수정됩니다.',
  properties: {
    name:          { type: 'string', minLength: 1 },
    accountNumber: { type: 'string', minLength: 1 },
    bank:          { type: 'string', minLength: 1 },
    phone:         { type: 'string', minLength: 1 },
    schedule: {
      description: '권장 포맷 WeeklySchedule (서버는 any 허용)',
      oneOf: [
        { $ref: '#/components/schemas/WeeklySchedule' },
        { type: 'object', additionalProperties: true }
      ]
    },
       nationalId: {
         type: 'string',
         pattern: '^\\d{6}-?\\d{7}$',
         description: '주민등록번호(서버에서 암호화/마스킹 저장)',
         example: '900101-1234567'
       },
    position:      { $ref: '#/components/schemas/Position' },
    section:       { $ref: '#/components/schemas/Section' },
    pay:           { type: 'number', minimum: 0 },
    payUnit:       { $ref: '#/components/schemas/PayUnit' },
    personalColor: {
      type: 'string',
      nullable: true,
      pattern: '^#[0-9A-Fa-f]{6}$',
      example: '#A7F3D0'
    }
  },
  additionalProperties: false
},

/** ✅ 응답용 스키마 (민감정보 제외) */
Employee: {
  type: 'object',
  properties: {
    id:            { type: 'integer' },
    shopId:        { type: 'integer' },
    name:          { type: 'string' },
    accountNumber: { type: 'string' },
    bank:          { type: 'string' },
    phone:         { type: 'string' },
    schedule: {
      description: '저장된 스케줄(JSON). 서버는 any를 저장하지만 일반적으로 WeeklySchedule 형태',
      oneOf: [
        { $ref: '#/components/schemas/WeeklySchedule' },
        { type: 'object', additionalProperties: true }
      ]
    },
    position:      { $ref: '#/components/schemas/Position' },
    section:       { $ref: '#/components/schemas/Section' },
    pay:           { type: 'integer', nullable: true },
    payUnit:       { $ref: '#/components/schemas/PayUnit', nullable: true },
    shopRole:          { type: 'string', example: 'employee' },
    personalColor: { type: 'string', nullable: true, pattern: '^#[0-9A-Fa-f]{6}$' },
    createdAt:     { type: 'string', format: 'date-time' },
    updatedAt:     { type: 'string', format: 'date-time' }
  }
},


WeeklySchedule: {
  type: 'object',
  description:
    '요일별 근무 계획. 각 요일 키(mon,tue,wed,thu,fri,sat,sun)는 선택적이며, 없으면 근무 없음.\n' +
    '각 요일 값은 { start:"HH:MM", end:"HH:MM" } 형식.',
  properties: {
    mon: { $ref: '#/components/schemas/DayShift' },
    tue: { $ref: '#/components/schemas/DayShift' },
    wed: { $ref: '#/components/schemas/DayShift' },
    thu: { $ref: '#/components/schemas/DayShift' },
    fri: { $ref: '#/components/schemas/DayShift' },
    sat: { $ref: '#/components/schemas/DayShift' },
    sun: { $ref: '#/components/schemas/DayShift' }
  },
  additionalProperties: false
},

DayShift: {
  type: 'object',
  required: ['start', 'end'],
  properties: {
    start: {
      type: 'string',
      description: '하루 시작 시간 (HH:MM, 24h)',
      pattern: '^\\d{2}:\\d{2}$',
      example: '09:00'
    },
    end: {
      type: 'string',
      description: '하루 종료 시간 (HH:MM, 24h)',
      pattern: '^\\d{2}:\\d{2}$',
      example: '18:00'
    }
  },
  additionalProperties: false
},

Position: {
  type: 'string',
enum: ['OWNER','MANAGER','STAFF','PART_TIME'],
  description: '직급(기본값: STAFF)'
},

Section: {
  type: 'string',
  enum: ['HALL', 'KITCHEN'],
  description: '근무 파트(기본값: HALL)'
},

PayUnit: {
  type: 'string',
  enum: ['MONTHLY', 'HOURLY'],
  description: '급여 단위'
},

ErrorResponse: {
  type: 'object',
  properties: {
    error: { type: 'string' },
    detail: { type: 'object', nullable: true }
  }
},

      RecentActivity: {
        type: 'object',
        properties: {
          id:            { type: 'integer', example: 1234 },
          type:          { $ref: '#/components/schemas/AttendanceType' },
          employeeId:    { type: 'integer', example: 42 },
          name:          { type: 'string', example: '김직원' },
          position:      { type: 'string', nullable: true, example: '파트타이머' },
          section:       { type: 'string', nullable: true, example: '주방' },
          clockInAt:     { type: 'string', format: 'date-time', nullable: true },
          clockOutAt:    { type: 'string', format: 'date-time', nullable: true },
          workedMinutes: { type: 'integer', nullable: true, example: 285 }
        }
      },
// swaggerDocument.components.schemas 안에 추가
// ── [components.schemas] 안에 다음을 교체/추가 ──

// ✅ 공통
AuthError: { type: 'object', properties: { error: { type: 'string' }, detail: { type: 'object', nullable: true } } },
ShopLite: {
  type: 'object',
  properties: {
    shopId:   { type: 'integer', example: 1 },
    name:     { type: 'string',  example: '길동분식' },
    shopRole: { type: 'string',  enum: ['OWNER'], example: 'OWNER' }
  }
},

// ✅ 사장님(ADMIN/OWNER) 전용
OwnerRegisterRequest: {
  type: 'object',
  required: ['loginId', 'password', 'name', 'phone', 'nationalId'],
  properties: {
    loginId:    { type: 'string', minLength: 1, example: 'boss01@gmail.com' },
    password:   { type: 'string', minLength: 8, example: 'P@ssw0rd!' },
    name:       { type: 'string', example: '홍길동' },

  }
},
OwnerRegisterResponse: {
  type: 'object',
  properties: {
    id:      { type: 'integer', example: 1 },
    loginId: { type: 'string', example: 'boss01' },
    phone:   { type: 'string', example: '01012345678' },
    name:    { type: 'string', example: '홍길동' }
  }
},

OwnerLoginRequest: {
  type: 'object',
  required: ['loginId', 'password'],
  properties: {
    loginId: { type: 'string', example: 'boss01' },
    password:{ type: 'string', example: 'P@ssw0rd!' },
    shopId:  { type: 'integer', nullable: true, example: 10, description: '소유 매장이 여러 개일 때 선택용(선택적)' }
  }
},
OwnerLoginResponse: {
  type: 'object',
  properties: {
    accessToken:      { type: ['string','null'] },
    refreshToken:     { type: ['string','null'] },
    selectedShopId:   { type: ['integer','null'] },
    selectedShopRole: { type: ['string','null'], enum: ['OWNER', null] },
    chooseRequired:   { type: 'boolean', example: false },
    shops:            { type: 'array', items: { $ref: '#/components/schemas/ShopLite' } }
  }
},

SelectShopRequest: {
  type: 'object',
  required: ['shopId'],
  properties: { shopId: { type: 'integer', example: 10 } }
},

RefreshRequestV2: {
  type: 'object',
  required: ['refreshToken'],
  properties: { refreshToken: { type: 'string' } }
},
RefreshResponseV2: {
  type: 'object',
  properties: {
    accessToken: { type: 'string' },
    refreshToken:{ type: 'string' },
    shopId:      { type: ['integer','null'] },
    shopRole:    { type: ['string','null'], enum: ['OWNER', 'EMPLOYEE', null] }
  }
},

LogoutRequestV2: {
  type: 'object',
  required: ['refreshToken'],
  properties: { refreshToken: { type: 'string' } }
},

MeResponse: {
  type: 'object',
  properties: {
    id:      { type: 'integer', example: 1 },
    loginId: { type: 'string',  example: 'boss01' },
    name:    { type: 'string',  example: '홍길동' },
    phone:   { type: 'string',  example: '01012345678' }
  }
},

// ✅ 직원 전용
EmployeeLoginRequest: {
  type: 'object',
  required: ['name','phoneLastFour'],
  properties: {
    name:          { type: 'string', example: '김직원' },
    phoneLastFour: { type: 'string', minLength: 4, maxLength: 4, example: '1234' }
  }
},
EmployeeLoginResponse: {
  type: 'object',
  properties: {
    accessToken: { type: 'string' },
    refreshToken:{ type: 'string' }
  }
},

SettleEmployeeCycleRequest: {
  type: 'object',
  required: ['year','month'],
  properties: {
    year: { type: 'integer', minimum: 2000, maximum: 2100, example: 2025 },
    month:{ type: 'integer', minimum: 1, maximum: 12, example: 9 },
    cycleStartDay: { type: 'integer', minimum: 1, maximum: 28, nullable: true, example: 7, description: '미지정 시 매장 payday 사용' },
  }
},
SettleEmployeeCycleResponse: {
  type: 'object',
  properties: {
    ok: { type: 'boolean', example: true },
    cycle: {
      type: 'object',
      properties: {
        start:    { type: 'string', format: 'date-time', example: '2025-09-07T00:00:00.000Z' },
        end:      { type: 'string', format: 'date-time', example: '2025-10-06T23:59:59.999Z' },
        startDay: { type: 'integer', example: 7 }
      }
    },
    employee: {
      type: 'object',
      properties: {
        id:      { type: 'integer', example: 42 },
        name:    { type: 'string',  example: '김직원' },
        payUnit: { type: 'string',  enum: ['HOURLY','MONTHLY'], example: 'HOURLY' }
      }
    },
    appliedShiftCount: { type: 'integer', example: 18, description: '이번 정산에 연결된 시프트 개수' },
    settlement: { $ref: '#/components/schemas/PayrollSettlement' }
  }
},
// swaggerDocument.components.schemas 안에 추가
SettleAllEmployeesCycleRequest: {
  type: 'object',
  required: ['year','month'],
  properties: {
    year: { type: 'integer', minimum: 2000, maximum: 2100, example: 2025 },
    month:{ type: 'integer', minimum: 1, maximum: 12, example: 9 },
    cycleStartDay: {
      type: 'integer', minimum: 1, maximum: 28, nullable: true, example: 7,
      description: '미지정 시 매장 payday 사용'
    },
  }
},
SettleAllEmployeesCycleCreatedItem: {
  type: 'object',
  properties: {
    employeeId: { type: 'integer', example: 1 },
    name:       { type: 'string',  example: '김철수' },
    payUnit:    { type: ['string','null'], enum: ['HOURLY','MONTHLY', null], example: 'HOURLY' },
    workedMinutes:   { type: 'integer', example: 10560 },
    basePay:         { type: 'integer', example: 2100000 },
    totalPay:        { type: 'integer', example: 2100000 },
    incomeTax:       { type: 'integer', example: 63000 },
    localIncomeTax:  { type: 'integer', example: 6300 },
    otherTax:        { type: 'integer', example: 0 },
    netPay:          { type: 'integer', example: 2030700 },
    settlementId:    { type: 'integer', example: 77 }
  }
},
SettleAllEmployeesCycleSkippedItem: {
  type: 'object',
  properties: {
    employeeId: { type: 'integer', example: 4 },
    name:       { type: 'string',  example: '박월급' },
    reason:     {
      type: 'string',
      enum: ['ALREADY_SETTLED','NO_CONFIRMED_SHIFTS','NO_PAY','NO_PAYUNIT','ERROR'],
      example: 'NO_PAY'
    },
    details: { type: 'string', nullable: true, example: 'pay=0' },
    settlementId: { type: 'integer', nullable: true, example: 55 }
  }
},
SettleAllEmployeesCycleResponse: {
  type: 'object',
  properties: {
    ok: { type: 'boolean', example: true },
    cycle: {
      type: 'object',
      properties: {
        start:    { type: 'string', format: 'date-time', example: '2025-09-07T00:00:00.000Z' },
        end:      { type: 'string', format: 'date-time', example: '2025-10-06T23:59:59.999Z' },
        startDay: { type: 'integer', example: 7 }
      }
    },
    createdCount: { type: 'integer', example: 3 },
    skippedCount: { type: 'integer', example: 2 },
    created: {
      type: 'array',
      items: { $ref: '#/components/schemas/SettleAllEmployeesCycleCreatedItem' }
    },
    skipped: {
      type: 'array',
      items: { $ref: '#/components/schemas/SettleAllEmployeesCycleSkippedItem' }
    }
  }
},

// ───────────────── Payroll Overview (프리랜서 3.3% 반영) ─────────────────
PayrollCycleLite: {
  type: 'object',
  properties: {
    start:    { type: 'string', format: 'date-time', example: '2025-09-07T00:00:00.000Z' },
    end:      { type: 'string', format: 'date-time', example: '2025-10-06T23:59:59.999Z' },
    label:    { type: 'string', example: '9월 7일 ~ 10월 6일' },
    startDay: { type: 'integer', minimum: 1, maximum: 28, example: 7 }
  }
},
PayrollOverviewFixed: {
  type: 'object',
  properties: {
    amount: { type: 'integer', example: 2500000, description: '고정급 합계(원). 현재는 0 또는 추후 확정 로직 반영' },
    withholding3_3: { type: 'integer', example: 82500, description: '프리랜서 원천징수 합계(소득세 3% + 지방세 0.3%)' },
    netAmount: { type: 'integer', example: 2417500, description: '세후 금액(3.3% 차감 후)' }
  }
},
PayrollOverviewHourly: {
  type: 'object',
  properties: {
    amount:     { type: 'integer', example: 394000, description: '시급 확정 합계(원): COMPLETED & finalPayAmount 존재만 포함' },
    shiftCount: { type: 'integer', example: 18 },
    withholding3_3: { type: 'integer', example: 13002, description: '프리랜서 원천징수 합계(≈3.3%)' },
    netAmount: { type: 'integer', example: 380998, description: '세후 금액(3.3% 차감 후)' }
  }
},
PayrollOverviewTotals: {
  type: 'object',
  properties: {
    // 세전
    expectedPayout: {
      type: 'integer',
      example: 394000,
      description: '세전 총 예상 지급액(원): 현재 사이클 fixed.amount + hourly.amount 합계'
    },
    previousExpectedPayout: {
      type: 'integer',
      example: 372000,
      description: '세전 총 예상 지급액(원, 전 사이클)'
    },
    deltaFromPrev: {
      type: 'integer',
      example: 22000,
      description: '세전 기준 전 사이클 대비 증감액(원) = expectedPayout - previousExpectedPayout'
    },

    // 세후
    expectedPayoutNet: {
      type: 'integer',
      example: 380998,
      description:
        '세후 총 예상 지급액(원): 프리랜서 원천징수율(rate) 적용 후 반올림. = expectedPayout - withholding3_3.current'
    },
    previousExpectedPayoutNet: {
      type: 'integer',
      example: 359724,
      description:
        '세후 총 예상 지급액(원, 전 사이클): 프리랜서 원천징수율(rate) 적용 후 반올림'
    },
    deltaFromPrevNet: {
      type: 'integer',
      example: 21274,
      description:
        '세후 기준 전 사이클 대비 증감액(원) = expectedPayoutNet - previousExpectedPayoutNet'
    },

    // 원천징수 요약(참고)
    withholding3_3: {
      type: 'object',
      properties: {
        current:  {
          type: 'integer',
          example: 13002,
          description: '이번 사이클 원천징수 합계(소득세 3% + 지방소득세 0.3%, 반올림)'
        },
        previous: {
          type: 'integer',
          example: 12276,
          description: '전 사이클 원천징수 합계(반올림)'
        },
        rate:     {
          type: 'number',
          example: 0.033,
          description: '적용 세율(기본 0.033). 서버 env(PAYROLL_WITHHOLDING_RATE)로 변경 가능'
        }
      }
    }
  }
},

PayrollOverviewMeta: {
  type: 'object',
  properties: {
    eligibleEmployees: { type: 'integer', example: 12, description: '급여 대상(급여 단가가 있는) 직원 수' }
  }
},
PayrollOverviewResponse: {
  type: 'object',
  properties: {
    year:  { type: 'integer', example: 2025 },
    month: { type: 'integer', example: 9 },
    cycle: { $ref: '#/components/schemas/PayrollCycleLite' },
    fixed: { $ref: '#/components/schemas/PayrollOverviewFixed' },
    hourly:{ $ref: '#/components/schemas/PayrollOverviewHourly' },
    totals:{ $ref: '#/components/schemas/PayrollOverviewTotals' },
    meta:  { $ref: '#/components/schemas/PayrollOverviewMeta' }
  }
},
      AttendanceCreateInRequest: {
        type: 'object',
        required: ['shopId','type'],
        properties: {
          shopId:  { type: 'integer', example: 123 },
          type:    { type: 'string', enum: ['IN'] },
          shiftId: { type: 'integer', example: 456, nullable: true, description: '선택(없으면 IN 시 자동 시프트 생성)' },
          memo:    { type: 'string', maxLength: 500, nullable: true },
          at:      { type: 'string', format: 'date-time', nullable: true }
        }
      },
      AttendanceCreateOutRequest: {
        type: 'object',
        required: ['shopId','shiftId','type'],
        properties: {
          shopId:  { type: 'integer', example: 123 },
          shiftId: { type: 'integer', example: 456 },
          type:    { type: 'string', enum: ['OUT'] },
          memo:    { type: 'string', maxLength: 500, nullable: true },
          at:      { type: 'string', format: 'date-time', nullable: true }
        }
      },
      AttendanceCreateRequest: {
        oneOf: [
          { $ref: '#/components/schemas/AttendanceCreateInRequest' },
          { $ref: '#/components/schemas/AttendanceCreateOutRequest' }
        ]
      },
      AttendanceConfirmInResponse: {
        type: 'object',
        properties: {
          ok: { type: 'boolean' },
          message: { type: 'string', example: '출근 완료' },
          clockInAt: { type: 'string', format: 'date-time' },
          shiftId: { type: 'integer', example: 456 },
          memo: { type: 'string', nullable: true, example: '버스 지연' }
        }
      },
      AttendancePreviewRequestIn: {
        type: 'object',
        required: ['shopId','type'],
        properties: {
          shopId:   { type: 'integer', example: 1 },
          type:     { type: 'string', enum: ['IN'] },
          shiftId:  { type: 'integer', example: 456, nullable: true, description: '선택(자동 생성 IN도 지원)' },
          scannedAt:{ type: 'string', format: 'date-time', nullable: true }
        }
      },
      AttendancePreviewRequestOut: {
        type: 'object',
        required: ['shopId','shiftId','type'],
        properties: {
          shopId:   { type: 'integer', example: 1 },
          shiftId:  { type: 'integer', example: 456 },
          type:     { type: 'string', enum: ['OUT'] },
          scannedAt:{ type: 'string', format: 'date-time', nullable: true }
        }
      },
      AttendancePreviewRequest: {
        oneOf: [
          { $ref: '#/components/schemas/AttendancePreviewRequestIn' },
          { $ref: '#/components/schemas/AttendancePreviewRequestOut' }
        ]
      },
      AttendancePreviewResponse: {
        type: 'object',
        properties: {
          ok:         { type: 'boolean', example: true },
          type:       { type: 'string', enum: ['IN','OUT'] },
          shopId:     { type: 'integer' },
          shiftId:    { type: 'integer' },
          scannedAt:  { type: 'string', format: 'date-time' },
          suggestedAt:{ type: 'string', format: 'date-time' },
          rounding:   { type: 'string', enum: ['NEAREST_HOUR','FLOOR_HOUR'] },
          label:      { type: 'string', example: '12:00 출근으로 제안' },
          message:    { type: 'string', example: '12시 00분 출근 맞습니까?' }
        }
      },
      AttendanceConfirmOutResponse: {
        type: 'object',
        properties: {
          ok: { type: 'boolean' },
          message: { type: 'string', example: '퇴근 완료' },
          clockOutAt: { type: 'string', format: 'date-time' },
          workedMinutes: { type: 'integer' },
          shiftId: { type: 'integer', example: 456 },
          finalPayAmount: { type: 'integer', nullable: true, example: 96000 },
          memo: { type: 'string', nullable: true, example: '컨디션 저하' },
          planned: {
            type: 'object',
            nullable: true,
            properties: { startAt: { type:'string',format:'date-time' }, endAt: { type:'string',format:'date-time', nullable: true } }
          }
        }
      },

     PayrollCycleWithNext: {
       type: 'object',
       properties: {
         start: { type: 'string', format: 'date-time', example: '2025-09-07T00:00:00.000Z' },
         end:   { type: 'string', format: 'date-time', example: '2025-10-06T23:59:59.999Z' },
         nextStart: { type: 'string', format: 'date-time', example: '2025-10-07T00:00:00.000Z' },
         label: { type: 'string', example: '9월 7일 ~ 10월 6일' },
         startDay: { type: 'integer', minimum: 1, maximum: 28, example: 7 }
       }
     },
     MonthRange: {
       type: 'object',
       properties: {
         start: { type: 'string', format: 'date-time', example: '2025-09-01T00:00:00.000Z' },
         end:   { type: 'string', format: 'date-time', example: '2025-09-30T23:59:59.999Z' },
         label: { type: 'string', example: '9월 1일 ~ 9월 30일' }
       }
     },
     SettlementDashboardKPI: {
       type: 'object',
       properties: {
         amountToSettle: { type: 'integer', description: '정산 대상 금액(원)', example: 0 },
         pendingEmployees: { type: 'integer', description: '미정산 직원 수', example: 0 },
         paidEmployees: { type: 'integer', description: '정산 완료 직원 수', example: 0 },
         workedMinutesThisMonth: { type: 'integer', description: '이번달 총 근무 분', example: 540 },
         workedDurationThisMonthLabel: { type: 'string', description: '이번달 총 근무시간 라벨', example: '9시간' },
         previousCyclePayout: { type: 'integer', description: '지난달 지출(직전 사이클 확정 합계, 원)', example: 0 }
       }
     },
     SettlementDashboardResponse: {
       type: 'object',
       properties: {
         year: { type: 'integer', example: 2025 },
         month:{ type: 'integer', example: 9 },
         cycle: { $ref: '#/components/schemas/PayrollCycleWithNext' },
         scheduledPayday: { type: 'string', format: 'date-time', description: '정산 예정일(다음 사이클 시작일)', example: '2025-10-07T00:00:00.000Z' },
         scheduledPaydayLabel: { type: 'string', description: 'YYYY. M. D. 표기', example: '2025. 10. 7.' },
         monthRange: { $ref: '#/components/schemas/MonthRange' },
         kpi: { $ref: '#/components/schemas/SettlementDashboardKPI' }
       }
     },

      MyProfileOverview: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          name: { type: 'string' },
          section: { type: 'string' },
          position: { type: 'string' },
          pay: { type: ['integer','null'] },
          payUnit: { type: ['string','null'], enum: ['HOURLY','MONTHLY', null] },
          phone: { type: 'string' },
          accountNumber: { type: 'string' },
          bank: { type: 'string' },
          lastMonthSettlementAmount: { type: ['integer','null'], description: '저번달 정산 실지급액(netPay)' },
          thisMonth: {
            type: 'object',
            properties: {
              workedMinutes: { type: 'integer' },
              workedHours: { type: 'number' }
            }
          },
          expectedTotalPay: { type: 'integer' },
          deductionAmount: { type: 'integer' },
          expectedNetPay: { type: 'integer' }
        }
      },
    }
  },
  security: [{ bearerAuth: [] }],
  paths: {
    '/api/health': {
      get: {
        tags: ['Health'],
        summary: 'Health check',
        responses: {
          '200': {
            description: 'Server is healthy'
          }
        }
      }
    },
// ── [paths] 아래의 /api/auth/* 섹션을 다음으로 교체 ──
'/api/admin/auth/register': {
  post: {
    tags: ['Auth (Owner)'],
    summary: '사장님 회원가입',
    requestBody: {
      required: true,
      content: { 'application/json': { schema: { $ref: '#/components/schemas/OwnerRegisterRequest' } } }
    },
    responses: {
      '201': { description: 'Created', content: { 'application/json': { schema: { $ref: '#/components/schemas/OwnerRegisterResponse' } } } },
      '400': { description: 'Bad Request' },
      '409': { description: 'Duplicate' }
    }
  }
},

'/api/admin/auth/login': {
  post: {
    tags: ['Auth (Owner)'],
    summary: '사장님 로그인(복수 매장일 경우 선택 흐름)',
    requestBody: {
      required: true,
      content: { 'application/json': { schema: { $ref: '#/components/schemas/OwnerLoginRequest' } } }
    },
    responses: {
      '200': { description: 'OK', content: { 'application/json': { schema: { $ref: '#/components/schemas/OwnerLoginResponse' } } } },
      '400': { description: 'Bad Request' },
      '401': { description: 'Invalid credentials' }
    }
  }
},

'/api/admin/auth/select-shop': {
  post: {
    tags: ['Auth (Owner)'],
    summary: '소유 매장 선택(로그인 이후)',
    security: [{ bearerAuth: [] }],
    requestBody: {
      required: true,
      content: { 'application/json': { schema: { $ref: '#/components/schemas/SelectShopRequest' } } }
    },
    responses: {
      '200': { description: 'OK', content: { 'application/json': { schema: { $ref: '#/components/schemas/OwnerLoginResponse' } } } },
      '400': { description: 'Bad Request' },
      '401': { description: 'Unauthorized' },
      '403': { description: 'Not an owner of the shop' }
    }
  }
},

'/api/auth/token/refresh': {
  post: {
    tags: ['Auth (Common)'],
    summary: '리프레시 토큰으로 재발급',
    requestBody: {
      required: true,
      content: { 'application/json': { schema: { $ref: '#/components/schemas/RefreshRequestV2' } } }
    },
    responses: {
      '200': { description: 'OK', content: { 'application/json': { schema: { $ref: '#/components/schemas/RefreshResponseV2' } } } },
      '401': { description: 'Unauthorized' },
      '403': { description: 'Invalid refresh token' }
    }
  }
},

'/api/auth/logout': {
  post: {
    tags: ['Auth (Common)'],
    summary: '로그아웃(리프레시 토큰 철회)',
    requestBody: {
      required: true,
      content: { 'application/json': { schema: { $ref: '#/components/schemas/LogoutRequestV2' } } }
    },
    responses: { '200': { description: 'OK' } }
  }
},

'/api/admin/auth/me': {
  get: {
    tags: ['Auth (Owner)'],
    summary: '내 정보 조회(사장님)',
    security: [{ bearerAuth: [] }],
    responses: {
      '200': { description: 'OK', content: { 'application/json': { schema: { $ref: '#/components/schemas/MeResponse' } } } },
      '401': { description: 'Unauthorized' }
    }
  }
},
// ── [paths]에 직원 로그인 엔드포인트 추가 (라우터: POST /employee/login/:shopId) ──
'/api/employee/auth/login/{shopId}': {
  post: {
    tags: ['Auth (Employee)'],
    summary: '직원 로그인(매장별)',
    parameters: [
      { name: 'shopId', in: 'path', required: true, schema: { type: 'integer' } }
    ],
    requestBody: {
      required: true,
      content: { 'application/json': { schema: { $ref: '#/components/schemas/EmployeeLoginRequest' } } }
    },
    responses: {
      '200': { description: 'OK', content: { 'application/json': { schema: { $ref: '#/components/schemas/EmployeeLoginResponse' } } } },
      '401': { description: 'Invalid credentials' },
      '404': { description: 'Shop/Employee not found' }
    }
  }
},
    '/api/attendance/me/status': {
      get: {
        tags: ['Attendance'],
        summary: '내 현재 출근 상태',
        responses: { '200': { description: 'OK' } }
      }
    },
'/api/admin/shops/{shopId}/payroll/overview': {
  get: {
    tags: ['Payroll'],
    summary: '급여 개요(사이클 기준 확정 합계)',
    description:
      'COMPLETED & finalPayAmount가 설정된 시급 시프트만 합산합니다(REVIEW/미확정 제외). ' +
      '세후/원천세는 프리랜서 기준(소득세 3% + 지방소득세=소득세의 10% → 총 3.3%)으로 산출합니다.',
    security: [{ bearerAuth: [] }],
    parameters: [
      { name: 'shopId', in: 'path', required: true, schema: { type: 'integer' } },
      { name: 'year', in: 'query', required: true, schema: { type: 'integer', minimum: 2000, maximum: 2100 } },
      { name: 'month', in: 'query', required: true, schema: { type: 'integer', minimum: 1, maximum: 12 } },
      { name: 'cycleStartDay', in: 'query', required: false, schema: { type: 'integer', minimum: 1, maximum: 28 },
        description: '사이클 시작일(기본: 매장 payday; 제공 시 override)' }
    ],
    responses: {
      '200': {
        description: 'OK',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/PayrollOverviewResponse' },
            examples: {
              sample: {
                value: {
                  year: 2025,
                  month: 9,
                  cycle: {
                    start: '2025-09-07T00:00:00.000Z',
                    end:   '2025-10-06T23:59:59.999Z',
                    label: '9월 7일 ~ 10월 6일',
                    startDay: 7
                  },
                  fixed: {
                    amount: 0,
                    withholding3_3: 0,
                    netAmount: 0
                  },
                  hourly: {
                    amount: 394000,
                    shiftCount: 18,
                    withholding3_3: 13002,
                    netAmount: 380998
                  },
                  totals: {
                    expectedPayout: 394000,
                    previousExpectedPayout: 372000,
                    deltaFromPrev: 22000,

                    expectedPayoutNet: 380998,
                    previousExpectedPayoutNet: 359724,
                    deltaFromPrevNet: 21274,

                    withholding3_3: {
                      current: 13002,
                      previous: 12276,
                      rate: 0.033
                    }
                  },
                  meta: { eligibleEmployees: 12 }
                }
              }
            }
          }
        }
      },
      '401': { description: 'Unauthorized' },
      '403': { description: 'Forbidden' },
      '404': { description: 'Shop not found' }
    }
  }
},
    '/api/admin/shops/{shopId}/payroll/summary': {
      get: {
        tags: ['Payroll'],
        summary: '정산관리 대시보드 요약',
        description:
          '선택한 연/월과 급여 사이클 기준으로 정산 요약 정보를 반환합니다.\n' +
          '- 정산 대상 금액, 미정산/정산 완료 인원 수\n' +
          '- 정산 예정일(다음 사이클 시작일)\n' +
          '- 이번달 총 근무시간(라벨 포함)\n' +
          '- 지난달 지출(직전 사이클 확정 합계)',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'shopId', in: 'path', required: true, schema: { type: 'integer' } },
          { name: 'year', in: 'query', required: true, schema: { type: 'integer', minimum: 2000, maximum: 2100 } },
          { name: 'month', in: 'query', required: true, schema: { type: 'integer', minimum: 1, maximum: 12 } },
          { name: 'cycleStartDay', in: 'query', required: false, schema: { type: 'integer', minimum: 1, maximum: 28 },
            description: '사이클 시작일(미지정 시 매장 payday 사용)' }
        ],
        responses: {
          '200': {
            description: 'OK',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/SettlementDashboardResponse' },
                examples: {
                  sample: {
                    value: {
                      year: 2025,
                      month: 9,
                      cycle: {
                        start: '2025-09-07T00:00:00.000Z',
                        end: '2025-10-06T23:59:59.999Z',
                        nextStart: '2025-10-07T00:00:00.000Z',
                        label: '9월 7일 ~ 10월 6일',
                        startDay: 7
                      },
                      monthRange: {
                        start: '2025-09-01T00:00:00.000Z',
                        end: '2025-09-30T23:59:59.999Z',
                        label: '9월 1일 ~ 9월 30일'
                      },
                      kpi: {
                        amountToSettle: 0,
                        pendingEmployees: 0,
                        paidEmployees: 0,
                        workedMinutesThisMonth: 540,
                        workedDurationThisMonthLabel: '9시간',
                        previousCyclePayout: 0
                      }
                    }
                  }
                }
              }
            }
          },
          '401': { description: 'Unauthorized' },
          '403': { description: 'Forbidden' },
          '404': { description: 'Not Found' }
        }
      }
    },

    '/api/admin/shops': {
      get: { tags: ['Admin'], summary: '매장 목록', responses: { '200': { description: 'OK' } } },
      post: { tags: ['Admin'], summary: '매장 생성', responses: { '201': { description: 'Created' }, '400': { description: 'Invalid payload' } } }
    },
    '/api/admin/shops/{shopId}': {
      put:  { tags: ['Admin'], summary: '매장 수정', parameters: [{ name: 'shopId', in: 'path', required: true, schema: { type: 'integer' } }], responses: { '200': { description: 'OK' }, '404': { description: 'Not Found' } } },
      delete: { tags: ['Admin'], summary: '매장 삭제', parameters: [{ name: 'shopId', in: 'path', required: true, schema: { type: 'integer' } }], responses: { '204': { description: 'No Content' } } }
    },
// swaggerDocument.paths 안에 추가
'/api/admin/shops/{shopId}/employees': {
  post: {
    tags: ['Employees'],
    summary: '직원 생성',
    description:
      '해당 매장(`shopId`)에 직원을 생성합니다.\n' +
      '- `accountNumber`, `phone`, `name`, `payUnit`, `pay`는 실사용 환경에서 필수로 쓰입니다.\n' +
      '- `schedule`은 요일별 `{ start: "HH:MM", end: "HH:MM" }` 형식이며, 미제공/요일 누락 시 그 요일은 근무 없음으로 간주됩니다.\n' +
      '- `personalColor`를 지정하지 않으면 서버 기본값(예: `#F5F5F5`)이 적용됩니다.',
    security: [{ bearerAuth: [] }],
    parameters: [
      { name: 'shopId', in: 'path', required: true, schema: { type: 'integer' } }
    ],
    requestBody: {
      required: true,
      content: {
        'application/json': {
          schema: { $ref: '#/components/schemas/EmployeeCreateRequest' },
          // (생성) /api/admin/shops/{shopId}/employees POST 의 requestBody.examples 교체/보강
examples: {
  hourly: {
    summary: '시급제 + 주민번호 포함',
    value: {
      name: '홍길동',
      accountNumber: '3333-12-3456789',
      nationalId: '900101-1234567',
      bank: '카카오뱅크',
      phone: '010-1234-5678',
      payUnit: 'HOURLY',
      pay: 12000,
      position: 'PART_TIME',
      section: 'HALL',
      personalColor: '#FDE68A',
      schedule: {
        mon: { start: '09:00', end: '13:00' },
        wed: { start: '14:00', end: '22:00' },
        fri: { start: '18:00', end: '23:00' }
      }
    }
  },
  monthly: {
    summary: '월급제 + 주민번호 포함',
    value: {
      name: '이월급',
      accountNumber: '110-123-456789',
      nationalId: '9202021234567',
      bank: '신한',
      phone: '010-9876-5432',
      payUnit: 'MONTHLY',
      pay: 2500000,
      position: 'STAFF',
      section: 'KITCHEN',
      personalColor: '#C7D2FE',
      schedule: {
        mon: { start: '09:00', end: '18:00' },
        tue: { start: '09:00', end: '18:00' },
        wed: { start: '09:00', end: '18:00' },
        thu: { start: '09:00', end: '18:00' },
        fri: { start: '09:00', end: '18:00' }
      }
    }
  }
}

        }
      }
    },
    responses: {
      '201': {
        description: 'Created',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/Employee' }
          }
        }
      },
      '400': { description: 'Bad Request(유효성 오류)' },
      '401': { description: 'Unauthorized' },
      '403': { description: 'Forbidden(관리자만 가능)' },
      '404': { description: 'Shop not found' },
      '409': { description: 'Conflict(중복 등 정책 위반)' }
    }
  },
  get: {
    tags: ['Employees'],
    summary: '직원 목록',
    description:
      '해당 매장(`shopId`)의 직원 목록을 조회합니다.\n' +
      '- 페이지네이션 파라미터가 있다면(예: `cursor`, `limit`) 서버 구현에 맞춰 추가로 기술하세요.',
    security: [{ bearerAuth: [] }],
    parameters: [
      { name: 'shopId', in: 'path', required: true, schema: { type: 'integer' } }
      // 필요 시 쿼리 파라미터 추가: { name: 'cursor', in:'query', schema:{type:'integer'} }, { name:'limit', in:'query', schema:{type:'integer', minimum:1, maximum:100}}
    ],
    responses: {
      '200': {
        description: 'OK',
        content: {
          'application/json': {
            schema: {
              type: 'array',
              items: { $ref: '#/components/schemas/Employee' }
            }
          }
        }
      },
      '401': { description: 'Unauthorized' },
      '403': { description: 'Forbidden' }
    }
  }
},

'/api/admin/shops/{shopId}/employees/{employeeId}': {
  put: {
    tags: ['Employees'],
    summary: '직원 수정',
    description:
      '직원 정보를 수정합니다. 부분 업데이트를 지원합니다.\n' +
      '- `payUnit` 변경 시 정산 정책이 달라질 수 있으므로 주의하세요.\n' +
      '- `schedule`은 전체 객체 교체(부분 갱신 지원 여부는 서버 구현에 따름).',
    security: [{ bearerAuth: [] }],
    parameters: [
      { name: 'shopId', in: 'path', required: true, schema: { type: 'integer' } },
      { name: 'employeeId', in: 'path', required: true, schema: { type: 'integer' } }
    ],
    requestBody: {
  required: true,
  content: {
    'application/json': {
      schema: { $ref: '#/components/schemas/EmployeeUpdateRequest' },
      examples: {
        allFields: {
          summary: '가능한 모든 필드 업데이트',
          value: {
            name: '홍길동(수정)',
            accountNumber: '3333-12-9999999',
            bank: '카카오뱅크',
            nationalId: "900101-1234567",
            phone: '010-1111-2222',
            schedule: {
              mon: { start: '10:00', end: '19:00' },
              tue: { start: '10:00', end: '19:00' },
              wed: { start: '10:00', end: '19:00' },
              thu: { start: '10:00', end: '19:00' },
              fri: { start: '10:00', end: '19:00' }
            },
            position: 'PART_TIME',
            section: 'HALL',
            payUnit: 'HOURLY',
            pay: 13000,
            personalColor: '#A7F3D0'
          }
        },
        partialMinimal: {
          summary: '부분 업데이트(이름만 변경)',
          value: {
            name: '이름만 바꿈'
          }
        },
        partialWage: {
          summary: '급여 정보만 변경',
          value: {
            payUnit: 'MONTHLY',
            pay: 2700000
          }
        }
      }
    }
  }
},
    responses: {
      '200': {
        description: 'OK',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/Employee' }
          }
        }
      },
      '400': { description: 'Bad Request' },
      '401': { description: 'Unauthorized' },
      '403': { description: 'Forbidden' },
      '404': { description: 'Employee/Shop not found' },
      '409': { description: 'Conflict(정책 위반/중복 등)' }
    }
  },
  delete: {
    tags: ['Employees'],
    summary: '직원 삭제',
    description:
      '직원을 삭제합니다. 참조 무결성 제약(정산/시프트 등)으로 인해 즉시 삭제가 불가할 수 있습니다.',
    security: [{ bearerAuth: [] }],
    parameters: [
      { name: 'shopId', in: 'path', required: true, schema: { type: 'integer' } },
      { name: 'employeeId', in: 'path', required: true, schema: { type: 'integer' } }
    ],
    responses: {
      '204': { description: 'No Content(삭제 완료)' },
      '401': { description: 'Unauthorized' },
      '403': { description: 'Forbidden' },
      '404': { description: 'Employee/Shop not found' },
      '409': { description: 'Conflict(관련 데이터로 삭제 불가)' }
    }
  }
},

'/api/admin/shops/{shopId}/payroll/export-xlsx': {
  get: {
    tags: ['Payroll'],
    summary: '급여 엑셀 다운로드(XLSX)',
    description:
      '사이클(년/월/시작일) 기준으로 확정된 시급 근로의 정산 내역을 엑셀로 다운로드합니다. ' +
      '세금은 프리랜서 원천징수 기준(소득세 3% + 지방소득세 0.3%)으로 계산하며, 기타세금은 0원으로 처리합니다.',
    security: [{ bearerAuth: [] }],
    parameters: [
      { name: 'shopId', in: 'path', required: true, schema: { type: 'integer' } },
      { name: 'year',   in: 'query', required: true, schema: { type: 'integer', minimum: 2000, maximum: 2100 } },
      { name: 'month',  in: 'query', required: true, schema: { type: 'integer', minimum: 1, maximum: 12 } },
      { name: 'cycleStartDay', in: 'query', required: false, schema: { type: 'integer', minimum: 1, maximum: 28 },
        description: '사이클 시작일(기본: 매장 payday; 제공 시 override)' },
              {
        name: 'includeSensitive',
        in: 'query',
        required: false,
        schema: { type: 'string', enum: ['0','1'], default: '0' },
        description: '1로 설정 시 엑셀에 주민번호(평문) 컬럼이 추가됩니다. 기본값 0(마스킹만).'
      },
      // (선택) 감사 사유
      {
        name: 'X-Admin-Action-Reason',
        in: 'header',
        required: false,
        schema: { type: 'string', maxLength: 200 },
        description: '감사로그용 사유(선택). 예: 급여이체 제출용'
      }
    ],
    responses: {
      '200': {
        description:
          'XLSX binary stream.\n' +
          '- 기본 컬럼: 세전/세후 금액 등 + **주민번호(마스킹)**\n' +
          '- `includeSensitive=1`일 때 **주민번호(평문)** 추가 컬럼이 뒤에 추가됩니다.',
        content: {
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': {
            schema: { type: 'string', format: 'binary' }
          }
        },
        headers: {
          'Content-Disposition': {
            schema: { type: 'string' },
            description: 'attachment; filename="payroll_<shop>_<YYYY-MM>.xlsx"'
          },

          // 캐시 금지/스니프 방지 헤더 명세
          'Cache-Control': {
            schema: { type: 'string', example: 'no-store, max-age=0' }
          },
          'Pragma': {
            schema: { type: 'string', example: 'no-cache' }
          },
          'X-Content-Type-Options': {
            schema: { type: 'string', example: 'nosniff' }
          }
        }
      },
      '401': { description: 'Unauthorized' },
      '403': { description: 'Forbidden' },
      '404': { description: 'Shop not found' }
    }
  }
},
  '/api/admin/shops/{shopId}/attendance/records': {
    get: {
      tags: ['Attendance (Admin)'],
      summary: '가게 출퇴근 목록(페이징)',
      description:
        '관리자/점주용 출퇴근 목록입니다. 저장된 workedMinutes/actualMinutes/finalPayAmount를 그대로 사용하며, 메모(memo)를 포함해 반환합니다.',
      security: [{ bearerAuth: [] }],
      parameters: [
        { name: 'shopId', in: 'path', required: true, schema: { type: 'integer' } },
        { name: 'employeeId', in: 'query', required: false, schema: { type: 'integer' } },
        { name: 'start', in: 'query', required: false, schema: { type: 'string', format: 'date-time' },
          description: 'actualInAt >= start' },
        { name: 'end', in: 'query', required: false, schema: { type: 'string', format: 'date-time' },
          description: 'actualOutAt <= end' },
        { name: 'cursor', in: 'query', required: false, schema: { type: 'integer' } },
        { name: 'limit', in: 'query', required: false, schema: { type: 'integer', minimum: 1, maximum: 50, default: 10 } }
      ],
      responses: {
        '200': {
          description: 'OK',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/CursorAttendanceAdminPage' },
              examples: {
                sample: {
                  value: {
                    items: [
                      {
                        id: 1234, shopId: 1, employeeId: 42, type: 'OUT',
                        clockInAt: '2025-09-05T08:30:00.000Z',
                        clockOutAt:'2025-09-05T17:30:00.000Z',
                        workedMinutes: 480,
                        finalPayAmount: 96000,
                        extraMinutes: 0,
                        paired: true,
                        shiftId: 1234,
                        status: 'COMPLETED',
                        memo: '조금 일찍 마감'
                      }
                    ],
                    nextCursor: null
                  }
                }
              }
            }
          }
        },
        '401': { description: 'Unauthorized' },
        '403': { description: 'Forbidden' }
      }
    }
  },

'/api/admin/shops/{shopId}/payroll/settlements': {
  post: {
    tags: ['Payroll'],
    summary: '사이클 전체 일괄 정산',
    description:
      '선택한 연/월 및 사이클 시작일 기준으로 **해당 매장 모든 직원**의 정산 스냅샷을 생성합니다.\n' +
      '- HOURLY: COMPLETED & settlementId=null 시프트의 **finalPayAmount 합**으로 계산. 없으면 건너뜀.\n' +
      '- MONTHLY: 월급 사용(근무가 0이어도 가능). pay가 없으면 건너뜀.\n' +
      '- 이미 해당 사이클로 정산된 직원은 건너뜀.\n' +
      '- 처리된 시프트는 생성된 settlementId로 연결됩니다.',
    security: [{ bearerAuth: [] }],
    parameters: [
      { name: 'shopId', in: 'path', required: true, schema: { type: 'integer' } }
    ],
    requestBody: {
      required: true,
      content: {
        'application/json': {
          schema: { $ref: '#/components/schemas/SettleAllEmployeesCycleRequest' },
          examples: {
            default: { value: { year: 2025, month: 9, cycleStartDay: 7 } },
          }
        }
      }
    },
    responses: {
      '201': {
        description: 'Created',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/SettleAllEmployeesCycleResponse' },
            examples: {
              sample: {
                value: {
                  ok: true,
                  cycle: {
                    start: '2025-09-07T00:00:00.000Z',
                    end: '2025-10-06T23:59:59.999Z',
                    startDay: 7
                  },
                  createdCount: 3,
                  skippedCount: 2,
                  created: [
                    {
                      employeeId: 1, name: '김철수', payUnit: 'HOURLY',
                      workedMinutes: 10560, basePay: 2100000, totalPay: 2100000,
                      incomeTax: 63000, localIncomeTax: 6300, otherTax: 0, netPay: 2030700,
                      settlementId: 77
                    }
                  ],
                  skipped: [
                    { employeeId: 4, name: '박월급', reason: 'NO_PAY' },
                    { employeeId: 7, name: '이미정산', reason: 'ALREADY_SETTLED', settlementId: 55 }
                  ]
                }
              }
            }
          }
        }
      },
      '400': { description: 'Bad Request' },
      '401': { description: 'Unauthorized' },
      '403': { description: 'Forbidden' },
      '404': { description: 'Shop not found' }
    }
  }
},


    '/api/admin/shops/{shopId}/qr': {
      get: { tags: ['QR'], summary: '매장 QR PNG 생성', parameters: [ { name:'shopId',in:'path',required:true,schema:{type:'integer'} }, { name:'download',in:'query',schema:{type:'integer', minimum:0, maximum:1} }, { name:'format', in:'query', schema:{ type:'string', enum:['raw','base64','json'] }, description:'QR 페이로드 포맷 (기본 raw)' } ], responses: { '200': { description: 'PNG' }, '404': { description: 'Not Found' } } }
    },
    // ... 기존 paths 아래에 이어서 추가
    '/api/admin/shops/{shopId}/dashboard/today': {
      get: {
        tags: ['Dashboard'],
        summary: '오늘 현황(근무일정 기준: 전체·출근·지각·결근)',
        description: '오늘(KST)과 교집합 있는 CANCELED 제외 모든 시프트를 대상으로, 출근/지각/결근을 시프트 단위로 집계합니다.',

        parameters: [
          { name: 'shopId', in: 'path', required: true, schema: { type: 'integer' } }
        ],
        responses: {
          '200': {
            description: 'OK',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/DashboardTodaySummary' }
              }
            }
          }
        }
      }
    },
    '/api/admin/shops/{shopId}/workshifts/{shiftId}/review/resolve': {
  post: {
    tags: ['Shifts (Admin)'],
    summary: 'REVIEW 해소(스케줄만 보정)',
    description:
      'REVIEW 상태의 근무일정에 대해 **실제 in/out(actual\*)은 그대로 두고** 계획 시간(startAt/endAt)만 수정하여 REVIEW를 해소합니다.\n' +
      '- `workedMinutes`는 **지각 유예 없이** `actualInAt~actualOutAt` 과 수정된 `startAt~endAt`의 **순수 교집합**으로 재계산합니다.\n' +
      '- `status`는 실제 기록 유무에 따라 SCHEDULED/IN_PROGRESS/COMPLETED 로 설정됩니다.\n' +
      '- `finalPayAmount`는 COMPLETED & HOURLY & workedMinutes 존재 시 `workedMinutes` 기준으로 재산출됩니다.\n' +
      '- 처리 시 `reviewResolvedAt`, `reviewedBy`가 기록됩니다.',
    security: [{ bearerAuth: [] }],
    parameters: [
      { name: 'shopId',  in: 'path', required: true, schema: { type: 'integer' } },
      { name: 'shiftId', in: 'path', required: true, schema: { type: 'integer' } }
    ],
    requestBody: {
      required: true,
      content: {
        'application/json': {
          schema: { $ref: '#/components/schemas/ResolveReviewScheduleRequest' },
          examples: {
            sample: {
              value: {
                startAt: '2025-09-09T10:00:00.000Z',
                endAt:   '2025-09-09T13:00:00.000Z',
                memo:    '종료 30분 보정'
              }
            }
          }
        }
      }
    },
    responses: {
      '200': {
        description: 'Resolved',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/WorkShiftUpdateResponse' },
            examples: {
              resolved: {
                value: {
                  ok: true,
                  shift: {
                    id: 321,
                    shopId: 1,
                    employeeId: 42,
                    startAt: '2025-09-09T10:00:00.000Z',
                    endAt:   '2025-09-09T13:00:00.000Z',
                    status:  'COMPLETED',
                    actualInAt:  '2025-09-09T10:05:00.000Z',
                    actualOutAt: '2025-09-09T13:02:00.000Z',
                    late: true,
                    leftEarly: false,
                    workedMinutes: 175,
                    finalPayAmount: 35000,
                    memo: '종료 30분 보정',
                    reviewResolvedAt: '2025-09-09T13:05:00.000Z',
                    reviewedBy: 1,
                    updatedAt: '2025-09-09T13:05:00.000Z'
                  },
                  summary: {
                    status: 'COMPLETED',
                    workedMinutes: 175,
                    finalPayAmount: 35000
                  }
                }
              }
            }
          }
        }
      },
      '400': { description: 'Invalid payload' },
      '401': { description: 'Unauthorized' },
      '403': { description: 'Forbidden' },
      '404': { description: 'REVIEW shift not found' },
      '409': { description: 'Overlap with another shift' }
    }
  }
},
    '/api/my/overview': {
      get: {
        tags: ['Me'],
        summary: '내 정보 개요(직원)',
        description:
          '직원이 자신의 기본 정보와 급여 개요를 조회합니다.\n' +
          '- 저번달 정산 금액: 저번달(달력 기준) 사이클 snapshot의 netPay\n' +
          '- 이번달 총 근무시간: 이번달 달력 기준, COMPLETED & actualOutAt 기준 집계\n' +
          '- 예상 급여/공제/실지급: 시급제는 확정금액 합(없으면 workedMinutes×시급 보정), 월급제는 월급 그대로. 공제율은 서버 env `PAYROLL_WITHHOLDING_RATE`(기본 0.033)를 사용',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': {
            description: 'OK',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/MyProfileOverview' } } }
          },
          '401': { description: 'Unauthorized' },
          '403': { description: 'Forbidden' }
        }
      }
    },
'/api/admin/shops/{shopId}/dashboard/active': {
  get: {
    tags: ['Dashboard'],
    summary: '직원 상태 목록(출근중/리뷰/퇴근)',
    description:
      '매장 모든 직원에 대해 현재 상태를 계산하여 반환합니다.\n' +
      '- 규칙: actualInAt && !actualOutAt → 출근중(ON_DUTY) / REVIEW 미해결 존재 → 리뷰상태(REVIEW) / 그 외 → 퇴근(OFF)\n' +
      '- 정렬: ON_DUTY → REVIEW → OFF, 같은 그룹 내에서는 이름 오름차순',
    parameters: [
      { name: 'shopId', in: 'path', required: true, schema: { type: 'integer' } }
    ],
    responses: {
      '200': {
        description: 'OK',
        content: {
          'application/json': {
            schema: {
              type: 'array',
              items: { $ref: '#/components/schemas/ActiveEmployee' }
            },
            examples: {
              sample: {
                value: [
                  {
                    employeeId: 1,
                    name: '김철수',
                    position: '매니저',
                    section: '홀',
                    status: 'ON_DUTY',
                    statusLabel: '출근중',
                    clockInAt: '2025-09-05T08:30:00.000Z'
                  },
                  {
                    employeeId: 2,
                    name: '이리뷰',
                    position: '스태프',
                    section: '주방',
                    status: 'REVIEW',
                    statusLabel: '리뷰상태',
                    clockInAt: null
                  },
                  {
                    employeeId: 3,
                    name: '박퇴근',
                    position: '스태프',
                    section: '홀',
                    status: 'OFF',
                    statusLabel: '퇴근',
                    clockInAt: null
                  }
                ]
              }
            }
          }
        }
      },
      '401': { description: 'Unauthorized' },
      '403': { description: 'Forbidden' }
    }
  }
},
    '/api/admin/shops/{shopId}/dashboard/recent': {
      get: {
        tags: ['Dashboard'],
        summary: '최근 출‧퇴근 활동',
        parameters: [
          { name: 'shopId', in: 'path', required: true, schema: { type: 'integer' } },
          {
            name: 'limit', in: 'query',
            description: '최대 100 (기본 30)',
            schema: { type: 'integer', minimum: 1, maximum: 100, default: 30 }
          }
        ],
        responses: {
          '200': {
            description: 'OK',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/RecentActivity' }
                }
              }
            }
          },
          '400': { description: 'Invalid limit' }
        }
      }
    },
    // 직원별 급여 현황 - 목록(추가근무/연장급액 제거)
'/api/admin/shops/{shopId}/payroll/employees': {
  get: {
    tags: ['Payroll'],
    summary: '직원별 급여 현황(목록) - 기본급만',
    description:
      '선택한 급여 사이클 기준으로 직원별 금액/근무시간/정산상태를 집계합니다.\n' +
      '- HOURLY: COMPLETED & finalPayAmount 합계(없으면 workedMinutes×시급)\n' +
      '- MONTHLY: 월급 그대로 사용\n' +
      '- 추가근무 및 연장급액 항목은 포함하지 않습니다.',
    security: [{ bearerAuth: [] }],
    parameters: [
      { name: 'shopId', in: 'path', required: true, schema: { type: 'integer' } },
      { name: 'year',   in: 'query', required: true,  schema: { type: 'integer', minimum: 2000, maximum: 2100 } },
      { name: 'month',  in: 'query', required: true,  schema: { type: 'integer', minimum: 1, maximum: 12 } },
      { name: 'cycleStartDay', in: 'query', required: false, schema: { type: 'integer', minimum: 1, maximum: 28 },
        description: '사이클 시작일(기본: 매장 설정값 또는 환경변수)' },
      { name: 'q', in: 'query', schema: { type: 'string' }, description: '직원명 검색(부분 일치)' },
      { name: 'position', in: 'query', schema: { type: 'string' }, description: '직위/역할 필터' },
      { name: 'settlement', in: 'query', schema: { type: 'string', enum: ['PENDING','PAID'] }, description: '정산 상태' },
      { name: 'sort', in: 'query', schema: { type: 'string', enum: ['amount','name','workedMinutes'], default: 'name' } },
      { name: 'order', in: 'query', schema: { type: 'string', enum: ['asc','desc'], default: 'asc' } }
    ],
    responses: {
      '200': {
        description: 'OK',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/PayrollEmployeeStatusListResponse' },
            examples: {
              sample: {
                value: {
                  year: 2025,
                  month: 9,
                  cycle: {
                    start: '2025-09-07T00:00:00.000Z',
                    end:   '2025-10-06T23:59:59.999Z',
                    label: '9월 7일 ~ 10월 6일',
                    startDay: 7
                  },
                  summary: { employeeCount: 5, paidCount: 2, pendingCount: 3, totalAmount: 8360000 },
                  items: [
                    {
                      employeeId: 1, name: '김철수', position: '매니저',
                      payUnit: 'HOURLY', pay: 12000,
                      amount: 2100000,
                      workedMinutes: 10560, daysWorked: 22,
                      settlement: { status: 'PENDING', settlementId: null, settledAt: null }
                    },
                    {
                      employeeId: 4, name: '정수진', position: '직원',
                      payUnit: 'MONTHLY', pay: 2500000,
                      amount: 2500000,
                      workedMinutes: 10080, daysWorked: 21,
                      settlement: { status: 'PAID', settlementId: 77, settledAt: '2025-09-08T09:00:00.000Z' }
                    }
                  ]
                }
              }
            }
          }
        }
      },
      '401': { description: 'Unauthorized' },
      '403': { description: 'Forbidden' },
      '404': { description: 'Not Found' }
    }
  }
},

// 직원별 급여 현황 - 상세(추가근무/연장급액 제거)
'/api/admin/shops/{shopId}/payroll/employees/{employeeId}': {
  get: {
    tags: ['Payroll'],
    summary: '직원별 급여 현황(상세) - 기본급만',
    description:
      '선택한 사이클에서 특정 직원의 합계 및 시프트 로그를 반환합니다.\n' +
      '- 추가근무 및 연장급액 항목은 포함하지 않습니다.',
    security: [{ bearerAuth: [] }],
    parameters: [
      { name: 'shopId', in: 'path', required: true, schema: { type: 'integer' } },
      { name: 'employeeId', in: 'path', required: true, schema: { type: 'integer' } },
      { name: 'year',   in: 'query', required: true,  schema: { type: 'integer', minimum: 2000, maximum: 2100 } },
      { name: 'month',  in: 'query', required: true,  schema: { type: 'integer', minimum: 1, maximum: 12 } },
      { name: 'cycleStartDay', in: 'query', required: false, schema: { type: 'integer', minimum: 1, maximum: 28 } }
    ],
    responses: {
      '200': {
        description: 'OK',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/PayrollEmployeeStatusDetailResponse' }
          }
        }
      },
      '401': { description: 'Unauthorized' },
      '403': { description: 'Forbidden' },
      '404': { description: 'Not Found' }
    }
  },
  post: {
  tags: ['Payroll'],
  summary: '지난 사이클 정산(스냅샷 저장)',
  description: '선택 연/월 + 사이클 시작일 기준으로 특정 직원의 직전 사이클을 정산합니다.',
  security: [{ bearerAuth: [] }],
  parameters: [
    { name: 'shopId', in: 'path', required: true, schema: { type: 'integer' } },
    { name: 'employeeId', in: 'path', required: true, schema: { type: 'integer' } }
  ],
  requestBody: {
    required: true,
    content: {
      'application/json': {
        schema: { $ref: '#/components/schemas/SettleEmployeeCycleRequest' },
        examples: {
          hourly: {
            value: { year: 2025, month: 9, cycleStartDay: 7 }
          },
          monthlyWithNote: {
            value: { year: 2025, month: 9, note: '9월 급여 확정' }
          },
          forceWithholding: {
            value: { year: 2025, month: 9, cycleStartDay: 7, forceWithholding: true }
          }
        }
      }
    }
  },
  responses: {
    '201': {
      description: 'Created',
      content: {
        'application/json': {
          schema: { $ref: '#/components/schemas/SettlePreviousResponse' }
        }
      }
    },
    '400': { description: 'Invalid payload / 확정 근무 없음' },
    '401': { description: 'Unauthorized' },
    '403': { description: 'Forbidden' },
    '404': { description: 'Shop/Employee not found' },
    '409': { description: 'Already settled for this cycle' }
  }
},
},

    '/api/my/workshifts': {
      get: {
        tags: ['Shifts'],
        summary: '내 근무일정 목록',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'from', in: 'query', required: false, schema: { type: 'string', format: 'date-time' } },
          { name: 'to',   in: 'query', required: false, schema: { type: 'string', format: 'date-time' } },
          { name: 'status', in: 'query', required: false, schema: { $ref: '#/components/schemas/WorkShiftStatus' } }
        ],
        responses: {
          '200': {
            description: 'OK',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/WorkShiftListResponse' },
                examples: {
                  sample: {
                    value: [
                      { id: 101, shopId: 1, employeeId: 42, startAt: '2025-09-01T02:00:00.000Z', endAt: '2025-09-01T10:00:00.000Z', status: 'SCHEDULED' }
                    ]
                  }
                }
              }
            }
          },
          '401': { description: 'Unauthorized' }
        }
      },
      post: {
        tags: ['Shifts'],
        summary: '내 근무일정 생성',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/WorkShiftCreateRequest' },
              examples: {
                iso:   { value: { startAt: '2025-09-01T02:00:00.000Z', endAt: '2025-09-01T10:00:00.000Z' } },
                local: { value: { date: '2025-09-01', start: '11:00', end: '19:00' } }
              }
            }
          }
        },
        responses: {
          '201': {
            description: 'Created',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/WorkShift' }
              }
            }
          },
          '400': { description: 'Invalid payload' },
          '401': { description: 'Unauthorized' },
          '409': { description: 'Conflict (overlap)' }
        }
      }
    },

    '/api/admin/shops/{shopId}/workshifts': {
      get: {
        tags: ['Shifts (Admin)'],
        summary: '가게 전체 근무일정 목록',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'shopId', in: 'path', required: true, schema: { type: 'integer' } },
          { name: 'from',   in: 'query', required: false, schema: { type: 'string', format: 'date-time' } },
          { name: 'to',     in: 'query', required: false, schema: { type: 'string', format: 'date-time' } },
          { name: 'employeeId', in: 'query', required: false, schema: { type: 'integer' } },
          { name: 'status', in: 'query', required: false, schema: { $ref: '#/components/schemas/WorkShiftStatus' } }
        ],
        responses: {
          '200': {
            description: 'OK',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/WorkShiftListWithEmployeeResponse' },
                examples: {
                  sample: {
                    value: [
                      {
                        id: 201, shopId: 1, employeeId: 42,
                        startAt: '2025-09-01T02:00:00.000Z', endAt: '2025-09-01T10:00:00.000Z', status: 'SCHEDULED',
                        employee: { name: '김직원', position: 'STAFF', section: 'HALL',pay:20000,payUnit:"HOURLY"  }
                      }
                    ]
                  }
                }
              }
            }
          },
          '401': { description: 'Unauthorized' },
          '403': { description: 'Forbidden' }
        }
      }
    },
    '/api/attendance/preview': {
      post: {
        tags: ['Attendance'],
        summary: 'QR 스캔 시 출/퇴근 시간 제안(미리보기)',
        description:
          'QR 스캔 이후 모달에 표시할 제안 시간을 계산합니다. \n' +
          '- 출근(IN): **가까운 정시로 반올림**(KST 기준, 분≥30 올림)\n' +
          '- 퇴근(OUT): **정시로 내림**(KST 기준)',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/AttendancePreviewRequest' },
              examples: {
                clockInExample: { value: { shopId: 1, type: 'IN',  scannedAt: '2025-09-05T02:55:12.000Z' } },
                clockOutExample:{ value: { shopId: 1, shiftId: 456, type: 'OUT', scannedAt: '2025-09-05T01:03:45.000Z' } }
              }
            }
          }
        },
        responses: {
          '200': {
            description: 'OK',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/AttendancePreviewResponse' } }
            }
          },
          '400': { description: 'Invalid payload' },
          '401': { description: 'Unauthorized' },
          '403': { description: 'Forbidden' }
        }
      }
    },
    '/api/attendance': {
      post: {
        tags: ['Attendance'],
        summary: '출퇴근 기록 생성/마감 (모달에서 선택한 시간 저장)',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
                            schema: { $ref: '#/components/schemas/AttendanceCreateRequest' },
              examples: {
                inWithChosenTime:  { value: { shopId: 1,type: 'IN',  at: '2025-09-05T03:00:00.000Z' } },
                outWithChosenTime: { value: { shopId: 1, shiftId: 123, type: 'OUT', at: '2025-09-05T10:00:00.000Z' } },
                noteIncluded:      { value: { shopId: 1,  type: 'IN',  at: '2025-09-05T03:00:00.000Z', memo: '버스 지연' } }
              }
            }
          }
        },
        responses: {
          '200': {
            description: 'OK',
            content: {
              'application/json': {
                schema: {
                  oneOf: [
                    { $ref: '#/components/schemas/AttendanceConfirmInResponse' },
                    { $ref: '#/components/schemas/AttendanceConfirmOutResponse' }
                  ]
                },
                examples: {
                  in:  { value: { ok:true, message:'출근 완료', clockInAt:'2025-09-05T08:30:00.000Z', shiftId:456 } },
                  out: { value: { ok:true, message:'퇴근 완료', clockOutAt:'2025-09-05T13:00:00.000Z', workedMinutes:480,planned:null, shiftId:456 } }
                }
            }
          },
          '400': { description: 'Bad Request (순서 위반 등)' },
          '403': { description: 'Forbidden (다른 가게 QR/권한 없음)' }
        }
      }
    }},
    '/api/admin/shops/{shopId}/workshifts/review': {
  get: {
    tags: ['Shifts (Admin)'],
    summary: 'REVIEW 상태 근무일정 목록',
    security: [{ bearerAuth: [] }],
    parameters: [
      { name: 'shopId', in: 'path', required: true, schema: { type: 'integer' } },
      { name: 'employeeId', in: 'query', schema: { type: 'integer' } },
      { name: 'from', in: 'query', schema: { type: 'string', format: 'date-time' } },
      { name: 'to', in: 'query', schema: { type: 'string', format: 'date-time' } },
      { name: 'cursor', in: 'query', schema: { type: 'integer' } },
      { name: 'limit', in: 'query', schema: { type: 'integer', default: 20, minimum: 1, maximum: 100 } },
      { name: 'unresolvedOnly', in: 'query', schema: { type: 'string', enum: ['0','1','true','false'], default: '1' },
        description: '기본 true(미해결만). 0/false면 모든 REVIEW 노출' }
    ],
    responses: {
      '200': {
        description: 'OK',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                items: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      id: { type: 'integer' },
                      shopId: { type: 'integer' },
                      employeeId: { type: 'integer' },
                      startAt: { type: 'string', format: 'date-time' },
                      endAt: { type: 'string', format: 'date-time', nullable: true  },
                      status: { $ref: '#/components/schemas/WorkShiftStatus' },
                      reviewReason: { $ref: '#/components/schemas/ShiftReviewReason' },
                      memo: { type: 'string', nullable: true },
                      reviewResolvedAt:{ type: 'string', format: 'date-time', nullable: true },
                      actualInAt: { type: 'string', format: 'date-time', nullable: true },
                      actualOutAt:{ type: 'string', format: 'date-time', nullable: true },
                      late: { type: 'boolean', nullable: true },
                      leftEarly: { type: 'boolean', nullable: true },
                      workedMinutes: { type: 'integer', nullable: true },
                      employee: {
                        type: 'object',
                        properties: {
                          name: { type: 'string' },
                          position: { type: 'string' },
                          section: { type: 'string' },
                          personalColor: { type: 'string', nullable: true, pattern: '^#[0-9A-Fa-f]{6}$' }
                        }
                      }
                    }
                  }
                },
                nextCursor: { type: 'integer', nullable: true }
              }
            }
          }
        }
      },
      '401': { description: 'Unauthorized' },
      '403': { description: 'Forbidden' }
    }
  }
},
    '/api/my/workshifts/today': {
      get: {
        tags: ['Shifts'],
        summary: '오늘 내 근무일정',
        description: 'KST 기준 오늘과 교집합이 있는 내 근무일정을 조회합니다. activeOnly=1|true 이면 COMPLETED/CANCELED 제외.',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'activeOnly',
            in: 'query',
            required: false,
            schema: { type: 'boolean' },
            description: 'true/1 이면 완료·취소 일정 제외'
          }
        ],
        responses: {
          '200': {
            description: 'OK',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/WorkShiftListResponse' }
              }
            }
          },
          '401': { description: 'Unauthorized' }
        }
      }
    },
    '/api/admin/shops/{shopId}/employees/{employeeId}/workshifts': {
      post: {
        tags: ['Shifts (Admin)'],
        summary: '특정 직원 근무일정 생성',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'shopId', in: 'path', required: true, schema: { type: 'integer' } },
          { name: 'employeeId', in: 'path', required: true, schema: { type: 'integer' } }
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/WorkShiftCreateRequest' },
              examples: {
                iso:   { value: { startAt: '2025-09-02T02:00:00.000Z', endAt: '2025-09-02T10:00:00.000Z' } },
                local: { value: { date: '2025-09-02', start: '11:00', end: '19:00' } }
              }
            }
          }
        },
        responses: {
          '201': {
            description: 'Created',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/WorkShift' } }
            }
          },
          '400': { description: 'Invalid payload' },
          '401': { description: 'Unauthorized' },
          '403': { description: 'Forbidden' },
          '404': { description: 'Not Found' },
          '409': { description: 'Conflict (overlap)' }
        }
      }
    },
        '/api/my/workshifts/{shiftId}': {
      put: {
        tags: ['Shifts'],
        summary: '내 근무일정 수정 (항상 REVIEW 전환)',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'shiftId', in: 'path', required: true, schema: { type: 'integer' } }
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/WorkShiftEmployeeUpdateRequest' },
              examples: {
                changeTime: {
                  value: {
                    startAt: '2025-09-10T00:00:00.000Z',
                    endAt: '2025-09-10T08:00:00.000Z',
                    memo: '개인 사정으로 30분 당김'
                  }
                },
                noteOnly: {
                  value: {
                    memo: '출근을 깜빡해서 09:10에 찍었습니다. 확인 부탁드려요.'
                  }
                }
              }
            }
          }
        },
        responses: {
          '200': { description: 'Updated', content: { 'application/json': { schema: { $ref: '#/components/schemas/WorkShiftEmployeeUpdateResponse' } } } },
          '400': { description: 'Invalid payload' },
          '401': { description: 'Unauthorized' },
          '403': { description: 'Forbidden' },
          '404': { description: 'Not Found' },
          '409': { description: 'Conflict (overlap / completed shift)' }
        }
      },
            delete: {
       tags: ['Shifts'],
       summary: '내 근무일정 삭제',
       description: '직원이 자신의 시프트를 삭제합니다. 이미 시작되었거나 완료/취소되었거나 정산 연결된 시프트는 삭제할 수 없습니다.',
       security: [{ bearerAuth: [] }],
       parameters: [
         { name: 'shiftId', in: 'path', required: true, schema: { type: 'integer' } }
       ],
       responses: {
         '204': { description: 'No Content(삭제 완료)' },
         '400': { description: 'Bad Request(shiftId 잘못됨)' },
         '401': { description: 'Unauthorized' },
         '403': { description: 'Forbidden' },
         '404': { description: 'Not Found(내 시프트 아님/존재 안 함)' },
         '409': { description: 'Conflict(이미 시작/완료/취소/정산 연결)' }
       }
     }
    },
    '/api/admin/shops/{shopId}/workshifts/{shiftId}': {
      put: {
        tags: ['Shifts (Admin)'],
        summary: '근무일정/출퇴근 수정(관리자 보정)',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'shopId', in: 'path', required: true, schema: { type: 'integer' } },
          { name: 'shiftId', in: 'path', required: true, schema: { type: 'integer' } }
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/WorkShiftUpdateRequest' },
              examples: {
                scheduleOnly: { value: { startAt: '2025-09-01T03:00:00.000Z', endAt: '2025-09-01T11:00:00.000Z', status: 'SCHEDULED' } },
                fixAttendance: { value: { actualInAt: '2025-09-01T02:58:00.000Z', actualOutAt: '2025-09-01T11:07:00.000Z', late: false, leftEarly: false, status: 'COMPLETED' } }
              }
            }
          }
        },
        responses: {
        '200': {
       description: 'Updated',
        content: {
      'application/json': {
        schema: { $ref: '#/components/schemas/WorkShiftUpdateResponse' },
        examples: {
          completed: {
            value: {
              ok: true,
              shift: {
                id: 123, shopId: 1, employeeId: 42,
                startAt: '2025-09-01T02:00:00.000Z', endAt: '2025-09-01T10:00:00.000Z',
                status: 'COMPLETED',
                actualInAt: '2025-09-01T02:58:00.000Z',
                actualOutAt:'2025-09-01T11:07:00.000Z',
                late: false, leftEarly: false, workedMinutes: 480,
                settlementId: null
              },
              summary: { workedMinutes: 480, late: false, leftEarly: false }
            }
          }
        }
      }
    }
  },
  '400': { description: 'Invalid payload' },
  '401': { description: 'Unauthorized' },
  '403': { description: 'Forbidden' },
  '404': { description: 'Not Found' },
  '409': { description: 'Conflict (overlap)' }
}
      },
      delete: {
        tags: ['Shifts (Admin)'],
        summary: '근무일정 삭제',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'shopId', in: 'path', required: true, schema: { type: 'integer' } },
          { name: 'shiftId', in: 'path', required: true, schema: { type: 'integer' } }
        ],
        responses: {
          '204': { description: 'No Content' },
          '401': { description: 'Unauthorized' },
          '403': { description: 'Forbidden' },
          '404': { description: 'Not Found' }
        }
      },
      get:{
 tags: ['Shifts (Admin)'],
    summary: '근무일정 상세 조회',
    security: [{ bearerAuth: [] }],
    parameters: [
      { name: 'shopId', in: 'path', required: true, schema: { type: 'integer' } },
      { name: 'shiftId', in: 'path', required: true, schema: { type: 'integer' } }
    ],
    responses: {
      '200': {
        description: 'OK',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                ok: { type: 'boolean' },
                shift: {
                  type: 'object',
                  properties: {
                    id: { type: 'integer' },
                    shopId: { type: 'integer' },
                    employeeId: { type: 'integer' },
                    startAt: { type: 'string', format: 'date-time' },
                    endAt:   { type: 'string', format: 'date-time' },
                    status:  { $ref: '#/components/schemas/WorkShiftStatus' },
                    actualInAt:  { type: 'string', format: 'date-time', nullable: true },
                    actualOutAt: { type: 'string', format: 'date-time', nullable: true },
                    late:        { type: 'boolean', nullable: true },
                    leftEarly:   { type: 'boolean', nullable: true },
                    workedMinutes: { type: 'integer', nullable: true },
                    reviewReason:  { $ref: '#/components/schemas/ShiftReviewReason', nullable: true },
                    memo:    { type: 'string', nullable: true },
                    reviewResolvedAt: { type: 'string', format: 'date-time', nullable: true },
                    createdBy: { type: 'integer', nullable: true },
                    updatedBy: { type: 'integer', nullable: true },
                    createdAt: { type: 'string', format: 'date-time' },
                    updatedAt: { type: 'string', format: 'date-time' },
                    employee: {
                      type: 'object',
                      properties: {
                        id: { type: 'integer' },
                        name: { type: 'string' },
                        position: { type: 'string' },
                        section: { type: 'string' },
                        pay: { type: 'integer' },
                        payUnit: { type: 'string' },
                        personalColor: { type: 'string', nullable: true, pattern: '^#[0-9A-Fa-f]{6}$' }
                      }
                    }
                  }
                },
                summary: {
                  type: 'object',
                  properties: {
                    plannedMinutes: { type: 'integer' },
                    workedMinutes:  { type: 'integer', nullable: true },
                    late: { type: 'boolean', nullable: true },
                    leftEarly: { type: 'boolean', nullable: true },
                    status: { $ref: '#/components/schemas/WorkShiftStatus' }
                  }
                }
              }
            }
          }
        }
      },
      '401': { description: 'Unauthorized' },
      '403': { description: 'Forbidden' },
      '404': { description: 'Not Found' }
    }
  }
      },
          '/api/admin/shops/{shopId}/shifts/yesterday/unchecked': {
      get: {
        tags: ['Shifts (Admin)'],
        summary: '어제(KST) 완료됐지만 미체크인 근무일정 목록',
        description: '조건: status=COMPLETED & adminChecked=false, 그리고 어제(KST)의 00:00~24:00과 시간 교집합이 있는 시프트만 반환합니다.',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'shopId', in: 'path', required: true, schema: { type: 'integer' } }
        ],
        responses: {
          '200': {
            description: 'OK',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    ok: { type: 'boolean', example: true },
                    range: {
                      type: 'object',
                      properties: {
                        start: { type: 'string', format: 'date-time', example: '2025-09-13T00:00:00.000Z' },
                        end:   { type: 'string', format: 'date-time', example: '2025-09-13T23:59:59.999Z' }
                      }
                    },
                    items: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/WorkShiftWithEmployee' }
                    }
                  }
                },
                examples: {
                  sample: {
                    value: {
                      ok: true,
                      range: { start: '2025-09-13T00:00:00.000Z', end: '2025-09-13T23:59:59.999Z' },
                      items: [
                        {
                          id: 321, employeeId: 42,
                          startAt: '2025-09-13T02:00:00.000Z',
                          endAt:   '2025-09-13T10:00:00.000Z',
                          status: 'COMPLETED',
                          adminChecked: false,
                          workedMinutes: 480,
                          finalPayAmount: 96000,
                          employee: { name: '김직원', position: 'STAFF', section: 'HALL', pay: 20000, payUnit: 'HOURLY', personalColor: '#1F6FEB' }
                        }
                      ]
                    }
                  }
                }
              }
            }
          },
          '401': { description: 'Unauthorized' },
          '403': { description: 'Forbidden' }
        }
      }
    },

    '/api/admin/shops/{shopId}/shifts/{shiftId}/admin-check': {
      put: {
        tags: ['Shifts (Admin)'],
        summary: '근무일정 관리자 체크 처리',
        description: '`adminChecked`를 `true`로 설정합니다.',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'shopId',  in: 'path', required: true, schema: { type: 'integer' } },
          { name: 'shiftId', in: 'path', required: true, schema: { type: 'integer' } }
        ],
        responses: {
          '200': {
            description: 'OK',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    ok: { type: 'boolean', example: true },
                    shift: { $ref: '#/components/schemas/WorkShift' }
                  }
                },
                examples: {
                  sample: {
                    value: {
                      ok: true,
                      shift: {
                        id: 321, shopId: 1, employeeId: 42,
                        startAt: '2025-09-13T02:00:00.000Z',
                        endAt:   '2025-09-13T10:00:00.000Z',
                        status: 'COMPLETED',
                        adminChecked: true,
                        updatedAt: '2025-09-14T01:23:45.000Z'
                      }
                    }
                  }
                }
              }
            }
          },
          '401': { description: 'Unauthorized' },
          '403': { description: 'Forbidden' },
          '404': { description: 'Not Found' }
        }
      }
    },
  }
};

export const swaggerServe: RequestHandler[] = swaggerUi.serve;

export const swaggerSetup = swaggerUi.setup(swaggerDocument, {
  swaggerOptions: {
    persistAuthorization: true, // 🔐 브라우저 새로고침해도 Authorization 유지
  },
});

