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
      LoginRequest: {
        type: 'object',
        required: ['name','phoneLastFour'],
        properties: {
          name: { type: 'string', example: '홍길동' },
          phoneLastFour: { type: 'string', example: '1234' }
        }
      },
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
      // 🔽 components.schemas 에 추가
PayrollCycle: {
  type: 'object',
  properties: {
    start: { type: 'string', format: 'date-time', example: '2025-07-07T00:00:00.000Z' },
    end:   { type: 'string', format: 'date-time', example: '2025-08-06T23:59:59.999Z' },
    label: { type: 'string', example: '7월 7일 ~ 8월 6일' },
    startDay: { type: 'integer', minimum: 1, maximum: 28, example: 7 }
  }
},
SettlementStatus: {
  type: 'object',
  properties: {
    status: { type: 'string', enum: ['PENDING','PAID'], example: 'PAID' },
    settlementId: { type: 'integer', nullable: true, example: 123 },
    totalPay: { type: 'integer', nullable: true, example: 2500000 },
    settledAt: { type: 'string', format: 'date-time', nullable: true, example: '2025-08-10T09:00:00.000Z' },
    // 상세 응답에서만 쓰는 보조 필드(있어도 되고 없어도 됨)
    fullyApplied: { type: 'boolean', nullable: true, example: true, description: '사이클 내 모든 근무 기록이 settlementId로 묶였는지' }
  }
},
EmployeePayrollListItem: {
  type: 'object',
  properties: {
    employeeId: { type: 'integer', example: 42 },
    name: { type: 'string', example: '김철수' },
    position: { type: 'string', example: 'STAFF' },
    hourlyPay: { type: 'integer', nullable: true, example: null },
    monthlyPay: { type: 'integer', nullable: true, example: 2500000 },
    workedMinutes: { type: 'integer', example: 14982 },
    extraMinutes: { type: 'integer', example: 0 },
    salary: { type: 'integer', example: 2500000 },
    settlement: { $ref: '#/components/schemas/SettlementStatus' }
  }
},
PayrollByEmployeeSummary: {
  type: 'object',
  properties: {
    employeeCount: { type: 'integer', example: 17 },
    paidCount: { type: 'integer', example: 9 },
    pendingCount: { type: 'integer', example: 8 },
    totalWorkedMinutes: { type: 'integer', example: 23850 }
  }
},
      WorkShiftEmployeeUpdateRequest: {
        type: 'object',
        properties: {
          startAt: { type: 'string', format: 'date-time' },
          endAt:   { type: 'string', format: 'date-time' },
          reviewNote: { type: 'string', maxLength: 500 }
        },
        description: 'startAt / endAt / reviewNote 중 최소 1개 필요'
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
              endAt:   { type: 'string', format: 'date-time' },
              status:  { $ref: '#/components/schemas/WorkShiftStatus' },
              needsReview: { type: 'boolean' },
              reviewReason: { $ref: '#/components/schemas/ShiftReviewReason', nullable: true },
              reviewNote:   { type: 'string', nullable: true },
              updatedAt:    { type: 'string', format: 'date-time' }
            }
          }
        }
      },
