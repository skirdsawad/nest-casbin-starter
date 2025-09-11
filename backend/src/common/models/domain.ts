
export type RoleCode = 'HD' | 'STAFF' | 'EXEC' | 'AMD' | 'CG' | 'ADMIN' | 'AF_APPROVER';

export interface User {
  id: string;
  email: string;
  displayName: string;
  isActive: boolean;
}

export interface Department {
  id: string;
  code: string;  // e.g., 'D10'
  name: string;
}

export type RequestStatus = 'DRAFT' | 'SUBMITTED' | 'IN_REVIEW' | 'APPROVED' | 'REJECTED';

export interface RequestEntity {
  id: string;
  departmentId: string;
  createdBy: string;         // userId
  status: RequestStatus;
  stageCode: string;         // e.g., 'DEPT_HEAD', 'AMD_REVIEW'
  payload: any;              // business fields
  createdAt: Date;
  updatedAt: Date;
}

export interface Approval {
  id: string;
  requestId: string;
  approverId: string;
  stageCode: string;         // stage approved
  decision: 'approve' | 'reject';
  decidedAt: Date;
}

export interface ApprovalRule {
  id: string;
  departmentId: string;
  stageCode: string;         // 'DEPT_HEAD' or 'AMD_REVIEW'
  minApprovers: number;      // 1 or 2
  fallbackRole?: RoleCode;   // e.g., 'AMD' when no HD exists
}
