'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Layers,
  Plus,
  X,
  Search,
  CheckCircle2,
  AlertTriangle,
  Phone,
  Truck,
  Building2,
  User,
  ShieldCheck,
  Scale,
  ArrowRight,
  Trash2
} from 'lucide-react';
import { api } from '@/lib/api';
import { Carrier, Vehicle } from '@/types';
import { RouteGuard } from '@/components/auth/RouteGuard';

export default function CarriersPage() {
  const [carriers, setCarriers] = useState<Carrier[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Active' | 'Inactive'>('All');

  // Selected Carrier for visual Master-Detail card
  const [selectedCarrier, setSelectedCarrier] = useState<Carrier | null>(null);
  const [carrierVehicles, setCarrierVehicles] = useState<Vehicle[]>([]);
  const [loadingVehicles, setLoadingVehicles] = useState(false);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState<any>({});
  const [submitting, setSubmitting] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await api.get('/carriers/');
      const list: Carrier[] = res.data.results || res.data || [];
      setCarriers(list);
      if (list.length > 0 && !selectedCarrier) {
        handleSelectCarrier(list[0]);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSelectCarrier = async (c: Carrier) => {
    setSelectedCarrier(c);
    try {
      setLoadingVehicles(true);
      const res = await api.get(`/vehicles/?carrier=${c.id}`);
      setCarrierVehicles(res.data.results || res.data || []);
    } catch {
      setCarrierVehicles([]);
    } finally {
      setLoadingVehicles(false);
    }
  };

  const handleOpenCreate = () => {
    setEditId(null);
    setFormData({
      status: 'Active',
      name: '',
      contact_person: '',
      phone_number: '',
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (c: Carrier, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEditId(c.id);
    setFormData({
      name: c.name,
      contact_person: c.contact_person || '',
      phone_number: c.phone_number || '',
      status: c.status || 'Active',
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
        phone_number: formData.phone_number || undefined,
        status: formData.status || 'Active',
      };

      let updatedRecord: Carrier;
      if (editId) {
        const res = await api.patch(`/carriers/${editId}/`, payload);
        updatedRecord = res.data;
      } else {
        const res = await api.post('/carriers/', payload);
        updatedRecord = res.data;
      }

      setIsModalOpen(false);
      setFormData({});
      setEditId(null);
      fetchData();
      if (selectedCarrier?.id === editId) {
        setSelectedCarrier(updatedRecord);
      }
    } catch (err: any) {
      alert(JSON.stringify(err.response?.data || 'Failed to save carrier.'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStatus = async (c: Carrier, e: React.MouseEvent) => {
    e.stopPropagation();
    const newStatus = c.status === 'Active' ? 'Inactive' : 'Active';
    try {
      await api.patch(`/carriers/${c.id}/`, { status: newStatus });
      if (selectedCarrier?.id === c.id) {
        setSelectedCarrier({ ...selectedCarrier, status: newStatus });
      }
      fetchData();
    } catch (err: any) {
      alert(JSON.stringify(err.response?.data || 'Failed to toggle carrier status.'));
    }
  };

  const handleDelete = async (c: Carrier, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!window.confirm(`Delete carrier "${c.name}"? This will mark it as Inactive.`)) return;
    try {
      await api.delete(`/carriers/${c.id}/`);
      if (selectedCarrier?.id === c.id) {
        setSelectedCarrier(null);
      }
      fetchData();
    } catch (err: any) {
      alert(JSON.stringify(err.response?.data || 'Failed to delete carrier.'));
    }
  };

  // Metrics
  const activeCount = carriers.filter((c) => c.status === 'Active').length;
  const inactiveCount = carriers.filter((c) => c.status === 'Inactive').length;

  const filtered = carriers.filter((c) => {
    const q = search.toLowerCase();
    const matchesSearch =
      c.name.toLowerCase().includes(q) ||
      (c.contact_person && c.contact_person.toLowerCase().includes(q)) ||
      (c.phone_number && c.phone_number.toLowerCase().includes(q));

    if (!matchesSearch) return false;

    if (statusFilter === 'Active') return c.status === 'Active';
    if (statusFilter === 'Inactive') return c.status === 'Inactive';
    return true;
  });

  return (
    <RouteGuard roles={['Supervisor', 'Manager', 'Administrator']}>
      <div className="space-y-6">
        
        {/* Header Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-zinc-900">Carriers & Logistics Fleets</h2>
            <p className="text-xs text-zinc-500 mt-0.5">
              Contracted transport companies, fleet dispatch dispatchers, and registered haulage trucks
            </p>
          </div>
          <button
            onClick={handleOpenCreate}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-zinc-900 hover:bg-black text-xs font-semibold text-white shadow-sm transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Add Carrier Fleet</span>
          </button>
        </div>

        {/* Carrier KPI Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white border border-zinc-200 rounded-xl p-4 shadow-xs flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">Total Hauliers</p>
              <h3 className="text-2xl font-black text-zinc-900 mt-0.5">{carriers.length}</h3>
              <p className="text-[10px] text-zinc-500 mt-0.5">Registered freight partners</p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-zinc-100 flex items-center justify-center text-zinc-800">
              <Layers className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-white border border-zinc-200 rounded-xl p-4 shadow-xs flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">Active Freight Fleets</p>
              <h3 className="text-2xl font-black text-zinc-900 mt-0.5">{activeCount}</h3>
              <p className="text-[10px] text-zinc-500 mt-0.5">Cleared for transport contracts</p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-zinc-100 flex items-center justify-center text-zinc-800">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-white border border-zinc-200 rounded-xl p-4 shadow-xs flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">Suspended Hauliers</p>
              <h3 className="text-2xl font-black text-zinc-900 mt-0.5">{inactiveCount}</h3>
              <p className="text-[10px] text-zinc-500 mt-0.5">Blocked from scale entrance</p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-zinc-100 flex items-center justify-center text-zinc-800">
              <AlertTriangle className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* Master-Detail Split Screen Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* LEFT: Carriers Table (7 Cols) */}
          <div className="lg:col-span-7 space-y-3">
            {/* Filter Controls & Search */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="relative w-full sm:w-72">
                <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Search carrier or contact name..."
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

            {/* Carriers Table */}
            <div className="rounded-xl bg-white border border-zinc-200 shadow-xs overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-zinc-50 text-zinc-600 font-bold border-b border-zinc-200 uppercase text-[10px]">
                  <tr>
                    <th className="px-4 py-3">Carrier / Fleet Name</th>
                    <th className="px-4 py-3">Fleet Size</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 text-zinc-700">
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-12 text-center text-zinc-400">
                        No haulage carriers found matching your search.
                      </td>
                    </tr>
                  ) : (
                    filtered.map((c) => {
                      const isSelected = selectedCarrier?.id === c.id;
                      return (
                        <tr
                          key={c.id}
                          onClick={() => handleSelectCarrier(c)}
                          className={`cursor-pointer transition-colors ${
                            isSelected ? 'bg-zinc-100/90 font-medium' : 'hover:bg-zinc-50/80'
                          }`}
                        >
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2.5">
                              <div
                                className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs border ${
                                  isSelected
                                    ? 'bg-zinc-900 text-white border-zinc-900'
                                    : 'bg-zinc-100 text-zinc-700 border-zinc-200'
                                }`}
                              >
                                <Layers className="w-4 h-4" />
                              </div>
                              <div>
                                <span className="font-bold text-zinc-900 block">{c.name}</span>
                                <span className="text-[10px] text-zinc-400">
                                  {c.contact_person || 'Haulage Contractor'}
                                </span>
                              </div>
                            </div>
                          </td>

                          <td className="px-4 py-3">
                            <span className="inline-flex items-center gap-1 font-mono font-bold text-zinc-900">
                              <Truck className="w-3.5 h-3.5 text-zinc-400" />
                              {c.vehicle_count ?? 0} Trucks
                            </span>
                          </td>

                          <td className="px-4 py-3">
                            <button
                              onClick={(e) => handleToggleStatus(c, e)}
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold border transition-all ${
                                c.status === 'Active'
                                  ? 'bg-zinc-100 text-zinc-900 border-zinc-300'
                                  : 'bg-zinc-50 text-zinc-400 border-zinc-200'
                              }`}
                            >
                              <span
                                className={`w-1.5 h-1.5 rounded-full ${
                                  c.status === 'Active' ? 'bg-zinc-900' : 'bg-zinc-400'
                                }`}
                              />
                              {c.status || 'Active'}
                            </button>
                          </td>

                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => handleSelectCarrier(c)}
                                className="px-2.5 py-1 rounded-md border border-zinc-200 hover:bg-zinc-200 text-[11px] font-semibold text-zinc-700 transition-colors"
                              >
                                View
                              </button>
                              <button
                                onClick={(e) => handleOpenEdit(c, e)}
                                className="px-2.5 py-1 rounded-md border border-zinc-200 hover:bg-zinc-200 text-[11px] font-semibold text-zinc-700 transition-colors"
                              >
                                Edit
                              </button>
                              <button
                                onClick={(e) => handleDelete(c, e)}
                                className="p-1 rounded-md border border-rose-200 text-rose-600 hover:bg-rose-50 transition-colors"
                                title="Delete carrier"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* RIGHT: Visual Carrier Profile & Assigned Trucks Card (5 Cols) */}
          <div className="lg:col-span-5 sticky top-4">
            {selectedCarrier ? (
              <div className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-xs space-y-5">
                
                {/* Visual Header */}
                <div className="flex items-start justify-between pb-4 border-b border-zinc-100">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-zinc-900 text-white flex items-center justify-center font-black shadow-sm">
                      <Layers className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-black text-base text-zinc-900">{selectedCarrier.name}</h3>
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${
                            selectedCarrier.status === 'Active'
                              ? 'bg-zinc-100 text-zinc-900 border border-zinc-300'
                              : 'bg-rose-50 text-rose-800 border border-rose-200'
                          }`}
                        >
                          {selectedCarrier.status || 'Active'}
                        </span>
                      </div>
                      <p className="text-xs text-zinc-400 font-mono">
                        HAULIER FLEET • #{selectedCarrier.id.toString().padStart(4, '0')}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={(e) => handleOpenEdit(selectedCarrier, e)}
                      className="px-2.5 py-1 rounded-lg border border-zinc-200 hover:bg-zinc-100 text-xs font-semibold text-zinc-700 transition-colors"
                    >
                      Edit Fleet
                    </button>
                    <button
                      onClick={(e) => handleDelete(selectedCarrier, e)}
                      className="p-1.5 rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50 transition-colors"
                      title="Delete carrier"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Dispatch & Operations Grid */}
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="p-3 bg-zinc-50 rounded-xl border border-zinc-200/80">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block mb-1 flex items-center gap-1">
                      <User className="w-3 h-3" /> Dispatch Contact
                    </span>
                    <span className="font-semibold text-zinc-900 block truncate">
                      {selectedCarrier.contact_person || 'Transport Manager'}
                    </span>
                  </div>

                  <div className="p-3 bg-zinc-50 rounded-xl border border-zinc-200/80">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block mb-1 flex items-center gap-1">
                      <Phone className="w-3 h-3" /> Cellular / Phone
                    </span>
                    <span className="font-mono text-zinc-800 block truncate">
                      {selectedCarrier.phone_number || 'No hotline record'}
                    </span>
                  </div>
                </div>

                {/* Fleet Clearance Badge */}
                <div className="p-3 rounded-xl bg-zinc-50 border border-zinc-200 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-zinc-900" />
                    <div>
                      <span className="font-bold text-zinc-900 block">Weighbridge Haulage Contract</span>
                      <span className="text-[10px] text-zinc-500">Authorized for freight entry</span>
                    </div>
                  </div>
                  <span className="font-mono font-bold text-xs text-zinc-900">
                    {selectedCarrier.status === 'Active' ? 'AUTHORIZED' : 'SUSPENDED'}
                  </span>
                </div>

                {/* Assigned Trucks in Fleet */}
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-zinc-900">
                      <Truck className="w-3.5 h-3.5 text-zinc-800" />
                      <span>Enrolled Fleet Vehicles ({carrierVehicles.length})</span>
                    </div>
                    <span className="text-[10px] text-zinc-400 font-mono">Assigned Units</span>
                  </div>

                  {loadingVehicles ? (
                    <div className="py-6 text-center text-xs text-zinc-400">Loading fleet trucks...</div>
                  ) : carrierVehicles.length === 0 ? (
                    <div className="py-6 text-center text-xs text-zinc-400 border border-dashed border-zinc-200 rounded-xl">
                      No vehicles assigned to this carrier fleet yet.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {carrierVehicles.map((v) => (
                        <div
                          key={v.id}
                          className="p-2.5 rounded-lg border border-zinc-200 bg-zinc-50/60 hover:bg-zinc-100 flex items-center justify-between text-xs transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            <div className="p-1 rounded bg-white border border-zinc-200">
                              <Truck className="w-3.5 h-3.5 text-zinc-700" />
                            </div>
                            <div>
                              <span className="font-mono font-bold text-zinc-900 block">{v.license_plate}</span>
                              <span className="text-[10px] text-zinc-500">{v.vehicle_type || 'Standard Hauler'}</span>
                            </div>
                          </div>

                          <div className="text-right font-mono">
                            <span className="font-bold text-zinc-800 block text-xs">
                              {v.known_tare_weight || v.tare_weight
                                ? `${Number(v.known_tare_weight || v.tare_weight).toLocaleString()} kg`
                                : 'Trip Tare'}
                            </span>
                            <span className="text-[10px] text-zinc-400">{v.status || 'Active'}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

              </div>
            ) : (
              <div className="p-8 text-center rounded-2xl bg-white border border-zinc-200 text-zinc-400 text-xs">
                Select a carrier fleet from the list to view dispatch details and enrolled vehicles.
              </div>
            )}
          </div>

        </div>

        {/* Modal: Create / Edit Carrier */}
        {isModalOpen && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <div className="w-full max-w-md bg-white border border-zinc-200 rounded-2xl shadow-2xl p-6">
              <div className="flex items-center justify-between pb-3 border-b border-zinc-200">
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-zinc-900" />
                  <h3 className="font-bold text-sm text-zinc-900">
                    {editId ? 'Edit Haulier Profile' : 'Register Carrier Fleet'}
                  </h3>
                </div>
                <button onClick={() => setIsModalOpen(false)} className="text-zinc-400 hover:text-zinc-600">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSave} className="mt-4 space-y-3.5 text-xs">
                <div>
                  <label className="block text-[11px] font-bold text-zinc-700 uppercase tracking-wider mb-1">
                    Company / Fleet Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Swift Haulage Logistics Ltd"
                    value={formData.name || ''}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full bg-zinc-50 border border-zinc-200 rounded-lg p-2.5 text-zinc-900 font-semibold focus:outline-none focus:bg-white focus:border-zinc-800"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-zinc-700 uppercase tracking-wider mb-1">
                    Key Dispatch Contact Person
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Tendai Chirwa (Fleet Controller)"
                    value={formData.contact_person || ''}
                    onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
                    className="w-full bg-zinc-50 border border-zinc-200 rounded-lg p-2.5 text-zinc-900 focus:outline-none focus:bg-white focus:border-zinc-800"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-zinc-700 uppercase tracking-wider mb-1">
                    Dispatch Telephone / Hotline
                  </label>
                  <input
                    type="tel"
                    placeholder="+263 24 2123456"
                    value={formData.phone_number || ''}
                    onChange={(e) => setFormData({ ...formData, phone_number: e.target.value })}
                    className="w-full bg-zinc-50 border border-zinc-200 rounded-lg p-2.5 text-zinc-900 font-mono focus:outline-none focus:bg-white focus:border-zinc-800"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-zinc-700 uppercase tracking-wider mb-1">
                    Operational Status
                  </label>
                  <select
                    value={formData.status || 'Active'}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="w-full bg-zinc-50 border border-zinc-200 rounded-lg p-2.5 text-zinc-900 focus:outline-none focus:bg-white focus:border-zinc-800"
                  >
                    <option value="Active">Active (Permitted for Haulage)</option>
                    <option value="Inactive">Inactive (Suspended)</option>
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
                    {submitting ? 'Saving...' : editId ? 'Update Carrier' : 'Register Carrier'}
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
