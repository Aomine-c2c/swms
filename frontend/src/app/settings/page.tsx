'use client';

import React, { useState, useEffect } from 'react';
import { 
  Settings, 
  ShieldAlert, 
  CheckCircle, 
  Save, 
  Scale, 
  Sliders, 
  RotateCw,
  Building,
  Info
} from 'lucide-react';
import { api } from '@/lib/api';
import { SystemSetting } from '@/types';
import { RouteGuard } from '@/components/auth/RouteGuard';

export default function SystemSettingsPage() {
  const [systemSetting, setSystemSetting] = useState<SystemSetting | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedNotice, setSavedNotice] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      setErrorMsg(null);
      const res = await api.get('/system/settings/');
      setSystemSetting(res.data);
    } catch (err: any) {
      setErrorMsg('Failed to load system settings from server.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!systemSetting) return;
    try {
      setSaving(true);
      setErrorMsg(null);
      const res = await api.post('/system/settings/', {
        tare_tolerance_pct: systemSetting.tare_tolerance_pct,
        tare_tolerance_kg: systemSetting.tare_tolerance_kg,
        tare_tolerance_mode: systemSetting.tare_tolerance_mode,
        overweight_enforcement_enabled: systemSetting.overweight_enforcement_enabled,
      });
      setSystemSetting(res.data);
      setSavedNotice(true);
      setTimeout(() => setSavedNotice(false), 3000);
    } catch (err: any) {
      setErrorMsg(err.response?.data ? JSON.stringify(err.response.data) : 'Failed to update system settings.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <RouteGuard permission="manage_system_settings" roles={['Administrator', 'Supervisor', 'Manager']}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-zinc-900 flex items-center gap-2">
              <Settings className="w-5 h-5 text-zinc-800" />
              <span>System Settings & Operational Policies</span>
            </h2>
            <p className="text-xs text-zinc-500 mt-0.5">
              Global weighbridge validation tolerances, dual-control exception policies, and system thresholds
            </p>
          </div>

          <button
            onClick={fetchSettings}
            disabled={loading}
            className="self-start sm:self-auto p-2 rounded-lg border border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-600 transition-colors shadow-2xs"
            title="Refresh Settings"
          >
            <RotateCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {savedNotice && (
          <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-semibold">System settings and operational policies updated successfully.</span>
          </div>
        )}

        {errorMsg && (
          <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs">
            {errorMsg}
          </div>
        )}

        {loading || !systemSetting ? (
          <div className="p-12 text-center text-zinc-400 text-xs font-mono">
            Loading operational policies...
          </div>
        ) : (
          <form onSubmit={handleSave} className="space-y-5">
            {/* Card 1: Tare Tolerance Rules */}
            <div className="bg-white border border-zinc-200 rounded-xl p-5 shadow-2xs space-y-4">
              <div className="flex items-center gap-2.5 pb-3 border-b border-zinc-100">
                <div className="p-2 rounded-lg bg-zinc-100 text-zinc-800">
                  <ShieldAlert className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <h3 className="font-bold text-zinc-900 text-sm">Tare Tolerance & Anti-Fraud Thresholds</h3>
                  <p className="text-[11px] text-zinc-500">
                    Intercept weighings when inbound/outbound tare diverges beyond safe operational tolerances
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-zinc-600 mb-1">
                    Allowed Tare Deviation Percentage (%) *
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max="50"
                      required
                      value={systemSetting.tare_tolerance_pct}
                      onChange={(e) => setSystemSetting({ ...systemSetting, tare_tolerance_pct: e.target.value })}
                      className="w-full bg-zinc-50 border border-zinc-200 rounded-lg p-2.5 pr-8 text-zinc-900 font-mono font-bold focus:bg-white focus:outline-none focus:border-zinc-800"
                    />
                    <span className="absolute right-3 top-2.5 text-zinc-400 font-mono">%</span>
                  </div>
                  <p className="text-[10px] text-zinc-400 mt-1">Relative variation against registered vehicle tare.</p>
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase text-zinc-600 mb-1">
                    Allowed Tare Deviation Absolute (kg) *
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="10"
                      min="0"
                      max="10000"
                      required
                      value={systemSetting.tare_tolerance_kg}
                      onChange={(e) => setSystemSetting({ ...systemSetting, tare_tolerance_kg: e.target.value })}
                      className="w-full bg-zinc-50 border border-zinc-200 rounded-lg p-2.5 pr-8 text-zinc-900 font-mono font-bold focus:bg-white focus:outline-none focus:border-zinc-800"
                    />
                    <span className="absolute right-3 top-2.5 text-zinc-400 font-mono">kg</span>
                  </div>
                  <p className="text-[10px] text-zinc-400 mt-1">Maximum physical variance in kg.</p>
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase text-zinc-600 mb-1">
                    Tolerance Verification Mode *
                  </label>
                  <select
                    value={systemSetting.tare_tolerance_mode}
                    onChange={(e: any) => setSystemSetting({ ...systemSetting, tare_tolerance_mode: e.target.value })}
                    className="w-full bg-zinc-50 border border-zinc-200 rounded-lg p-2.5 text-zinc-900 font-medium focus:bg-white focus:outline-none focus:border-zinc-800"
                  >
                    <option value="EITHER">EITHER (Breach if either % OR kg exceeded)</option>
                    <option value="PERCENTAGE">PERCENTAGE ONLY (Trigger if % exceeded)</option>
                    <option value="ABSOLUTE">ABSOLUTE ONLY (Trigger if kg exceeded)</option>
                  </select>
                  <p className="text-[10px] text-zinc-400 mt-1">Evaluation condition applied on each transaction.</p>
                </div>
              </div>
            </div>

            {/* Card 2: Overload & Capacity Enforcement */}
            <div className="bg-white border border-zinc-200 rounded-xl p-5 shadow-2xs space-y-4">
              <div className="flex items-center gap-2.5 pb-3 border-b border-zinc-100">
                <div className="p-2 rounded-lg bg-zinc-100 text-zinc-800">
                  <Scale className="w-5 h-5 text-zinc-800" />
                </div>
                <div>
                  <h3 className="font-bold text-zinc-900 text-sm">Highway & Bridge Overload Protection</h3>
                  <p className="text-[11px] text-zinc-500">
                    Enforce statutory gross vehicle weight ratings (GVWR)
                  </p>
                </div>
              </div>

              <div className="p-3.5 bg-zinc-50 border border-zinc-200 rounded-lg flex items-center justify-between">
                <div>
                  <span className="font-bold text-xs text-zinc-900 block">Strict Max Vehicle Capacity Enforcement</span>
                  <p className="text-[11px] text-zinc-500 mt-0.5">
                    When active, trucks exceeding their registered maximum capacity cannot complete weighing without formal Supervisor approval.
                  </p>
                </div>

                <label className="relative inline-flex items-center cursor-pointer shrink-0 ml-4">
                  <input
                    type="checkbox"
                    checked={systemSetting.overweight_enforcement_enabled}
                    onChange={(e) => setSystemSetting({ ...systemSetting, overweight_enforcement_enabled: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-zinc-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-zinc-900"></div>
                </label>
              </div>
            </div>

            {/* Save Action */}
            <div className="flex items-center justify-between pt-2">
              <span className="text-[11px] text-zinc-400">
                Policies take effect immediately across all scale operator terminals.
              </span>
              <button
                type="submit"
                disabled={saving}
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-zinc-900 hover:bg-black text-white text-xs font-semibold shadow-sm transition-all disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                <span>{saving ? 'Saving Policies...' : 'Save System Settings'}</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </RouteGuard>
  );
}
