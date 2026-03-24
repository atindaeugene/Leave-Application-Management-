import React, { useState, useEffect } from 'react';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, orderBy, writeBatch, getDoc, setDoc } from 'firebase/firestore';
import { sendPasswordResetEmail, updatePassword } from 'firebase/auth';
import { 
  Settings, 
  Plus, 
  Edit2, 
  Trash2, 
  Save, 
  X, 
  Users, 
  Calendar, 
  ShieldCheck,
  AlertCircle,
  RefreshCw,
  CheckCircle2,
  ArrowRightLeft,
  Info,
  Key,
  Mail,
  Lock
} from 'lucide-react';
import { db, auth } from '../firebase';
import { useAuth } from '../AuthContext';
import { LeaveType, UserProfile, SystemConfig } from '../types';
import { toast } from 'sonner';
import { cn } from '../lib/utils';

const SystemSettings: React.FC = () => {
  const { isAdmin, isHR, user: currentUser } = useAuth();
  const [activeTab, setActiveTab] = useState<'types' | 'allocation' | 'carry-forward' | 'security'>('types');
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [systemConfig, setSystemConfig] = useState<SystemConfig>({
    enableCarryForward: false,
    maxCarryForwardDays: 0,
    carryForwardExpiryDate: ''
  });
  const [loading, setLoading] = useState(true);
  
  // Security State
  const [resetEmail, setResetEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);

  // Leave Type Form State
  const [isEditingType, setIsEditingType] = useState<string | null>(null);
  const [typeForm, setTypeForm] = useState({
    name: '',
    maxDays: 0,
    requiresAttachment: false,
    requiresEscalation: false,
    description: ''
  });

  // Allocation State
  const [allocationAmount, setAllocationAmount] = useState<number>(0);
  const [allocating, setAllocating] = useState(false);

  useEffect(() => {
    if (!isAdmin && !isHR) return;

    const fetchData = async () => {
      try {
        const typesSnap = await getDocs(query(collection(db, 'leave_types'), orderBy('name')));
        setLeaveTypes(typesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as LeaveType)));

        const usersSnap = await getDocs(collection(db, 'users'));
        setUsers(usersSnap.docs.map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile)));

        const configSnap = await getDoc(doc(db, 'system_config', 'global'));
        if (configSnap.exists()) {
          setSystemConfig(configSnap.data() as SystemConfig);
        }
      } catch (error) {
        console.error("Error fetching settings data:", error);
        toast.error("Failed to load settings.");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [isAdmin, isHR]);

  const handleSaveType = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (isEditingType) {
        await updateDoc(doc(db, 'leave_types', isEditingType), typeForm);
        setLeaveTypes(leaveTypes.map(t => t.id === isEditingType ? { ...t, ...typeForm } : t));
        toast.success('Leave type updated.');
      } else {
        const docRef = await addDoc(collection(db, 'leave_types'), typeForm);
        setLeaveTypes([...leaveTypes, { id: docRef.id, ...typeForm }]);
        toast.success('Leave type added.');
      }
      resetTypeForm();
    } catch (error) {
      toast.error('Failed to save leave type.');
    }
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await setDoc(doc(db, 'system_config', 'global'), systemConfig);
      toast.success('System configuration updated.');
    } catch (error) {
      toast.error('Failed to update system configuration.');
    }
  };

  const handleSendResetEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetEmail) return;
    try {
      await sendPasswordResetEmail(auth, resetEmail);
      toast.success(`Password reset email sent to ${resetEmail}`);
      setResetEmail('');
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || 'Failed to send reset email.');
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match.');
      return;
    }
    if (newPassword.length < 6) {
      toast.error('Password must be at least 6 characters.');
      return;
    }

    setIsUpdatingPassword(true);
    try {
      await updatePassword(currentUser, newPassword);
      toast.success('Password updated successfully.');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error: any) {
      console.error(error);
      if (error.code === 'auth/requires-recent-login') {
        toast.error('Please log out and log back in to change your password.');
      } else {
        toast.error(error.message || 'Failed to update password.');
      }
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  const resetTypeForm = () => {
    setIsEditingType(null);
    setTypeForm({
      name: '',
      maxDays: 0,
      requiresAttachment: false,
      requiresEscalation: false,
      description: ''
    });
  };

  const handleEditType = (type: LeaveType) => {
    setIsEditingType(type.id);
    setTypeForm({
      name: type.name,
      maxDays: type.maxDays,
      requiresAttachment: type.requiresAttachment,
      requiresEscalation: type.requiresEscalation,
      description: type.description || ''
    });
  };

  const handleDeleteType = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this leave type?')) return;
    try {
      await deleteDoc(doc(db, 'leave_types', id));
      setLeaveTypes(leaveTypes.filter(t => t.id !== id));
      toast.success('Leave type deleted.');
    } catch (error) {
      toast.error('Failed to delete leave type.');
    }
  };

  const handleBulkAllocate = async () => {
    if (allocationAmount <= 0) {
      toast.error('Please enter a valid allocation amount.');
      return;
    }
    if (!window.confirm(`Are you sure you want to add ${allocationAmount} days to ALL employees?`)) return;

    setAllocating(true);
    try {
      const batch = writeBatch(db);
      users.forEach(user => {
        const userRef = doc(db, 'users', user.uid);
        batch.update(userRef, {
          leaveBalance: (user.leaveBalance || 0) + allocationAmount
        });
      });
      await batch.commit();
      
      // Update local state
      setUsers(users.map(u => ({ ...u, leaveBalance: (u.leaveBalance || 0) + allocationAmount })));
      toast.success(`Successfully allocated ${allocationAmount} days to all employees.`);
      setAllocationAmount(0);
    } catch (error) {
      console.error(error);
      toast.error('Failed to perform bulk allocation.');
    } finally {
      setAllocating(false);
    }
  };

  if (!isAdmin && !isHR) {
    return (
      <div className="p-8 text-center bg-white rounded-xl border border-gray-200 shadow-sm">
        <AlertCircle size={48} className="mx-auto text-red-500 mb-4" />
        <h2 className="text-xl font-bold text-gray-900 mb-2">Access Denied</h2>
        <p className="text-gray-500">You do not have permission to access system settings.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">System Settings</h1>
          <p className="text-gray-500">Manage leave policies and employee allocations.</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        <button
          onClick={() => setActiveTab('types')}
          className={cn(
            "px-6 py-3 text-sm font-medium border-b-2 transition-colors",
            activeTab === 'types' 
              ? "border-[#8B0000] text-[#8B0000]" 
              : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
          )}
        >
          Leave Types
        </button>
        <button
          onClick={() => setActiveTab('allocation')}
          className={cn(
            "px-6 py-3 text-sm font-medium border-b-2 transition-colors",
            activeTab === 'allocation' 
              ? "border-[#8B0000] text-[#8B0000]" 
              : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
          )}
        >
          Leave Allocation
        </button>
        <button
          onClick={() => setActiveTab('carry-forward')}
          className={cn(
            "px-6 py-3 text-sm font-medium border-b-2 transition-colors",
            activeTab === 'carry-forward' 
              ? "border-[#8B0000] text-[#8B0000]" 
              : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
          )}
        >
          Carry Forward Rules
        </button>
        <button
          onClick={() => setActiveTab('security')}
          className={cn(
            "px-6 py-3 text-sm font-medium border-b-2 transition-colors",
            activeTab === 'security' 
              ? "border-[#8B0000] text-[#8B0000]" 
              : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
          )}
        >
          Security & Auth
        </button>
      </div>

      {activeTab === 'types' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Form */}
          <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm h-fit">
            <h3 className="font-bold text-gray-900 mb-6 flex items-center gap-2">
              {isEditingType ? <Edit2 size={18} /> : <Plus size={18} />}
              {isEditingType ? 'Edit Leave Type' : 'Add New Leave Type'}
            </h3>
            <form onSubmit={handleSaveType} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Type Name</label>
                <input
                  type="text"
                  required
                  value={typeForm.name}
                  onChange={(e) => setTypeForm({ ...typeForm, name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-[#8B0000] focus:border-[#8B0000]"
                  placeholder="e.g. Annual Leave"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Max Days per Year</label>
                <input
                  type="number"
                  required
                  value={typeForm.maxDays}
                  onChange={(e) => setTypeForm({ ...typeForm, maxDays: parseInt(e.target.value) })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-[#8B0000] focus:border-[#8B0000]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  rows={3}
                  value={typeForm.description}
                  onChange={(e) => setTypeForm({ ...typeForm, description: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-[#8B0000] focus:border-[#8B0000]"
                  placeholder="Optional description..."
                />
              </div>
              <div className="space-y-3 pt-2">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={typeForm.requiresAttachment}
                    onChange={(e) => setTypeForm({ ...typeForm, requiresAttachment: e.target.checked })}
                    className="w-4 h-4 text-[#8B0000] border-gray-300 rounded focus:ring-[#8B0000]"
                  />
                  <span className="text-sm text-gray-700">Requires Attachment</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={typeForm.requiresEscalation}
                    onChange={(e) => setTypeForm({ ...typeForm, requiresEscalation: e.target.checked })}
                    className="w-4 h-4 text-[#8B0000] border-gray-300 rounded focus:ring-[#8B0000]"
                  />
                  <span className="text-sm text-gray-700">Requires CEO Approval</span>
                </label>
              </div>
              <div className="pt-4 flex gap-3">
                <button
                  type="submit"
                  className="flex-1 flex items-center justify-center gap-2 py-2 bg-[#8B0000] text-white rounded-lg hover:bg-[#a00000] transition-colors"
                >
                  <Save size={16} />
                  {isEditingType ? 'Update' : 'Save'}
                </button>
                {isEditingType && (
                  <button
                    type="button"
                    onClick={resetTypeForm}
                    className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>
            </form>
          </div>

          {/* List */}
          <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-gray-100">
              <h3 className="font-bold text-gray-900">Configured Leave Types</h3>
            </div>
            <div className="divide-y divide-gray-100">
              {leaveTypes.map((type) => (
                <div key={type.id} className="p-6 flex items-center justify-between hover:bg-gray-50 transition-colors">
                  <div className="space-y-1">
                    <h4 className="font-bold text-gray-900">{type.name}</h4>
                    <p className="text-sm text-gray-500">{type.description || 'No description provided.'}</p>
                    <div className="flex gap-2 pt-2">
                      <span className="text-[10px] px-2 py-0.5 bg-gray-100 border border-gray-200 rounded text-gray-600 font-medium">
                        Max: {type.maxDays} Days
                      </span>
                      {type.requiresAttachment && (
                        <span className="text-[10px] px-2 py-0.5 bg-blue-50 border border-blue-100 rounded text-blue-600 font-medium">
                          Attachment Required
                        </span>
                      )}
                      {type.requiresEscalation && (
                        <span className="text-[10px] px-2 py-0.5 bg-orange-50 border border-orange-100 rounded text-orange-600 font-medium">
                          CEO Approval
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleEditType(type)}
                      className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    >
                      <Edit2 size={18} />
                    </button>
                    <button
                      onClick={() => handleDeleteType(type.id)}
                      className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              ))}
              {leaveTypes.length === 0 && (
                <div className="p-12 text-center text-gray-500">
                  <Calendar size={40} className="mx-auto text-gray-200 mb-3" />
                  <p>No leave types configured yet.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'allocation' && (
        <div className="space-y-8">
          {/* Bulk Allocation */}
          <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 bg-blue-50 rounded-lg">
                <RefreshCw className="text-blue-600" size={24} />
              </div>
              <div>
                <h3 className="font-bold text-gray-900">Bulk Leave Allocation</h3>
                <p className="text-sm text-gray-500">Add leave days to all active employees at once (e.g. annual reset).</p>
              </div>
            </div>
            <div className="flex flex-col md:flex-row items-end gap-4 max-w-2xl">
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">Days to Add</label>
                <input
                  type="number"
                  value={allocationAmount}
                  onChange={(e) => setAllocationAmount(parseInt(e.target.value))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-[#8B0000] focus:border-[#8B0000]"
                  placeholder="e.g. 21"
                />
              </div>
              <button
                onClick={handleBulkAllocate}
                disabled={allocating || allocationAmount <= 0}
                className="px-8 py-2 bg-[#8B0000] text-white rounded-lg hover:bg-[#a00000] transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {allocating ? <RefreshCw className="animate-spin" size={18} /> : <CheckCircle2 size={18} />}
                {allocating ? 'Allocating...' : 'Apply to All Employees'}
              </button>
            </div>
          </div>

          {/* Employee List */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-bold text-gray-900 flex items-center gap-2">
                <Users size={20} className="text-[#8B0000]" />
                Employee Leave Balances
              </h3>
              <span className="text-xs text-gray-500">{users.length} Total Employees</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Employee</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Department</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Current Balance</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {users.map((user) => (
                    <tr key={user.uid} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-600 font-bold text-xs">
                            {user.fullName.charAt(0)}
                          </div>
                          <div>
                            <p className="text-sm font-bold text-gray-900">{user.fullName}</p>
                            <p className="text-xs text-gray-500">{user.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">{user.department}</td>
                      <td className="px-6 py-4">
                        <span className={cn(
                          "px-2.5 py-0.5 rounded-full text-xs font-bold",
                          (user.leaveBalance || 0) > 5 ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                        )}>
                          {user.leaveBalance || 0} Days
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button 
                          onClick={() => {
                            const newBalance = prompt(`Update balance for ${user.fullName}:`, (user.leaveBalance || 0).toString());
                            if (newBalance !== null) {
                              const amount = parseInt(newBalance);
                              if (!isNaN(amount)) {
                                updateDoc(doc(db, 'users', user.uid), { leaveBalance: amount });
                                setUsers(users.map(u => u.uid === user.uid ? { ...u, leaveBalance: amount } : u));
                                toast.success(`Updated balance for ${user.fullName}`);
                              }
                            }
                          }}
                          className="text-xs text-[#8B0000] font-bold hover:underline"
                        >
                          Adjust
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'carry-forward' && (
        <div className="max-w-2xl">
          <div className="bg-white p-8 rounded-xl border border-gray-200 shadow-sm">
            <div className="flex items-center gap-3 mb-8">
              <div className="p-3 bg-orange-50 rounded-lg">
                <ArrowRightLeft className="text-orange-600" size={24} />
              </div>
              <div>
                <h3 className="font-bold text-gray-900">Leave Carry Forward Rules</h3>
                <p className="text-sm text-gray-500">Configure how unused leave days are handled at year-end.</p>
              </div>
            </div>

            <form onSubmit={handleSaveConfig} className="space-y-6">
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-100">
                <div>
                  <p className="font-bold text-gray-900">Enable Carry Forward</p>
                  <p className="text-xs text-gray-500">Allow employees to carry over unused leave to the next year.</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input 
                    type="checkbox" 
                    className="sr-only peer"
                    checked={systemConfig.enableCarryForward}
                    onChange={(e) => setSystemConfig({ ...systemConfig, enableCarryForward: e.target.checked })}
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-[#8B0000]/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#8B0000]"></div>
                </label>
              </div>

              <div className={cn("space-y-6 transition-opacity", !systemConfig.enableCarryForward && "opacity-50 pointer-events-none")}>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Maximum Carry Forward Days</label>
                  <input
                    type="number"
                    required={systemConfig.enableCarryForward}
                    value={systemConfig.maxCarryForwardDays}
                    onChange={(e) => setSystemConfig({ ...systemConfig, maxCarryForwardDays: parseInt(e.target.value) })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-[#8B0000] focus:border-[#8B0000]"
                    placeholder="e.g. 5"
                  />
                  <p className="mt-1 text-xs text-gray-500">The maximum number of days an employee can carry over.</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Carry Forward Expiry Date</label>
                  <input
                    type="date"
                    required={systemConfig.enableCarryForward}
                    value={systemConfig.carryForwardExpiryDate}
                    onChange={(e) => setSystemConfig({ ...systemConfig, carryForwardExpiryDate: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-[#8B0000] focus:border-[#8B0000]"
                  />
                  <p className="mt-1 text-xs text-gray-500">Carried over leave will expire on this date in the new year.</p>
                </div>
              </div>

              <div className="pt-6 border-t border-gray-100">
                <button
                  type="submit"
                  className="w-full flex items-center justify-center gap-2 py-3 bg-[#8B0000] text-white rounded-lg hover:bg-[#a00000] transition-colors font-bold"
                >
                  <Save size={18} />
                  Save Configuration
                </button>
              </div>
            </form>
          </div>

          <div className="mt-6 p-4 bg-blue-50 border border-blue-100 rounded-lg flex gap-3">
            <Info className="text-blue-600 shrink-0" size={20} />
            <p className="text-xs text-blue-700 leading-relaxed">
              <strong>Note:</strong> These rules are applied during the annual leave reset process. 
              The system will automatically cap the carried-over balance based on these settings 
              and track the expiry date for the carried-over portion.
            </p>
          </div>
        </div>
      )}

      {activeTab === 'security' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Password Reset (Admin Tool) */}
          <div className="bg-white p-8 rounded-xl border border-gray-200 shadow-sm">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 bg-blue-50 rounded-lg">
                <Mail className="text-blue-600" size={24} />
              </div>
              <div>
                <h3 className="font-bold text-gray-900">Trigger Password Reset</h3>
                <p className="text-sm text-gray-500">Send a password reset email to any employee.</p>
              </div>
            </div>
            
            <form onSubmit={handleSendResetEmail} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Employee Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                  <input
                    type="email"
                    required
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-[#8B0000] focus:border-[#8B0000]"
                    placeholder="employee@company.com"
                  />
                </div>
              </div>
              <button
                type="submit"
                className="w-full flex items-center justify-center gap-2 py-2.5 bg-[#8B0000] text-white rounded-lg hover:bg-[#a00000] transition-colors font-bold shadow-sm"
              >
                <Key size={18} />
                Send Reset Link
              </button>
            </form>
            
            <div className="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-100">
              <p className="text-xs text-gray-500 leading-relaxed">
                <strong>Note:</strong> This will send an official Firebase password reset link to the user's email address. 
                The link is valid for 1 hour.
              </p>
            </div>
          </div>

          {/* Change My Password (Self Service) */}
          <div className="bg-white p-8 rounded-xl border border-gray-200 shadow-sm">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 bg-purple-50 rounded-lg">
                <Lock className="text-purple-600" size={24} />
              </div>
              <div>
                <h3 className="font-bold text-gray-900">Change My Password</h3>
                <p className="text-sm text-gray-500">Update your own login credentials.</p>
              </div>
            </div>
            
            <form onSubmit={handleChangePassword} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                  <input
                    type="password"
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-[#8B0000] focus:border-[#8B0000]"
                    placeholder="••••••••"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Confirm New Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                  <input
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-[#8B0000] focus:border-[#8B0000]"
                    placeholder="••••••••"
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={isUpdatingPassword}
                className="w-full flex items-center justify-center gap-2 py-2.5 bg-gray-900 text-white rounded-lg hover:bg-black transition-colors font-bold shadow-sm disabled:opacity-50"
              >
                {isUpdatingPassword ? <RefreshCw className="animate-spin" size={18} /> : <Save size={18} />}
                {isUpdatingPassword ? 'Updating...' : 'Update Password'}
              </button>
            </form>
            
            <div className="mt-6 p-4 bg-orange-50 rounded-lg border border-orange-100 flex gap-3">
              <AlertCircle className="text-orange-600 shrink-0" size={18} />
              <p className="text-[10px] text-orange-700 leading-relaxed">
                For security reasons, Firebase requires a recent login to change your password. 
                If you haven't logged in recently, you may be prompted to re-authenticate.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SystemSettings;
