'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Truck,
  Plus,
  X,
  Search,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  ShieldAlert,
  Building2,
  UserCheck,
  Scale,
  Gauge,
  Clock,
  ShieldCheck,
  FileText,
  Weight,
  Trash2
} from 'lucide-react';
import { api } from '@/lib/api';
import { Vehicle, Carrier, Driver, WeighingTransaction } from '@/types';
import { RouteGuard } from '@/components/auth/RouteGuard';

export default function VehiclesPage() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [carriers, setCarriers] = useState<Carrier[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Active' | 'Inactive' | 'Expiring'>('All');

  // Selected vehicle for visual detail card
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [vehicleTxHistory, setVehicleTxHistory] = useState<WeighingTransaction[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState<any>({});
  const [submitting, setSubmitting] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [vRes, cRes, dRes] = await Promise.allSettled([
        api.get('/vehicles/'),
        api.get('/carriers/'),
        api.get('/drivers/'),
      ]);
      if (vRes.status === 'fulfilled') {
        const list: Vehicle[] = vRes.value.data.results || vRes.value.data || [];
        setVehicles(list);
        if (list.length > 0 && !selectedVehicle) {
          handleSelectVehicle(list[0]);
        }
      }
      if (cRes.status === 'fulfilled') setCarriers(cRes.value.data.results || cRes.value.data || []);
      if (dRes.status === 'fulfilled') setDrivers(dRes.value.data.results || dRes.value.data || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSelectVehicle = async (v: Vehicle) => {
    setSelectedVehicle(v);
    try {
      setLoadingHistory(true);
      const res = await api.get(`/transactions/?vehicle_id=${v.id}&ordering=-first_weighing_datetime&page_size=6`);
      setVehicleTxHistory(res.data.results || res.data || []);
    } catch {
      setVehicleTxHistory([]);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleOpenCreate = () => {
    setEditId(null);
    setFormData({
      status: 'Active',
      vehicle_type: 'Articulated Tipper',
      known_tare_weight: '',
      max_capacity: '44000',
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (v: Vehicle, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEditId(v.id);
    setFormData({
      license_plate: v.license_plate,
      vehicle_type: v.vehicle_type || 'Rigid Hauler',
      known_tare_weight: v.known_tare_weight || v.tare_weight || '',
      max_capacity: v.max_capacity || '',
      carrier: typeof v.carrier === 'object' ? v.carrier?.id : v.carrier || '',
      default_driver: typeof v.default_driver === 'object' ? v.default_driver?.id : v.default_driver || '',
      registration_expiry: v.registration_expiry || '',
      last_inspection_date: v.last_inspection_date || '',
      status: v.status || 'Active',
    });
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload: any = { ...formData };
      if (payload.carrier) payload.carrier = parseInt(payload.carrier);
      else payload.carrier = null;

      if (payload.default_driver) payload.default_driver = parseInt(payload.default_driver);
      else payload.default_driver = null;

      if (payload.known_tare_weight) payload.known_tare_weight = parseFloat(payload.known_tare_weight);
      else payload.known_tare_weight = null;

      if (payload.max_capacity) payload.max_capacity = parseFloat(payload.max_capacity);
      else payload.max_capacity = null;

      let updatedRecord: Vehicle;
      if (editId) {
        const res = await api.patch(`/vehicles/${editId}/`, payload);
        updatedRecord = res.data;
      } else {
        const res = await api.post('/vehicles/', payload);
        updatedRecord = res.data;
      }

      setIsModalOpen(false);
      setFormData({});
      setEditId(null);
      fetchData();
      if (selectedVehicle?.id === editId) {
        setSelectedVehicle(updatedRecord);
      }
    } catch (err: any) {
      alert(JSON.stringify(err.response?.data || 'Failed to save vehicle.'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (v: Vehicle, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!window.confirm(`Delete vehicle ${v.license_plate}? It will be marked as Inactive and removed from active dispatch.`)) return;
    try {
      await api.delete(`/vehicles/${v.id}/`);
      if (selectedVehicle?.id === v.id) setSelectedVehicle(null);
      fetchData();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to delete vehicle.');
    }
  };


  // Helper: check if registration is expiring soon (within 30 days) or expired
  const getExpiryStatus = (expiryDate?: string | null) => {
    if (!expiryDate) return { label: 'No Expiry Set', color: 'zinc' };
    const exp = new Date(expiryDate);
    const now = new Date();
    const diffDays = Math.ceil((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return { label: `Expired (${Math.abs(diffDays)}d ago)`, color: 'rose' };
    }
    if (diffDays <= 30) {
      return { label: `Renews in ${diffDays}d`, color: 'amber' };
    }
    return { label: `Valid (${diffDays}d)`, color: 'emerald' };
  };

  // Summary Metrics
  const activeCount = vehicles.filter((v) => v.status === 'Active').length;
  const expiredCount = vehicles.filter((v) => {
    if (!v.registration_expiry) return false;
    return new Date(v.registration_expiry).getTime() < new Date().getTime();
  }).length;
  const calibratedTareCount = vehicles.filter((v) => Boolean(v.known_tare_weight || v.tare_weight)).length;

  const filtered = vehicles.filter((v) => {
    const matchesSearch =
      v.license_plate.toLowerCase().includes(search.toLowerCase()) ||
      (v.carrier_name && v.carrier_name.toLowerCase().includes(search.toLowerCase())) ||
      (v.default_driver_name && v.default_driver_name.toLowerCase().includes(search.toLowerCase()));

    if (!matchesSearch) return false;

    if (statusFilter === 'Active') return v.status === 'Active';
    if (statusFilter === 'Inactive') return v.status === 'Inactive';
    if (statusFilter === 'Expiring') {
      if (!v.registration_expiry) return false;
      const diffDays = Math.ceil(
        (new Date(v.registration_expiry).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
      );
      return diffDays <= 30;
    }
    return true;
  });

  return (
    <RouteGuard roles={['Administrator', 'Operator', 'Supervisor']}>
      <div className="space-y-6">
        
        {/* Header Title & Action Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-zinc-900">Vehicles & Fleet Registry</h2>
            <p className="text-xs text-zinc-500 mt-0.5">
              Certified tare baselines, registration renewals, max gross capacity limits, and trip history
            </p>
          </div>
          <button
            onClick={handleOpenCreate}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-zinc-900 hover:bg-black text-xs font-semibold text-white shadow-sm transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Register Vehicle</span>
          </button>
        </div>

        {/* Fleet KPI Metric Badges */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white border border-zinc-200 rounded-xl p-4 shadow-xs flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">Total Active Fleet</p>
              <h3 className="text-2xl font-black text-zinc-900 mt-0.5">{activeCount}</h3>
              <p className="text-[10px] text-zinc-500 mt-0.5">Authorized for weighment</p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-zinc-100 flex items-center justify-center text-zinc-800">
              <Truck className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-white border border-zinc-200 rounded-xl p-4 shadow-xs flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">Calibrated Tare Weights</p>
              <h3 className="text-2xl font-black text-zinc-900 mt-0.5">{calibratedTareCount}</h3>
              <p className="text-[10px] text-zinc-500 mt-0.5">Preset vehicle tare baseline</p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-zinc-100 flex items-center justify-center text-zinc-800">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-white border border-zinc-200 rounded-xl p-4 shadow-xs flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">Expired Registration</p>
              <h3 className="text-2xl font-black text-zinc-900 mt-0.5">{expiredCount}</h3>
              <p className="text-[10px] text-zinc-500 mt-0.5">Requires safety inspection</p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-zinc-100 flex items-center justify-center text-zinc-800">
              <ShieldAlert className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* Master-Detail Split Screen Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* LEFT: Vehicles List Table (7 Cols) */}
          <div className="lg:col-span-7 space-y-3">
            {/* Filter Controls & Search */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="relative w-full sm:w-72">
                <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Search plate, carrier, driver..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full bg-white border border-zinc-200 rounded-lg pl-9 pr-3 py-1.5 text-xs text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-zinc-800"
                />
              </div>

              {/* Status Filter Chips */}
              <div className="flex border border-zinc-200 rounded-lg p-0.5 bg-zinc-100 text-xs font-semibold self-stretch sm:self-auto">
                {(['All', 'Active', 'Expiring', 'Inactive'] as const).map((tab) => (
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

            {/* Data Table */}
            <div className="rounded-xl bg-white border border-zinc-200 shadow-xs overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-zinc-50 text-zinc-600 font-bold border-b border-zinc-200 uppercase text-[10px]">
                  <tr>
                    <th className="px-4 py-3">Vehicle Details</th>
                    <th className="px-4 py-3">Tare (kg)</th>
                    <th className="px-4 py-3">Carrier / Fleet</th>
                    <th className="px-4 py-3">Registration</th>
                    <th className="px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 text-zinc-700">
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-12 text-center text-zinc-400">
                        No vehicles found matching the filter criteria.
                      </td>
                    </tr>
                  ) : (
                    filtered.map((v) => {
                      const tare = v.known_tare_weight || v.tare_weight;
                      const expInfo = getExpiryStatus(v.registration_expiry);
                      const isSelected = selectedVehicle?.id === v.id;

                      return (
                        <tr
                          key={v.id}
                          onClick={() => handleSelectVehicle(v)}
                          className={`cursor-pointer transition-colors ${
                            isSelected ? 'bg-zinc-100/90 font-medium' : 'hover:bg-zinc-50/80'
                          }`}
                        >
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div
                                className={`w-7 h-7 rounded border flex items-center justify-center ${
                                  isSelected
                                    ? 'bg-zinc-900 text-white border-zinc-900'
                                    : 'bg-zinc-100 text-zinc-700 border-zinc-200'
                                }`}
                              >
                                <Truck className="w-3.5 h-3.5" />
                              </div>
                              <div>
                                <span className="font-mono font-bold text-zinc-900 text-sm block">
                                  {v.license_plate}
                                </span>
                                <span className="text-[10px] text-zinc-500">{v.vehicle_type || 'Standard Hauler'}</span>
                              </div>
                            </div>
                          </td>

                          <td className="px-4 py-3 font-mono font-bold text-zinc-900">
                            {tare ? (
                              <span>{Number(tare).toLocaleString()} kg</span>
                            ) : (
                              <span className="text-zinc-400 font-normal italic">Trip Tare</span>
                            )}
                          </td>

                          <td className="px-4 py-3">
                            <span className="truncate max-w-[120px] block text-zinc-800">
                              {v.carrier_name || 'Independent'}
                            </span>
                          </td>

                          <td className="px-4 py-3">
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold border ${
                                expInfo.color === 'emerald'
                                  ? 'bg-zinc-100 text-zinc-900 border-zinc-300'
                                  : expInfo.color === 'amber'
                                  ? 'bg-amber-50 text-amber-900 border-amber-200'
                                  : expInfo.color === 'rose'
                                  ? 'bg-rose-50 text-rose-800 border-rose-200'
                                  : 'bg-zinc-50 text-zinc-500 border-zinc-200'
                              }`}
                            >
                              {expInfo.label}
                            </span>
                          </td>

                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={(e) => handleOpenEdit(v, e)}
                                className="px-2.5 py-1 rounded-md border border-zinc-200 hover:bg-zinc-200 text-[11px] font-semibold text-zinc-700 transition-colors"
                              >
                                Edit
                              </button>
                              <button
                                onClick={(e) => handleDelete(v, e)}
                                className="p-1 rounded hover:bg-rose-50 text-zinc-300 hover:text-rose-600 transition-colors"
                                title="Delete Vehicle"
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

          {/* RIGHT: Visual Vehicle Profile & Capacity Diagnostics Card (5 Cols) */}
          <div className="lg:col-span-5 sticky top-4">
            {selectedVehicle ? (
              <div className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-xs space-y-5">
                
                {/* Visual Header & Plate Display */}
                <div className="flex items-start justify-between pb-4 border-b border-zinc-100">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-zinc-900 text-white flex items-center justify-center font-black shadow-sm">
                      <Truck className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-mono font-black text-lg text-zinc-900 tracking-wide">
                          {selectedVehicle.license_plate}
                        </h3>
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${
                            selectedVehicle.status === 'Active'
                              ? 'bg-zinc-100 text-zinc-900 border border-zinc-300'
                              : 'bg-rose-50 text-rose-800 border border-rose-200'
                          }`}
                        >
                          {selectedVehicle.status || 'Active'}
                        </span>
                      </div>
                      <p className="text-xs text-zinc-400 font-medium">
                        {selectedVehicle.vehicle_type || 'Articulated Hauler'} • ID #{selectedVehicle.id}
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={(e) => handleOpenEdit(selectedVehicle, e)}
                    className="px-2.5 py-1 rounded-lg border border-zinc-200 hover:bg-zinc-100 text-xs font-semibold text-zinc-700 transition-colors"
                  >
                    Edit Vehicle
                  </button>
                </div>

                {/* Weight & Capacity Gauge Box */}
                <div className="p-4 rounded-xl bg-zinc-50 border border-zinc-200/80 space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5 font-bold text-zinc-800">
                      <Gauge className="w-3.5 h-3.5 text-zinc-700" />
                      <span>Gross Vehicle Weight (GVW) Legal Cap</span>
                    </div>
                    <span className="font-mono font-bold text-zinc-900">
                      {selectedVehicle.max_capacity
                        ? `${Number(selectedVehicle.max_capacity).toLocaleString()} kg`
                        : '44,000 kg (Default)'}
                    </span>
                  </div>

                  {/* Progress bar representing tare vs remaining payload allowance */}
                  {(() => {
                    const maxCap = Number(selectedVehicle.max_capacity || 44000);
                    const tare = Number(selectedVehicle.known_tare_weight || selectedVehicle.tare_weight || 7500);
                    const tarePct = Math.min(100, Math.round((tare / maxCap) * 100));
                    const payloadAllowance = Math.max(0, maxCap - tare);

                    return (
                      <div className="space-y-1.5">
                        <div className="w-full bg-zinc-200 h-2 rounded-full overflow-hidden flex">
                          <div
                            style={{ width: `${tarePct}%` }}
                            className="bg-zinc-800 h-full"
                            title={`Tare Baseline: ${tare.toLocaleString()} kg (${tarePct}%)`}
                          />
                          <div
                            style={{ width: `${100 - tarePct}%` }}
                            className="bg-zinc-400 h-full"
                            title={`Payload Capacity: ${payloadAllowance.toLocaleString()} kg`}
                          />
                        </div>
                        <div className="flex justify-between text-[10px] font-mono text-zinc-500 pt-0.5">
                          <span>Tare: {tare.toLocaleString()} kg ({tarePct}%)</span>
                          <span>Max Payload: {payloadAllowance.toLocaleString()} kg</span>
                        </div>
                      </div>
                    );
                  })()}
                </div>

                {/* Logistics & Dispatch Card Grid */}
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="p-3 bg-zinc-50 rounded-xl border border-zinc-200/80">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block mb-1 flex items-center gap-1">
                      <Building2 className="w-3 h-3" /> Fleet Carrier
                    </span>
                    <span className="font-semibold text-zinc-900 block truncate">
                      {selectedVehicle.carrier_name || 'Independent Contractor'}
                    </span>
                  </div>

                  <div className="p-3 bg-zinc-50 rounded-xl border border-zinc-200/80">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block mb-1 flex items-center gap-1">
                      <UserCheck className="w-3 h-3" /> Assigned Driver
                    </span>
                    <span className="font-semibold text-zinc-900 block truncate">
                      {selectedVehicle.default_driver_name || 'Flexible Dispatch'}
                    </span>
                  </div>
                </div>

                {/* Roadworthiness Registration Info */}
                <div className="p-3 rounded-xl bg-zinc-50 border border-zinc-200 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-zinc-900" />
                    <div>
                      <span className="font-bold text-zinc-900 block">Road Safety Registration</span>
                      <span className="text-[10px] text-zinc-500">
                        {selectedVehicle.registration_expiry
                          ? `Expires: ${new Date(selectedVehicle.registration_expiry).toLocaleDateString()}`
                          : 'No inspection recorded'}
                      </span>
                    </div>
                  </div>
                  <span className="font-mono font-bold text-xs">
                    {getExpiryStatus(selectedVehicle.registration_expiry).label}
                  </span>
                </div>

                {/* Recent Weighbridge Scale Trips */}
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-zinc-900">
                      <Scale className="w-3.5 h-3.5 text-zinc-800" />
                      <span>Recent Truck Weighments</span>
                    </div>
                    <span className="text-[10px] text-zinc-400 font-mono">Last 6 Scale Tickets</span>
                  </div>

                  {loadingHistory ? (
                    <div className="py-6 text-center text-xs text-zinc-400">Loading trips...</div>
                  ) : vehicleTxHistory.length === 0 ? (
                    <div className="py-6 text-center text-xs text-zinc-400 border border-dashed border-zinc-200 rounded-xl">
                      No scale weighings logged for this vehicle yet.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {vehicleTxHistory.map((tx) => (
                        <div
                          key={tx.id}
                          className="p-2.5 rounded-lg border border-zinc-200 bg-zinc-50/60 hover:bg-zinc-100 flex items-center justify-between text-xs transition-colors"
                        >
                          <div>
                            <span className="font-mono font-bold text-zinc-900 block">
                              {tx.ticket_number || `TX-#${tx.id}`}
                            </span>
                            <span className="text-[10px] text-zinc-500">
                              {typeof tx.material === 'object' ? tx.material.name : tx.material_name}
                            </span>
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
                Select a vehicle from the fleet table to inspect capacity baselines and trip tickets.
              </div>
            )}
          </div>

        </div>

        {/* Modal: Create / Edit Vehicle */}
        {isModalOpen && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <div className="w-full max-w-lg bg-white border border-zinc-200 rounded-2xl shadow-2xl p-6">
              <div className="flex items-center justify-between pb-3 border-b border-zinc-200">
                <div className="flex items-center gap-2">
                  <Truck className="w-4 h-4 text-zinc-900" />
                  <h3 className="font-bold text-sm text-zinc-900">
                    {editId ? 'Edit Vehicle Profile' : 'Register New Vehicle'}
                  </h3>
                </div>
                <button onClick={() => setIsModalOpen(false)} className="text-zinc-400 hover:text-zinc-600">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSave} className="mt-4 space-y-4 text-xs">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-zinc-700 uppercase tracking-wider mb-1">
                      License Plate *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. TRK-9812-BW"
                      value={formData.license_plate || ''}
                      onChange={(e) => setFormData({ ...formData, license_plate: e.target.value })}
                      className="w-full bg-zinc-50 border border-zinc-200 rounded-lg p-2 text-zinc-900 uppercase font-mono font-bold focus:outline-none focus:bg-white focus:border-zinc-800"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-zinc-700 uppercase tracking-wider mb-1">
                      Vehicle Type
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Articulated Tipper, 3-Axle"
                      value={formData.vehicle_type || ''}
                      onChange={(e) => setFormData({ ...formData, vehicle_type: e.target.value })}
                      className="w-full bg-zinc-50 border border-zinc-200 rounded-lg p-2 text-zinc-900 focus:outline-none focus:bg-white focus:border-zinc-800"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-zinc-700 uppercase tracking-wider mb-1">
                      Preset Known Tare (kg)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="e.g. 7450"
                      value={formData.known_tare_weight || ''}
                      onChange={(e) => setFormData({ ...formData, known_tare_weight: e.target.value })}
                      className="w-full bg-zinc-50 border border-zinc-200 rounded-lg p-2 text-zinc-900 font-mono focus:outline-none focus:bg-white focus:border-zinc-800"
                    />
                    <span className="text-[10px] text-zinc-400 mt-0.5 block">Leave blank for per-trip tare</span>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-zinc-700 uppercase tracking-wider mb-1">
                      Max Gross Overload Limit (kg)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="e.g. 44000"
                      value={formData.max_capacity || ''}
                      onChange={(e) => setFormData({ ...formData, max_capacity: e.target.value })}
                      className="w-full bg-zinc-50 border border-zinc-200 rounded-lg p-2 text-zinc-900 font-mono focus:outline-none focus:bg-white focus:border-zinc-800"
                    />
                    <span className="text-[10px] text-zinc-400 mt-0.5 block">Highway GVW legal cap</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-zinc-700 uppercase tracking-wider mb-1">
                      Carrier / Haulage Fleet
                    </label>
                    <select
                      value={formData.carrier || ''}
                      onChange={(e) => setFormData({ ...formData, carrier: e.target.value })}
                      className="w-full bg-zinc-50 border border-zinc-200 rounded-lg p-2 text-zinc-900 focus:outline-none focus:bg-white focus:border-zinc-800"
                    >
                      <option value="">Independent Contractor...</option>
                      {carriers.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-zinc-700 uppercase tracking-wider mb-1">
                      Assigned Default Driver
                    </label>
                    <select
                      value={formData.default_driver || ''}
                      onChange={(e) => setFormData({ ...formData, default_driver: e.target.value })}
                      className="w-full bg-zinc-50 border border-zinc-200 rounded-lg p-2 text-zinc-900 focus:outline-none focus:bg-white focus:border-zinc-800"
                    >
                      <option value="">None / Flexible...</option>
                      {drivers.map((d) => (
                        <option key={d.id} value={d.id}>{d.name} ({d.license_number})</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-zinc-700 uppercase tracking-wider mb-1">
                      Registration Expiration
                    </label>
                    <input
                      type="date"
                      value={formData.registration_expiry || ''}
                      onChange={(e) => setFormData({ ...formData, registration_expiry: e.target.value })}
                      className="w-full bg-zinc-50 border border-zinc-200 rounded-lg p-2 text-zinc-900 focus:outline-none focus:bg-white focus:border-zinc-800"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-zinc-700 uppercase tracking-wider mb-1">
                      Status
                    </label>
                    <select
                      value={formData.status || 'Active'}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                      className="w-full bg-zinc-50 border border-zinc-200 rounded-lg p-2 text-zinc-900 focus:outline-none focus:bg-white focus:border-zinc-800"
                    >
                      <option value="Active">Active (Permitted)</option>
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
                    {submitting ? 'Saving...' : editId ? 'Update Vehicle' : 'Register Vehicle'}
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
