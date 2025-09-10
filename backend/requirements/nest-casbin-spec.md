# NestJS Backend Spec — Department-Scoped Approvals (No DB RLS, Policy-as-Code)

**Goal**  
Build a department-scoped request/approval backend in **NestJS**. All visibility and actions are enforced in the **backend only** (no DB Row-Level Security). Policies and approval requirements are configurable without code changes.

---

## Key Requirements

- Department isolation: a user sees/acts only within allowed department(s).
- Roles: **HD** (Head of Dept), **AF** (Accounting/Finance), **EXEC** (Executive), **AMD** (Assistant MD), **CG** (Controlling Group), **ADMIN**.
- Some departments have **two HDs** → either **1-of-2** or **2-of-2** approvals.
- Some departments **have no HD** → approval **falls back to AMD**.
- Co-approval & fallback rules are **per department** and stored in DB/config.
- CG can **bulk approve/reject** (MC out of scope, but CG bulk action included).
- All authorization enforced in app with **Casbin (policy-as-code)**; no DB RLS.
- Provide **e2e tests** for visibility, approve flows, co-approve, fallback, bulk.

---

## Tech Stack

- **NestJS** (`@nestjs/common`, `@nestjs/core`, `@nestjs/platform-express`)
- **Auth**: simple header (`x-user-id`) for tests; swap to **JWT** later
- **Policy**: **Casbin** (`node-casbin`); start with in-memory seed, plug adapter later
- **DB Layer**: start with **in-memory repos**; later replace with Prisma/TypeORM
- **Tests**: **Jest** + **Supertest** (e2e)

> You can begin with an in-memory Casbin **StringAdapter**; later move policy to SQL via adapter without changing route code.

---

## Domain Model (Minimal)

```ts
export type RoleCode = 'HD' | 'AF' | 'EXEC' | 'AMD' | 'CG' | 'ADMIN';

export interface User {
  id: string;
  email: string;
  displayName: string;
  isActive: boolean;
}

export interface Department {
  id: number;
  code: string;  // e.g., 'D10'
  name: string;
}

export type RequestStatus = 'DRAFT' | 'SUBMITTED' | 'IN_REVIEW' | 'APPROVED' | 'REJECTED';

export interface RequestEntity {
  id: number;
  departmentId: number;
  createdBy: string;         // userId
  status: RequestStatus;
  stageCode: string;         // e.g., 'DEPT_HEAD', 'AMD_REVIEW'
  payload: any;              // business fields
  createdAt: Date;
  updatedAt: Date;
}

export interface Approval {
  id: number;
  requestId: number;
  approverId: string;
  stageCode: string;         // stage approved
  decision: 'approve' | 'reject';
  decidedAt: Date;
}

export interface ApprovalRule {
  id: number;
  departmentId: number;
  stageCode: string;         // 'DEPT_HEAD' or 'AMD_REVIEW'
  minApprovers: number;      // 1 or 2
  fallbackRole?: RoleCode;   // e.g., 'AMD' when no HD exists
}
```

> **DB uniqueness:** enforce unique `(requestId, stageCode, approverId)` to prevent duplicate approvals by the same user.

---

## Authorization Model (Casbin RBAC with Domains)

- **domain = department code** (`'D15'`, `'D19'`, or `'*'` for global).
- **object =** `'requests'`
- **action =** `'view' | 'create' | 'edit' | 'bulk_approve' | 'approve:DEPT_HEAD' | 'approve:AMD_REVIEW'`

### Casbin Model (`casbin/model.conf`)

```ini
[request_definition]
r = sub, dom, obj, act      # subject(userId), domain(dept), object, action

[policy_definition]
p = sub, dom, obj, act

[role_definition]
g = _, _, _                 # user -> role in a domain (dept)

[policy_effect]
e = some(where (p.eft == allow))

[matchers]
m = (g(r.sub, p.sub, r.dom) || g(r.sub, p.sub, "*")) && (r.dom == p.dom || p.dom == "*") && r.obj == p.obj && r.act == p.act
```

> The matcher allows either a role in the specific department **or** a global `*` domain (for AF/CG/AMD).

### Policy Seed (permissions) — examples

