import React, { useState, useEffect } from 'react';
import { collection, addDoc, getDocs, doc, updateDoc, increment, serverTimestamp, getDoc } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Calendar, FileText, Info, AlertTriangle } from 'lucide-react';
import { db } from '../firebase';
import { useAuth } from '../AuthContext';
import { LeaveType } from '../types';
import { differenceInBusinessDays, parseISO, isBefore } from 'date-fns';
import { cn } from '../lib/utils';

import { sendNotification, sendSMSNotification } from '../lib/notifications';

const ApplyLeave: React.FC = () => {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [loading, setLoading] = useState(false);
  
  const [formData, setFormData] = useState({
    leaveType: '',
    startDate: '',
    endDate: '',
    reason: '',
  });

  useEffect(() => {
    const fetchLeaveTypes = async () => {
      const snapshot = await getDocs(collection(db, 'leave_types'));
      setLeaveTypes(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as LeaveType)));
    };
    fetchLeaveTypes();
  }, []);

  const calculateDays = () => {
    if (!formData.startDate || !formData.endDate) return 0;
    const start = parseISO(formData.startDate);
    const end = parseISO(formData.endDate);
    if (isBefore(end, start)) return 0;
    
    // Simple business days calculation (excluding weekends)
    // In a real app, we'd also exclude public holidays from the holidays collection
    return differenceInBusinessDays(end, start) + 1;
  };

  const totalDays = calculateDays();
  const selectedType = leaveTypes.find(t => t.id === formData.leaveType);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;

    if (totalDays <= 0) {
      toast.error('Invalid date range selected.');
      return;
    }

    if (formData.leaveType === 'annual' && totalDays > profile.leaveBalance) {
      toast.error('Insufficient leave balance.');
      return;
    }

    setLoading(true);
    try {
      const requestData = {
        applicantId: profile.uid,
        applicantName: profile.fullName,
        applicantEmail: profile.email,
        applicantPhoneNumber: profile.phoneNumber || '',
        department: profile.department,
        supervisorId: profile.supervisorId || '',
        leaveType: selectedType?.name || formData.leaveType,
        requiresEscalation: selectedType?.requiresEscalation || false,
        startDate: formData.startDate,
        endDate: formData.endDate,
        totalDays,
        reason: formData.reason,
        status: 'pending_supervisor',
        currentApproverId: profile.supervisorId || '',
        comments: [],
        submittedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await addDoc(collection(db, 'leave_requests'), requestData);
      
      // Audit log
      await addDoc(collection(db, 'audit_logs'), {
        timestamp: new Date().toISOString(),
        actorId: profile.uid,
        actorName: profile.fullName,
        action: 'LEAVE_SUBMITTED',
        details: `Submitted ${totalDays} days of ${requestData.leaveType}`,
      });

      // Notify Supervisor
      if (profile.supervisorId) {
        const supervisorDoc = await getDoc(doc(db, 'users', profile.supervisorId));
        if (supervisorDoc.exists()) {
          const supervisorData = supervisorDoc.data();
          const message = `Hello ${supervisorData.fullName},\n\n${profile.fullName} has submitted a new ${requestData.leaveType} request for ${totalDays} days (${formData.startDate} to ${formData.endDate}).\n\nPlease log in to the LMS to review and take action.\n\nReason: ${formData.reason}`;
          
          // Send Email
          await sendNotification({
            to: supervisorData.email,
            subject: `New Leave Request: ${profile.fullName}`,
            body: message
          });

          // Send SMS
          if (supervisorData.phoneNumber) {
            await sendSMSNotification({
              to: supervisorData.phoneNumber,
              body: `Devco LMS: New ${requestData.leaveType} request from ${profile.fullName} for ${totalDays} days. Please review.`
            });
          }
        }
      }

      toast.success('Leave application submitted successfully!');
      navigate('/my-requests');
    } catch (error) {
      console.error(error);
      toast.error('Failed to submit application. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Apply for Leave</h1>
        <p className="text-gray-500">Fill in the details below to submit your leave request.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Leave Type</label>
                <select
                  required
                  value={formData.leaveType}
                  onChange={(e) => setFormData({ ...formData, leaveType: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-[#8B0000] focus:border-[#8B0000]"
                >
                  <option value="">Select Leave Type</option>
                  {leaveTypes.map(type => (
                    <option key={type.id} value={type.id}>{type.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                <input
                  type="date"
                  required
                  min={new Date().toISOString().split('T')[0]}
                  value={formData.startDate}
                  onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-[#8B0000] focus:border-[#8B0000]"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                <input
                  type="date"
                  required
                  min={formData.startDate || new Date().toISOString().split('T')[0]}
                  value={formData.endDate}
                  onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-[#8B0000] focus:border-[#8B0000]"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Reason / Comments</label>
                <textarea
                  required
                  rows={4}
                  value={formData.reason}
                  onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-[#8B0000] focus:border-[#8B0000]"
                  placeholder="Provide a brief reason for your leave..."
                ></textarea>
              </div>
            </div>

            <div className="pt-4 border-t border-gray-100 flex justify-end gap-4">
              <button
                type="button"
                onClick={() => navigate('/')}
                className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || totalDays <= 0}
                className="px-6 py-2 bg-[#8B0000] text-white rounded-lg hover:bg-[#a00000] transition-colors disabled:opacity-50"
              >
                {loading ? 'Submitting...' : 'Submit Request'}
              </button>
            </div>
          </form>
        </div>

        <div className="space-y-6">
          {/* Summary Card */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Info size={18} className="text-[#8B0000]" />
              Summary
            </h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Total Days:</span>
                <span className="font-bold text-gray-900">{totalDays} Days</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Current Balance:</span>
                <span className="font-bold text-gray-900">{profile?.leaveBalance} Days</span>
              </div>
              <div className="flex justify-between pt-3 border-t border-gray-100">
                <span className="text-gray-500">Remaining After:</span>
                <span className={cn(
                  "font-bold",
                  (profile?.leaveBalance || 0) - totalDays < 0 ? "text-red-600" : "text-green-600"
                )}>
                  {(profile?.leaveBalance || 0) - totalDays} Days
                </span>
              </div>
            </div>
          </div>

          {/* Policy Notice */}
          <div className="bg-yellow-50 rounded-xl border border-yellow-200 p-6">
            <h3 className="font-bold text-yellow-800 mb-2 flex items-center gap-2 text-sm">
              <AlertTriangle size={16} />
              Important Notice
            </h3>
            <ul className="text-xs text-yellow-700 space-y-2 list-disc pl-4">
              <li>Leave must be applied at least 48 hours in advance.</li>
              <li>Annual leave requires supervisor and HR approval.</li>
              <li>Sick leave over 2 days requires a medical certificate.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ApplyLeave;
