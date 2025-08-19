# Employee Project Backend API

A comprehensive employee management system with attendance tracking, payroll management, and admin controls.

## Features

- **Authentication**: JWT-based login with refresh tokens
- **Employee Management**: CRUD operations for shops and employees
- **Attendance Tracking**: QR-based clock in/out with validation
- **Payroll System**: Excel export, monthly summaries, and calculations
- **Dashboard**: Real-time employee status and activity monitoring
- **QR Generation**: Shop-specific QR codes for attendance
- **Role-based Access**: Admin and employee permissions
- **API Documentation**: Swagger UI at `/api/docs`

## Tech Stack

- **Runtime**: Node.js 20 + TypeScript
- **Framework**: Express.js 5
- **Database**: PostgreSQL + Prisma ORM
- **Security**: Helmet, CORS, Rate Limiting
- **Validation**: Zod schema validation
- **Testing**: Jest + Supertest
- **Deployment**: Docker + Caddy (TLS)

## API Endpoints

### Authentication
- `POST /api/auth/login` - Employee login
- `POST /api/auth/refresh` - Refresh access token
- `POST /api/auth/logout` - Logout and invalidate token
- `GET /api/auth/validate` - Validate current token

### Health & Documentation
- `GET /api/health` - Server health check
- `GET /api/docs` - Swagger API documentation

### Attendance (Employee)
- `POST /api/attendance` - Record clock in/out
- `GET /api/attendance/me` - Personal attendance history
- `GET /api/attendance/me/status` - Current work status

### Admin Routes
- `GET /api/admin/shops` - List all shops
- `POST /api/admin/shops` - Create new shop
- `PUT /api/admin/shops/:id` - Update shop
- `DELETE /api/admin/shops/:id` - Delete shop
- `GET /api/admin/shops/:id/employees` - List shop employees
- `POST /api/admin/shops/:id/employees` - Add employee
- `PUT /api/admin/shops/:id/employees/:employeeId` - Update employee
- `DELETE /api/admin/shops/:id/employees/:employeeId` - Remove employee

### Payroll & Dashboard
- `GET /api/admin/shops/:shopId/payroll/export` - Export payroll Excel
- `GET /api/admin/shops/:shopId/payroll/dashboard` - Payroll overview
- `GET /api/admin/shops/:shopId/payroll/employees` - Employee payroll list
- `GET /api/admin/shops/:shopId/payroll/employees/:employeeId` - Employee detail
- `GET /api/admin/shops/:shopId/dashboard/today` - Today's summary
- `GET /api/admin/shops/:shopId/dashboard/active` - Active employees
- `GET /api/admin/shops/:shopId/dashboard/recent` - Recent activities

### QR & Utilities
- `GET /api/admin/shops/:id/qr` - Generate shop QR code

## Development

### Prerequisites
- Node.js 20+
- PostgreSQL
- Docker (optional)

### Setup
```bash
# Install dependencies
npm install

# Environment setup
cp .env.example .env
# Edit .env with your database and JWT settings

# Database setup
npx prisma generate
npx prisma migrate dev

# Development
npm run dev

# Build
npm run build

# Production start
npm start
```

### Testing
```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run specific test file
npx jest __tests__/app.test.ts
```

## Test Coverage

The test suite covers:

- **Authentication & Authorization**: Token validation, role checks
- **Input Validation**: Zod schema validation for all endpoints
- **Error Handling**: Centralized error handling and 404 responses
- **Security**: Rate limiting, CORS, security headers
- **Middleware**: Request size limits, validation order
- **API Endpoints**: All CRUD operations and business logic

### Test Files
- `__tests__/app.test.ts` - Core app functionality and auth
- `__tests__/attendance.test.ts` - Attendance system tests
- `__tests__/admin.test.ts` - Admin CRUD operations
- `__tests__/payroll.test.ts` - Payroll and dashboard tests
- `__tests__/qr.test.ts` - QR generation tests
- `__tests__/integration.test.ts` - Middleware and integration tests

## Deployment

### Docker Deployment
```bash
# Build and run with Docker Compose
docker compose up -d --build

# View logs
docker compose logs -f backend
```

### Environment Variables
```env
NODE_ENV=production
PORT=3001
DATABASE_URL=postgresql://user:pass@host:5432/db
JWT_SECRET=your-secure-secret
SWAGGER_SERVER_URL=https://yourdomain.com
```

### Production Considerations
- Set strong `JWT_SECRET`
- Configure database connection pooling
- Set up monitoring and logging
- Configure rate limiting for production traffic
- Set up SSL/TLS termination

## Security Features

- **Helmet**: Security headers and protections
- **Rate Limiting**: 120 requests per minute per IP
- **CORS**: Configurable cross-origin policies
- **Input Validation**: Zod schema validation
- **JWT Security**: Secure token handling with expiration
- **Request Limits**: 1MB JSON payload limit

## Database Schema

The system uses PostgreSQL with Prisma ORM:

- **Shop**: Store information and settings
- **Employee**: Staff details, schedules, and pay
- **AttendanceRecord**: Clock in/out tracking with calculations

## Contributing

1. Follow TypeScript best practices
2. Add tests for new features
3. Update Swagger documentation
4. Validate all inputs with Zod schemas
5. Maintain consistent error handling

## License

ISC License
