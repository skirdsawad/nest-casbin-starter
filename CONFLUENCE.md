# NestJS Casbin Starter - ABAC Implementation Guide

## Overview

This project implements an **Attribute-Based Access Control (ABAC)** system using **Casbin** within a **NestJS** framework for a request approval workflow system. The implementation demonstrates domain-based role assignments with cross-department approval capabilities.

## Requirements

### Functional Requirements

1. **User Management**
   - Create users with department and role assignments
   - Enforce department selection during user creation
   - Automatic role assignment in Casbin upon user creation
   - Special cross-department roles for AF and CG departments

2. **Department Management**
   - Create and manage departments
   - Validate department codes (2-5 uppercase letters)
   - Department-based request isolation

3. **Request Workflow**
   - Multi-stage approval process (DEPT_HEAD → AF_REVIEW → CG_REVIEW)
   - Department-specific request creation
   - Cross-department visibility for AF and CG approvers
   - Status tracking (DRAFT → IN_REVIEW → APPROVED/REJECTED)

4. **Role-Based Permissions**
   - **STAFF**: Create and submit requests within own department
   - **HD (Head of Department)**: Approve requests at DEPT_HEAD stage
   - **AF_APPROVER**: Approve at AF_REVIEW stage across all departments
   - **CG_APPROVER**: Approve at CG_REVIEW stage + view AF_REVIEW stage

### Non-Functional Requirements

- **Security**: Enforce domain-based permissions with wildcard support
- **Scalability**: Support multiple departments and users
- **Auditability**: Track request lifecycle and approval decisions
- **Usability**: Intuitive UI for request management

## ABAC Model with Casbin

### Access Control Model

The system uses Casbin's **RBAC with domains** model defined in `backend/src/common/casbin/model.conf`:

```conf
[request_definition]
r = sub, dom, obj, act

[policy_definition]
p = sub, dom, obj, act

[role_definition]
g = _, _, _

[policy_effect]
e = some(where (p.eft == allow))

[matchers]
m = (g(r.sub, p.sub, r.dom) || g(r.sub, p.sub, "*")) && (r.dom == p.dom || p.dom == "*") && r.obj == p.obj && r.act == p.act
```

### Key Components

- **Subject (sub)**: User ID
- **Domain (dom)**: Department code (HR, IT, AF, CG, etc.) or wildcard (*)
- **Object (obj)**: Resource type (users, requests, departments)
- **Action (act)**: Operation (create, edit, view, approve:STAGE)

### Role Hierarchy

1. **Department-Specific Roles**
   - `STAFF` in specific departments (e.g., HR, IT)
   - `HD` (Head of Department) in specific departments

2. **Cross-Department Roles**
   - `AF_APPROVER` with wildcard domain (*) for AF department users
   - `CG_APPROVER` with wildcard domain (*) for CG department users

### Permission Matrix

| Role | Domain | Object | Actions |
|------|--------|--------|---------|
| STAFF | Dept | requests | create, edit |
| HD | Dept | requests | create, edit, approve:DEPT_HEAD |
| AF_APPROVER | * | requests | approve:AF_REVIEW |
| CG_APPROVER | * | requests | approve:CG_REVIEW, view:AF_REVIEW |

## Implementation Architecture

### Backend Structure

```
backend/src/
├── common/
│   ├── auth/                    # Authentication & authorization
│   ├── casbin/                  # Casbin configuration
│   │   ├── casbin.module.ts     # Global Casbin module
│   │   ├── casbin.service.ts    # Casbin operations
│   │   └── model.conf           # ABAC model definition
│   └── entities/                # TypeORM entities
├── users/                       # User management
│   ├── dto/create-user.dto.ts   # User creation validation
│   ├── users.service.ts         # User business logic
│   ├── users.controller.ts      # REST endpoints
│   └── users.module.ts          # Module configuration
├── departments/                 # Department management
├── requests/                    # Request workflow
└── approvals/                   # Approval logic
```

### Frontend Structure

```
frontend/src/
├── App.js                      # Main application component
├── CreateUser.js               # User creation dialog
├── CreateDepartment.js         # Department creation dialog
└── Requests.js                 # Request management interface
```

## Technical Implementation Details

### 1. User Creation with Automatic Role Assignment

**Backend: `users.service.ts:19-52`**

```typescript
async create(createUserDto: CreateUserDto): Promise<User> {
  // Validate department exists
  const department = await this.departmentsRepository.findByCode(createUserDto.department);
  if (!department) {
    throw new BadRequestException(`Department '${createUserDto.department}' does not exist`);
  }

  // Create user
  const newUser = await this.repository.create({
    displayName: createUserDto.displayName,
    email: createUserDto.email,
  });

  // Assign primary role in Casbin
  await this.enforcer.addRoleForUser(newUser.id, createUserDto.role, createUserDto.department);

  // Assign special cross-department roles
  if (createUserDto.department === 'AF') {
    await this.enforcer.addRoleForUser(newUser.id, 'AF_APPROVER', '*');
  }
  if (createUserDto.department === 'CG') {
    await this.enforcer.addRoleForUser(newUser.id, 'CG_APPROVER', '*');
  }

  await this.enforcer.savePolicy();
  return newUser;
}
```

### 2. Department Validation and Creation

**DTO Validation: `departments/dto/create-department.dto.ts`**

```typescript
export class CreateDepartmentDto {
  @IsNotEmpty()
  @IsString()
  @IsUppercase()
  @Length(2, 5)
  @Matches(/^[A-Z]+$/, { message: 'Code must contain only uppercase letters' })
  code: string;

  @IsNotEmpty()
  @IsString()
  @Length(3, 50)
  name: string;
}
```

