'use client';

import React, { useEffect, useState } from 'react';
import {
  Package,
  Plus,
  X,
  Search,
  CheckCircle2,
  AlertTriangle,
  Scale,
  DollarSign,
  Layers,
  Sparkles,
  Trash2
} from 'lucide-react';
import { api } from '@/lib/api';
import { Material } from '@/types';
import { RouteGuard } from '@/components/auth/RouteGuard';

export default function MaterialsPage() {
  const [materials, setMaterials] = useState<Material[]>([]);
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
      const res = await api.get('/materials/');
      setMaterials(res.data.results || res.data || []);
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
      description: '',
      unit_price: '',
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (m: Material) => {
    setEditId(m.id);
    setFormData({
      name: m.name,
      description: m.description || '',
      unit_price: m.unit_price || '',
      status: m.status || 'Active',
    });
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload: any = {
        name: formData.name,
        description: formData.description || undefined,
        unit_price: formData.unit_price ? parseFloat(formData.unit_price) : null,
        status: formData.status || 'Active',
      };

      if (editId) {
        await api.patch(`/materials/${editId}/`, payload);
      } else {
        await api.post('/materials/', payload);
      }

      setIsModalOpen(false);
      setFormData({});
      setEditId(null);
      fetchData();
    } catch (err: any) {
      alert(JSON.stringify(err.response?.data || 'Failed to save material.'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStatus = async (m: Material) => {
    const newStatus = m.status === 'Active' ? 'Inactive' : 'Active';
    try {
      await api.patch(`/materials/${m.id}/`, { status: newStatus });
      fetchData();
    } catch (err: any) {
      alert(JSON.stringify(err.response?.data || 'Failed to toggle material status.'));
    }
  };

  const handleDelete = async (m: Material) => {
    if (!window.confirm(`Delete commodity "${m.name}"? This will mark it as Inactive.`)) return;
    try {
      await api.delete(`/materials/${m.id}/`);
      fetchData();
    } catch (err: any) {
      alert(JSON.stringify(err.response?.data || 'Failed to delete commodity.'));
    }
  };

  // Metrics
  const activeCount = materials.filter((m) => m.status === 'Active').length;
  const pricedCount = materials.filter((m) => Boolean(m.unit_price && Number(m.unit_price) > 0)).length;

  const filtered = materials.filter((m) => {
    const q = search.toLowerCase();
    const matchesSearch =
      m.name.toLowerCase().includes(q) ||
      (m.description && m.description.toLowerCase().includes(q));

    if (!matchesSearch) return false;

    if (statusFilter === 'Active') return m.status === 'Active';
    if (statusFilter === 'Inactive') return m.status === 'Inactive';
    return true;
  });

  return (
    <RouteGuard roles={['Administrator', 'Operator', 'Supervisor']}>
      <div className="space-y-6">
        
        {/* Header Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-zinc-900">Materials & Commodities Registry</h2>
            <p className="text-xs text-zinc-500 mt-0.5">
              Bulk aggregate commodities, ore minerals, unit valuations, and scale billing classifications
            </p>
          </div>
          <button
            onClick={handleOpenCreate}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-zinc-900 hover:bg-black text-xs font-semibold text-white shadow-sm transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Add Commodity</span>
          </button>
        </div>

        {/* Commodity KPI Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white border border-zinc-200 rounded-xl p-4 shadow-xs flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">Total Commodities</p>
              <h3 className="text-2xl font-black text-zinc-900 mt-0.5">{materials.length}</h3>
              <p className="text-[10px] text-zinc-500 mt-0.5">Catalogued bulk materials</p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-zinc-100 flex items-center justify-center text-zinc-800">
              <Package className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-white border border-zinc-200 rounded-xl p-4 shadow-xs flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">Active on Weighbridge</p>
              <h3 className="text-2xl font-black text-zinc-900 mt-0.5">{activeCount}</h3>
              <p className="text-[10px] text-zinc-500 mt-0.5">Selectable by scale operators</p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-zinc-100 flex items-center justify-center text-zinc-800">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-white border border-zinc-200 rounded-xl p-4 shadow-xs flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">Priced Valuations</p>
              <h3 className="text-2xl font-black text-zinc-900 mt-0.5">{pricedCount}</h3>
              <p className="text-[10px] text-zinc-500 mt-0.5">Unit tariff configured</p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-zinc-100 flex items-center justify-center text-zinc-800">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* Filter Controls & Search */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:w-80">
            <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search commodity name or grade description..."
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
                <th className="px-4 py-3">Commodity Specification</th>
                <th className="px-4 py-3">Quality / Grade Description</th>
                <th className="px-4 py-3">Default Billing Unit</th>
                <th className="px-4 py-3">Tariff / Unit Price</th>
                <th className="px-4 py-3">Weighment Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 text-zinc-700">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-zinc-400">
                    No materials found matching your search.
                  </td>
                </tr>
              ) : (
                filtered.map((m) => (
                  <tr key={m.id} className="hover:bg-zinc-50/80 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-zinc-100 border border-zinc-200 flex items-center justify-center text-zinc-700">
                          <Package className="w-4 h-4" />
                        </div>
                        <div>
                          <span className="font-bold text-zinc-900 block">{m.name}</span>
                          <span className="text-[10px] text-zinc-400 font-mono">MAT-#{m.id.toString().padStart(4, '0')}</span>
                        </div>
                      </div>
                    </td>

                    <td className="px-4 py-3 text-zinc-600">
                      <span className="truncate max-w-xs block">
                        {m.description || 'Standard bulk delivery commodity'}
                      </span>
                    </td>

                    <td className="px-4 py-3 font-mono">
                      <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-bold bg-zinc-100 text-zinc-900 border border-zinc-200">
                        METRIC TON (MT)
                      </span>
                    </td>

                    <td className="px-4 py-3 font-mono font-bold text-zinc-900">
                      {m.unit_price && Number(m.unit_price) > 0 ? (
                        <span>${Number(m.unit_price).toFixed(2)} / MT</span>
                      ) : (
                        <span className="text-zinc-400 font-normal italic">Market / Contract</span>
                      )}
                    </td>

                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleToggleStatus(m)}
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[10px] font-semibold border transition-all ${
                          m.status === 'Active'
                            ? 'bg-zinc-100 text-zinc-900 border-zinc-300 hover:bg-zinc-200'
                            : 'bg-zinc-50 text-zinc-400 border-zinc-200 hover:bg-zinc-100'
                        }`}
                        title="Click to toggle status"
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            m.status === 'Active' ? 'bg-zinc-900' : 'bg-zinc-400'
                          }`}
                        />
                        {m.status || 'Active'}
                      </button>
                    </td>

                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleOpenEdit(m)}
                          className="px-2.5 py-1 rounded-md border border-zinc-200 hover:bg-zinc-100 text-[11px] font-semibold text-zinc-700 transition-colors"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(m)}
                          className="p-1 rounded-md border border-rose-200 text-rose-600 hover:bg-rose-50 transition-colors"
                          title="Delete commodity"
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

        {/* Modal: Create / Edit Material */}
        {isModalOpen && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <div className="w-full max-w-md bg-white border border-zinc-200 rounded-2xl shadow-2xl p-6">
              <div className="flex items-center justify-between pb-3 border-b border-zinc-200">
                <div className="flex items-center gap-2">
                  <Package className="w-4 h-4 text-zinc-900" />
                  <h3 className="font-bold text-sm text-zinc-900">
                    {editId ? 'Edit Commodity Specification' : 'Register New Commodity'}
                  </h3>
                </div>
                <button onClick={() => setIsModalOpen(false)} className="text-zinc-400 hover:text-zinc-600">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSave} className="mt-4 space-y-3.5 text-xs">
                <div>
                  <label className="block text-[11px] font-bold text-zinc-700 uppercase tracking-wider mb-1">
                    Commodity / Material Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Copper Concentrate Grade A"
                    value={formData.name || ''}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full bg-zinc-50 border border-zinc-200 rounded-lg p-2.5 text-zinc-900 font-semibold focus:outline-none focus:bg-white focus:border-zinc-800"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-zinc-700 uppercase tracking-wider mb-1">
                    Quality Description & Lab Notes
                  </label>
                  <textarea
                    rows={2}
                    placeholder="e.g. Inbound ore with standard moisture allowance 6%"
                    value={formData.description || ''}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full bg-zinc-50 border border-zinc-200 rounded-lg p-2.5 text-zinc-900 focus:outline-none focus:bg-white focus:border-zinc-800 resize-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-zinc-700 uppercase tracking-wider mb-1">
                      Tariff Price / Unit ($)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="e.g. 145.50"
                      value={formData.unit_price || ''}
                      onChange={(e) => setFormData({ ...formData, unit_price: e.target.value })}
                      className="w-full bg-zinc-50 border border-zinc-200 rounded-lg p-2.5 text-zinc-900 font-mono focus:outline-none focus:bg-white focus:border-zinc-800"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-zinc-700 uppercase tracking-wider mb-1">
                      Status
                    </label>
                    <select
                      value={formData.status || 'Active'}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                      className="w-full bg-zinc-50 border border-zinc-200 rounded-lg p-2.5 text-zinc-900 focus:outline-none focus:bg-white focus:border-zinc-800"
                    >
                      <option value="Active">Active (Permitted on Scale)</option>
                      <option value="Inactive">Inactive (Suspended)</option>
                    </select>
                  </div>
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
                    {submitting ? 'Saving...' : editId ? 'Update Commodity' : 'Register Commodity'}
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
