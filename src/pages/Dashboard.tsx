import React, { useEffect, useState } from 'react';
import { doc, updateDoc, collection, query, where, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { Calendar, Clock, CheckCircle, AlertCircle, ArrowRight, Phone, Save } from 'lucide-react';
import { Link } from 'react-router-dom';
import { db } from '../firebase';
import { useAuth } from '../AuthContext';
import { LeaveRequest } from '../types';
import StatusBadge from '../components/StatusBadge';
import { formatDate, cn } from '../lib/utils';
import { toast } from 'sonner';

const Dashboard: React.FC = () => {
  const { profile, isManager, isHR, isCEO } = useAuth();
  const [recentRequests, setRecentRequests] = useState<LeaveRequest[]>([]);
  const [pendingApprovals, setPendingApprovals] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [phoneNumber, setPhoneNumber] = useState(profile?.phoneNumber || '');
  const [savingPhone, setSavingPhone] = useState(false);

  useEffect(() => {
    if (profile?.phoneNumber) {
      setPhoneNumber(profile.phoneNumber);
    }
  }, [profile]);

  const handleUpdatePhone = async () => {
    if (!profile) return;
    setSavingPhone(true);
    try {
      await updateDoc(doc(db, 'users', profile.uid), {
        phoneNumber: phoneNumber
      });
      toast.success('Phone number updated successfully!');
    } catch (error) {
      console.error(error);
      toast.error('Failed to update phone number.');
    } finally {
      setSavingPhone(false);
    }
  };

  useEffect(() => {
    if (!profile) return;

    // Fetch user's recent requests
    const q = query(
      collection(db, 'leave_requests'),
      where('applicantId', '==', profile.uid),
      orderBy('submittedAt', 'desc'),
      limit(5)
    );

    const unsubscribeRecent = onSnapshot(q, (snapshot) => {
      const requests = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as LeaveRequest));
      setRecentRequests(requests);
      setLoading(false);
    });

    // If manager/HR/CEO, fetch pending approvals
    let unsubscribePending = () => {};
    if (isManager || isHR || isCEO) {
      const pendingQ = query(
        collection(db, 'leave_requests'),
        where('currentApproverId', '==', profile.uid),
        where('status', 'in', ['pending_supervisor', 'pending_hr', 'pending_ceo']),
        orderBy('submittedAt', 'desc')
      );

      unsubscribePending = onSnapshot(pendingQ, (snapshot) => {
        const requests = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as LeaveRequest));
        setPendingApprovals(requests);
      });
    }

    return () => {
      unsubscribeRecent();
      unsubscribePending();
    };
  }, [profile, isManager, isHR, isCEO]);

  const stats = [
    { label: 'Leave Balance', value: `${profile?.leaveBalance || 0} Days`, icon: Calendar, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Pending Requests', value: recentRequests.filter(r => r.status.startsWith('pending')).length, icon: Clock, color: 'text-yellow-600', bg: 'bg-yellow-50' },
    { label: 'Approved This Year', value: recentRequests.filter(r => r.status === 'approved').length, icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-50' },
  ];

  return (
    <div className="space-y-8">
      {/* Welcome Section */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Welcome back, {profile?.fullName}</h1>
        <p className="text-gray-500">Here's an overview of your leave status and activity.</p>
      </div>

      {/* Profile Settings & Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Stats Grid */}
        <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-6">
          {stats.map((stat, i) => (
            <div key={i} className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex items-center gap-4">
              <div className={cn("p-3 rounded-lg", stat.bg)}>
                <stat.icon className={stat.color} size={24} />
              </div>
              <div>
                <p className="text-sm text-gray-500 font-medium">{stat.label}</p>
                <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* SMS Settings */}
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
          <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Phone size={18} className="text-[#8B0000]" />
            SMS Notifications
          </h3>
          <p className="text-sm text-gray-500 mb-4">Enter your phone number to receive SMS alerts for leave updates.</p>
          <div className="space-y-3">
            <input
              type="tel"
              placeholder="+254..."
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-[#8B0000] focus:border-[#8B0000]"
            />
            <button
              onClick={handleUpdatePhone}
              disabled={savingPhone}
              className="w-full flex items-center justify-center gap-2 py-2 bg-[#8B0000] text-white rounded-lg hover:bg-[#a00000] transition-colors disabled:opacity-50"
            >
              <Save size={16} />
              {savingPhone ? 'Saving...' : 'Save Phone Number'}
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Pending Approvals (Only for Managers/HR) */}
        {(isManager || isHR || isCEO) && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-bold text-gray-900 flex items-center gap-2">
                <AlertCircle size={20} className="text-[#8B0000]" />
                Pending Approvals
              </h3>
              <Link to="/approvals" className="text-sm text-[#8B0000] font-medium hover:underline flex items-center gap-1">
                View All <ArrowRight size={14} />
              </Link>
            </div>
            <div className="divide-y divide-gray-100">
              {pendingApprovals.length > 0 ? (
                pendingApprovals.map((request) => (
                  <div key={request.id} className="p-4 hover:bg-gray-50 transition-colors">
                    <div className="flex justify-between items-start mb-1">
                      <p className="font-semibold text-gray-900">{request.applicantName}</p>
                      <StatusBadge status={request.status} />
                    </div>
                    <p className="text-sm text-gray-600">{request.leaveType} • {request.totalDays} Days</p>
                    <p className="text-xs text-gray-400 mt-1">{formatDate(request.startDate)} - {formatDate(request.endDate)}</p>
                  </div>
                ))
              ) : (
                <div className="p-8 text-center text-gray-500">
                  <p>No pending approvals at the moment.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Recent Activity */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-gray-100 flex items-center justify-between">
            <h3 className="font-bold text-gray-900">My Recent Requests</h3>
            <Link to="/my-requests" className="text-sm text-[#8B0000] font-medium hover:underline flex items-center gap-1">
              View History <ArrowRight size={14} />
            </Link>
          </div>
          <div className="divide-y divide-gray-100">
            {recentRequests.length > 0 ? (
              recentRequests.map((request) => (
                <div key={request.id} className="p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex justify-between items-start mb-1">
                    <p className="font-semibold text-gray-900">{request.leaveType}</p>
                    <StatusBadge status={request.status} />
                  </div>
                  <p className="text-sm text-gray-600">{request.totalDays} Days • Submitted {formatDate(request.submittedAt)}</p>
                  <p className="text-xs text-gray-400 mt-1">{formatDate(request.startDate)} - {formatDate(request.endDate)}</p>
                </div>
              ))
            ) : (
              <div className="p-8 text-center text-gray-500">
                <p>You haven't submitted any leave requests yet.</p>
                <Link to="/apply" className="mt-4 inline-block text-[#8B0000] font-medium hover:underline">
                  Apply for Leave
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