### 3. Request Workflow with Stage-Based Approvals

**Request Service: `requests.service.ts:22-44`**

```typescript
async list(departmentId: string): Promise<RequestWithActionsDto[]> {
  const userId = await this.userContext.getUserId();
  const requests = await this.repository.findByDepartmentId(departmentId);
  const deptCode = await this.depts.getCodeById(departmentId);

  return Promise.all(
    requests.map(async (req) => {
      const permittedActions: string[] = [];
      if (req.status === 'DRAFT') {
        if (await this.casbin.enforce(userId, deptCode, 'requests', 'edit')) {
          permittedActions.push('submit');
        }
      }
      if (req.status === 'IN_REVIEW') {
        const action = `approve:${req.stageCode}`;
        if (await this.casbin.enforce(userId, deptCode, 'requests', action)) {
          permittedActions.push('approve', 'reject');
        }
      }
      return { ...req, permittedActions };
    }),
  );
}
```

### 4. Cross-Department Visibility

**Reviewable Requests: `requests.service.ts:46-79`**

```typescript
async findReviewable(): Promise<RequestWithActionsDto[]> {
  const userId = await this.userContext.getUserId();
  const requests = await this.repository.findInReview();
  const allDepts = await this.depts.findAll();
  const deptCodeMap = new Map(allDepts.map((d) => [d.id, d.code]));

  const reviewableRequests: RequestWithActionsDto[] = [];

  for (const req of requests) {
    const deptCode = deptCodeMap.get(req.departmentId);
    if (!deptCode) continue;

    const action = `approve:${req.stageCode}`;
    const canApproveDept = await this.casbin.enforce(userId, deptCode, 'requests', action);
    const canApproveGlobal = await this.casbin.enforce(userId, '*', 'requests', action);

    if (canApproveDept || canApproveGlobal) {
      reviewableRequests.push({
        ...req,
        permittedActions: ['approve', 'reject'],
      });
    } else if (req.stageCode === 'AF_REVIEW') {
      // CG users can view AF_REVIEW stage
      const canViewAfReview = await this.casbin.enforce(userId, '*', 'requests', 'view:AF_REVIEW');
      if (canViewAfReview) {
        reviewableRequests.push({
          ...req,
          permittedActions: [], // View-only
        });
      }
    }
  }
  return reviewableRequests;
}
```

## Database Schema

### Casbin Rules Table (`casbin_rule`)

Automatically managed by TypeOrmAdapter:

| Column | Type | Description |
|--------|------|-------------|
| ptype | varchar | Policy type (g for roles, p for permissions) |
| v0 | varchar | Subject (user ID) |
| v1 | varchar | Role or domain |
| v2 | varchar | Domain or object |
| v3 | varchar | Action (for permissions) |

### Example Role Assignments

```sql
-- User 123 has STAFF role in HR department
INSERT INTO casbin_rule (ptype, v0, v1, v2) VALUES ('g', '123', 'STAFF', 'HR');

-- User 456 has AF_APPROVER role with wildcard domain
INSERT INTO casbin_rule (ptype, v0, v1, v2) VALUES ('g', '456', 'AF_APPROVER', '*');
```

## Security Considerations

### 1. Domain Isolation
- Requests are isolated by department through domain-based permissions
- Users can only see/modify requests in their assigned departments
- Cross-department roles use wildcard domains for broader access

### 2. Stage-Based Approval
- Each approval stage requires specific permissions
- `approve:DEPT_HEAD`, `approve:AF_REVIEW`, `approve:CG_REVIEW`
- Prevents unauthorized stage bypassing

### 3. Input Validation
- DTO validation with class-validator decorators
- Department code format enforcement
- Email and display name validation

### 4. Role Assignment Automation
- Automatic Casbin rule creation prevents orphaned users
- Special role assignment for AF/CG departments
- Consistent role structure enforcement

## Testing Strategy

### 1. Unit Tests
- Service layer business logic
- DTO validation rules
- Casbin permission enforcement

### 2. Integration Tests
- API endpoint functionality
- Database transactions
- Casbin rule persistence

### 3. End-to-End Tests
- Complete request workflow
- Multi-user approval scenarios
- Cross-department visibility

## Deployment Considerations

### 1. Environment Configuration
- Database connection for Casbin adapter
- JWT secret configuration
- CORS settings for frontend

### 2. Database Migration
- Casbin rule table creation
- Seeding initial departments and permissions
- User data migration

### 3. Performance Optimization
- Casbin policy caching
- Database indexing on frequently queried fields
- Frontend state management optimization

## Future Enhancements

### 1. Advanced ABAC Features
- Time-based permissions (e.g., approval deadlines)
- Location-based access control
- Dynamic policy updates

### 2. Audit Trail
- Complete request lifecycle logging
- User action tracking
- Permission change history

### 3. Notification System
- Email notifications for approval requests
- Real-time updates via WebSocket
- Slack/Teams integration

### 4. Advanced UI Features
- Bulk approval operations
- Advanced filtering and search
- Dashboard with analytics

## Conclusion

This implementation demonstrates a robust ABAC system using Casbin within a NestJS application. The domain-based role model provides flexible permission management while maintaining security through proper isolation and validation. The automatic role assignment and cross-department visibility features showcase advanced ABAC capabilities suitable for enterprise workflow systems.

The modular architecture ensures maintainability and extensibility, while the comprehensive validation and error handling provide a production-ready foundation for request approval workflows.