import { LeaveStatus } from './types';

export const LEAVE_STATUS_LABELS: Record<LeaveStatus, string> = {
  pending_supervisor: 'Pending Supervisor',
  pending_hr: 'Pending HR',
  pending_ceo: 'Pending CEO',
  approved: 'Approved',
  rejected: 'Rejected',
  clarification: 'Clarification Needed',
  cancelled: 'Cancelled',
};

export const LEAVE_STATUS_COLORS: Record<LeaveStatus, string> = {
  pending_supervisor: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  pending_hr: 'bg-blue-100 text-blue-800 border-blue-200',
  pending_ceo: 'bg-purple-100 text-purple-800 border-purple-200',
  approved: 'bg-green-100 text-green-800 border-green-200',
  rejected: 'bg-red-100 text-red-800 border-red-200',
  clarification: 'bg-orange-100 text-orange-800 border-orange-200',
  cancelled: 'bg-gray-100 text-gray-800 border-gray-200',
};

export const ROLE_LABELS: Record<string, string> = {
  staff: 'Staff Member',
  manager: 'Line Manager',
  hr: 'HR Officer',
  admin: 'System Administrator',
  ceo: 'Senior Management',
};
