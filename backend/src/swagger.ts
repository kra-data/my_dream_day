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
          extraMinutes: { type: 'integer' }
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
    '/api/attendance': {
      post: {
        tags: ['Attendance'],
        summary: '직원 출퇴근 기록 생성 (IN | OUT)',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['shopId','type'],
                properties: {
                  shopId: { type: 'integer' },
                  type: { type: 'string', enum: ['IN','OUT'] }
                }
              }
            }
          }
        },
        responses: { '200': { description: 'OK' }, '400': { description: 'Invalid payload' }, '403': { description: 'Forbidden' } }
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
      get: { tags: ['Payroll'], summary: '직원별 급여 목록', parameters: [ { name:'shopId',in:'path',required:true,schema:{type:'integer'} }, { name:'year',in:'query',schema:{type:'integer'} }, { name:'month',in:'query',schema:{type:'integer'} } ], responses: { '200': { description: 'OK' } } }
    },
    '/api/admin/shops/{shopId}/payroll/employees/{employeeId}': {
      get: { tags: ['Payroll'], summary: '직원 월별 급여 상세', parameters: [ { name:'shopId',in:'path',required:true,schema:{type:'integer'} }, { name:'employeeId',in:'path',required:true,schema:{type:'integer'} }, { name:'year',in:'query',schema:{type:'integer'} }, { name:'month',in:'query',schema:{type:'integer'} } ], responses: { '200': { description: 'OK' }, '404': { description: 'Not Found' } } }
    },
    '/api/admin/shops/{shopId}/payroll/employees/{employeeId}/summary': {
      get: { tags: ['Payroll'], summary: '직원 월별 요약', parameters: [ { name:'shopId',in:'path',required:true,schema:{type:'integer'} }, { name:'employeeId',in:'path',required:true,schema:{type:'integer'} }, { name:'year',in:'query',schema:{type:'integer'} }, { name:'month',in:'query',schema:{type:'integer'} } ], responses: { '200': { description: 'OK' } } }
    },
    '/api/admin/shops/{shopId}/qr': {
      get: { tags: ['QR'], summary: '매장 QR PNG 생성', parameters: [ { name:'shopId',in:'path',required:true,schema:{type:'integer'} }, { name:'download',in:'query',schema:{type:'integer', minimum:0, maximum:1} }, { name:'format', in:'query', schema:{ type:'string', enum:['raw','base64','json'] }, description:'QR 페이로드 포맷 (기본 raw)' } ], responses: { '200': { description: 'PNG' }, '404': { description: 'Not Found' } } }
    }
  }
};

export const swaggerServe: RequestHandler[] = swaggerUi.serve;

export const swaggerSetup = swaggerUi.setup(swaggerDocument, {
  swaggerOptions: {
    persistAuthorization: true, // 🔐 브라우저 새로고침해도 Authorization 유지
  },
});



