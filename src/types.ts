export type UserRole = 'staff' | 'manager' | 'hr' | 'admin' | 'ceo';

export interface UserProfile {
  uid: string;
  fullName: string;
  email: string;
  phoneNumber?: string;
  employeeNumber: string;
  department: string;
  role: UserRole;
  supervisorId?: string;
  leaveBalance: number;
  status: 'active' | 'inactive';
  createdAt: string;
}

export type LeaveStatus = 
  | 'pending_supervisor' 
  | 'pending_hr' 
  | 'pending_ceo' 
  | 'approved' 
  | 'rejected' 
  | 'clarification' 
  | 'cancelled';

export interface LeaveRequest {
  id: string;
  applicantId: string;
  applicantName: string;
  applicantEmail?: string;
  applicantPhoneNumber?: string;
  department: string;
  leaveType: string;
  requiresEscalation?: boolean;
  startDate: string;
  endDate: string;
  totalDays: number;
  reason: string;
  attachmentUrl?: string;
  status: LeaveStatus;
  currentApproverId?: string;
  supervisorDecision?: Decision;
  hrDecision?: Decision;
  ceoDecision?: Decision;
  comments: Comment[];
  submittedAt: string;
  updatedAt: string;
}

export interface Decision {
  status: 'approved' | 'rejected' | 'clarification';
  comment: string;
  approverId: string;
  approverName: string;
  timestamp: string;
}

export interface Comment {
  authorId: string;
  authorName: string;
  text: string;
  timestamp: string;
}

export interface LeaveType {
  id: string;
  name: string;
  maxDays: number;
  requiresAttachment: boolean;
  requiresEscalation: boolean;
  description?: string;
}

export interface Department {
  id: string;
  name: string;
  headId: string;
}

export interface Holiday {
  id: string;
  date: string;
  name: string;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  actorId: string;
  actorName: string;
  action: string;
  details: string;
  targetId?: string;
}

export interface SystemConfig {
  enableCarryForward: boolean;
  maxCarryForwardDays: number;
  carryForwardExpiryDate: string;
}
