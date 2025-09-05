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
        enum: ['SCHEDULED', 'COMPLETED', 'CANCELED'],
        example: 'SCHEDULED'
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
          // 아래 필드는 선택(DB에 존재하는 경우 문서화)
          createdBy:   { type: 'integer', nullable: true, example: 42 },
          updatedBy:   { type: 'integer', nullable: true, example: 1 },
          createdAt:   { type: 'string', format: 'date-time', nullable: true },
          updatedAt:   { type: 'string', format: 'date-time', nullable: true },
          actualInAt:  { type: 'string', format: 'date-time', nullable: true },
          actualOutAt: { type: 'string', format: 'date-time', nullable: true },
          leftEarly:   { type: 'boolean', nullable: true, example: false },
          notes:       { type: 'string', nullable: true }
        }
      },
      WorkShiftEmployeeLite: {
        type: 'object',
        properties: {
          name:     { type: 'string', example: '김직원' },
          position: { type: 'string', example: 'STAFF' },
          section:  { type: 'string', example: 'HALL' }
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
          status:  { $ref: '#/components/schemas/WorkShiftStatus' }
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


      // ... 기존 components.schemas 아래에 이어서 추가
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
},AttendanceCreateRequest: {
        type: 'object',
        required: ['shopId', 'type'],
        properties: {
          shopId: { type: 'integer', example: 123 },
          type: { type: 'string', enum: ['IN', 'OUT'] },
          preview: { type: 'boolean', example: true, description: 'true면 저장하지 않고 제안만 반환' },
          selectedAt: { type: 'string', format: 'date-time', example: '2025-09-05T12:00:00.000Z', description: '사용자가 확정한 시각(미지정 시 preview 동작)' },
          updateShiftStart: { type: 'boolean', example: false, description: 'IN에서 시프트 시작을 selectedAt으로 수정(겹침 없을 때만)' }
        }
      },
      AttendancePreviewInResponse: {
        type: 'object',
        properties: {
          ok: { type: 'boolean' },
          requiresConfirmation: { type: 'boolean' },
          type: { type: 'string', enum: ['IN'] },
          now: { type: 'string', format: 'date-time' },
          suggestedClockInAt: { type: 'string', format: 'date-time' },
          suggestionReason: { type: 'string', enum: ['round_nearest_half_hour', 'align_to_shift_start', 'clamp_into_shift'] },
          allowAdjust: { type: 'boolean' },
          shift: {
            type: 'object',
            nullable: true,
            properties: {
              id: { type: 'integer' },
              plannedStart: { type: 'string', format: 'date-time' },
              plannedEnd: { type: 'string', format: 'date-time' },
              graceInMin: { type: 'integer' }
            }
          }
        }
      },
      AttendancePreviewOutResponse: {
        type: 'object',
        properties: {
          ok: { type: 'boolean' },
          requiresConfirmation: { type: 'boolean' },
          type: { type: 'string', enum: ['OUT'] },
          now: { type: 'string', format: 'date-time' },
          suggestedClockOutAt: { type: 'string', format: 'date-time' },
          suggestionReason: { type: 'string', enum: ['floor_prev_half_hour', 'clamp_into_shift'] },
          allowAdjust: { type: 'boolean' },
          shift: {
            type: 'object',
            nullable: true,
            properties: {
              id: { type: 'integer' },
              plannedStart: { type: 'string', format: 'date-time' },
              plannedEnd: { type: 'string', format: 'date-time' },
              graceInMin: { type: 'integer' }
            }
          }
        }
      }
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
    '/api/attendance/me': {
      get: {
        tags: ['Attendance'],
        summary: '내 출퇴근 기록(커서 기반) 조회',
        parameters: [
          { name: 'start', in: 'query', schema: { type: 'string', format: 'date' } },
          { name: 'end',   in: 'query', schema: { type: 'string', format: 'date' } },
          { name: 'cursor',in: 'query', schema: { type: 'integer' } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 10 } }
        ],
        responses: { '200': { description: 'OK', content: { 'application/json': { schema: { type: 'object', properties: { records: { type: 'array', items: { $ref: '#/components/schemas/AttendanceRecord' } }, nextCursor: { type: 'integer', nullable: true } } } } } } }
      }
    },
    '/api/attendance/me/status': {
      get: {
        tags: ['Attendance'],
        summary: '내 현재 출근 상태',
        responses: { '200': { description: 'OK' } }
      }
    },
    '/api/attendance/admin/shops/{shopId}/attendance': {
      get: {
        tags: ['Attendance (Admin)'],
        summary: '가게 출퇴근 기록 조회(커서 기반)',
        parameters: [
          { name: 'shopId', in: 'path', required: true, schema: { type: 'integer' } },
          { name: 'start', in: 'query', schema: { type: 'string', format: 'date' } },
          { name: 'end',   in: 'query', schema: { type: 'string', format: 'date' } },
          { name: 'employeeId', in: 'query', schema: { type: 'integer' } },
          { name: 'cursor', in: 'query', schema: { type: 'integer' } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 10 } }
        ],
        responses: { '200': { description: 'OK' } }
      }
    },
    '/api/attendance/admin/shops/{shopId}/attendance/employees/{employeeId}': {
      post: {
        tags: ['Attendance (Admin)'],
        summary: '관리자 출퇴근 생성/마감',
        parameters: [
          { name: 'shopId', in: 'path', required: true, schema: { type: 'integer' } },
          { name: 'employeeId', in: 'path', required: true, schema: { type: 'integer' } }
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  clockInAt: { type: 'string', format: 'date-time' },
                  clockOutAt: { type: 'string', format: 'date-time' }
                }
              }
            }
          }
        },
        responses: {
          '201': { description: 'Created or closed' },
          '400': { description: 'Invalid payload' },
          '403': { description: 'Forbidden' },
          '404': { description: 'Not Found' }
        }
      }
    },
    '/api/attendance/admin/shops/{shopId}/attendance/records/{id}': {
      put: {
        tags: ['Attendance (Admin)'],
        summary: '관리자 출퇴근 기록 수정',
        parameters: [
          { name: 'shopId', in: 'path', required: true, schema: { type: 'integer' } },
          { name: 'id', in: 'path', required: true, schema: { type: 'integer' } }
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  clockInAt: { type: 'string', format: 'date-time' },
                  clockOutAt: { type: 'string', format: 'date-time' }
                }
              }
            }
          }
        },
        responses: {
          '200': { description: 'Updated' },
          '400': { description: 'Invalid payload' },
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
                id: 1, name: '김철수', position: 'STAFF',
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
    '/api/attendance': {
      post: {
        tags: ['Attendance'],
        summary: '출퇴근 기록 생성/확정 (IN=반올림·시프트맞춤, OUT=반내림·시프트맞춤). preview=true면 제안만 반환',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/AttendanceCreateRequest' }
            }
          }
        },
        responses: {
          '200': {
            description: 'OK (preview 또는 확정)',
            content: {
              'application/json': {
                schema: {
                  oneOf: [
                    { $ref: '#/components/schemas/AttendancePreviewInResponse' },
                    { $ref: '#/components/schemas/AttendancePreviewOutResponse' }
                  ]
                }
              }
            }
          },
          '400': { description: 'Bad Request' },
          '403': { description: 'Forbidden' }
        }
      }
    },

    '/api/admin/shops/{shopId}/workshifts/{shiftId}': {
      put: {
        tags: ['Shifts (Admin)'],
        summary: '근무일정 수정',
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
              example: { startAt: '2025-09-01T03:00:00.000Z', endAt: '2025-09-01T11:00:00.000Z', status: 'SCHEDULED' }
            }
          }
        },
        responses: {
          '200': { description: 'Updated', content: { 'application/json': { schema: { $ref: '#/components/schemas/WorkShift' } } } },
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



