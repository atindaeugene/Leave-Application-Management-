import React from 'react';
import { cn } from '../lib/utils';
import { LEAVE_STATUS_COLORS, LEAVE_STATUS_LABELS } from '../constants';
import { LeaveStatus } from '../types';

interface StatusBadgeProps {
  status: LeaveStatus;
  className?: string;
}

const StatusBadge: React.FC<StatusBadgeProps> = ({ status, className }) => {
  return (
    <span className={cn(
      "px-2.5 py-0.5 rounded-full text-xs font-medium border",
      LEAVE_STATUS_COLORS[status],
      className
    )}>
      {LEAVE_STATUS_LABELS[status]}
    </span>
  );
};

export default StatusBadge;
