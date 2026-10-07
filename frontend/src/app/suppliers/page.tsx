'use client';

import React, { useEffect, useState } from 'react';
import {
  Building2,
  Plus,
  X,
  Search,
  CheckCircle2,
  AlertTriangle,
  Phone,
  MapPin,
  User,
  ShieldCheck,
  Package,
  Trash2
} from 'lucide-react';
import { api } from '@/lib/api';
import { Supplier } from '@/types';
import { RouteGuard } from '@/components/auth/RouteGuard';

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Active' | 'Inactive'>('All');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState<any>({});
  const [submitting, setSubmitting] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await api.get('/suppliers/');
      setSuppliers(res.data.results || res.data || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleOpenCreate = () => {
    setEditId(null);
    setFormData({
      status: 'Active',
      name: '',
      contact_person: '',
      address: '',
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (s: Supplier) => {
    setEditId(s.id);
    setFormData({
      name: s.name,
      contact_person: s.contact_person || '',
      address: s.address || '',
      status: s.status || 'Active',
    });
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload: any = {
        name: formData.name,
        contact_person: formData.contact_person || undefined,
        address: formData.address || undefined,
        status: formData.status || 'Active',
      };

      if (editId) {
        await api.patch(`/suppliers/${editId}/`, payload);
      } else {
        await api.post('/suppliers/', payload);
      }

      setIsModalOpen(false);
      setFormData({});
      setEditId(null);
      fetchData();
    } catch (err: any) {
      alert(JSON.stringify(err.response?.data || 'Failed to save supplier.'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStatus = async (s: Supplier) => {
    const newStatus = s.status === 'Active' ? 'Inactive' : 'Active';
    try {
      await api.patch(`/suppliers/${s.id}/`, { status: newStatus });
      fetchData();
    } catch (err: any) {
      alert(JSON.stringify(err.response?.data || 'Failed to toggle supplier status.'));
    }
  };

  const handleDelete = async (s: Supplier) => {
    if (!window.confirm(`Delete supplier "${s.name}"? This will mark them as Inactive.`)) return;
    try {
      await api.delete(`/suppliers/${s.id}/`);
      fetchData();
    } catch (err: any) {
      alert(JSON.stringify(err.response?.data || 'Failed to delete supplier.'));
    }
  };

  // Metrics
  const activeCount = suppliers.filter((s) => s.status === 'Active').length;
  const inactiveCount = suppliers.filter((s) => s.status === 'Inactive').length;

  const filtered = suppliers.filter((s) => {
    const q = search.toLowerCase();
    const matchesSearch =
      s.name.toLowerCase().includes(q) ||
      (s.contact_person && s.contact_person.toLowerCase().includes(q)) ||
      (s.address && s.address.toLowerCase().includes(q));

    if (!matchesSearch) return false;

    if (statusFilter === 'Active') return s.status === 'Active';
    if (statusFilter === 'Inactive') return s.status === 'Inactive';
    return true;
  });

  return (
    <RouteGuard roles={['Administrator', 'Operator', 'Supervisor']}>
      <div className="space-y-6">
        
        {/* Header Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-zinc-900">Suppliers & Commercial Vendors</h2>
            <p className="text-xs text-zinc-500 mt-0.5">
              Approved commodity source vendors, certified consignors, and destination customer accounts
            </p>
          </div>
          <button
            onClick={handleOpenCreate}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-zinc-900 hover:bg-black text-xs font-semibold text-white shadow-sm transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Add Supplier</span>
          </button>
        </div>

        {/* Supplier KPI Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white border border-zinc-200 rounded-xl p-4 shadow-xs flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">Total Suppliers</p>
              <h3 className="text-2xl font-black text-zinc-900 mt-0.5">{suppliers.length}</h3>
              <p className="text-[10px] text-zinc-500 mt-0.5">Registered trade partners</p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-zinc-100 flex items-center justify-center text-zinc-800">
              <Building2 className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-white border border-zinc-200 rounded-xl p-4 shadow-xs flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">Active Trade Accounts</p>
              <h3 className="text-2xl font-black text-zinc-900 mt-0.5">{activeCount}</h3>
              <p className="text-[10px] text-zinc-500 mt-0.5">Permitted for delivery reception</p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-zinc-100 flex items-center justify-center text-zinc-800">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-white border border-zinc-200 rounded-xl p-4 shadow-xs flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">Dormant / On Hold</p>
              <h3 className="text-2xl font-black text-zinc-900 mt-0.5">{inactiveCount}</h3>
              <p className="text-[10px] text-zinc-500 mt-0.5">Credit review or suspended</p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-zinc-100 flex items-center justify-center text-zinc-800">
              <AlertTriangle className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* Filter Controls & Search */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:w-80">
            <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search vendor name, contact person, city..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-white border border-zinc-200 rounded-lg pl-9 pr-3 py-1.5 text-xs text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-zinc-800"
            />
          </div>

          <div className="flex border border-zinc-200 rounded-lg p-0.5 bg-zinc-100 text-xs font-semibold self-stretch sm:self-auto">
            {(['All', 'Active', 'Inactive'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setStatusFilter(tab)}
                className={`px-3 py-1 rounded-md transition-all ${
                  statusFilter === tab ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {/* Table Content */}
        <div className="rounded-xl bg-white border border-zinc-200 shadow-xs overflow-hidden">
          <table className="w-full text-left text-xs">
            <thead className="bg-zinc-50 text-zinc-600 font-bold border-b border-zinc-200 uppercase text-[10px]">
              <tr>
                <th className="px-4 py-3">Vendor / Entity Name</th>
                <th className="px-4 py-3">Primary Contact</th>
                <th className="px-4 py-3">Location / Operational Base</th>
                <th className="px-4 py-3">Account Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 text-zinc-700">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-zinc-400">
                    No suppliers found matching your search.
                  </td>
                </tr>
              ) : (
                filtered.map((s) => (
                  <tr key={s.id} className="hover:bg-zinc-50/80 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-zinc-100 border border-zinc-200 flex items-center justify-center text-zinc-700">
                          <Building2 className="w-4 h-4" />
                        </div>
                        <div>
                          <span className="font-bold text-zinc-900 block">{s.name}</span>
                          <span className="text-[10px] text-zinc-400 font-mono">SUP-#{s.id.toString().padStart(4, '0')}</span>
                        </div>
                      </div>
                    </td>

                    <td className="px-4 py-3">
                      {s.contact_person ? (
                        <div className="flex items-center gap-1.5 text-zinc-800 font-medium">
                          <User className="w-3.5 h-3.5 text-zinc-400" />
                          <span>{s.contact_person}</span>
                        </div>
                      ) : (
                        <span className="text-zinc-400 italic">No representative assigned</span>
                      )}
                    </td>

                    <td className="px-4 py-3 text-zinc-600">
                      {s.address ? (
                        <div className="flex items-center gap-1.5">
                          <MapPin className="w-3 h-3 text-zinc-400 shrink-0" />
                          <span className="truncate max-w-xs">{s.address}</span>
                        </div>
                      ) : (
                        <span className="text-zinc-400 italic">Standard Regional Commercial</span>
                      )}
                    </td>

                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleToggleStatus(s)}
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[10px] font-semibold border transition-all ${
                          s.status === 'Active'
                            ? 'bg-zinc-100 text-zinc-900 border-zinc-300 hover:bg-zinc-200'
                            : 'bg-zinc-50 text-zinc-400 border-zinc-200 hover:bg-zinc-100'
                        }`}
                        title="Click to toggle status"
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            s.status === 'Active' ? 'bg-zinc-900' : 'bg-zinc-400'
                          }`}
                        />
                        {s.status || 'Active'}
                      </button>
                    </td>

                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleOpenEdit(s)}
                          className="px-2.5 py-1 rounded-md border border-zinc-200 hover:bg-zinc-100 text-[11px] font-semibold text-zinc-700 transition-colors"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(s)}
                          className="p-1 rounded-md border border-rose-200 text-rose-600 hover:bg-rose-50 transition-colors"
                          title="Delete supplier"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Modal: Create / Edit Supplier */}
        {isModalOpen && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <div className="w-full max-w-md bg-white border border-zinc-200 rounded-2xl shadow-2xl p-6">
              <div className="flex items-center justify-between pb-3 border-b border-zinc-200">
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-zinc-900" />
                  <h3 className="font-bold text-sm text-zinc-900">
                    {editId ? 'Edit Supplier Account' : 'Register Commercial Supplier'}
                  </h3>
                </div>
                <button onClick={() => setIsModalOpen(false)} className="text-zinc-400 hover:text-zinc-600">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSave} className="mt-4 space-y-3.5 text-xs">
                <div>
                  <label className="block text-[11px] font-bold text-zinc-700 uppercase tracking-wider mb-1">
                    Company / Vendor Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Masvingo Quarries & Mining Ltd"
                    value={formData.name || ''}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full bg-zinc-50 border border-zinc-200 rounded-lg p-2.5 text-zinc-900 font-semibold focus:outline-none focus:bg-white focus:border-zinc-800"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-zinc-700 uppercase tracking-wider mb-1">
                    Primary Contact Representative
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Sarah Ndlovu (Accounts)"
                    value={formData.contact_person || ''}
                    onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
                    className="w-full bg-zinc-50 border border-zinc-200 rounded-lg p-2.5 text-zinc-900 focus:outline-none focus:bg-white focus:border-zinc-800"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-zinc-700 uppercase tracking-wider mb-1">
                    Base Facility Address / Plant Location
                  </label>
                  <textarea
                    rows={2}
                    placeholder="e.g. Plot 14, Industrial Site, Mutare Road"
                    value={formData.address || ''}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    className="w-full bg-zinc-50 border border-zinc-200 rounded-lg p-2.5 text-zinc-900 focus:outline-none focus:bg-white focus:border-zinc-800 resize-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-zinc-700 uppercase tracking-wider mb-1">
                    Commercial Account Status
                  </label>
                  <select
                    value={formData.status || 'Active'}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="w-full bg-zinc-50 border border-zinc-200 rounded-lg p-2.5 text-zinc-900 focus:outline-none focus:bg-white focus:border-zinc-800"
                  >
                    <option value="Active">Active (Permitted for Inbound Weighment)</option>
                    <option value="Inactive">Inactive / Suspended</option>
                  </select>
                </div>

                <div className="flex justify-end gap-2 pt-4 border-t border-zinc-200">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-3.5 py-2 rounded-lg border border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-100"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-4 py-2 rounded-lg bg-zinc-900 hover:bg-black text-white font-semibold shadow-sm"
                  >
                    {submitting ? 'Saving...' : editId ? 'Update Supplier' : 'Register Supplier'}
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
