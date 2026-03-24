import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  FilePlus, 
  CheckSquare, 
  Settings, 
  Users, 
  LogOut, 
  Calendar,
  ShieldCheck,
  Menu,
  X
} from 'lucide-react';
import { useAuth } from '../AuthContext';
import { auth } from '../firebase';
import { cn } from '../lib/utils';
import { ROLE_LABELS } from '../constants';

const Sidebar: React.FC<{ isOpen: boolean; toggle: () => void }> = ({ isOpen, toggle }) => {
  const { profile, isAdmin, isHR, isManager, isCEO } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await auth.signOut();
    navigate('/login');
  };

  const navItems = [
    { label: 'Dashboard', icon: LayoutDashboard, path: '/', show: true },
    { label: 'HR Dashboard', icon: ShieldCheck, path: '/hr/dashboard', show: isHR || isAdmin },
    { label: 'Apply Leave', icon: FilePlus, path: '/apply', show: true },
    { label: 'My Requests', icon: Calendar, path: '/my-requests', show: true },
    { label: 'Approvals', icon: CheckSquare, path: '/approvals', show: isManager || isHR || isCEO || isAdmin },
    { label: 'User Management', icon: Users, path: '/admin/users', show: isAdmin },
    { label: 'System Settings', icon: Settings, path: '/admin/settings', show: isAdmin || isHR },
  ];

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden" 
          onClick={toggle}
        />
      )}

      <aside className={cn(
        "fixed inset-y-0 left-0 w-64 bg-[#8B0000] text-white transform transition-transform duration-200 ease-in-out z-50 lg:translate-x-0 lg:static lg:inset-0",
        isOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="p-6 border-b border-white/10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center text-[#8B0000] font-bold text-xl">
                D
              </div>
              <div>
                <h1 className="font-bold text-lg leading-tight">DEVCO SACCO</h1>
                <p className="text-xs text-white/60">Leave Management</p>
              </div>
            </div>
          </div>

          {/* User Info */}
          <div className="p-6 bg-black/10">
            <p className="text-sm font-medium truncate">{profile?.fullName}</p>
            <p className="text-xs text-white/60 capitalize">{profile?.role ? ROLE_LABELS[profile.role] : 'Loading...'}</p>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
            {navItems.filter(item => item.show).map((item) => (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => toggle()}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-lg transition-colors",
                  location.pathname === item.path 
                    ? "bg-white/10 text-white" 
                    : "text-white/70 hover:bg-white/5 hover:text-white"
                )}
              >
                <item.icon size={20} />
                <span className="font-medium">{item.label}</span>
              </Link>
            ))}
          </nav>

          {/* Footer */}
          <div className="p-4 border-t border-white/10">
            <button
              onClick={handleLogout}
              className="flex items-center gap-3 w-full px-4 py-3 text-white/70 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
            >
              <LogOut size={20} />
              <span className="font-medium">Sign Out</span>
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
