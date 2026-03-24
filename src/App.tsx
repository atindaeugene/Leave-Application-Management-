import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'sonner';
import { AuthProvider } from './AuthContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import ApplyLeave from './pages/ApplyLeave';
import MyRequests from './pages/MyRequests';
import Approvals from './pages/Approvals';
import HRDashboard from './pages/HRDashboard';
import SystemSettings from './pages/SystemSettings';
import UserManagement from './pages/UserManagement';

// Placeholder for missing pages
const Placeholder = ({ title }: { title: string }) => (
  <div className="p-8 bg-white rounded-xl border border-gray-200 shadow-sm text-center">
    <h2 className="text-xl font-bold text-gray-900 mb-2">{title}</h2>
    <p className="text-gray-500">This feature is coming soon in the next iteration.</p>
  </div>
);

import ErrorBoundary from './components/ErrorBoundary';

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <Router>
          <Routes>
            <Route path="/login" element={<Login />} />
            
            <Route element={<Layout />}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/hr/dashboard" element={<HRDashboard />} />
              <Route path="/apply" element={<ApplyLeave />} />
              <Route path="/my-requests" element={<MyRequests />} />
              <Route path="/approvals" element={<Approvals />} />
              <Route path="/admin/users" element={<UserManagement />} />
              <Route path="/admin/settings" element={<SystemSettings />} />
            </Route>

            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </Router>
        <Toaster position="top-right" richColors />
      </AuthProvider>
    </ErrorBoundary>
  );
}
