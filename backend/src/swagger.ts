import { RequestHandler } from 'express';
import swaggerUi from 'swagger-ui-express';

// Minimal OpenAPI spec for current endpoints
export const swaggerDocument: any = {
  openapi: '3.0.0',
  info: {
    title: 'Employee Project API',
    version: '1.0.0',
    description: 'API documentation for the Employee Project backend'
  },
  servers: [
    { url: process.env.SWAGGER_SERVER_URL || 'http://localhost:3001', description: 'Server' }
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT'
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
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  phoneLastFour: { type: 'string' }
                },
                required: ['name', 'phoneLastFour']
              }
            }
          }
        },
        responses: {
          '200': {
            description: 'Tokens returned'
          },
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
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  token: { type: 'string' }
                },
                required: ['token']
              }
            }
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
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  token: { type: 'string' }
                },
                required: ['token']
              }
            }
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
    }
  }
};

export const swaggerServe: RequestHandler[] = swaggerUi.serve;
export const swaggerSetup = swaggerUi.setup(swaggerDocument);



