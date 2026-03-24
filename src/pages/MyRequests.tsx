import React, { useEffect, useState } from 'react';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../AuthContext';
import { LeaveRequest } from '../types';
import StatusBadge from '../components/StatusBadge';
import { formatDate } from '../lib/utils';
import { FileText, Calendar, Clock } from 'lucide-react';

const MyRequests: React.FC = () => {
  const { profile } = useAuth();
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile) return;

    const q = query(
      collection(db, 'leave_requests'),
      where('applicantId', '==', profile.uid),
      orderBy('submittedAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setRequests(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as LeaveRequest)));
      setLoading(false);
    });

    return () => unsubscribe();
  }, [profile]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Leave Requests</h1>
          <p className="text-gray-500">Track the status of your leave applications.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {requests.length > 0 ? (
          requests.map((request) => (
            <div key={request.id} className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm hover:border-[#8B0000]/30 transition-all group">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div className="p-3 bg-gray-50 rounded-lg text-gray-400 group-hover:text-[#8B0000] transition-colors">
                    <FileText size={24} />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 text-lg">{request.leaveType}</h3>
                    <div className="flex flex-wrap gap-4 mt-1 text-sm text-gray-500">
                      <span className="flex items-center gap-1">
                        <Calendar size={14} />
                        {formatDate(request.startDate)} - {formatDate(request.endDate)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock size={14} />
                        {request.totalDays} Working Days
                      </span>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-4">
                  <div className="text-right hidden md:block">
                    <p className="text-xs text-gray-400 uppercase font-bold">Status</p>
                    <StatusBadge status={request.status} className="mt-1" />
                  </div>
                  <div className="md:hidden">
                    <StatusBadge status={request.status} />
                  </div>
                </div>
              </div>

              {request.comments && request.comments.length > 0 && (
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <p className="text-xs text-gray-400 uppercase font-bold mb-2">Latest Comment</p>
                  <div className="bg-gray-50 p-3 rounded-lg text-sm text-gray-700">
                    <span className="font-semibold">{request.comments[request.comments.length - 1].authorName}: </span>
                    {request.comments[request.comments.length - 1].text}
                  </div>
                </div>
              )}
            </div>
          ))
        ) : (
          <div className="bg-white p-12 rounded-xl border border-dashed border-gray-300 text-center text-gray-500">
            <p className="text-lg font-medium">No requests found.</p>
            <p className="text-sm">When you apply for leave, your requests will appear here.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default MyRequests;