PayrollByEmployeeResponse: {
  type: 'object',
  properties: {
    year: { type: 'integer', example: 2025 },
    month: { type: 'integer', example: 8 },
    cycle: { $ref: '#/components/schemas/PayrollCycle' },
    summary: { $ref: '#/components/schemas/PayrollByEmployeeSummary' },
    employees: {
      type: 'array',
      items: { $ref: '#/components/schemas/EmployeePayrollListItem' }
    },
    paid: {
      type: 'array',
      items: { $ref: '#/components/schemas/EmployeePayrollListItem' }
    },
    pending: {
      type: 'array',
      items: { $ref: '#/components/schemas/EmployeePayrollListItem' }
    }
  }
},
PayrollEmployeeDetailLog: {
  type: 'object',
  properties: {
    id: { type: 'integer', example: 9876 },
    date: { type: 'string', format: 'date', nullable: true, example: '2025-08-03' },
    clockInAt: { type: 'string', format: 'date-time', nullable: true },
    clockOutAt: { type: 'string', format: 'date-time', nullable: true },
    workedMinutes: { type: 'integer', nullable: true, example: 360 },
    extraMinutes: { type: 'integer', nullable: true, example: 0 },
    settlementId: { type: 'integer', nullable: true, example: 123 }
  }
},
PayrollEmployeeDetailResponse: {
  type: 'object',
  properties: {
    year: { type: 'integer', example: 2025 },
    month: { type: 'integer', example: 8 },
    cycle: { $ref: '#/components/schemas/PayrollCycle' },
    settlement: { $ref: '#/components/schemas/SettlementStatus' },
    employee: {
      type: 'object',
      properties: {
        id: { type: 'integer', example: 42 },
        name: { type: 'string', example: '김철수' },
        position: { type: 'string', example: 'STAFF' },
        hourlyPay: { type: 'integer', nullable: true, example: null },
        monthlyPay: { type: 'integer', nullable: true, example: 2500000 }
      }
    },
    daysWorked: { type: 'integer', example: 12 },
    workedMinutes: { type: 'integer', example: 14982 },
    extraMinutes: { type: 'integer', example: 0 },
    salary: { type: 'integer', example: 2500000 },
    logs: {
      type: 'array',
      items: { $ref: '#/components/schemas/PayrollEmployeeDetailLog' }
    }
  }
},
      // ───────────────────────────────
      // Shifts (근무일정) 스키마 추가
      // ───────────────────────────────
      WorkShiftStatus: {
        type: 'string',
        enum: ['SCHEDULED','IN_PROGRESS','COMPLETED','CANCELED','MISSED','OVERDUE','REVIEW']
      },
      ShiftReviewReason: {
        type: 'string',
        enum: ['LATE_IN','EARLY_OUT','LATE_OUT','EXTENDED']
      },
