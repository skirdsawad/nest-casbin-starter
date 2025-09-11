# Seed Data Scenarios for POC

This document describes the complete seed data that demonstrates all approval workflow scenarios in the nest-casbin-starter application.

## Users Created

### Department Heads
- `hr.head@example.com` - HR Head (can approve DEPT_HEAD stage for HR)
- `mkt.head@example.com` - Marketing Head (can approve DEPT_HEAD stage for MKT)
- `it.head@example.com` - IT Head (can approve DEPT_HEAD stage for IT)
- `sp.head@example.com` - Strategic Planning Head (can approve DEPT_HEAD stage for SP)
- `af.head@example.com` - AF Head (can approve DEPT_HEAD stage for AF + AF_REVIEW for all departments)

### Department Staff
- `hr.user@example.com` - HR User (can create/edit requests in HR)
- `hr.staff2@example.com` - HR Staff 2 (additional HR staff)
- `mkt.user@example.com` - Marketing User (can create/edit requests in MKT)
- `mkt.staff2@example.com` - Marketing Staff 2 (additional MKT staff)
- `it.user@example.com` - IT User (can create/edit requests in IT)
- `sp.user@example.com` - SP User (can create/edit requests in SP)
- `af.user@example.com` - AF User (can create/edit requests in AF + approve AF_REVIEW for all departments)

### Global Roles
- `amd.user@example.com` - AMD User (can approve AMD_REVIEW stage)
- `cg.user@example.com` - CG User (can bulk approve and view all requests)

## Departments Created
- `HR` - Human Resources
- `MKT` - Marketing  
- `IT` - IT
- `SP` - Strategic&Planning
- `AF` - Accounting&Financial

## Sample Requests Created

### 1. DRAFT Request (HR)
- **Creator**: `hr.user@example.com`
- **Department**: HR
- **Status**: DRAFT
- **Stage**: DEPT_HEAD
- **Payload**: Leave Request - Annual leave for 5 days
- **Description**: Shows a request that hasn't been submitted yet

### 2. SUBMITTED Request (Marketing)
- **Creator**: `mkt.user@example.com` 
- **Department**: MKT
- **Status**: SUBMITTED
- **Stage**: DEPT_HEAD
- **Payload**: Budget Request - Marketing campaign budget $50,000
- **Description**: Shows a request waiting for department head approval

### 3. IN_REVIEW Request (IT)
- **Creator**: `it.user@example.com`
- **Department**: IT
- **Status**: IN_REVIEW
- **Stage**: AF_REVIEW
- **Payload**: Equipment Purchase - New servers for data center
- **Description**: Shows a request that passed HD approval and is now waiting for AF approval
- **Existing Approval**: IT Head has already approved at DEPT_HEAD stage

### 4. AF Department Request
- **Creator**: `af.user@example.com`
- **Department**: AF
- **Status**: SUBMITTED
- **Stage**: DEPT_HEAD
- **Payload**: Audit Request - External audit preparation
- **Description**: Shows AF department request (should end after HD approval, no AF_REVIEW needed)

### 5. APPROVED Request (SP)
- **Creator**: `sp.user@example.com`
- **Department**: SP
- **Status**: APPROVED
- **Stage**: AF_REVIEW
- **Payload**: Strategic Plan - Q4 strategic planning document
- **Description**: Shows a fully approved request that went through both stages
- **Existing Approvals**: SP Head approved at DEPT_HEAD, AF User approved at AF_REVIEW

### 6. REJECTED Request (HR)
- **Creator**: `hr.staff2@example.com`
- **Department**: HR
- **Status**: REJECTED
- **Stage**: DEPT_HEAD
- **Payload**: Training Request - Expensive external training course
- **Description**: Shows a request rejected by department head
- **Existing Approval**: HR Head rejected at DEPT_HEAD stage

## Approval Workflow Scenarios Demonstrated

### Scenario A: Normal 2-Step Approval (HR, MKT, IT, SP departments)
1. Staff creates request → DRAFT
2. Staff submits request → SUBMITTED (DEPT_HEAD stage)
3. Department Head approves → IN_REVIEW (AF_REVIEW stage)
4. AF staff/head approves → APPROVED

### Scenario B: AF Department 1-Step Approval
1. AF staff creates request → DRAFT
2. AF staff submits request → SUBMITTED (DEPT_HEAD stage)
3. AF Head approves → APPROVED (no AF_REVIEW stage)

### Scenario C: Rejection at Department Head Level
1. Staff creates request → DRAFT
2. Staff submits request → SUBMITTED (DEPT_HEAD stage)
3. Department Head rejects → REJECTED

### Scenario D: Rejection at AF Review Level (can be tested)
1. Request reaches AF_REVIEW stage
2. AF staff/head rejects → REJECTED

## Key Authorization Rules Demonstrated

1. **Department-based permissions**: Users can only create/edit requests in their own department
2. **Cross-department AF approval**: AF staff get `AF_APPROVER` role with `*` domain to approve AF_REVIEW stage for requests from any department
3. **Self-approval prevention**: Users cannot approve their own requests
4. **Role-based stage approval**: Only users with appropriate roles can approve specific stages
5. **AF department special workflow**: AF department requests skip AF_REVIEW stage
6. **Global AF approval rights**: AF staff have both STAFF role in AF department AND AF_APPROVER role globally

## Testing the Complete Workflow

To see the complete workflow in action:

1. Run `npm run db:reset` to seed all data
2. Use different `x-user-email` headers to simulate different users
3. Test creating requests as various staff members
4. Test approving requests as department heads
5. Test AF approval workflow with AF staff
6. Verify AF department requests end after HD approval

Example test sequence:
```bash
# Create request as HR user
curl -H "x-user-email: hr.user@example.com" -X POST localhost:3000/requests -d '{"departmentId":"<HR_DEPT_ID>","payload":{"type":"test"}}'

# Approve as HR head  
curl -H "x-user-email: hr.head@example.com" -X POST localhost:3000/requests/<REQUEST_ID>/approve -d '{"decision":"approve"}'

# Approve as AF user
curl -H "x-user-email: af.user@example.com" -X POST localhost:3000/requests/<REQUEST_ID>/approve -d '{"decision":"approve"}'
```