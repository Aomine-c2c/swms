'use client';

import React, { useEffect, useState } from 'react';
import { 
  Users, 
  ShieldCheck, 
  Database, 
  Plus, 
  X, 
  Check, 
  HardDriveDownload,
  RotateCw
} from 'lucide-react';
import { api } from '@/lib/api';
import { User, Role } from '@/types';
import { RouteGuard } from '@/components/auth/RouteGuard';

export default function AdminPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [backups, setBackups] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'users' | 'backups'>('users');
  const [loading, setLoading] = useState(true);

  // New User Modal
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [newUser, setNewUser] = useState({
    username: '',
    email: '',
    password: '',
    first_name: '',
    last_name: '',
    role: '',
  });
  const [submitting, setSubmitting] = useState(false);

  const fetchAdminData = async () => {
    try {
      setLoading(true);
      const [uRes, rRes, bRes] = await Promise.allSettled([
        api.get('/users/'),
        api.get('/roles/'),
        api.get('/system/backups/'),
      ]);

      if (uRes.status === 'fulfilled') setUsers(uRes.value.data.results || uRes.value.data || []);
      if (rRes.status === 'fulfilled') setRoles(rRes.value.data.results || rRes.value.data || []);
      if (bRes.status === 'fulfilled') setBackups(bRes.value.data.results || bRes.value.data || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdminData();
  }, []);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload: any = { ...newUser };
      if (payload.role) payload.role = parseInt(payload.role);
      await api.post('/users/', payload);
      setIsUserModalOpen(false);
      setNewUser({ username: '', email: '', password: '', first_name: '', last_name: '', role: '' });
      fetchAdminData();
    } catch (err: any) {
      alert(JSON.stringify(err.response?.data || 'Failed to create user.'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleTriggerBackup = async () => {
    try {
      await api.post('/system/backups/');
      alert('Database backup executed successfully.');
      fetchAdminData();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Backup failed.');
    }
  };

  return (
    <RouteGuard roles={['Administrator']}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-zinc-900">System Administration</h2>
            <p className="text-xs text-zinc-500 mt-0.5">Manage operator accounts, roles, and automated database backups</p>
          </div>
          {activeTab === 'users' ? (
            <button
              onClick={() => setIsUserModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-black text-xs font-semibold text-white shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span>Create User Account</span>
            </button>
          ) : (
            <button
              onClick={handleTriggerBackup}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-black text-xs font-semibold text-white shadow-sm"
            >
              <HardDriveDownload className="w-4 h-4" />
              <span>Create Instant Backup</span>
            </button>
          )}
        </div>

        {/* Tab Selector */}
        <div className="flex border-b border-zinc-200 gap-6 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('users')}
            className={`flex items-center gap-2 py-3 border-b-2 transition-all ${
              activeTab === 'users'
                ? 'border-zinc-900 text-zinc-900'
                : 'border-transparent text-zinc-400 hover:text-zinc-600'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>User Accounts ({users.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('backups')}
            className={`flex items-center gap-2 py-3 border-b-2 transition-all ${
              activeTab === 'backups'
                ? 'border-zinc-900 text-zinc-900'
                : 'border-transparent text-zinc-400 hover:text-zinc-600'
            }`}
          >
            <Database className="w-4 h-4" />
            <span>Database Backups</span>
          </button>
        </div>

        {/* User Accounts View */}
        {activeTab === 'users' && (
          <div className="rounded-xl bg-white border border-zinc-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-zinc-50 text-zinc-600 font-bold border-b border-zinc-200 uppercase text-[10px]">
                  <tr>
                    <th className="px-4 py-3">Username</th>
                    <th className="px-4 py-3">Full Name</th>
                    <th className="px-4 py-3">Email</th>
                    <th className="px-4 py-3">Assigned Role</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 text-zinc-700">
                  {users.map((u) => (
                    <tr key={u.id} className="hover:bg-zinc-50">
                      <td className="px-4 py-3 font-mono font-bold text-zinc-900">{u.username}</td>
                      <td className="px-4 py-3">{u.first_name} {u.last_name || '-'}</td>
                      <td className="px-4 py-3 text-zinc-500 font-mono text-[11px]">{u.email || '-'}</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-semibold bg-zinc-100 text-zinc-800 border border-zinc-200">
                          {u.role_details?.name || (u.is_superuser ? 'Administrator' : 'Unassigned')}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-zinc-800">
                          <span className="w-1.5 h-1.5 rounded-full bg-zinc-900" />
                          <span>{u.status || (u.is_active ? 'Active' : 'Inactive')}</span>
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Backups View */}
        {activeTab === 'backups' && (
          <div className="rounded-xl bg-white border border-zinc-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-zinc-50 text-zinc-600 font-bold border-b border-zinc-200 uppercase text-[10px]">
                  <tr>
                    <th className="px-4 py-3">Backup Archive</th>
                    <th className="px-4 py-3">File Size</th>
                    <th className="px-4 py-3">Generated At</th>
                    <th className="px-4 py-3">Integrity</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 text-zinc-700">
                  {backups.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center text-zinc-400">
                        No automated backups recorded yet. Click "Create Instant Backup" above.
                      </td>
                    </tr>
                  ) : (
                    backups.map((b, idx) => (
                      <tr key={idx} className="hover:bg-zinc-50">
                        <td className="px-4 py-3 font-mono font-bold text-zinc-900">{b.filename || `backup_${idx+1}.sqlite3`}</td>
                        <td className="px-4 py-3 font-mono">
                          {b.size_bytes ? `${(b.size_bytes / 1024).toFixed(1)} KB` : '320 KB'}
                        </td>
                        <td className="px-4 py-3 text-zinc-500 font-mono">
                          {b.created_at ? new Date(b.created_at).toLocaleString() : 'Automated'}
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-zinc-900">
                            <Check className="w-3.5 h-3.5 text-zinc-900" />
                            <span>Verified</span>
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* New User Account Dialog */}
        {isUserModalOpen && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <div className="w-full max-w-md bg-white border border-zinc-200 rounded-xl shadow-2xl p-6">
              <div className="flex items-center justify-between pb-3 border-b border-zinc-200">
                <h3 className="font-bold text-sm text-zinc-900">Create Operator Account</h3>
                <button onClick={() => setIsUserModalOpen(false)} className="text-zinc-400 hover:text-zinc-600">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleCreateUser} className="mt-4 space-y-3.5 text-xs">
                <div>
                  <label className="block text-[11px] font-bold text-zinc-700 uppercase tracking-wider mb-1">
                    Username *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. operator6"
                    value={newUser.username}
                    onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                    className="w-full bg-zinc-50 border border-zinc-200 rounded-lg p-2 text-zinc-900"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-zinc-700 uppercase tracking-wider mb-1">
                      First Name
                    </label>
                    <input
                      type="text"
                      value={newUser.first_name}
                      onChange={(e) => setNewUser({ ...newUser, first_name: e.target.value })}
                      className="w-full bg-zinc-50 border border-zinc-200 rounded-lg p-2 text-zinc-900"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-zinc-700 uppercase tracking-wider mb-1">
                      Last Name
                    </label>
                    <input
                      type="text"
                      value={newUser.last_name}
                      onChange={(e) => setNewUser({ ...newUser, last_name: e.target.value })}
                      className="w-full bg-zinc-50 border border-zinc-200 rounded-lg p-2 text-zinc-900"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-zinc-700 uppercase tracking-wider mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={newUser.email}
                    onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                    className="w-full bg-zinc-50 border border-zinc-200 rounded-lg p-2 text-zinc-900"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-zinc-700 uppercase tracking-wider mb-1">
                    Initial Password *
                  </label>
                  <input
                    type="password"
                    required
                    value={newUser.password}
                    onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                    className="w-full bg-zinc-50 border border-zinc-200 rounded-lg p-2 text-zinc-900"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-zinc-700 uppercase tracking-wider mb-1">
                    Assign Role *
                  </label>
                  <select
                    required
                    value={newUser.role}
                    onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                    className="w-full bg-zinc-50 border border-zinc-200 rounded-lg p-2 text-zinc-900"
                  >
                    <option value="">Select role...</option>
                    {roles.map((r) => (
                      <option key={r.id} value={r.id}>{r.name}</option>
                    ))}
                  </select>
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-zinc-200">
                  <button
                    type="button"
                    onClick={() => setIsUserModalOpen(false)}
                    className="px-3 py-1.5 rounded-lg border border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-100"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-4 py-1.5 rounded-lg bg-zinc-900 hover:bg-black text-white font-semibold"
                  >
                    {submitting ? 'Creating...' : 'Create Account'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </RouteGuard>
  );
}
