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
