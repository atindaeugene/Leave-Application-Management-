import React, { useState, useEffect } from 'react';
import { 
  collection, 
  getDocs, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  query, 
  orderBy, 
  where,
  serverTimestamp 
} from 'firebase/firestore';
import { 
  Users, 
  UserPlus, 
  Search, 
  Edit2, 
  Trash2, 
  Shield, 
  Mail, 
  Briefcase, 
  Hash,
  CheckCircle2,
  XCircle,
  Filter,
  MoreVertical,
  ChevronRight,
  UserCheck,
  UserMinus,
  Save,
  X
} from 'lucide-react';
import { db } from '../firebase';
import { useAuth } from '../AuthContext';
import { UserProfile, UserRole } from '../types';
import { toast } from 'sonner';
import { cn } from '../lib/utils';

const UserManagement: React.FC = () => {
  const { isAdmin, isHR } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState<string>('all');
  const [filterDept, setFilterDept] = useState<string>('all');
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    employeeNumber: '',
    department: '',
    role: 'staff' as UserRole,
    supervisorId: '',
    leaveBalance: 0,
    status: 'active' as 'active' | 'inactive'
  });

  const departments = Array.from(new Set(users.map(u => u.department))).filter(Boolean);
  const roles: UserRole[] = ['staff', 'manager', 'hr', 'admin', 'ceo'];

  useEffect(() => {
    if (!isAdmin && !isHR) return;

    const fetchUsers = async () => {
      try {
        const usersSnap = await getDocs(query(collection(db, 'users'), orderBy('fullName')));
        setUsers(usersSnap.docs.map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile)));
      } catch (error) {
        console.error("Error fetching users:", error);
        toast.error("Failed to load users.");
      } finally {
        setLoading(false);
      }
    };

    fetchUsers();
  }, [isAdmin, isHR]);

  const handleOpenModal = (user?: UserProfile) => {
    if (user) {
      setEditingUser(user);
      setFormData({
        fullName: user.fullName,
        email: user.email,
        employeeNumber: user.employeeNumber,
        department: user.department,
        role: user.role,
        supervisorId: user.supervisorId || '',
        leaveBalance: user.leaveBalance,
        status: user.status
      });
    } else {
      setEditingUser(null);
      setFormData({
        fullName: '',
        email: '',
        employeeNumber: '',
        department: '',
        role: 'staff',
        supervisorId: '',
        leaveBalance: 21,
        status: 'active'
      });
    }
    setIsModalOpen(true);
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingUser) {
        await updateDoc(doc(db, 'users', editingUser.uid), {
          ...formData,
          updatedAt: new Date().toISOString()
        });
        setUsers(users.map(u => u.uid === editingUser.uid ? { ...u, ...formData } : u));
        toast.success('User updated successfully.');
      } else {
        // In a real app, we might use Firebase Auth to create the user or send an invite
        // For this demo, we'll just add to the users collection
        const docRef = await addDoc(collection(db, 'users'), {
          ...formData,
          createdAt: new Date().toISOString()
        });
        setUsers([...users, { uid: docRef.id, ...formData, createdAt: new Date().toISOString() } as UserProfile]);
        toast.success('User added successfully.');
      }
      setIsModalOpen(false);
    } catch (error) {
      toast.error('Failed to save user.');
    }
  };

  const toggleUserStatus = async (user: UserProfile) => {
    const newStatus = user.status === 'active' ? 'inactive' : 'active';
    try {
      await updateDoc(doc(db, 'users', user.uid), { status: newStatus });
      setUsers(users.map(u => u.uid === user.uid ? { ...u, status: newStatus } : u));
      toast.success(`User ${newStatus === 'active' ? 'activated' : 'deactivated'}.`);
    } catch (error) {
      toast.error('Failed to update user status.');
    }
  };

  const filteredUsers = users.filter(user => {
    const matchesSearch = user.fullName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         user.employeeNumber.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = filterRole === 'all' || user.role === filterRole;
    const matchesDept = filterDept === 'all' || user.department === filterDept;
    return matchesSearch && matchesRole && matchesDept;
  });

  if (!isAdmin && !isHR) {
    return (
      <div className="p-8 text-center bg-white rounded-xl border border-gray-200 shadow-sm">
        <Shield size={48} className="mx-auto text-red-500 mb-4" />
        <h2 className="text-xl font-bold text-gray-900 mb-2">Access Denied</h2>
        <p className="text-gray-500">You do not have permission to manage users.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
          <p className="text-gray-500">Manage employee profiles, roles, and access permissions.</p>
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="flex items-center justify-center gap-2 px-6 py-2.5 bg-[#8B0000] text-white rounded-lg hover:bg-[#a00000] transition-all shadow-sm font-medium"
        >
          <UserPlus size={18} />
          Add New User
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-wrap gap-4 items-center">
        <div className="flex-1 min-w-[240px] relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            placeholder="Search by name, email or ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-[#8B0000] focus:border-[#8B0000]"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter size={18} className="text-gray-400" />
          <select
            value={filterRole}
            onChange={(e) => setFilterRole(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-[#8B0000] focus:border-[#8B0000] text-sm"
          >
            <option value="all">All Roles</option>
            {roles.map(role => (
              <option key={role} value={role}>{role.toUpperCase()}</option>
            ))}
          </select>
          <select
            value={filterDept}
            onChange={(e) => setFilterDept(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-[#8B0000] focus:border-[#8B0000] text-sm"
          >
            <option value="all">All Departments</option>
            {departments.map(dept => (
              <option key={dept} value={dept}>{dept}</option>
            ))}
          </select>
        </div>
      </div>

      {/* User Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Employee</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">ID & Dept</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Role</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Balance</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredUsers.map((user) => (
                <tr key={user.uid} className="hover:bg-gray-50 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-[#8B0000]/10 flex items-center justify-center text-[#8B0000] font-bold">
                        {user.fullName.charAt(0)}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-gray-900">{user.fullName}</p>
                        <div className="flex items-center gap-1 text-xs text-gray-500">
                          <Mail size={12} />
                          {user.email}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-1 text-xs font-medium text-gray-700">
                        <Hash size={12} className="text-gray-400" />
                        {user.employeeNumber}
                      </div>
                      <div className="flex items-center gap-1 text-xs text-gray-500">
                        <Briefcase size={12} className="text-gray-400" />
                        {user.department}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={cn(
                      "px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider",
                      user.role === 'admin' ? "bg-purple-100 text-purple-700" :
                      user.role === 'hr' ? "bg-blue-100 text-blue-700" :
                      user.role === 'manager' ? "bg-orange-100 text-orange-700" :
                      user.role === 'ceo' ? "bg-red-100 text-red-700" :
                      "bg-gray-100 text-gray-700"
                    )}>
                      {user.role}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm font-bold text-gray-900">{user.leaveBalance} Days</div>
                    <div className="text-[10px] text-gray-500">Available</div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={cn(
                      "flex items-center gap-1.5 text-xs font-medium",
                      user.status === 'active' ? "text-green-600" : "text-gray-400"
                    )}>
                      {user.status === 'active' ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
                      {user.status.charAt(0).toUpperCase() + user.status.slice(1)}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => handleOpenModal(user)}
                        className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Edit User"
                      >
                        <Edit2 size={18} />
                      </button>
                      <button
                        onClick={() => toggleUserStatus(user)}
                        className={cn(
                          "p-2 rounded-lg transition-colors",
                          user.status === 'active' 
                            ? "text-gray-400 hover:text-orange-600 hover:bg-orange-50" 
                            : "text-gray-400 hover:text-green-600 hover:bg-green-50"
                        )}
                        title={user.status === 'active' ? "Deactivate" : "Activate"}
                      >
                        {user.status === 'active' ? <UserMinus size={18} /> : <UserCheck size={18} />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filteredUsers.length === 0 && (
          <div className="p-12 text-center text-gray-500">
            <Users size={48} className="mx-auto text-gray-200 mb-4" />
            <p className="text-lg font-medium text-gray-900">No users found</p>
            <p>Try adjusting your search or filters.</p>
          </div>
        )}
      </div>

      {/* User Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50">
              <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                {editingUser ? <Edit2 size={20} className="text-[#8B0000]" /> : <UserPlus size={20} className="text-[#8B0000]" />}
                {editingUser ? 'Edit User Profile' : 'Add New Employee'}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors">
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleSaveUser} className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                    <input
                      type="text"
                      required
                      value={formData.fullName}
                      onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-[#8B0000] focus:border-[#8B0000]"
                      placeholder="John Doe"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
                    <input
                      type="email"
                      required
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-[#8B0000] focus:border-[#8B0000]"
                      placeholder="john@example.com"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Employee Number</label>
                    <input
                      type="text"
                      required
                      value={formData.employeeNumber}
                      onChange={(e) => setFormData({ ...formData, employeeNumber: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-[#8B0000] focus:border-[#8B0000]"
                      placeholder="EMP001"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
                    <input
                      type="text"
                      required
                      value={formData.department}
                      onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-[#8B0000] focus:border-[#8B0000]"
                      placeholder="Engineering"
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">System Role</label>
                    <select
                      value={formData.role}
                      onChange={(e) => setFormData({ ...formData, role: e.target.value as UserRole })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-[#8B0000] focus:border-[#8B0000]"
                    >
                      {roles.map(role => (
                        <option key={role} value={role}>{role.toUpperCase()}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Supervisor</label>
                    <select
                      value={formData.supervisorId}
                      onChange={(e) => setFormData({ ...formData, supervisorId: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-[#8B0000] focus:border-[#8B0000]"
                    >
                      <option value="">No Supervisor</option>
                      {users
                        .filter(u => u.uid !== editingUser?.uid && (u.role === 'manager' || u.role === 'admin' || u.role === 'ceo'))
                        .map(u => (
                          <option key={u.uid} value={u.uid}>{u.fullName} ({u.role})</option>
                        ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Leave Balance (Days)</label>
                    <input
                      type="number"
                      required
                      value={formData.leaveBalance}
                      onChange={(e) => setFormData({ ...formData, leaveBalance: parseInt(e.target.value) })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-[#8B0000] focus:border-[#8B0000]"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Account Status</label>
                    <select
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value as 'active' | 'inactive' })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-[#8B0000] focus:border-[#8B0000]"
                    >
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="pt-6 border-t border-gray-100 flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-[#8B0000] text-white rounded-lg hover:bg-[#a00000] transition-colors font-medium shadow-sm"
                >
                  <Save size={18} />
                  {editingUser ? 'Update Profile' : 'Create User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManagement;
