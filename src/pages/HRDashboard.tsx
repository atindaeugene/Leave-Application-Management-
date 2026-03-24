import React, { useEffect, useState, useMemo } from 'react';
import { collection, query, where, onSnapshot, getDocs, orderBy, limit } from 'firebase/firestore';
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
  CheckSquare,
  BarChart3,
  PieChart as PieChartIcon,
  Activity
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell, 
  LineChart, 
  Line,
  Legend
} from 'recharts';
import { db } from '../firebase';
import { useAuth } from '../AuthContext';
import { LeaveRequest, LeaveType, UserProfile } from '../types';
import StatusBadge from '../components/StatusBadge';
import { formatDate, cn } from '../lib/utils';

const COLORS = ['#8B0000', '#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

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
  const [allApprovedRequests, setAllApprovedRequests] = useState<LeaveRequest[]>([]);
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isHR && !isAdmin) return;

    // 1. Fetch Metrics & Data for Charts
    const fetchData = async () => {
      try {
        // Total Employees
        const usersSnap = await getDocs(collection(db, 'users'));
        const users = usersSnap.docs.map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile));
        setAllUsers(users);
        const totalEmployees = users.length;

        // Pending HR Approvals
        const pendingHRQuery = query(
          collection(db, 'leave_requests'),
          where('status', '==', 'pending_hr')
        );
        const pendingHRSnap = await getDocs(pendingHRQuery);
        const pendingHR = pendingHRSnap.size;

        // All Approved Requests for trends and distribution
        const approvedQuery = query(
          collection(db, 'leave_requests'),
          where('status', '==', 'approved')
        );
        const approvedSnap = await getDocs(approvedQuery);
        const approvedRequests = approvedSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as LeaveRequest));
        setAllApprovedRequests(approvedRequests);

        // On Leave Today
        const today = new Date().toISOString().split('T')[0];
        const onLeaveToday = approvedRequests.filter(data => {
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

    fetchData();

    // 2. Listen for Pending HR Requests
    const pendingQ = query(
      collection(db, 'leave_requests'),
      where('status', '==', 'pending_hr'),
      orderBy('submittedAt', 'desc'),
      limit(10)
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

  // Process Data for Charts
  const departmentData = useMemo(() => {
    const deptCounts: Record<string, number> = {};
    allApprovedRequests.forEach(req => {
      const dept = req.department || 'Unknown';
      deptCounts[dept] = (deptCounts[dept] || 0) + 1;
    });
    return Object.entries(deptCounts).map(([name, value]) => ({ name, value }));
  }, [allApprovedRequests]);

  const leaveTypeData = useMemo(() => {
    const typeCounts: Record<string, number> = {};
    allApprovedRequests.forEach(req => {
      typeCounts[req.leaveType] = (typeCounts[req.leaveType] || 0) + 1;
    });
    return Object.entries(typeCounts).map(([name, value]) => ({ name, value }));
  }, [allApprovedRequests]);

  const trendData = useMemo(() => {
    const last6Months = Array.from({ length: 6 }, (_, i) => {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      return d.toLocaleString('default', { month: 'short' });
    }).reverse();

    const monthCounts: Record<string, number> = {};
    allApprovedRequests.forEach(req => {
      const date = new Date(req.submittedAt);
      const month = date.toLocaleString('default', { month: 'short' });
      if (last6Months.includes(month)) {
        monthCounts[month] = (monthCounts[month] || 0) + 1;
      }
    });

    return last6Months.map(month => ({
      name: month,
      requests: monthCounts[month] || 0
    }));
  }, [allApprovedRequests]);

  const absenteeismData = useMemo(() => {
    const employeeAbsence: Record<string, { name: string, days: number }> = {};
    allApprovedRequests.forEach(req => {
      if (!employeeAbsence[req.applicantId]) {
        employeeAbsence[req.applicantId] = { name: req.applicantName, days: 0 };
      }
      employeeAbsence[req.applicantId].days += req.totalDays;
    });
    return Object.values(employeeAbsence)
      .sort((a, b) => b.days - a.days)
      .slice(0, 5);
  }, [allApprovedRequests]);

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

      {/* Visualizations Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Leave Trends */}
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-bold text-gray-900 flex items-center gap-2">
              <Activity size={20} className="text-[#8B0000]" />
              Leave Trends (Last 6 Months)
            </h3>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#666' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#666' }} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #eee', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Line type="monotone" dataKey="requests" stroke="#8B0000" strokeWidth={3} dot={{ r: 4, fill: '#8B0000' }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Department Distribution */}
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-bold text-gray-900 flex items-center gap-2">
              <PieChartIcon size={20} className="text-[#8B0000]" />
              Department-wise Distribution
            </h3>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={departmentData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {departmentData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend verticalAlign="bottom" height={36}/>
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Leave Type Breakdown */}
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-bold text-gray-900 flex items-center gap-2">
              <BarChart3 size={20} className="text-[#8B0000]" />
              Leave Type Breakdown
            </h3>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={leaveTypeData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#666' }} width={100} />
                <Tooltip cursor={{ fill: 'transparent' }} />
                <Bar dataKey="value" fill="#8B0000" radius={[0, 4, 4, 0]} barSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top Absent Employees */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-gray-100 flex items-center gap-2">
            <Users size={20} className="text-[#8B0000]" />
            <h3 className="font-bold text-gray-900">Top Absent Employees</h3>
          </div>
          <div className="p-4 space-y-4">
            {absenteeismData.length > 0 ? absenteeismData.map((emp, i) => (
              <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-gray-50 border border-gray-100">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-[#8B0000]/10 flex items-center justify-center text-[#8B0000] font-bold text-xs">
                    {emp.name.charAt(0)}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{emp.name}</p>
                    <p className="text-[10px] text-gray-500 uppercase font-bold">Total Approved Days</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-[#8B0000]">{emp.days}</p>
                  <p className="text-[10px] text-gray-400">Days</p>
                </div>
              </div>
            )) : (
              <div className="py-8 text-center text-gray-400 text-sm">
                No approved leave data available.
              </div>
            )}
          </div>
        </div>

        {/* Pending Actions */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-gray-100 flex items-center justify-between">
            <h3 className="font-bold text-gray-900 flex items-center gap-2">
              <Clock size={20} className="text-[#8B0000]" />
              Recent Pending
            </h3>
            <Link to="/approvals" className="text-xs text-[#8B0000] font-medium hover:underline">
              View All
            </Link>
          </div>
          <div className="divide-y divide-gray-100">
            {pendingRequests.length > 0 ? (
              pendingRequests.slice(0, 4).map((request) => (
                <div key={request.id} className="p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex justify-between items-start mb-1">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{request.applicantName}</p>
                      <p className="text-[10px] text-gray-500">{request.department}</p>
                    </div>
                    <StatusBadge status={request.status} />
                  </div>
                  <div className="mt-1 flex items-center justify-between text-[11px]">
                    <span className="text-gray-600 font-medium">{request.leaveType}</span>
                    <span className="text-gray-400">{formatDate(request.startDate)}</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-8 text-center text-gray-500 text-sm">
                No pending requests.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default HRDashboard;