```
# AF (global) can view/create/edit for any department
p, AF,   *,   requests, view
p, AF,   *,   requests, create
p, AF,   *,   requests, edit

# CG (global) can view + bulk approve + per-stage approve (to support bulk)
p, CG,   *,   requests, view
p, CG,   *,   requests, bulk_approve
p, CG,   *,   requests, approve:DEPT_HEAD
p, CG,   *,   requests, approve:AMD_REVIEW

# HD: per-dept approval at DEPT_HEAD stage (+ view/create/edit in own dept)
p, HD,  D15,  requests, view
p, HD,  D15,  requests, create
p, HD,  D15,  requests, edit
p, HD,  D15,  requests, approve:DEPT_HEAD

# AMD (global) can approve fallback stage
p, AMD,   *,  requests, approve:AMD_REVIEW
```

### Policy Seed (role bindings) — examples

```
# Dept with two HDs (D15)
g, user_hd_a, HD,  D15
g, user_hd_b, HD,  D15

# Dept with NO HD (D19) → no HD bindings

# AMD global
g, user_amd_1, AMD, *

# AF, CG global
g, user_af_1, AF, *
g, user_cg_1, CG, *
```

---

## Approval Rules (Data-Driven)

**Table:** `approval_rules(departmentId, stageCode, minApprovers, fallbackRole)`

Examples:
- Dept with two heads **requiring both** → `(D15, 'DEPT_HEAD', 2, NULL)`
- Dept with two heads, **only one** needed → `(D15, 'DEPT_HEAD', 1, NULL)`
- Dept **with no HD** → AMD fallback:  
  `(D19, 'DEPT_HEAD', 1, 'AMD')` and AMD must have `approve:AMD_REVIEW` permission

> Engine checks **eligibility** via Casbin and **completion** via `minApprovers`. If no eligible HD exists and `fallbackRole` is set, route to the fallback stage (e.g., `AMD_REVIEW`).

---

## NestJS Structure

```
src/
  app.module.ts
  common/
    auth/
      user-context.ts         # get userId from header/JWT
      auth.module.ts
    casbin/
      model.conf
      policy.seed.ts          # p/g lines for e2e; later move to DB adapter
      casbin.module.ts        # Enforcer provider
      casbin.util.ts          # helper to enforce & check eligibility
  departments/
    departments.module.ts
    departments.service.ts    # id → code mapping
  rules/
    rules.module.ts
    rules.service.ts          # approval_rules (replace with DB later)
  approvals/
    approvals.module.ts
    approvals.repository.ts   # in-memory; replace with DB later
    approvals.service.ts      # co-approval + fallback logic
  requests/
    dto/
      create-request.dto.ts
      approve.dto.ts
      bulk-action.dto.ts
    requests.repository.ts    # in-memory; replace with DB later
    requests.service.ts
    requests.controller.ts
test/
  e2e/
    app.e2e-spec.ts
```

---

## REST Endpoints

```
POST   /requests                      # create (deptId in body)
GET    /requests?departmentId=D15     # list by dept
GET    /requests/:id                  # detail (optional)
POST   /requests/:id/submit           # move to IN_REVIEW
POST   /requests/:id/approve          # { decision: 'approve' | 'reject' }
POST   /requests/bulk                 # CG only; { ids: number[], action: 'approve'|'reject' }
```

**Authorization (Casbin `enforce`)**

- List → `enforce(userId, deptCode, 'requests', 'view')`
- Create → `enforce(userId, deptCode, 'requests', 'create')`
- Edit/Submit → `enforce(userId, deptCode, 'requests', 'edit')`
- Approve (stage) → `enforce(userId, deptCode, 'requests', 'approve:DEPT_HEAD')` or `'approve:AMD_REVIEW'`
- Bulk → `enforce(userId, '*', 'requests', 'bulk_approve')` (plus per-stage rules for CG if item-level approval path is reused)

---

## Core Service Logic (Pseudo)

### Casbin Helper
```ts
policy.enforce(userId, deptCode, 'requests', act);
policy.hasAnyEligible('HD', deptCode, 'approve:DEPT_HEAD'); // true if any HD in dept can approve
```

### RequestsService
```ts
list(user, deptId):
  assert enforce(user, D(deptId), 'requests', 'view')
  return repo.listByDepartmentId(deptId)

create(user, deptId, payload):
  assert enforce(user, D(deptId), 'requests', 'create')
  initialStage = approvals.determineInitialStage(deptId) // HD or AMD fallback
  return repo.create({ departmentId: deptId, createdBy: user, payload, status: 'DRAFT', stageCode: initialStage })

submit(user, id):
  r = repo.get(id)
  assert enforce(user, D(r.departmentId), 'requests', 'edit')
  return repo.update(id, { status: 'IN_REVIEW' })

approve(user, id, decision):
  return approvals.approve(user, id, decision)

bulk(user, ids, action):
  assert enforce(user, '*', 'requests', 'bulk_approve')
  return ids.map(id => approvals.approve(user, id, action))
```

