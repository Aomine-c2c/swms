'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Users,
  Plus,
  X,
  Search,
  CheckCircle2,
  AlertTriangle,
  Phone,
  ShieldCheck,
  Truck,
  IdCard,
  Building2,
  Calendar,
  ExternalLink,
  Scale,
  Clock,
  ArrowRight,
  FileText
} from 'lucide-react';
import { api } from '@/lib/api';
import { Driver, Carrier, WeighingTransaction } from '@/types';
import { RouteGuard } from '@/components/auth/RouteGuard';

export default function DriversPage() {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [carriers, setCarriers] = useState<Carrier[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Active' | 'Inactive'>('All');

  // Selected Driver for visual detail panel / drawer
  const [selectedDriver, setSelectedDriver] = useState<Driver | null>(null);
  const [driverTxHistory, setDriverTxHistory] = useState<WeighingTransaction[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState<any>({});
  const [submitting, setSubmitting] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [dRes, cRes] = await Promise.allSettled([
        api.get('/drivers/'),
        api.get('/carriers/'),
      ]);
      if (dRes.status === 'fulfilled') {
        const list: Driver[] = dRes.value.data.results || dRes.value.data || [];
        setDrivers(list);
        if (list.length > 0 && !selectedDriver) {
          handleSelectDriver(list[0]);
        }
      }
      if (cRes.status === 'fulfilled') setCarriers(cRes.value.data.results || cRes.value.data || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSelectDriver = async (d: Driver) => {
    setSelectedDriver(d);
    try {
      setLoadingHistory(true);
      const res = await api.get(`/transactions/?driver_id=${d.id}&ordering=-first_weighing_datetime&page_size=6`);
      setDriverTxHistory(res.data.results || res.data || []);
    } catch {
      setDriverTxHistory([]);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleOpenCreate = () => {
    setEditId(null);
    setFormData({
      status: 'Active',
      contact_info: '',
      license_number: '',
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (d: Driver, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEditId(d.id);
    setFormData({
      name: d.name,
      license_number: d.license_number || '',
      contact_info: d.contact_info || d.phone || '',
      status: d.status || 'Active',
    });
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload: any = {
        name: formData.name,
        license_number: formData.license_number,
        contact_info: formData.contact_info,
        status: formData.status || 'Active',
      };

      let updatedRecord: Driver;
      if (editId) {
        const res = await api.patch(`/drivers/${editId}/`, payload);
        updatedRecord = res.data;
      } else {
        const res = await api.post('/drivers/', payload);
        updatedRecord = res.data;
      }

      setIsModalOpen(false);
      setFormData({});
      setEditId(null);
      fetchData();
      if (selectedDriver?.id === editId) {
        setSelectedDriver(updatedRecord);
      }
    } catch (err: any) {
      alert(JSON.stringify(err.response?.data || 'Failed to save driver.'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStatus = async (d: Driver, e: React.MouseEvent) => {
    e.stopPropagation();
    const newStatus = d.status === 'Active' ? 'Inactive' : 'Active';
    try {
      const res = await api.patch(`/drivers/${d.id}/`, { status: newStatus });
      if (selectedDriver?.id === d.id) {
        setSelectedDriver({ ...selectedDriver, status: newStatus });
      }
      fetchData();
    } catch (err: any) {
      alert(JSON.stringify(err.response?.data || 'Failed to toggle status.'));
    }
  };

  // Metrics
  const activeCount = drivers.filter((d) => d.status === 'Active').length;
  const inactiveCount = drivers.filter((d) => d.status === 'Inactive').length;

  const filtered = drivers.filter((d) => {
    const q = search.toLowerCase();
    const matchesSearch =
      d.name.toLowerCase().includes(q) ||
      (d.license_number && d.license_number.toLowerCase().includes(q)) ||
      (d.contact_info && d.contact_info.toLowerCase().includes(q));

    if (!matchesSearch) return false;

    if (statusFilter === 'Active') return d.status === 'Active';
    if (statusFilter === 'Inactive') return d.status === 'Inactive';
    return true;
  });

  return (
    <RouteGuard roles={['Administrator', 'Operator', 'Supervisor']}>
      <div className="space-y-6">
        
        {/* Header Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-zinc-900">Drivers Registry & Profiles</h2>
            <p className="text-xs text-zinc-500 mt-0.5">
              Authorized commercial drivers, CDL license status, and recent weighbridge ticket activity
            </p>
          </div>
          <button
            onClick={handleOpenCreate}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-zinc-900 hover:bg-black text-xs font-semibold text-white shadow-sm transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Enroll Driver</span>
          </button>
        </div>

        {/* Driver Summary Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white border border-zinc-200 rounded-xl p-4 shadow-xs flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">Total Drivers</p>
              <h3 className="text-2xl font-black text-zinc-900 mt-0.5">{drivers.length}</h3>
              <p className="text-[10px] text-zinc-500 mt-0.5">Enrolled operators</p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-zinc-100 flex items-center justify-center text-zinc-800">
              <Users className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-white border border-zinc-200 rounded-xl p-4 shadow-xs flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">Active / Permitted</p>
              <h3 className="text-2xl font-black text-zinc-900 mt-0.5">{activeCount}</h3>
              <p className="text-[10px] text-zinc-500 mt-0.5">Cleared for scale transactions</p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-zinc-100 flex items-center justify-center text-zinc-800">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-white border border-zinc-200 rounded-xl p-4 shadow-xs flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">Suspended / Inactive</p>
              <h3 className="text-2xl font-black text-zinc-900 mt-0.5">{inactiveCount}</h3>
              <p className="text-[10px] text-zinc-500 mt-0.5">Blocked from ticket generation</p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-zinc-100 flex items-center justify-center text-zinc-800">
              <AlertTriangle className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* Master-Detail Split Screen Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* LEFT: Driver List Table (7 Cols) */}
          <div className="lg:col-span-7 space-y-3">
            {/* Filter Controls & Search */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="relative w-full sm:w-72">
                <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Search driver name, CDL license..."
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

            {/* Drivers Table */}
            <div className="rounded-xl bg-white border border-zinc-200 shadow-xs overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-zinc-50 text-zinc-600 font-bold border-b border-zinc-200 uppercase text-[10px]">
                  <tr>
                    <th className="px-4 py-3">Driver Profile</th>
                    <th className="px-4 py-3">CDL License</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 text-zinc-700">
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-12 text-center text-zinc-400">
                        No drivers found matching your search.
                      </td>
                    </tr>
                  ) : (
                    filtered.map((d) => {
                      const isSelected = selectedDriver?.id === d.id;
                      return (
                        <tr
                          key={d.id}
                          onClick={() => handleSelectDriver(d)}
                          className={`cursor-pointer transition-colors ${
                            isSelected ? 'bg-zinc-100/90 font-medium' : 'hover:bg-zinc-50/80'
                          }`}
                        >
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2.5">
                              <div
                                className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-[10px] ${
                                  isSelected ? 'bg-zinc-900 text-white' : 'bg-zinc-200 text-zinc-700'
                                }`}
                              >
                                {d.name.charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <span className="font-bold text-zinc-900 block">{d.name}</span>
                                <span className="text-[10px] text-zinc-400">ID #{d.id}</span>
                              </div>
                            </div>
                          </td>

                          <td className="px-4 py-3">
                            <span className="font-mono font-bold text-zinc-800">
                              {d.license_number || 'Pending'}
                            </span>
                          </td>

                          <td className="px-4 py-3">
                            <button
                              onClick={(e) => handleToggleStatus(d, e)}
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold border transition-all ${
                                d.status === 'Active'
                                  ? 'bg-zinc-100 text-zinc-900 border-zinc-300'
                                  : 'bg-zinc-50 text-zinc-400 border-zinc-200'
                              }`}
                            >
                              <span
                                className={`w-1.5 h-1.5 rounded-full ${
                                  d.status === 'Active' ? 'bg-zinc-900' : 'bg-zinc-400'
                                }`}
                              />
                              {d.status || 'Active'}
                            </button>
                          </td>

                          <td className="px-4 py-3 text-right">
                            <button
                              onClick={(e) => handleOpenEdit(d, e)}
                              className="px-2.5 py-1 rounded-md border border-zinc-200 hover:bg-zinc-200 text-[11px] font-semibold text-zinc-700 transition-colors"
                            >
                              Edit
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* RIGHT: Visual Driver Profile & Scale Activity Card (5 Cols) */}
          <div className="lg:col-span-5 sticky top-4">
            {selectedDriver ? (
              <div className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-xs space-y-5">
                
                {/* Visual ID Badge Header */}
                <div className="flex items-start justify-between pb-4 border-b border-zinc-100">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-zinc-900 text-white flex items-center justify-center font-black text-lg shadow-sm">
                      {selectedDriver.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-black text-base text-zinc-900">{selectedDriver.name}</h3>
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${
                            selectedDriver.status === 'Active'
                              ? 'bg-zinc-100 text-zinc-900 border border-zinc-300'
                              : 'bg-rose-50 text-rose-800 border border-rose-200'
                          }`}
                        >
                          {selectedDriver.status || 'Active'}
                        </span>
                      </div>
                      <p className="text-xs text-zinc-400 font-mono">ENROLLED DRIVER • #{selectedDriver.id.toString().padStart(4, '0')}</p>
                    </div>
                  </div>

                  <button
                    onClick={(e) => handleOpenEdit(selectedDriver, e)}
                    className="px-2.5 py-1 rounded-lg border border-zinc-200 hover:bg-zinc-100 text-xs font-semibold text-zinc-700 transition-colors"
                  >
                    Edit Profile
                  </button>
                </div>

                {/* ID Details Card Grid */}
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="p-3 bg-zinc-50 rounded-xl border border-zinc-200/80">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block mb-1 flex items-center gap-1">
                      <IdCard className="w-3 h-3" /> License (CDL)
                    </span>
                    <span className="font-mono font-bold text-zinc-900 text-sm">
                      {selectedDriver.license_number || 'Unverified'}
                    </span>
                  </div>

                  <div className="p-3 bg-zinc-50 rounded-xl border border-zinc-200/80">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block mb-1 flex items-center gap-1">
                      <Phone className="w-3 h-3" /> Phone Contact
                    </span>
                    <span className="font-mono text-zinc-800">
                      {selectedDriver.contact_info || selectedDriver.phone || 'No phone'}
                    </span>
                  </div>
                </div>

                {/* Road Clearance Badge */}
                <div className="p-3 rounded-xl bg-zinc-50 border border-zinc-200 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-zinc-900" />
                    <div>
                      <span className="font-bold text-zinc-900 block">Weighbridge Clearance</span>
                      <span className="text-[10px] text-zinc-500">Authorized for gross/tare tickets</span>
                    </div>
                  </div>
                  <span className="font-mono font-bold text-xs text-zinc-900">
                    {selectedDriver.status === 'Active' ? 'CLEARED' : 'RESTRICTED'}
                  </span>
                </div>

                {/* Recent Weighbridge Tickets Activity */}
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-zinc-900">
                      <Scale className="w-3.5 h-3.5 text-zinc-800" />
                      <span>Recent Weighbridge Trips</span>
                    </div>
                    <span className="text-[10px] text-zinc-400 font-mono">Last 6 Weighments</span>
                  </div>

                  {loadingHistory ? (
                    <div className="py-6 text-center text-xs text-zinc-400">Loading trips...</div>
                  ) : driverTxHistory.length === 0 ? (
                    <div className="py-6 text-center text-xs text-zinc-400 border border-dashed border-zinc-200 rounded-xl">
                      No past weighment transactions found for this driver.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {driverTxHistory.map((tx) => (
                        <div
                          key={tx.id}
                          className="p-2.5 rounded-lg border border-zinc-200 bg-zinc-50/60 hover:bg-zinc-100 flex items-center justify-between text-xs transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            <div className="p-1 rounded bg-white border border-zinc-200">
                              <Truck className="w-3.5 h-3.5 text-zinc-700" />
                            </div>
                            <div>
                              <span className="font-mono font-bold text-zinc-900 block">
                                {typeof tx.vehicle === 'object' ? tx.vehicle.license_plate : tx.vehicle_license || 'TRUCK'}
                              </span>
                              <span className="text-[10px] text-zinc-500">
                                {typeof tx.material === 'object' ? tx.material.name : tx.material_name}
                              </span>
                            </div>
                          </div>

                          <div className="text-right">
                            <span className="font-mono font-bold text-zinc-900 block">
                              {tx.net_weight ? `${Number(tx.net_weight).toLocaleString()} kg` : `${tx.status}`}
                            </span>
                            <span className="text-[10px] text-zinc-400 font-mono">
                              {new Date(tx.first_weighing_datetime).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

              </div>
            ) : (
              <div className="p-8 text-center rounded-2xl bg-white border border-zinc-200 text-zinc-400 text-xs">
                Select a driver from the list to view full profile details and transaction history.
              </div>
            )}
          </div>

        </div>

        {/* Modal: Create / Edit Driver */}
        {isModalOpen && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <div className="w-full max-w-md bg-white border border-zinc-200 rounded-2xl shadow-2xl p-6">
              <div className="flex items-center justify-between pb-3 border-b border-zinc-200">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-zinc-900" />
                  <h3 className="font-bold text-sm text-zinc-900">
                    {editId ? 'Edit Driver Profile' : 'Enroll Licensed Driver'}
                  </h3>
                </div>
                <button onClick={() => setIsModalOpen(false)} className="text-zinc-400 hover:text-zinc-600">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSave} className="mt-4 space-y-3.5 text-xs">
                <div>
                  <label className="block text-[11px] font-bold text-zinc-700 uppercase tracking-wider mb-1">
                    Driver Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Johnathan Moyo"
                    value={formData.name || ''}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full bg-zinc-50 border border-zinc-200 rounded-lg p-2.5 text-zinc-900 focus:outline-none focus:bg-white focus:border-zinc-800"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-zinc-700 uppercase tracking-wider mb-1">
                    Commercial Driver License (CDL) *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. DL-82910-Z"
                    value={formData.license_number || ''}
                    onChange={(e) => setFormData({ ...formData, license_number: e.target.value })}
                    className="w-full bg-zinc-50 border border-zinc-200 rounded-lg p-2.5 text-zinc-900 font-mono uppercase focus:outline-none focus:bg-white focus:border-zinc-800"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-zinc-700 uppercase tracking-wider mb-1">
                    Contact Phone / Cellular
                  </label>
                  <input
                    type="tel"
                    placeholder="+263 77 123 4567"
                    value={formData.contact_info || ''}
                    onChange={(e) => setFormData({ ...formData, contact_info: e.target.value })}
                    className="w-full bg-zinc-50 border border-zinc-200 rounded-lg p-2.5 text-zinc-900 font-mono focus:outline-none focus:bg-white focus:border-zinc-800"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-zinc-700 uppercase tracking-wider mb-1">
                    Authorization Status
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
                    {submitting ? 'Saving...' : editId ? 'Update Driver' : 'Enroll Driver'}
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