WorkShift: {
  type: 'object',
  properties: {
    id:          { type: 'integer', example: 101 },
    shopId:      { type: 'integer', example: 1 },
    employeeId:  { type: 'integer', example: 42 },
    startAt:     { type: 'string', format: 'date-time', example: '2025-09-01T02:00:00.000Z' },
    endAt:       { type: 'string', format: 'date-time', example: '2025-09-01T10:00:00.000Z' },
    status:      { $ref: '#/components/schemas/WorkShiftStatus' },
          needsReview:   { type: 'boolean', nullable: true },
          reviewReason:  { $ref: '#/components/schemas/ShiftReviewReason', nullable: true },
          reviewNote:    { type: 'string', nullable: true },
          reviewResolvedAt: { type: 'string', format: 'date-time', nullable: true },

    // ✅ 실적 필드
    actualInAt:  { type: 'string', format: 'date-time', nullable: true },
    actualOutAt: { type: 'string', format: 'date-time', nullable: true },
    late:        { type: 'boolean', nullable: true, example: false },
    leftEarly:   { type: 'boolean', nullable: true, example: false },

    // ✅ 산출값(OUT 시 저장)
    actualMinutes: { type: 'integer', nullable: true, example: 505, description: '실제 근무 분' },
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
      // swaggerDocument.components.schemas 에 추가
WorkShiftUpdateSummary: {
  type: 'object',
  properties: {
    actualMinutes: { type: 'integer', nullable: true, example: 505 },
    workedMinutes: { type: 'integer', nullable: true, example: 480 },
    late:          { type: 'boolean', nullable: true, example: false },
    leftEarly:     { type: 'boolean', nullable: true, example: false }
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
          totalEmployees: { type: 'integer', example: 17 },
          checkedIn:      { type: 'integer', example: 9 },
          late:           { type: 'integer', example: 2 },
          absent:         { type: 'integer', example: 1 }
        }
      },
      AttendanceType: {
        type: 'string',
        enum: ['IN','OUT']
      },
      ActiveEmployee: {
        type: 'object',
        properties: {
          employeeId: { type: 'integer', example: 42 },
          name:       { type: 'string', example: '김직원' },
          position:   { type: 'string', nullable: true, example: '파트타이머' },
          section:    { type: 'string', nullable: true, example: '홀' },
          clockInAt:  { type: 'string', format: 'date-time', example: '2025-08-27T09:03:12.000Z' }
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
// swaggerDocument.components.schemas 에 추가
MyPageProfile: {
  type: 'object',
  properties: {
    name: { type: 'string', example: '김철수' },
    section: { type: 'string', example: 'HALL' },
    position: { type: 'string', example: 'STAFF' },
    pay: { type: 'integer', example: 2500000 },
    payUnit: { type: 'string', enum: ['MONTHLY','HOURLY'], example: 'MONTHLY' },
    phoneMasked: { type: 'string', example: '010****5432' },
    bank: { type: 'string', nullable: true, example: '국민' },
    bankRegistered: { type: 'boolean', example: false }
  }
},
PayrollSettlement: {
  type: 'object',
  properties: {
    id:           { type: 'integer', example: 10 },
    shopId:       { type: 'integer', example: 1 },
    employeeId:   { type: 'integer', example: 42 },
    cycleStart:   { type: 'string', format: 'date-time' },
    cycleEnd:     { type: 'string', format: 'date-time' },
    workedMinutes:{ type: 'integer', example: 14982 },
    basePay:      { type: 'integer', example: 2500000 },
    totalPay:     { type: 'integer', example: 2500000 },
    settledAt:    { type: 'string', format: 'date-time', nullable: true },
    processedBy:  { type: 'integer', nullable: true, example: 1 }
  }
},
SettlePreviousResponse: {
  type: 'object',
  properties: {
    ok: { type: 'boolean', example: true },
    settlement: { $ref: '#/components/schemas/PayrollSettlement' }
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

MyPageCycle: {
  type: 'object',
  properties: {
    start: { type: 'string', format: 'date-time' },
    end:   { type: 'string', format: 'date-time' },
    label: { type: 'string', example: '8월 7일 ~ 9월 6일' },
    startDay: { type: 'integer', minimum: 1, maximum: 28, example: 7 }
  }
},
MyPageCards: {
  type: 'object',
  properties: {
    current: {
      type: 'object',
      properties: {
        amount: { type: 'integer', example: 2500000 },
        status: { type: 'string', enum: ['PENDING','PAID'], example: 'PENDING' },
        cycleStart: { type: 'string', format: 'date-time' },
        cycleEnd: { type: 'string', format: 'date-time' }
      }
    },
    previous: {
      type: 'object',
      properties: {
        amount: { type: 'integer', example: 2500000 },
        status: { type: 'string', enum: ['PENDING','PAID'], example: 'PAID' },
        cycleStart: { type: 'string', format: 'date-time' },
        cycleEnd: { type: 'string', format: 'date-time' },
        settledAt: { type: 'string', format: 'date-time', nullable: true }
      }
    }
  }
},
MyPageMonth: {
  type: 'object',
  properties: {
    year: { type: 'integer', example: 2025 },
    month:{ type: 'integer', example: 8 },
    workedMinutes: { type: 'integer', example: 14982 },
    workedHours: { type: 'number', example: 249.7 },
    basePay: { type: 'integer', example: 3901923 },
    totalPay: { type: 'integer', example: 3948798 }
  }
},
MyPageStats: {
  type: 'object',
  properties: {
    presentDays: { type: 'integer', example: 10 },
    lateCount: { type: 'integer', example: 8 },
    absentCount: { type: 'integer', example: 11 }
  }
},
MyPageSettlementResponse: {
  type: 'object',
  properties: {
    ok: { type: 'boolean', example: true },
    profile: { $ref: '#/components/schemas/MyPageProfile' },
    cycle:   { $ref: '#/components/schemas/MyPageCycle' },
    cards:   { $ref: '#/components/schemas/MyPageCards' },
    month:   { $ref: '#/components/schemas/MyPageMonth' },
    stats:   { $ref: '#/components/schemas/MyPageStats' }
  }
},
AttendanceCreateRequest: {
        type: 'object',
        required: ['shopId', 'shiftId', 'type'],
        properties: {
          shopId:  { type: 'integer', example: 123 },
          shiftId: { type: 'integer', example: 456 },
          type:    { type: 'string', enum: ['IN', 'OUT'] },
          memo:   { type: 'string', maxLength: 500, nullable: true, description: '리뷰 사유 메모(지각>10분/조퇴 시)' }
        }
      },
      AttendanceConfirmInResponse: {
        type: 'object',
        properties: {
          ok: { type: 'boolean' },
          message: { type: 'string', example: '출근 완료' },
          clockInAt: { type: 'string', format: 'date-time' },
          shiftId: { type: 'integer', example: 456 }
        }
      },
      AttendanceConfirmOutResponse: {
        type: 'object',
        properties: {
          ok: { type: 'boolean' },
          message: { type: 'string', example: '퇴근 완료' },
          clockOutAt: { type: 'string', format: 'date-time' },
          workedMinutes: { type: 'integer' },
          actualMinutes: { type: 'integer' },
          shiftId: { type: 'integer', example: 456 },
          planned: {
            type: 'object',
            nullable: true,
            properties: { startAt: { type:'string',format:'date-time' }, endAt: { type:'string',format:'date-time' } }
          }
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
    '/api/auth/login': {
      post: {
        tags: ['Auth'],
        summary: 'Login with name and phone last 4 digits',
        requestBody: {
          required: true,
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/LoginRequest' } }
          }
        },
        responses: {
          '200': { description: 'Tokens returned', content: { 'application/json': { schema: { $ref: '#/components/schemas/TokenPair' } } } },
          '401': {
            description: 'Invalid credentials'
          }
        }
      }
    },
    '/api/auth/refresh': {
      post: {
        tags: ['Auth'],
        summary: 'Refresh access token',
        requestBody: {
          required: true,
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/RefreshRequest' } }
          }
        },
        responses: {
          '200': { description: 'New access token' },
          '403': { description: 'Invalid refresh token' }
        }
      }
    },
    '/api/auth/logout': {
      post: {
        tags: ['Auth'],
        summary: 'Logout and invalidate refresh token',
        requestBody: {
          required: true,
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/LogoutRequest' } }
          }
        },
        responses: { '200': { description: 'Logged out' } }
      }
    },
    '/api/auth/validate': {
      get: {
        tags: ['Auth'],
        summary: 'Validate Bearer access token',
        parameters: [
          {
            name: 'Authorization',
            in: 'header',
            required: true,
            schema: { type: 'string', example: 'Bearer <token>' }
          }
        ],
        responses: { '200': { description: 'Token info' }, '401': { description: 'Invalid' } }
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


    '/api/admin/shops': {
      get: { tags: ['Admin'], summary: '매장 목록', responses: { '200': { description: 'OK' } } },
      post: { tags: ['Admin'], summary: '매장 생성', responses: { '201': { description: 'Created' }, '400': { description: 'Invalid payload' } } }
    },
    '/api/admin/shops/{shopId}': {
      put:  { tags: ['Admin'], summary: '매장 수정', parameters: [{ name: 'shopId', in: 'path', required: true, schema: { type: 'integer' } }], responses: { '200': { description: 'OK' }, '404': { description: 'Not Found' } } },
      delete: { tags: ['Admin'], summary: '매장 삭제', parameters: [{ name: 'shopId', in: 'path', required: true, schema: { type: 'integer' } }], responses: { '204': { description: 'No Content' } } }
    },
    '/api/admin/shops/{shopId}/employees': {
      get: { tags: ['Admin'], summary: '직원 목록', parameters: [{ name: 'shopId', in: 'path', required: true, schema: { type: 'integer' } }], responses: { '200': { description: 'OK' } } },
      post: { tags: ['Admin'], summary: '직원 생성', parameters: [{ name: 'shopId', in: 'path', required: true, schema: { type: 'integer' } }], responses: { '201': { description: 'Created' }, '400': { description: 'Invalid payload' } } }
    },
    '/api/admin/shops/{shopId}/employees/{employeeId}': {
      put:  { tags: ['Admin'], summary: '직원 수정', parameters: [{ name: 'shopId', in: 'path', required: true, schema: { type: 'integer' } }, { name: 'employeeId', in: 'path', required: true, schema: { type: 'integer' } }], responses: { '200': { description: 'OK' }, '404': { description: 'Not Found' } } },
      delete:{ tags: ['Admin'], summary: '직원 삭제', parameters: [{ name: 'shopId', in: 'path', required: true, schema: { type: 'integer' } }, { name: 'employeeId', in: 'path', required: true, schema: { type: 'integer' } }], responses: { '204': { description: 'No Content' } } }
    },
    '/api/admin/shops/{shopId}/payroll/export': {
      get: { tags: ['Payroll'], summary: '급여 엑셀 다운로드', parameters: [ { name:'shopId',in:'path',required:true,schema:{type:'integer'} }, { name:'start',in:'query',required:true,schema:{type:'string',format:'date'} }, { name:'end',in:'query',required:true,schema:{type:'string',format:'date'} } ], responses: { '200': { description: 'Excel stream' } } }
    },
    '/api/admin/shops/{shopId}/payroll/dashboard': {
      get: { tags: ['Payroll'], summary: '급여 대시보드', parameters: [ { name:'shopId',in:'path',required:true,schema:{type:'integer'} }, { name:'year',in:'query',schema:{type:'integer'} }, { name:'month',in:'query',schema:{type:'integer'} } ], responses: { '200': { description: 'OK' } } }
    },
    '/api/admin/shops/{shopId}/payroll/employees': {
      get: { tags: ['Payroll'], summary: '직원별 급여 목록', parameters: [ { name:'shopId',in:'path',required:true,schema:{type:'integer'} }, { name:'year',in:'query',schema:{type:'integer'} }, { name:'month',in:'query',schema:{type:'integer'} } ], // 기존 paths['/api/admin/shops/{shopId}/payroll/employees'].get.responses 를 아래로 교체
responses: {
  '200': {
    description: 'OK',
    content: {
      'application/json': {
        schema: { $ref: '#/components/schemas/PayrollByEmployeeResponse' },
        examples: {
          sample: {
            value: {
              year: 2025,
              month: 8,
              cycle: {
                start: '2025-07-07T00:00:00.000Z',
                end:   '2025-08-06T23:59:59.999Z',
                label: '7월 7일 ~ 8월 6일',
                startDay: 7
              },
              summary: {
                employeeCount: 2,
                paidCount: 1,
                pendingCount: 1,
                totalWorkedMinutes: 28182
              },
              employees: [
                {
                  employeeId: 1, name: '김철수', position: 'STAFF',
                  hourlyPay: null, monthlyPay: 2500000,
                  workedMinutes: 14982, extraMinutes: 0, salary: 2500000,
                  settlement: { status: 'PAID', settlementId: 10, settledAt: '2025-08-10T09:00:00.000Z', totalPay: 2500000 }
                },
                {
                  employeeId: 2, name: '이영희', position: 'PART_TIME',
                  hourlyPay: 12000, monthlyPay: null,
                  workedMinutes: 13200, extraMinutes: 0, salary: 2640000,
                  settlement: { status: 'PENDING', settlementId: null, settledAt: null, totalPay: null }
                }
              ],
              paid: [
                {
                  employeeId: 1, name: '김철수', position: 'STAFF',
                  hourlyPay: null, monthlyPay: 2500000,
                  workedMinutes: 14982, extraMinutes: 0, salary: 2500000,
                  settlement: { status: 'PAID', settlementId: 10, settledAt: '2025-08-10T09:00:00.000Z', totalPay: 2500000 }
                }
              ],
              pending: [
                {
                  employeeId: 2, name: '이영희', position: 'PART_TIME',
                  hourlyPay: 12000, monthlyPay: null,
                  workedMinutes: 13200, extraMinutes: 0, salary: 2640000,
                  settlement: { status: 'PENDING', settlementId: null, settledAt: null, totalPay: null }
                }
              ]
            }
          }
        }
      }
    }
  }
}
 }
    },
    '/api/admin/shops/{shopId}/payroll/employees/{employeeId}': {
      get: { tags: ['Payroll'], summary: '직원 월별 급여 상세', parameters: [ { name:'shopId',in:'path',required:true,schema:{type:'integer'} }, { name:'employeeId',in:'path',required:true,schema:{type:'integer'} }, { name:'year',in:'query',schema:{type:'integer'} }, { name:'month',in:'query',schema:{type:'integer'} } ], // 기존 paths['/api/admin/shops/{shopId}/payroll/employees/{employeeId}'].get.responses 를 아래로 교체
responses: {
  '200': {
    description: 'OK',
    content: {
      'application/json': {
        schema: { $ref: '#/components/schemas/PayrollEmployeeDetailResponse' },
        examples: {
          sample: {
            value: {
              year: 2025,
              month: 8,
              cycle: {
                start: '2025-07-07T00:00:00.000Z',
                end:   '2025-08-06T23:59:59.999Z',
                label: '7월 7일 ~ 8월 6일',
                startDay: 7
              },
              settlement: {
                status: 'PAID',
                settlementId: 10,
                totalPay: 2500000,
                settledAt: '2025-08-10T09:00:00.000Z',
                fullyApplied: true
              },
              employee: {
                hourlyPay: null, monthlyPay: 2500000
              },
              daysWorked: 12,
              workedMinutes: 14982,
              extraMinutes: 0,
              salary: 2500000,
              logs: [
                {
                  id: 901,
                  date: '2025-08-01',
                  clockInAt: '2025-08-01T00:05:00.000Z',
                  clockOutAt: '2025-08-01T09:00:00.000Z',
                  workedMinutes: 535,
                  extraMinutes: 0,
                  settlementId: 10
                },
                {
                  id: 902,
                  date: '2025-08-02',
                  clockInAt: '2025-08-02T00:03:00.000Z',
                  clockOutAt: '2025-08-02T09:01:00.000Z',
                  workedMinutes: 538,
                  extraMinutes: 0,
                  settlementId: 10
                }
              ]
            }
          }
        }
      }
    }
  },
  '404': { description: 'Not Found' }
}
}
    },// swaggerDocument.paths 에 추가
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
        description: '사이클 시작일(기본: 매장 payday; 제공 시 override)' }
    ],
    responses: {
      '200': {
        description: 'XLSX binary stream',
        content: {
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': {
            schema: { type: 'string', format: 'binary' }
          }
        },
        headers: {
          'Content-Disposition': {
            schema: { type: 'string' },
            description: 'attachment; filename="payroll_<shop>_<YYYY-MM>.xlsx"'
          }
        }
      },
      '401': { description: 'Unauthorized' },
      '403': { description: 'Forbidden' },
      '404': { description: 'Shop not found' }
    }
  }
},

    '/api/admin/shops/{shopId}/payroll/employees/{employeeId}/summary': {
      get: { tags: ['Payroll'], summary: '직원 월별 요약', parameters: [ { name:'shopId',in:'path',required:true,schema:{type:'integer'} }, { name:'employeeId',in:'path',required:true,schema:{type:'integer'} }, { name:'year',in:'query',schema:{type:'integer'} }, { name:'month',in:'query',schema:{type:'integer'} } ], responses: { '200': { description: 'OK' } } }
    },
    '/api/admin/shops/{shopId}/qr': {
      get: { tags: ['QR'], summary: '매장 QR PNG 생성', parameters: [ { name:'shopId',in:'path',required:true,schema:{type:'integer'} }, { name:'download',in:'query',schema:{type:'integer', minimum:0, maximum:1} }, { name:'format', in:'query', schema:{ type:'string', enum:['raw','base64','json'] }, description:'QR 페이로드 포맷 (기본 raw)' } ], responses: { '200': { description: 'PNG' }, '404': { description: 'Not Found' } } }
    },
    // ... 기존 paths 아래에 이어서 추가
    '/api/admin/shops/{shopId}/dashboard/today': {
      get: {
        tags: ['Dashboard'],
        summary: '오늘 현황(전체 · 출근 · 지각 · 결근)',
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
    '/api/admin/shops/{shopId}/dashboard/active': {
      get: {
        tags: ['Dashboard'],
        summary: '실시간 근무자 목록(OUT 미기록)',
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
                }
              }
            }
          }
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
// swaggerDocument.paths 에 추가
'/api/my/settlement': {
  get: {
    tags: ['Payroll'],
    summary: '마이페이지 정산/프로필/통계',
    security: [{ bearerAuth: [] }],
    parameters: [
      {
        name: 'anchor',
        in: 'query',
        required: false,
        schema: { type: 'string', format: 'date-time' },
        description: '기준 시각(KST 기준 사이클/월 계산 anchor). 기본값: 현재 시각'
      },
      {
        name: 'cycleStartDay',
        in: 'query',
        required: false,
        schema: { type: 'integer', minimum: 1, maximum: 28 },
        description: '사이클 시작일(숫자). 기본: 매장 payday 또는 환경변수'
      }
    ],
    responses: {
      '200': {
        description: 'OK',
        content: {
          'application/json': { schema: { $ref: '#/components/schemas/MyPageSettlementResponse' } }
        }
      },
      '401': { description: 'Unauthorized' }
    }
  }
},
'/api/admin/shops/{shopId}/settlements/employees/{employeeId}': {
  post: {
    tags: ['Payroll'],
    summary: '지난 사이클 정산(스냅샷 저장)',
    security: [{ bearerAuth: [] }],
    parameters: [
      { name: 'shopId', in: 'path', required: true, schema: { type: 'integer' } },
      { name: 'employeeId', in: 'path', required: true, schema: { type: 'integer' } }
    ],
    responses: {
      '201': { description: 'Created', content: { 'application/json': { schema: { $ref: '#/components/schemas/SettlePreviousResponse' } } } },
      '401': { description: 'Unauthorized' },
      '403': { description: 'Forbidden' },
      '404': { description: 'Not Found' }
   }
 }
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
    '/api/attendance': {
      post: {
        tags: ['Attendance'],
        summary: '출퇴근 기록 생성/마감 (Shift 1:1 매칭)',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
                            schema: { $ref: '#/components/schemas/AttendanceCreateRequest' },
              examples: {
                clockInLateWithin10: { value: { shopId: 1, shiftId: 123, type: 'IN' } },
                clockInLateOver10:   { value: { shopId: 1, shiftId: 123, type: 'IN', memo: '버스 지연으로 15분 지각' } },
                earlyOutWithin10:    { value: { shopId: 1, shiftId: 123, type: 'OUT', memo: '컨디션 저하로 조퇴' } }
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
                  out: { value: { ok:true, message:'퇴근 완료', clockOutAt:'2025-09-05T13:00:00.000Z', workedMinutes:480, actualMinutes:505, planned:null, shiftId:456 } }
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
                      endAt: { type: 'string', format: 'date-time' },
                      status: { $ref: '#/components/schemas/WorkShiftStatus' },
                      needsReview: { type: 'boolean' },
                      reviewReason: { $ref: '#/components/schemas/ShiftReviewReason' },
                      reviewNote: { type: 'string', nullable: true },
                      reviewResolvedAt:{ type: 'string', format: 'date-time', nullable: true },
                      actualInAt: { type: 'string', format: 'date-time', nullable: true },
                      actualOutAt:{ type: 'string', format: 'date-time', nullable: true },
                      late: { type: 'boolean', nullable: true },
                      leftEarly: { type: 'boolean', nullable: true },
                      actualMinutes: { type: 'integer', nullable: true },
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
        tags: ['WorkShift (Employee)'],
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
                    reviewNote: '개인 사정으로 30분 당김'
                  }
                },
                noteOnly: {
                  value: {
                    reviewNote: '출근을 깜빡해서 09:10에 찍었습니다. 확인 부탁드려요.'
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
                late: false, leftEarly: false,
                actualMinutes: 489, workedMinutes: 480,
                settlementId: null
              },
              summary: { actualMinutes: 489, workedMinutes: 480, late: false, leftEarly: false }
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
                    actualMinutes: { type: 'integer', nullable: true },
                    workedMinutes: { type: 'integer', nullable: true },
                    needsReview:   { type: 'boolean', nullable: true },
                    reviewReason:  { $ref: '#/components/schemas/ShiftReviewReason', nullable: true },
                    reviewNote:    { type: 'string', nullable: true },
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
                    actualMinutes:  { type: 'integer', nullable: true },
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
      }
  }
};
// 🔻 기존 정산/급여 관련 스키마 제거
[
  'PayrollCycle',
  'SettlementStatus',
  'EmployeePayrollListItem',
  'PayrollByEmployeeSummary',
  'PayrollByEmployeeResponse',
  'PayrollEmployeeDetailLog',
  'PayrollEmployeeDetailResponse',
  'PayrollSettlement',
  'SettlePreviousResponse',
  'MyPageCycle',
  'MyPageCards',
  'MyPageMonth',
  'MyPageStats',
  'MyPageSettlementResponse',
].forEach((k) => {
  try { delete swaggerDocument.components.schemas[k as any]; } catch {}
});

// 🔻 AttendanceRecord 안에 settlementId 필드도 제거(정산 재설계 전에 노출 안 함)
try {
  delete swaggerDocument.components.schemas.AttendanceRecord.properties.settlementId;
} catch {}

// 🔻 정산/급여 관련 경로 제거
[
  '/api/admin/shops/{shopId}/payroll/export',
  '/api/admin/shops/{shopId}/payroll/dashboard',
  '/api/admin/shops/{shopId}/payroll/employees',
  '/api/admin/shops/{shopId}/payroll/employees/{employeeId}',
  '/api/admin/shops/{shopId}/payroll/employees/{employeeId}/summary',
  '/api/my/settlement',
  '/api/admin/shops/{shopId}/settlements/employees/{employeeId}',
].forEach((p) => {
  try { delete swaggerDocument.paths[p as any]; } catch {}
});
export const swaggerServe: RequestHandler[] = swaggerUi.serve;

export const swaggerSetup = swaggerUi.setup(swaggerDocument, {
  swaggerOptions: {
    persistAuthorization: true, // 🔐 브라우저 새로고침해도 Authorization 유지
  },
});