### ApprovalsService
```ts
determineInitialStage(deptId):
  if policy.hasAnyEligible('HD', D(deptId), 'approve:DEPT_HEAD') return 'DEPT_HEAD'
  if rules[deptId,'DEPT_HEAD'].fallbackRole == 'AMD' return 'AMD_REVIEW'
  return 'DEPT_HEAD'

approve(user, requestId, decision):
  req = get(requestId)
  dept = D(req.departmentId)
  action = 'approve:' + req.stageCode
  assert enforce(user, dept, 'requests', action)

  approvals.addUnique(requestId, stage=req.stageCode, approver=user, decision)
  if decision == 'reject': return finalizeReject(req)

  rule = rules[req.departmentId, req.stageCode] || { minApprovers: 1 }
  if approvals.countDistinctApprove(requestId, req.stageCode) >= rule.minApprovers:
      finalizeApprove(req)
  return req
```

---

## DTOs

```ts
export class CreateRequestDto {
  departmentId: number;
  payload?: Record<string, any>;
}

export class ApproveDto {
  decision: 'approve' | 'reject';
}

export class BulkActionDto {
  ids: number[];
  action: 'approve' | 'reject';
}
```

---

## E2E Test Plan

**Seed**
- Departments: `D15` (two HDs), `D19` (no HD)
- Rules:
  - `(D15, 'DEPT_HEAD', 2, null)`
  - `(D19, 'DEPT_HEAD', 1, 'AMD')`
- Users: `user_hd_a`, `user_hd_b`, `user_amd_1`, `user_af_1`, `user_cg_1`
- Casbin policy: as above

**Scenarios**
1. **Visibility**
   - `user_hd_a` GET `/requests?departmentId=D15` → 200
   - `user_hd_a` GET `/requests?departmentId=D19` → 403
   - `user_af_1` GET `/requests?departmentId=D19` → 200
2. **Create/Edit/Submit**
   - `user_hd_a` POST `/requests` `{ departmentId: 15 }` → 201  
   - `user_hd_a` POST `/requests/:id/submit` → 201 (status to `IN_REVIEW`)
3. **Two-HD co-approval (D15)**  
   - A approves (count=1/2) → still `IN_REVIEW`  
   - B approves → `APPROVED`
4. **No-HD fallback (D19)**  
   - initial stage `AMD_REVIEW`  
   - `user_amd_1` approves → `APPROVED`
5. **Bulk approve (CG)**  
   - `user_cg_1` POST `/requests/bulk` → 200  
   - non-CG → 403
6. **Unauthorized & duplicates**  
   - `user_hd_a` tries approve AMD stage → 403  
   - same approver twice → error (duplicate)

---

## Implementation Notes

- **Identity** in tests via header `x-user-id`; later replace with JWT.
- **Policy helpers**:
  - `getAllowedDepartments(userId, obj, act)` (optional)  
  - `hasAnyEligible(role, deptCode, act)` — checks any user bound to role in domain can take action
- **Transactions** around approval writes; enforce uniqueness for `(requestId, stageCode, approverId)`.

---

## Non-Goals / Out of Scope

- MC decision capture (only CG bulk action included)
- Notifications
- Frontend
- DB adapters (for both repos and Casbin) — can be added later without route changes

---

## Deliverables Checklist

- [ ] `casbin/model.conf` and policy seed (`p`/`g`) for D15 & D19
- [ ] `rules` service (or table) with seeds for `(D15, DEPT_HEAD, 2)` and `(D19, DEPT_HEAD, 1, 'AMD')`
- [ ] `CasbinModule` + `PolicyUtil`
- [ ] `RequestsController/Service/Repo` (list/create/submit/approve/bulk)
- [ ] `ApprovalsService/Repo` (co-approval & fallback)
- [ ] E2E tests for all scenarios

---

### Notes / Updates from Testing
- **Casbin matcher** must allow global `*` domain in grouping and permissions (see model above).  
- To make **“Bulk approve: CG only”** pass while reusing per-item approval, grant CG:
  - `p, CG, *, requests, approve:DEPT_HEAD`  
  - `p, CG, *, requests, approve:AMD_REVIEW`
