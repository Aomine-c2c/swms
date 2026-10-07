'use client';

import React, { useEffect, useState } from 'react';
import { 
  Users, 
  Plus, 
  X, 
  Check, 
  RotateCw,
  Pencil,
  Trash2,
  PowerOff,
  Power
} from 'lucide-react';
import { api } from '@/lib/api';
import { User, Role } from '@/types';
import { RouteGuard } from '@/components/auth/RouteGuard';

const EMPTY_USER_FORM = {
  username: '',
  email: '',
  password: '',
  first_name: '',
  last_name: '',
  role: '',
};

export default function AdminPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);

  // Create User Modal
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newUser, setNewUser] = useState({ ...EMPTY_USER_FORM });
  const [submitting, setSubmitting] = useState(false);

  // Edit User Modal
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editForm, setEditForm] = useState<any>({});
  const [editSubmitting, setEditSubmitting] = useState(false);

  const fetchAdminData = async () => {
    try {
      setLoading(true);
      const [uRes, rRes] = await Promise.allSettled([
        api.get('/users/'),
        api.get('/roles/'),
      ]);

      if (uRes.status === 'fulfilled') setUsers(uRes.value.data.results || uRes.value.data || []);
      if (rRes.status === 'fulfilled') setRoles(rRes.value.data.results || rRes.value.data || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdminData();
  }, []);

  // ─── Create User ─────────────────────────────────────────────────────────────
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload: any = { ...newUser };
      if (payload.role) payload.role = parseInt(payload.role);
      else delete payload.role;
      await api.post('/users/', payload);
      setIsCreateModalOpen(false);
      setNewUser({ ...EMPTY_USER_FORM });
      fetchAdminData();
    } catch (err: any) {
      alert(JSON.stringify(err.response?.data || 'Failed to create user.'));
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Edit User ───────────────────────────────────────────────────────────────
  const handleOpenEdit = (u: User) => {
    setEditingUser(u);
    setEditForm({
      first_name: u.first_name || '',
      last_name: u.last_name || '',
      email: u.email || '',
      role: u.role !== null ? String(u.role) : '',
      status: u.status || (u.is_active ? 'Active' : 'Inactive'),
    });
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    setEditSubmitting(true);
    try {
      const payload: any = {
        first_name: editForm.first_name,
        last_name: editForm.last_name,
        email: editForm.email,
        status: editForm.status,
      };
      if (editForm.role) payload.role = parseInt(editForm.role);
      else payload.role = null;
      await api.patch(`/users/${editingUser.id}/`, payload);
      setEditingUser(null);
      fetchAdminData();
    } catch (err: any) {
      alert(JSON.stringify(err.response?.data || 'Failed to update user.'));
    } finally {
      setEditSubmitting(false);
    }
  };

  // ─── Deactivate / Activate ───────────────────────────────────────────────────
  const handleToggleStatus = async (u: User) => {
    const isCurrentlyActive = u.is_active !== false && u.status !== 'Inactive';
    const newStatus = isCurrentlyActive ? 'Inactive' : 'Active';
    const verb = isCurrentlyActive ? 'deactivate' : 'activate';
    if (!window.confirm(`Are you sure you want to ${verb} user "${u.username}"?`)) return;
    try {
      await api.patch(`/users/${u.id}/`, {
        status: newStatus,
        is_active: !isCurrentlyActive,
      });
      fetchAdminData();
    } catch (err: any) {
      alert(err.response?.data?.detail || `Failed to ${verb} user.`);
    }
  };

  // ─── Delete User ─────────────────────────────────────────────────────────────
  const handleDeleteUser = async (u: User) => {
    if (!window.confirm(`Delete user "${u.username}"? This will deactivate their account and revoke access.`)) return;
    try {
      await api.delete(`/users/${u.id}/`);
      fetchAdminData();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to delete user.');
    }
  };

  return (
    <RouteGuard roles={['Administrator']}>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-zinc-900 flex items-center gap-2">
              <Users className="w-5 h-5 text-zinc-800" />
              <span>User Accounts & Access Control</span>
            </h2>
            <p className="text-xs text-zinc-500 mt-0.5">Manage operator credentials, assign role privileges, and supervise active accounts</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-zinc-900 hover:bg-black text-xs font-semibold text-white shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span>Create User Account</span>
            </button>
          </div>
        </div>

        {/* User Accounts View */}
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
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 text-zinc-700">
                  {users.map((u) => {
                    const isActive = u.is_active !== false && u.status !== 'Inactive';
                    return (
                      <tr key={u.id} className="hover:bg-zinc-50">
                        <td className="px-4 py-3 font-mono font-bold text-zinc-900">{u.username}</td>
                        <td className="px-4 py-3">{[u.first_name, u.last_name].filter(Boolean).join(' ') || '-'}</td>
                        <td className="px-4 py-3 text-zinc-500 font-mono text-[11px]">{u.email || '-'}</td>
                        <td className="px-4 py-3">
                          <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-semibold bg-zinc-100 text-zinc-800 border border-zinc-200">
                            {u.role_details?.name || (u.is_superuser ? 'Administrator' : 'Unassigned')}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1 text-[11px] font-semibold ${isActive ? 'text-zinc-800' : 'text-zinc-400'}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-zinc-900' : 'bg-zinc-300'}`} />
                            <span>{u.status || (isActive ? 'Active' : 'Inactive')}</span>
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleOpenEdit(u)}
                              className="p-1 rounded hover:bg-zinc-100 text-zinc-600 hover:text-zinc-900 transition-colors"
                              title="Edit User"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleToggleStatus(u)}
                              className={`p-1 rounded transition-colors ${
                                isActive
                                  ? 'hover:bg-amber-50 text-amber-600 hover:text-amber-800'
                                  : 'hover:bg-zinc-100 text-zinc-400 hover:text-zinc-700'
                              }`}
                              title={isActive ? 'Deactivate User' : 'Activate User'}
                            >
                              {isActive ? <PowerOff className="w-3.5 h-3.5" /> : <Power className="w-3.5 h-3.5" />}
                            </button>
                            {!u.is_superuser && (
                              <button
                                onClick={() => handleDeleteUser(u)}
                                className="p-1 rounded hover:bg-rose-50 text-zinc-400 hover:text-rose-600 transition-colors"
                                title="Delete User"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        {/* Create User Modal */}
        {isCreateModalOpen && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <div className="w-full max-w-md bg-white border border-zinc-200 rounded-xl shadow-2xl p-6">
              <div className="flex items-center justify-between pb-3 border-b border-zinc-200">
                <h3 className="font-bold text-sm text-zinc-900">Create Operator Account</h3>
                <button onClick={() => setIsCreateModalOpen(false)} className="text-zinc-400 hover:text-zinc-600">
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
                    className="w-full bg-zinc-50 border border-zinc-200 rounded-lg p-2 text-zinc-900 focus:outline-none focus:bg-white focus:border-zinc-800"
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
                      className="w-full bg-zinc-50 border border-zinc-200 rounded-lg p-2 text-zinc-900 focus:outline-none focus:bg-white focus:border-zinc-800"
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
                      className="w-full bg-zinc-50 border border-zinc-200 rounded-lg p-2 text-zinc-900 focus:outline-none focus:bg-white focus:border-zinc-800"
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
                    className="w-full bg-zinc-50 border border-zinc-200 rounded-lg p-2 text-zinc-900 focus:outline-none focus:bg-white focus:border-zinc-800"
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
                    className="w-full bg-zinc-50 border border-zinc-200 rounded-lg p-2 text-zinc-900 focus:outline-none focus:bg-white focus:border-zinc-800"
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
                    className="w-full bg-zinc-50 border border-zinc-200 rounded-lg p-2 text-zinc-900 focus:outline-none focus:bg-white focus:border-zinc-800"
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
                    onClick={() => setIsCreateModalOpen(false)}
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

        {/* Edit User Modal */}
        {editingUser && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <div className="w-full max-w-md bg-white border border-zinc-200 rounded-xl shadow-2xl p-6">
              <div className="flex items-center justify-between pb-3 border-b border-zinc-200">
                <h3 className="font-bold text-sm text-zinc-900">Edit User: <span className="font-mono text-zinc-600">{editingUser.username}</span></h3>
                <button onClick={() => setEditingUser(null)} className="text-zinc-400 hover:text-zinc-600">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSaveEdit} className="mt-4 space-y-3.5 text-xs">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-zinc-700 uppercase tracking-wider mb-1">
                      First Name
                    </label>
                    <input
                      type="text"
                      value={editForm.first_name}
                      onChange={(e) => setEditForm({ ...editForm, first_name: e.target.value })}
                      className="w-full bg-zinc-50 border border-zinc-200 rounded-lg p-2 text-zinc-900 focus:outline-none focus:bg-white focus:border-zinc-800"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-zinc-700 uppercase tracking-wider mb-1">
                      Last Name
                    </label>
                    <input
                      type="text"
                      value={editForm.last_name}
                      onChange={(e) => setEditForm({ ...editForm, last_name: e.target.value })}
                      className="w-full bg-zinc-50 border border-zinc-200 rounded-lg p-2 text-zinc-900 focus:outline-none focus:bg-white focus:border-zinc-800"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-zinc-700 uppercase tracking-wider mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={editForm.email}
                    onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                    className="w-full bg-zinc-50 border border-zinc-200 rounded-lg p-2 text-zinc-900 focus:outline-none focus:bg-white focus:border-zinc-800"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-zinc-700 uppercase tracking-wider mb-1">
                    Assigned Role
                  </label>
                  <select
                    value={editForm.role}
                    onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                    className="w-full bg-zinc-50 border border-zinc-200 rounded-lg p-2 text-zinc-900 focus:outline-none focus:bg-white focus:border-zinc-800"
                  >
                    <option value="">— Unassigned —</option>
                    {roles.map((r) => (
                      <option key={r.id} value={r.id}>{r.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-zinc-700 uppercase tracking-wider mb-1">
                    Account Status
                  </label>
                  <select
                    value={editForm.status}
                    onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                    className="w-full bg-zinc-50 border border-zinc-200 rounded-lg p-2 text-zinc-900 focus:outline-none focus:bg-white focus:border-zinc-800"
                  >
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-zinc-200">
                  <button
                    type="button"
                    onClick={() => setEditingUser(null)}
                    className="px-3 py-1.5 rounded-lg border border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-100"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={editSubmitting}
                    className="px-4 py-1.5 rounded-lg bg-zinc-900 hover:bg-black text-white font-semibold"
                  >
                    {editSubmitting ? 'Saving...' : 'Save Changes'}
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
