'use client';

import React, { useEffect, useState } from 'react';
import { 
  Truck, 
  Users, 
  Building2, 
  Package, 
  Plus, 
  X, 
  RotateCw
} from 'lucide-react';
import { api } from '@/lib/api';
import { Vehicle, Driver, Supplier, Material } from '@/types';
import { RouteGuard } from '@/components/auth/RouteGuard';

type Tab = 'vehicles' | 'drivers' | 'suppliers' | 'materials';

export default function MasterDataPage() {
  const [activeTab, setActiveTab] = useState<Tab>('vehicles');
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState<any>({});
  const [submitting, setSubmitting] = useState(false);

  const fetchMasterData = async () => {
    try {
      setLoading(true);
      const [vRes, dRes, sRes, mRes] = await Promise.allSettled([
        api.get('/vehicles/'),
        api.get('/drivers/'),
        api.get('/suppliers/'),
        api.get('/materials/'),
      ]);

      if (vRes.status === 'fulfilled') setVehicles(vRes.value.data.results || vRes.value.data || []);
      if (dRes.status === 'fulfilled') setDrivers(dRes.value.data.results || dRes.value.data || []);
      if (sRes.status === 'fulfilled') setSuppliers(sRes.value.data.results || sRes.value.data || []);
      if (mRes.status === 'fulfilled') setMaterials(mRes.value.data.results || mRes.value.data || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMasterData();
  }, [activeTab]);

  const handleOpenCreate = () => {
    setFormData({});
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post(`/${activeTab}/`, formData);
      setIsModalOpen(false);
      fetchMasterData();
    } catch (err: any) {
      alert(JSON.stringify(err.response?.data || 'Failed to save entity.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <RouteGuard roles={['Administrator', 'Operator', 'Supervisor']}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-zinc-900">Master Data Registry</h2>
            <p className="text-xs text-zinc-500 mt-0.5">
              Vehicles, licensed drivers, commercial vendors, and weighable materials
            </p>
          </div>
          <button
            onClick={handleOpenCreate}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-black text-xs font-semibold text-white shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>Add {activeTab.slice(0, -1)}</span>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-zinc-200 gap-6 text-xs font-semibold">
          {[
            { tab: 'vehicles' as Tab, label: 'Vehicles', icon: Truck, count: vehicles.length },
            { tab: 'drivers' as Tab, label: 'Drivers', icon: Users, count: drivers.length },
            { tab: 'suppliers' as Tab, label: 'Suppliers', icon: Building2, count: suppliers.length },
            { tab: 'materials' as Tab, label: 'Materials', icon: Package, count: materials.length },
          ].map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.tab;
            return (
              <button
                key={item.tab}
                onClick={() => setActiveTab(item.tab)}
                className={`flex items-center gap-2 py-3 border-b-2 transition-all ${
                  isActive
                    ? 'border-zinc-900 text-zinc-900'
                    : 'border-transparent text-zinc-400 hover:text-zinc-600'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{item.label}</span>
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-zinc-100 text-zinc-600 font-mono border border-zinc-200">
                  {item.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Content Table */}
        <div className="rounded-xl bg-white border border-zinc-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            {activeTab === 'vehicles' && (
              <table className="w-full text-left text-xs">
                <thead className="bg-zinc-50 text-zinc-600 font-bold border-b border-zinc-200 uppercase text-[10px]">
                  <tr>
                    <th className="px-4 py-3">License Plate</th>
                    <th className="px-4 py-3">Default Tare Weight</th>
                    <th className="px-4 py-3">Carrier / Fleet</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 text-zinc-700">
                  {vehicles.map((v) => (
                    <tr key={v.id} className="hover:bg-zinc-50">
                      <td className="px-4 py-3 font-mono font-bold text-zinc-900">{v.license_plate}</td>
                      <td className="px-4 py-3 font-mono">
                        {v.tare_weight ? `${Number(v.tare_weight).toLocaleString()} kg` : 'Variable'}
                      </td>
                      <td className="px-4 py-3">{v.carrier_name || 'Standard'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {activeTab === 'drivers' && (
              <table className="w-full text-left text-xs">
                <thead className="bg-zinc-50 text-zinc-600 font-bold border-b border-zinc-200 uppercase text-[10px]">
                  <tr>
                    <th className="px-4 py-3">Driver Name</th>
                    <th className="px-4 py-3">License Number</th>
                    <th className="px-4 py-3">Phone</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 text-zinc-700">
                  {drivers.map((d) => (
                    <tr key={d.id} className="hover:bg-zinc-50">
                      <td className="px-4 py-3 font-semibold text-zinc-900">{d.name}</td>
                      <td className="px-4 py-3 font-mono">{d.license_number}</td>
                      <td className="px-4 py-3 font-mono text-zinc-500">{d.phone || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {activeTab === 'suppliers' && (
              <table className="w-full text-left text-xs">
                <thead className="bg-zinc-50 text-zinc-600 font-bold border-b border-zinc-200 uppercase text-[10px]">
                  <tr>
                    <th className="px-4 py-3">Vendor / Supplier</th>
                    <th className="px-4 py-3">Vendor Code</th>
                    <th className="px-4 py-3">Contact</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 text-zinc-700">
                  {suppliers.map((s) => (
                    <tr key={s.id} className="hover:bg-zinc-50">
                      <td className="px-4 py-3 font-semibold text-zinc-900">{s.name}</td>
                      <td className="px-4 py-3 font-mono text-zinc-500">{s.code || '-'}</td>
                      <td className="px-4 py-3">{s.contact_person || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {activeTab === 'materials' && (
              <table className="w-full text-left text-xs">
                <thead className="bg-zinc-50 text-zinc-600 font-bold border-b border-zinc-200 uppercase text-[10px]">
                  <tr>
                    <th className="px-4 py-3">Material Name</th>
                    <th className="px-4 py-3">Material Code</th>
                    <th className="px-4 py-3">Unit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 text-zinc-700">
                  {materials.map((m) => (
                    <tr key={m.id} className="hover:bg-zinc-50">
                      <td className="px-4 py-3 font-semibold text-zinc-900">{m.name}</td>
                      <td className="px-4 py-3 font-mono text-zinc-500">{m.code || '-'}</td>
                      <td className="px-4 py-3 font-mono uppercase">{m.unit_of_measure || 'KG'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Modal */}
        {isModalOpen && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <div className="w-full max-w-md bg-white border border-zinc-200 rounded-xl shadow-2xl p-6">
              <div className="flex items-center justify-between pb-3 border-b border-zinc-200">
                <h3 className="font-bold text-sm text-zinc-900 capitalize">New {activeTab.slice(0, -1)}</h3>
                <button onClick={() => setIsModalOpen(false)} className="text-zinc-400 hover:text-zinc-600">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSave} className="mt-4 space-y-3.5 text-xs">
                {activeTab === 'vehicles' && (
                  <>
                    <div>
                      <label className="block text-[11px] font-bold text-zinc-700 uppercase tracking-wider mb-1">
                        Plate *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. AB-123-CD"
                        value={formData.license_plate || ''}
                        onChange={(e) => setFormData({ ...formData, license_plate: e.target.value })}
                        className="w-full bg-zinc-50 border border-zinc-200 rounded-lg p-2 text-zinc-900 uppercase font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-zinc-700 uppercase tracking-wider mb-1">
                        Default Tare (kg)
                      </label>
                      <input
                        type="number"
                        placeholder="e.g. 7400"
                        value={formData.tare_weight || ''}
                        onChange={(e) => setFormData({ ...formData, tare_weight: e.target.value })}
                        className="w-full bg-zinc-50 border border-zinc-200 rounded-lg p-2 text-zinc-900 font-mono"
                      />
                    </div>
                  </>
                )}

                {activeTab === 'drivers' && (
                  <>
                    <div>
                      <label className="block text-[11px] font-bold text-zinc-700 uppercase tracking-wider mb-1">
                        Driver Full Name *
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.name || ''}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className="w-full bg-zinc-50 border border-zinc-200 rounded-lg p-2 text-zinc-900"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-zinc-700 uppercase tracking-wider mb-1">
                        Driver License # *
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.license_number || ''}
                        onChange={(e) => setFormData({ ...formData, license_number: e.target.value })}
                        className="w-full bg-zinc-50 border border-zinc-200 rounded-lg p-2 text-zinc-900 font-mono"
                      />
                    </div>
                  </>
                )}

                {activeTab === 'suppliers' && (
                  <>
                    <div>
                      <label className="block text-[11px] font-bold text-zinc-700 uppercase tracking-wider mb-1">
                        Company Name *
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.name || ''}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className="w-full bg-zinc-50 border border-zinc-200 rounded-lg p-2 text-zinc-900"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-zinc-700 uppercase tracking-wider mb-1">
                        Vendor Code
                      </label>
                      <input
                        type="text"
                        value={formData.code || ''}
                        onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                        className="w-full bg-zinc-50 border border-zinc-200 rounded-lg p-2 text-zinc-900 font-mono"
                      />
                    </div>
                  </>
                )}

                {activeTab === 'materials' && (
                  <>
                    <div>
                      <label className="block text-[11px] font-bold text-zinc-700 uppercase tracking-wider mb-1">
                        Material Name *
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.name || ''}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className="w-full bg-zinc-50 border border-zinc-200 rounded-lg p-2 text-zinc-900"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-zinc-700 uppercase tracking-wider mb-1">
                        Material Code
                      </label>
                      <input
                        type="text"
                        value={formData.code || ''}
                        onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                        className="w-full bg-zinc-50 border border-zinc-200 rounded-lg p-2 text-zinc-900 font-mono"
                      />
                    </div>
                  </>
                )}

                <div className="flex justify-end gap-2 pt-3 border-t border-zinc-200">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-3 py-1.5 rounded-lg border border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-100"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-4 py-1.5 rounded-lg bg-zinc-900 hover:bg-black text-white font-semibold"
                  >
                    {submitting ? 'Saving...' : 'Save Record'}
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
