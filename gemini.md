## Project Structure Update (September 2025)

The entire NestJS application, including the `src` and `test` directories, is located within the `backend` subdirectory. All file paths in the summaries below should be considered relative to the `backend` directory.

---

# Gemini Code Assist Workspace

This file can be used to store information and context about the project.

## Project Refactoring Summary (September 2025)

The project was refocused to align with the specifications in `requirements/nest-casbin-spec.md` and to follow proper NestJS conventions.

### Key Changes:

1.  **Domain Models**: Created a central `src/common/models/domain.ts` file for all domain entities as specified.
2.  **Dependency Injection**:
    *   Converted all in-memory data repositories (`Approvals`, `Requests`, `Departments`, `Rules`) from simple object literals into injectable NestJS services (`@Injectable()`).
    *   Refactored all services (`ApprovalsService`, `RequestsService`, etc.) to use constructor-based dependency injection for their repository and service dependencies.
3.  **Authentication & Authorization**:
    *   `UserContext` was refactored into a request-scoped injectable service to provide the current user's ID.
    *   `CasbinUtil` was renamed to `CasbinService` and provided via the `CasbinModule` to better align with NestJS patterns.
4.  **Modules**:
    *   Updated all feature modules (`ApprovalsModule`, `RequestsModule`, etc.) to correctly provide and export their services and repositories.
    *   Resolved a circular dependency between `ApprovalsModule` and `RequestsModule` by using `forwardRef`.
5.  **Controllers & DTOs**:
    *   The `RequestsController` was updated to use DTOs with `class-validator` decorators for request validation.
    *   Added `ValidationPipe` globally in `main.ts` to enable automatic request validation.
    *   Corrected HTTP status codes in the controller to return `200 OK` for updates and `201 Created` for new resources.
6.  **Error Handling**:
    *   Improved error handling for duplicate approvals, throwing a `BadRequestException` (400) instead of a generic `Error` (500).
7.  **Testing**:
    *   Updated the entire e2e test suite (`app.e2e-spec.ts`) to reflect the API changes (correct status codes, error responses).
    *   All tests are now passing, confirming the application behaves as specified.
8.  **Dependencies**: Added `class-validator` and `class-transformer` to support DTO validation.

---

### Guard-Based Authorization (September 2025)

To improve separation of concerns and make authorization more declarative, the imperative `casbin.enforce()` calls were removed from the `RequestsService` and replaced with a custom NestJS Guard.

**Implementation Details:**

1.  **`@CheckPolicies` Decorator**: A custom decorator (`src/common/auth/policies.decorator.ts`) was created to attach authorization metadata (e.g., `['requests', 'view']`) to controller routes.
2.  **`PoliciesGuard`**: A custom guard (`src/common/auth/policies.guard.ts`) was implemented. It:
    *   Injects the `CasbinService`, `UserContext`, and relevant repositories.
    *   Uses the `Reflector` to read the metadata set by the `@CheckPolicies` decorator.
    *   Dynamically determines the `departmentId` (the Casbin "domain") from route params, query params, or the request body.
    *   Handles global policies (like `bulk_approve`) where a specific department is not required.
    *   Calls `casbin.enforce()` with the correct user, domain, and policy.
3.  **Refactoring**:
    *   The `RequestsController` was updated to use `@UseGuards(PoliciesGuard)` and the `@CheckPolicies()` decorator on each route.
    *   The corresponding `casbin.enforce()` calls were removed from the `RequestsService`, simplifying its logic.
    *   The e2e tests were re-run and all passed, confirming the guard works as expected.

This approach makes the authorization logic reusable, declarative, and centralizes the enforcement logic, which is a significant improvement over the previous implementation.

---

## Database and Authentication Overhaul (September 2025)

The application was significantly refactored to move from an in-memory proof-of-concept to a more robust, database-driven architecture with proper user management.

### 1. PostgreSQL Integration (TypeORM)
*   **Persistence**: Replaced all in-memory array-based repositories with a PostgreSQL database managed by TypeORM.
*   **Dependencies**: Added `@nestjs/typeorm`, `typeorm`, and `pg`.
*   **Entities**: Created TypeORM entities for all domain models (`User`, `RequestEntity`, `Department`, `Approval`, `ApprovalRule`).
*   **Casbin Storage**: Integrated `typeorm-adapter` to store Casbin authorization policies and roles directly in the database, replacing the previous file-based `StringAdapter`.
*   **Schema Sync**: The main `AppModule` is configured with `synchronize: true` for development, allowing TypeORM to automatically create and update the database schema based on entity definitions.

### 2. UUID Primary Keys
*   **Data Model**: All primary keys (`id`) and corresponding foreign key columns were changed from auto-incrementing integers to UUIDs (`string`).
*   **API Impact**: Controller routes were updated to use `ParseUUIDPipe` for ID validation, and DTOs were updated with `@IsUUID` decorators.
*   **Services**: All services and repositories were updated to handle `string` IDs instead of `number`.

### 3. Configuration (`.env`)
*   **Environment Variables**: Added `@nestjs/config` to manage configuration.
*   **Security**: The hardcoded PostgreSQL connection string was removed from the source code. It is now stored in a `.env` file (`DATABASE_URL`) which is excluded from Git via `.gitignore`.
*   **Dynamic Configuration**: `AppModule` and `CasbinModule` were updated to be asynchronous and inject `ConfigService` to retrieve the database URL at runtime.

### 4. User Management Module
*   **Foundation**: A new, dedicated `UsersModule` was created with a `User` entity, `UsersRepository`, and `UsersService`.
*   **User Seeding**: The user repository now includes a `seed()` method to populate the database with a realistic set of users (department heads, staff, etc.).

### 5. Dynamic User Context & Authorization
*   **Database-Driven Auth**: The request-scoped `UserContext` service was refactored. It no longer uses a hardcoded `x-user-id` header.
*   **User Simulation**: It now simulates a logged-in user by fetching a user record from the database based on an `x-user-email` header.
*   **Asynchronous Update**: The `userId` property was replaced with an async `getUserId()` method. All dependent services (`RequestsService`, `PoliciesGuard`, `ApprovalsService`) were updated to `await` this method, making the entire request context aware of the asynchronous user lookup.
*   **Policy Seeding**: The Casbin policy seeding script was updated to use the UUIDs of the newly seeded users, linking authorization rules to actual user records.

### 6. Data Seeding
*   **Orchestration**: The main `seed.ts` script was overhauled to manage the entire seeding process in the correct order of dependency:
    1.  Seed Users
    2.  Seed Departments
    3.  Seed Rules (which depend on Department IDs)
    4.  Seed Casbin Policies (which depend on User IDs)
*   **Data Alignment**: The seed data for users, departments, and rules was updated to reflect a more realistic organizational structure (e.g., "Human Resources", "IT").
