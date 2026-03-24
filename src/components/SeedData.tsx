import React, { useState } from 'react';
import { collection, doc, setDoc, getDocs, query, limit } from 'firebase/firestore';
import { db } from '../firebase';
import { toast } from 'sonner';
import { Database } from 'lucide-react';

const SeedData: React.FC = () => {
  const [loading, setLoading] = useState(false);

  const seed = async () => {
    setLoading(true);
    try {
      // 1. Seed Leave Types
      const leaveTypes = [
        { id: 'annual', name: 'Annual Leave', maxDays: 21, requiresAttachment: false, requiresEscalation: false },
        { id: 'sick', name: 'Sick Leave', maxDays: 30, requiresAttachment: true, requiresEscalation: false },
        { id: 'maternity', name: 'Maternity Leave', maxDays: 90, requiresAttachment: true, requiresEscalation: true },
        { id: 'paternity', name: 'Paternity Leave', maxDays: 14, requiresAttachment: true, requiresEscalation: false },
        { id: 'compassionate', name: 'Compassionate Leave', maxDays: 5, requiresAttachment: false, requiresEscalation: false },
        { id: 'study', name: 'Study Leave', maxDays: 14, requiresAttachment: true, requiresEscalation: true },
        { id: 'unpaid', name: 'Unpaid Leave', maxDays: 365, requiresAttachment: false, requiresEscalation: true },
      ];

      for (const type of leaveTypes) {
        await setDoc(doc(db, 'leave_types', type.id), type);
      }

      // 2. Seed Departments
      const departments = [
        { id: 'it', name: 'Information Technology', headId: '' },
        { id: 'hr', name: 'Human Resources', headId: '' },
        { id: 'finance', name: 'Finance & Accounting', headId: '' },
        { id: 'ops', name: 'Operations', headId: '' },
      ];

      for (const dept of departments) {
        await setDoc(doc(db, 'departments', dept.id), dept);
      }

      toast.success('System data seeded successfully! You can now register or login.');
    } catch (error) {
      console.error(error);
      toast.error('Failed to seed data.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={seed}
      disabled={loading}
      className="mt-4 w-full flex items-center justify-center gap-2 py-2 px-4 border border-gray-300 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50"
    >
      <Database size={16} />
      {loading ? 'Seeding...' : 'Initialize System Data'}
    </button>
  );
};

export default SeedData;
