import React, { useEffect, useState } from 'react';
import { collection, query, where, onSnapshot, getDocs } from 'firebase/firestore';
import { 
  Users, 
  Calendar, 
  Clock, 
  FileText, 
  TrendingUp, 
  AlertCircle,
  ArrowRight,
  Download,
  Info,
  CheckSquare
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { db } from '../firebase';
import { useAuth } from '../AuthContext';
import { LeaveRequest, LeaveType, UserProfile } from '../types';
import StatusBadge from '../components/StatusBadge';
import { formatDate, cn } from '../lib/utils';

const HRDashboard: React.FC = () => {
  const { isHR, isAdmin } = useAuth();
  const [metrics, setMetrics] = useState({
    totalEmployees: 0,
    onLeaveToday: 0,
    pendingHR: 0,
    requestsThisMonth: 0
  });
  const [pendingRequests, setPendingRequests] = useState<LeaveRequest[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isHR && !isAdmin) return;

    // 1. Fetch Metrics
    const fetchMetrics = async () => {
      try {
        // Total Employees
        const usersSnap = await getDocs(collection(db, 'users'));
        const totalEmployees = usersSnap.size;

        // Pending HR Approvals
        const pendingHRQuery = query(
          collection(db, 'leave_requests'),
          where('status', '==', 'pending_hr')
        );
        const pendingHRSnap = await getDocs(pendingHRQuery);
        const pendingHR = pendingHRSnap.size;

        // On Leave Today (Simple check: status is approved and today is between start and end)
        const today = new Date().toISOString().split('T')[0];
        const approvedQuery = query(
          collection(db, 'leave_requests'),
          where('status', '==', 'approved')
        );
        const approvedSnap = await getDocs(approvedQuery);
        const onLeaveToday = approvedSnap.docs.filter(doc => {
          const data = doc.data() as LeaveRequest;
          return today >= data.startDate && today <= data.endDate;
        }).length;

        // Requests This Month
        const firstDayOfMonth = new Date();
        firstDayOfMonth.setDate(1);
        firstDayOfMonth.setHours(0, 0, 0, 0);
        const requestsThisMonthQuery = query(
          collection(db, 'leave_requests'),
          where('submittedAt', '>=', firstDayOfMonth.toISOString())
        );
        const requestsThisMonthSnap = await getDocs(requestsThisMonthQuery);
        const requestsThisMonth = requestsThisMonthSnap.size;

        setMetrics({
          totalEmployees,
          onLeaveToday,
          pendingHR,
          requestsThisMonth
        });
      } catch (error) {
        console.error("Error fetching HR metrics:", error);
      }
    };

    fetchMetrics();

    // 2. Listen for Pending HR Requests
    const pendingQ = query(
      collection(db, 'leave_requests'),
      where('status', '==', 'pending_hr')
    );
    const unsubscribePending = onSnapshot(pendingQ, (snapshot) => {
      const requests = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as LeaveRequest));
      setPendingRequests(requests);
    });

    // 3. Fetch Leave Types
    const unsubscribeTypes = onSnapshot(collection(db, 'leave_types'), (snapshot) => {
      const types = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as LeaveType));
      setLeaveTypes(types);
      setLoading(false);
    });

    return () => {
      unsubscribePending();
      unsubscribeTypes();
    };
  }, [isHR, isAdmin]);

  const stats = [
    { label: 'Total Employees', value: metrics.totalEmployees, icon: Users, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'On Leave Today', value: metrics.onLeaveToday, icon: Calendar, color: 'text-green-600', bg: 'bg-green-50' },
    { label: 'Pending HR Action', value: metrics.pendingHR, icon: Clock, color: 'text-orange-600', bg: 'bg-orange-50' },
    { label: 'Requests (MTD)', value: metrics.requestsThisMonth, icon: TrendingUp, color: 'text-purple-600', bg: 'bg-purple-50' },
  ];

  if (!isHR && !isAdmin) {
    return (
      <div className="p-8 text-center bg-white rounded-xl border border-gray-200 shadow-sm">
        <AlertCircle size={48} className="mx-auto text-red-500 mb-4" />
        <h2 className="text-xl font-bold text-gray-900 mb-2">Access Denied</h2>
        <p className="text-gray-500">You do not have permission to view the HR Dashboard.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">HR Officer Dashboard</h1>
          <p className="text-gray-500">Monitor organization-wide leave activity and metrics.</p>
        </div>
        <div className="flex items-center gap-3">
          <button className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
            <Download size={16} />
            Export Report
          </button>
          <Link 
            to="/approvals"
            className="flex items-center gap-2 px-4 py-2 bg-[#8B0000] text-white rounded-lg text-sm font-medium hover:bg-[#a00000] transition-colors"
          >
            <CheckSquare size={16} />
            Review Requests
          </Link>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Pending Actions */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-bold text-gray-900 flex items-center gap-2">
                <Clock size={20} className="text-[#8B0000]" />
                Pending HR Approvals
              </h3>
              <Link to="/approvals" className="text-sm text-[#8B0000] font-medium hover:underline flex items-center gap-1">
                View All <ArrowRight size={14} />
              </Link>
            </div>
            <div className="divide-y divide-gray-100">
              {pendingRequests.length > 0 ? (
                pendingRequests.slice(0, 5).map((request) => (
                  <div key={request.id} className="p-4 hover:bg-gray-50 transition-colors">
                    <div className="flex justify-between items-start mb-1">
                      <div>
                        <p className="font-semibold text-gray-900">{request.applicantName}</p>
                        <p className="text-xs text-gray-500">{request.department}</p>
                      </div>
                      <StatusBadge status={request.status} />
                    </div>
                    <div className="mt-2 flex items-center justify-between text-sm">
                      <span className="text-gray-600">{request.leaveType} • {request.totalDays} Days</span>
                      <span className="text-gray-400">{formatDate(request.startDate)} - {formatDate(request.endDate)}</span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-12 text-center text-gray-500">
                  <Clock size={40} className="mx-auto text-gray-200 mb-3" />
                  <p>No leave requests pending HR approval.</p>
                </div>
              )}
            </div>
          </div>

          {/* Quick Access Reports */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm hover:border-[#8B0000]/30 transition-colors cursor-pointer group">
              <div className="flex items-start justify-between mb-4">
                <div className="p-3 bg-blue-50 rounded-lg group-hover:bg-blue-100 transition-colors">
                  <FileText className="text-blue-600" size={24} />
                </div>
                <ArrowRight size={18} className="text-gray-300 group-hover:text-[#8B0000] transition-colors" />
              </div>
              <h4 className="font-bold text-gray-900 mb-1">Leave Balances Report</h4>
              <p className="text-sm text-gray-500">View current leave balances for all employees across departments.</p>
            </div>
            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm hover:border-[#8B0000]/30 transition-colors cursor-pointer group">
              <div className="flex items-start justify-between mb-4">
                <div className="p-3 bg-green-50 rounded-lg group-hover:bg-green-100 transition-colors">
                  <Users className="text-green-600" size={24} />
                </div>
                <ArrowRight size={18} className="text-gray-300 group-hover:text-[#8B0000] transition-colors" />
              </div>
              <h4 className="font-bold text-gray-900 mb-1">Employee Attendance</h4>
              <p className="text-sm text-gray-500">Track daily attendance and identify patterns of absenteeism.</p>
            </div>
          </div>
        </div>

        {/* Leave Policy Overview */}
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex items-center gap-2">
              <Info size={20} className="text-[#8B0000]" />
              <h3 className="font-bold text-gray-900">Leave Policy Overview</h3>
            </div>
            <div className="p-6 space-y-4">
              {leaveTypes.map((type) => (
                <div key={type.id} className="flex items-start gap-3 p-3 rounded-lg bg-gray-50 border border-gray-100">
                  <div className="mt-1 w-2 h-2 rounded-full bg-[#8B0000] shrink-0" />
                  <div>
                    <p className="font-semibold text-gray-900 text-sm">{type.name}</p>
                    <div className="mt-1 flex flex-wrap gap-2">
                      <span className="text-[10px] px-1.5 py-0.5 bg-white border border-gray-200 rounded text-gray-600">
                        Max: {type.maxDays} Days
                      </span>
                      {type.requiresAttachment && (
                        <span className="text-[10px] px-1.5 py-0.5 bg-blue-50 border border-blue-100 rounded text-blue-600">
                          Attachment Required
                        </span>
                      )}
                      {type.requiresEscalation && (
                        <span className="text-[10px] px-1.5 py-0.5 bg-orange-50 border border-orange-100 rounded text-orange-600">
                          CEO Approval
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="p-4 bg-gray-50 border-t border-gray-100">
              <Link to="/admin/settings" className="text-xs text-[#8B0000] font-semibold hover:underline flex items-center justify-center gap-1">
                Manage Policies <ArrowRight size={12} />
              </Link>
            </div>
          </div>

          {/* HR Tips/Notices */}
          <div className="bg-[#8B0000] rounded-xl p-6 text-white">
            <h4 className="font-bold mb-2 flex items-center gap-2">
              <AlertCircle size={18} />
              HR Notice
            </h4>
            <p className="text-sm text-white/80 leading-relaxed">
              Ensure all leave requests are reviewed within 48 hours to maintain operational efficiency. 
              Check for supporting documents on medical and maternity leave requests.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HRDashboard;
