import React, { useEffect, useState } from 'react';
import { collection, query, where, orderBy, onSnapshot, doc, updateDoc, addDoc, increment } from 'firebase/firestore';
import { toast } from 'sonner';
import { Check, X, MessageSquare, Eye } from 'lucide-react';
import { db } from '../firebase';
import { useAuth } from '../AuthContext';
import { LeaveRequest } from '../types';
import StatusBadge from '../components/StatusBadge';
import { formatDate, formatDateTime } from '../lib/utils';

import { sendNotification, sendSMSNotification } from '../lib/notifications';

const Approvals: React.FC = () => {
  const { profile, isManager, isHR, isCEO } = useAuth();
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState<LeaveRequest | null>(null);
  const [comment, setComment] = useState('');

  useEffect(() => {
    if (!profile) return;

    const q = query(
      collection(db, 'leave_requests'),
      where('currentApproverId', '==', profile.uid),
      where('status', 'in', ['pending_supervisor', 'pending_hr', 'pending_ceo']),
      orderBy('submittedAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setRequests(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as LeaveRequest)));
      setLoading(false);
    });

    return () => unsubscribe();
  }, [profile]);

  const handleAction = async (requestId: string, action: 'approve' | 'reject' | 'clarification') => {
    if (!profile || !comment && action !== 'approve') {
      toast.error('Comment is required for rejection or clarification.');
      return;
    }

    const request = requests.find(r => r.id === requestId);
    if (!request) return;

    try {
      let nextStatus = request.status;
      let nextApproverId = '';

      if (action === 'approve') {
        if (request.status === 'pending_supervisor') {
          nextStatus = 'pending_hr';
          // In a real app, we'd fetch the HR officer's ID or a group ID
          nextApproverId = 'hr_officer_id'; 
        } else if (request.status === 'pending_hr') {
          nextStatus = 'approved';
          // Deduct leave balance
          await updateDoc(doc(db, 'users', request.applicantId), {
            leaveBalance: increment(-request.totalDays)
          });
        }
      } else if (action === 'reject') {
        nextStatus = 'rejected';
      } else {
        nextStatus = 'clarification';
      }

      await updateDoc(doc(db, 'leave_requests', requestId), {
        status: nextStatus,
        currentApproverId: nextApproverId,
        updatedAt: new Date().toISOString(),
        comments: [...request.comments, {
          authorId: profile.uid,
          authorName: profile.fullName,
          text: comment || `Action: ${action}`,
          timestamp: new Date().toISOString()
        }]
      });

      // Notify Applicant
      if (request.applicantEmail) {
        let subject = `Leave Request Update: ${action.toUpperCase()}`;
        let body = `Hello ${request.applicantName},\n\nYour ${request.leaveType} request for ${request.totalDays} days (${request.startDate} to ${request.endDate}) has been ${action}d by ${profile.fullName}.\n\nStatus: ${nextStatus.replace('_', ' ').toUpperCase()}`;
        
        if (comment) {
          body += `\n\nComment: ${comment}`;
        }
        
        // Send Email
        await sendNotification({
          to: request.applicantEmail,
          subject,
          body
        });

        // Send SMS
        if (request.applicantPhoneNumber) {
          await sendSMSNotification({
            to: request.applicantPhoneNumber,
            body: `Devco LMS: Your ${request.leaveType} request has been ${action}d. Status: ${nextStatus.replace('_', ' ').toUpperCase()}`
          });
        }
      }

      toast.success(`Request ${action}d successfully.`);
      setSelectedRequest(null);
      setComment('');
    } catch (error) {
      console.error(error);
      toast.error('Failed to process request.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Pending Approvals</h1>
          <p className="text-gray-500">Review and take action on leave requests from your team.</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Applicant</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Dates</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Days</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {requests.length > 0 ? (
              requests.map((request) => (
                <tr key={request.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{request.applicantName}</div>
                    <div className="text-xs text-gray-500">{request.department}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{request.leaveType}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatDate(request.startDate)} - {formatDate(request.endDate)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">{request.totalDays}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <StatusBadge status={request.status} />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                    <button 
                      onClick={() => setSelectedRequest(request)}
                      className="text-blue-600 hover:text-blue-900 p-1 rounded-md hover:bg-blue-50"
                    >
                      <Eye size={18} />
                    </button>
                    <button 
                      onClick={() => handleAction(request.id, 'approve')}
                      className="text-green-600 hover:text-green-900 p-1 rounded-md hover:bg-green-50"
                    >
                      <Check size={18} />
                    </button>
                    <button 
                      onClick={() => {
                        setSelectedRequest(request);
                        // Focus comment box
                      }}
                      className="text-red-600 hover:text-red-900 p-1 rounded-md hover:bg-red-50"
                    >
                      <X size={18} />
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                  No pending requests found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Detail Modal */}
      {selectedRequest && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 shadow-2xl">
            <div className="flex justify-between items-start mb-6">
              <h2 className="text-xl font-bold text-gray-900">Review Leave Request</h2>
              <button onClick={() => setSelectedRequest(null)} className="text-gray-400 hover:text-gray-600">
                <X size={24} />
              </button>
            </div>

            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4 bg-gray-50 p-4 rounded-lg">
                <div>
                  <p className="text-xs text-gray-500 uppercase font-bold">Applicant</p>
                  <p className="font-medium">{selectedRequest.applicantName}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase font-bold">Leave Type</p>
                  <p className="font-medium">{selectedRequest.leaveType}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase font-bold">Duration</p>
                  <p className="font-medium">{formatDate(selectedRequest.startDate)} to {formatDate(selectedRequest.endDate)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase font-bold">Total Days</p>
                  <p className="font-medium">{selectedRequest.totalDays} Working Days</p>
                </div>
              </div>

              <div>
                <p className="text-xs text-gray-500 uppercase font-bold mb-1">Reason</p>
                <p className="text-gray-700 bg-white border border-gray-200 p-3 rounded-lg italic">
                  "{selectedRequest.reason}"
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Decision Comment</label>
                <textarea
                  rows={3}
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-[#8B0000] focus:border-[#8B0000]"
                  placeholder="Add a comment for your decision..."
                ></textarea>
              </div>

              <div className="flex gap-4 pt-4 border-t border-gray-100">
                <button
                  onClick={() => handleAction(selectedRequest.id, 'clarification')}
                  className="flex-1 px-4 py-2 border border-orange-300 text-orange-700 rounded-lg hover:bg-orange-50 transition-colors flex items-center justify-center gap-2"
                >
                  <MessageSquare size={18} /> Clarification
                </button>
                <button
                  onClick={() => handleAction(selectedRequest.id, 'reject')}
                  className="flex-1 px-4 py-2 border border-red-300 text-red-700 rounded-lg hover:bg-red-50 transition-colors flex items-center justify-center gap-2"
                >
                  <X size={18} /> Reject
                </button>
                <button
                  onClick={() => handleAction(selectedRequest.id, 'approve')}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
                >
                  <Check size={18} /> Approve
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Approvals;
