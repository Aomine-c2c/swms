'use client';

import React, { useState } from 'react';
import { 
  Cpu, 
  Wifi, 
  Cable, 
  RotateCw, 
  CheckCircle, 
  AlertCircle, 
  Save, 
  Activity, 
  Sliders
} from 'lucide-react';
import { useScale, ScaleConfig } from '@/lib/scale-context';
import { RouteGuard } from '@/components/auth/RouteGuard';

export default function ScaleSettingsPage() {
  const { config, updateConfig, liveWeight, isStable, testConnection, zeroScale, simulateWeight } = useScale();

  const [form, setForm] = useState<ScaleConfig>(config);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string; sampleRaw?: string } | null>(null);
  const [savedNotice, setSavedNotice] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    updateConfig(form);
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 2500);
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    updateConfig(form);
    const res = await testConnection();
    setTestResult(res);
    setTesting(false);
  };

  return (
    <RouteGuard roles={['Administrator', 'Supervisor']}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-zinc-900">Scale Hardware & Communication</h2>
            <p className="text-xs text-zinc-500 mt-0.5">Configure RS-232 serial COM ports, TCP/IP network indicators, and data stream protocols</p>
          </div>
          <button
            onClick={handleTest}
            disabled={testing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-200 bg-white hover:bg-zinc-100 text-xs font-semibold text-zinc-700 shadow-xs transition-colors disabled:opacity-50"
          >
            <Activity className={`w-3.5 h-3.5 ${testing ? 'animate-spin' : ''}`} />
            <span>{testing ? 'Testing Loopback...' : 'Test Connection'}</span>
          </button>
        </div>

        {/* Live Indicator Test Card */}
        <div className="bg-zinc-900 text-white rounded-xl p-5 border border-zinc-800 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-zinc-800 flex items-center justify-center font-bold">
              <Cpu className="w-6 h-6 text-zinc-200" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${isStable ? 'bg-zinc-100' : 'bg-zinc-500 animate-ping'}`} />
                <span className="font-bold text-xs uppercase tracking-wider">{form.connectionType} Scale Interface</span>
              </div>
              <p className="text-[11px] text-zinc-400 mt-0.5">
                Protocol: <span className="font-mono text-zinc-200 uppercase">{form.indicatorProtocol}</span> • Rate: <span className="font-mono text-zinc-200">{form.pollIntervalMs}ms</span>
              </p>
            </div>
          </div>

          <div className="text-center sm:text-right">
            <div className="font-mono font-black text-3xl sm:text-4xl tracking-wider text-white">
              {liveWeight.toLocaleString()} <span className="text-sm font-normal text-zinc-400">kg</span>
            </div>
            <div className="flex items-center justify-center sm:justify-end gap-2 mt-2">
              <button
                type="button"
                onClick={() => simulateWeight(Math.floor(Math.random() * 16000) + 12000)}
                className="px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-[11px] font-semibold text-zinc-200"
              >
                Send Test Weight
              </button>
              <button
                type="button"
                onClick={zeroScale}
                className="px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-[11px] font-semibold text-zinc-400"
              >
                Zero
              </button>
            </div>
          </div>
        </div>

        {testResult && (
          <div className={`p-4 rounded-xl border text-xs flex items-start gap-3 ${
            testResult.success ? 'bg-zinc-50 border-zinc-300 text-zinc-900' : 'bg-zinc-100 border-zinc-400 text-zinc-900'
          }`}>
            {testResult.success ? (
              <CheckCircle className="w-4 h-4 text-zinc-900 mt-0.5 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-zinc-700 mt-0.5 shrink-0" />
            )}
            <div className="space-y-1">
              <p className="font-bold">{testResult.message}</p>
              {testResult.sampleRaw && (
                <p className="font-mono text-[11px] text-zinc-600 bg-white p-1.5 rounded border border-zinc-200">
                  Raw ASCII Stream: {testResult.sampleRaw}
                </p>
              )}
            </div>
          </div>
        )}

        {savedNotice && (
          <div className="p-3 bg-zinc-900 text-white rounded-lg text-xs font-semibold flex items-center gap-2">
            <CheckCircle className="w-4 h-4" />
            <span>Scale parameters updated and saved to local terminal configuration.</span>
          </div>
        )}

        {/* Configuration Form */}
        <form onSubmit={handleSave} className="bg-white border border-zinc-200 rounded-xl p-6 shadow-sm space-y-6 text-xs">
          
          {/* Connection Interface Selector */}
          <div>
            <label className="block text-[11px] font-bold text-zinc-700 uppercase tracking-wider mb-2">
              Physical Communication Interface
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                { type: 'serial' as const, label: 'RS-232 / USB Serial COM', icon: Cable, desc: 'Direct RS-232 DB9 cable from indicator' },
                { type: 'network' as const, label: 'Ethernet / TCP Network Socket', icon: Wifi, desc: 'Scale transmitter on local IP/Port' },
                { type: 'simulated' as const, label: 'Virtual Simulator (Test Mode)', icon: Sliders, desc: 'Development loopback simulation' },
              ].map((opt) => {
                const Icon = opt.icon;
                const isSelected = form.connectionType === opt.type;
                return (
                  <button
                    key={opt.type}
                    type="button"
                    onClick={() => setForm({ ...form, connectionType: opt.type })}
                    className={`p-4 rounded-xl border text-left flex flex-col justify-between transition-all ${
                      isSelected
                        ? 'border-zinc-900 bg-zinc-50 ring-1 ring-zinc-900'
                        : 'border-zinc-200 hover:border-zinc-300'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <Icon className={`w-5 h-5 ${isSelected ? 'text-zinc-900' : 'text-zinc-400'}`} />
                      {isSelected && <span className="w-2 h-2 rounded-full bg-zinc-900" />}
                    </div>
                    <div>
                      <p className="font-bold text-zinc-900">{opt.label}</p>
                      <p className="text-[10px] text-zinc-500 mt-0.5">{opt.desc}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Serial Settings (Shown if Serial Selected) */}
          {form.connectionType === 'serial' && (
            <div className="p-4 bg-zinc-50 border border-zinc-200 rounded-xl space-y-4">
              <h4 className="font-bold text-xs uppercase tracking-wider text-zinc-700">RS-232 Serial Port Parameters</h4>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-zinc-500 mb-1">Port Name / Device</label>
                  <input
                    type="text"
                    required
                    placeholder="/dev/ttyUSB0 or COM3"
                    value={form.serialPort}
                    onChange={(e) => setForm({ ...form, serialPort: e.target.value })}
                    className="w-full bg-white border border-zinc-200 rounded-lg p-2 text-zinc-900 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-zinc-500 mb-1">Baud Rate</label>
                  <select
                    value={form.baudRate}
                    onChange={(e) => setForm({ ...form, baudRate: parseInt(e.target.value) })}
                    className="w-full bg-white border border-zinc-200 rounded-lg p-2 text-zinc-900 font-mono"
                  >
                    {[2400, 4800, 9600, 19200, 38400, 57600, 115200].map((b) => (
                      <option key={b} value={b}>{b} bps</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-zinc-500 mb-1">Data Bits</label>
                  <select
                    value={form.dataBits}
                    onChange={(e) => setForm({ ...form, dataBits: parseInt(e.target.value) as any })}
                    className="w-full bg-white border border-zinc-200 rounded-lg p-2 text-zinc-900 font-mono"
                  >
                    <option value={8}>8 Bits</option>
                    <option value={7}>7 Bits</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-zinc-500 mb-1">Parity</label>
                  <select
                    value={form.parity}
                    onChange={(e: any) => setForm({ ...form, parity: e.target.value })}
                    className="w-full bg-white border border-zinc-200 rounded-lg p-2 text-zinc-900 font-mono"
                  >
                    <option value="none">None (N)</option>
                    <option value="even">Even (E)</option>
                    <option value="odd">Odd (O)</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Network Settings (Shown if Network Selected) */}
          {form.connectionType === 'network' && (
            <div className="p-4 bg-zinc-50 border border-zinc-200 rounded-xl space-y-4">
              <h4 className="font-bold text-xs uppercase tracking-wider text-zinc-700">TCP/IP Network Indicator Settings</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-zinc-500 mb-1">Indicator IP Address / Hostname</label>
                  <input
                    type="text"
                    required
                    placeholder="192.168.1.150"
                    value={form.networkHost}
                    onChange={(e) => setForm({ ...form, networkHost: e.target.value })}
                    className="w-full bg-white border border-zinc-200 rounded-lg p-2 text-zinc-900 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-zinc-500 mb-1">TCP Port Number</label>
                  <input
                    type="number"
                    required
                    placeholder="4001"
                    value={form.networkPort}
                    onChange={(e) => setForm({ ...form, networkPort: parseInt(e.target.value) })}
                    className="w-full bg-white border border-zinc-200 rounded-lg p-2 text-zinc-900 font-mono"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Indicator Protocol & Parsing */}
          <div>
            <h4 className="font-bold text-xs uppercase tracking-wider text-zinc-700 mb-3">Scale Indicator Protocol & Polling</h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[10px] font-bold uppercase text-zinc-500 mb-1">Indicator Stream Protocol</label>
                <select
                  value={form.indicatorProtocol}
                  onChange={(e: any) => setForm({ ...form, indicatorProtocol: e.target.value })}
                  className="w-full bg-zinc-50 border border-zinc-200 rounded-lg p-2 text-zinc-900"
                >
                  <option value="continuous">Standard Continuous Stream (ASCII)</option>
                  <option value="avery">Avery Weigh-Tronix Format</option>
                  <option value="rintrsum">Rinstrum (R420 / R320 Format)</option>
                  <option value="mettler">Mettler Toledo SICS Protocol</option>
                  <option value="poll_command">Demand Command (P&lt;CR&gt;&lt;LF&gt;)</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-zinc-500 mb-1">Polling Interval (ms)</label>
                <input
                  type="number"
                  step="50"
                  min="100"
                  max="2000"
                  value={form.pollIntervalMs}
                  onChange={(e) => setForm({ ...form, pollIntervalMs: parseInt(e.target.value) })}
                  className="w-full bg-zinc-50 border border-zinc-200 rounded-lg p-2 text-zinc-900 font-mono"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-zinc-500 mb-1">Zero Stability Range (± kg)</label>
                <input
                  type="number"
                  value={form.zeroToleranceKg}
                  onChange={(e) => setForm({ ...form, zeroToleranceKg: parseInt(e.target.value) })}
                  className="w-full bg-zinc-50 border border-zinc-200 rounded-lg p-2 text-zinc-900 font-mono"
                />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-zinc-200">
            <span className="text-[11px] text-zinc-400">Settings persist in local application state.</span>
            <button
              type="submit"
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-zinc-900 hover:bg-black text-white font-semibold shadow-xs"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Save Configuration</span>
            </button>
          </div>
        </form>
      </div>
    </RouteGuard>
  );
}
