# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a monorepo containing a NestJS backend with Casbin authorization and a React frontend. The project is structured with two main directories:
- `backend/` - NestJS application with PostgreSQL and Casbin
- `frontend/` - React application with Material-UI

## Development Commands

### Backend (run from backend/ directory)
- `npm run start:dev` - Start development server with auto-reload
- `npm run start` - Start production server
- `npm test` - Run unit tests
- `npm run test:e2e` - Run end-to-end tests
- `npm run seed` - Seed database with test data
- `npm run db:reset` - Reset database and re-seed

### Frontend (run from frontend/ directory)
- `npm start` - Start React development server (uses custom port finder)
- `npm run build` - Build for production
- `npm test` - Run React tests

## Database Setup

The backend requires PostgreSQL. Connection is configured via `.env` file in the backend directory:
```
DATABASE_URL=postgresql://postgres:password123@localhost:5432/nest-casbin-poc
```

The application uses TypeORM with `synchronize: true` for development, so the database schema is automatically created.

## Architecture

### Authorization System
- **Casbin** is used for role-based access control (RBAC) with domain-based policies
- **PoliciesGuard** - Custom NestJS guard that enforces Casbin policies
- **@CheckPolicies** decorator - Applied to controller routes to specify required permissions
- **AF_APPROVER** role - Special role for AF department staff to approve AF_REVIEW stage across all departments
- Policies are stored in PostgreSQL using `typeorm-adapter`

### Key Modules
- **AuthModule** - Contains user context and authorization guards
- **CasbinModule** - Configures Casbin with TypeORM adapter
- **UsersModule** - User management with UUID primary keys
- **RequestsModule** - Business request workflow
- **ApprovalsModule** - Approval workflow management
- **DepartmentsModule** - Department hierarchy

### Domain Models
All domain interfaces are centralized in `src/common/models/domain.ts`:
- User, Department, RequestEntity, Approval, ApprovalRule
- Uses UUIDs for all primary keys
- Request workflow follows: DRAFT → SUBMITTED → IN_REVIEW → APPROVED/REJECTED

### Authentication Simulation
The app simulates authentication via `x-user-email` header. The `UserContext` service resolves this to a user ID from the database.

### Data Flow
1. Controllers use `@CheckPolicies` decorator for authorization
2. `PoliciesGuard` enforces Casbin policies before route execution
3. Services handle business logic with dependency injection
4. TypeORM entities map to PostgreSQL tables
5. All IDs are UUIDs, validated with `ParseUUIDPipe`

## Testing Strategy
- Unit tests use Jest with ts-jest
- E2E tests validate full request flows with supertest
- Tests must pass authorization checks via headers
- Database is reset between test suites