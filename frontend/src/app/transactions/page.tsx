'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { 
  Scale, 
  Search, 
  RotateCw, 
  Printer, 
  Check, 
  AlertCircle,
  Truck,
  ArrowRight,
  ShieldAlert,
  AlertTriangle,
  X
} from 'lucide-react';
import { api } from '@/lib/api';
import { WeighingTransaction, Vehicle, Driver, Supplier, Material } from '@/types';
import { useAuth } from '@/lib/auth-context';
import { useScale } from '@/lib/scale-context';

export default function TransactionsPage() {
  const { user } = useAuth();
  const { liveWeight, isStable, zeroScale, simulateWeight, config: scaleConfig } = useScale();
  const [openTransactions, setOpenTransactions] = useState<WeighingTransaction[]>([]);
  const [completedTransactions, setCompletedTransactions] = useState<WeighingTransaction[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);

  // Form states (1st Weighing)
  const [formVehicle, setFormVehicle] = useState('');
  const [formDriver, setFormDriver] = useState('');
  const [formSupplier, setFormSupplier] = useState('');
  const [formMaterial, setFormMaterial] = useState('');
  const [formWeighingType, setFormWeighingType] = useState<'gross' | 'tare'>('gross');
  const [formIsManual, setFormIsManual] = useState(false);
  const [formManualWeight, setFormManualWeight] = useState('');
  const [formManualReason, setFormManualReason] = useState('');
  const [formRemarks, setFormRemarks] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // 2nd Weighing modal
  const [activeCompletingTx, setActiveCompletingTx] = useState<WeighingTransaction | null>(null);
  const [secondWeightInput, setSecondWeightInput] = useState<string>('');
  const [secondIsManual, setSecondIsManual] = useState(false);
  const [secondManualReason, setSecondManualReason] = useState('');
  
  // Auto-opened Printable Ticket Slip Modal
  const [printedTx, setPrintedTx] = useState<any | null>(null);

  // Exception request modal (correction / reversal / cancellation)
  const [exceptionModalTx, setExceptionModalTx] = useState<WeighingTransaction | null>(null);
  const [exceptionAction, setExceptionAction] = useState<'CORRECTION' | 'REVERSAL' | 'CANCELLATION'>('CORRECTION');
  const [exceptionReason, setExceptionReason] = useState('');
  const [exceptionSubmitting, setExceptionSubmitting] = useState(false);

  // Anti-fraud optical positioning sensors (front & rear IR beams)
  const [frontBeamClear, setFrontBeamClear] = useState<boolean>(true);
  const [rearBeamClear, setRearBeamClear] = useState<boolean>(true);

  // Moisture & Impurity Lab Deductions (for 2nd weighing completion)
  const [moisturePct, setMoisturePct] = useState<string>('0');
  const [impurityPct, setImpurityPct] = useState<string>('0');

  // Automated Threshold Breach Warning Modal
  const [thresholdModal, setThresholdModal] = useState<{
    stage: 'first' | 'second';
    payload: any;
    violations: any[];
    txId?: number;
    extraPrintedData?: any;
  } | null>(null);
  const [thresholdOperatorNote, setThresholdOperatorNote] = useState('');
  const [thresholdSubmitting, setThresholdSubmitting] = useState(false);

  // Search in table
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'open' | 'completed'>('open');

  const fetchData = async () => {
    try {
      setLoading(true);
      const [openRes, completedRes, vRes, dRes, sRes, mRes] = await Promise.allSettled([
        api.get('/transactions/?status=Open'),
        api.get('/transactions/?status=Completed&page_size=30'),
        api.get('/vehicles/'),
        api.get('/drivers/'),
        api.get('/suppliers/'),
        api.get('/materials/'),
      ]);

      if (openRes.status === 'fulfilled') {
        setOpenTransactions(openRes.value.data.results || openRes.value.data || []);
      }
      if (completedRes.status === 'fulfilled') {
        setCompletedTransactions(completedRes.value.data.results || completedRes.value.data || []);
      }
      if (vRes.status === 'fulfilled') setVehicles(vRes.value.data.results || vRes.value.data || []);
      if (dRes.status === 'fulfilled') setDrivers(dRes.value.data.results || dRes.value.data || []);
      if (sRes.status === 'fulfilled') setSuppliers(sRes.value.data.results || sRes.value.data || []);
      if (mRes.status === 'fulfilled') setMaterials(mRes.value.data.results || mRes.value.data || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleVehicleSelect = (vId: string) => {
    setFormVehicle(vId);
    const sel = vehicles.find((v) => v.id.toString() === vId);
    if (sel?.default_driver) {
      setFormDriver(sel.default_driver.toString());
    }
  };

  const captureScaleReading = () => {
    simulateWeight(Math.floor(Math.random() * 18000) + 12000);
  };

  const handleCreate1stWeighing = async (e: React.FormEvent) => {
    e.preventDefault();
    const effectiveWeight = formIsManual ? parseFloat(formManualWeight) : liveWeight;
    if (!effectiveWeight || effectiveWeight <= 0) {
      setErrorMsg(formIsManual ? 'Please enter a valid manual weight greater than 0 kg.' : 'Scale weight is zero. Capture a valid scale reading or check Manual Entry.');
      return;
    }
    if (formIsManual && !formManualReason.trim()) {
      setErrorMsg('A valid justification reason is required for manual entry override.');
      return;
    }
    if ((!frontBeamClear || !rearBeamClear) && !formIsManual) {
      setErrorMsg('Anti-Fraud Warning: Truck is improperly positioned on scale (IR optical beams obstructed). Re-position truck or check Manual Entry.');
      return;
    }
    setSubmitting(true);
    setErrorMsg(null);

    try {
      const payload: any = {
        vehicle: parseInt(formVehicle),
        material: parseInt(formMaterial),
        weight_type: formWeighingType,
        weight: effectiveWeight,
        is_manual_entry: formIsManual,
        first_weighing_datetime: new Date().toISOString(),
        remarks: formRemarks || undefined,
      };

      if (formDriver) payload.driver = parseInt(formDriver);
      if (formSupplier) payload.supplier = parseInt(formSupplier);

      if (formWeighingType === 'gross') {
        payload.gross_weight = effectiveWeight;
      } else {
        payload.tare_weight = effectiveWeight;
      }

      if (formIsManual) {
        payload.manual_entry_reason = formManualReason;
      }

      try {
        await api.post('/transactions/', payload);
        setFormVehicle('');
        setFormDriver('');
        setFormSupplier('');
        setFormMaterial('');
        setFormRemarks('');
        setFormIsManual(false);
        setFormManualWeight('');
        setFormManualReason('');
        zeroScale();
        fetchData();
      } catch (err: any) {
        if (err.response?.status === 409 && err.response?.data?.requires_approval) {
          setThresholdModal({
            stage: 'first',
            payload,
            violations: err.response.data.violations || [],
          });
          setThresholdOperatorNote('');
          return;
        }
        setErrorMsg(err.response?.data ? JSON.stringify(err.response.data) : 'Failed to record weighing.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleComplete2ndWeighing = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCompletingTx) return;
    if (secondIsManual && !secondManualReason.trim()) {
      setErrorMsg('A valid justification reason is required for manual entry override.');
      return;
    }
    setSubmitting(true);
    setErrorMsg(null);

    try {
      const weightVal = parseFloat(secondWeightInput);
      const mPct = parseFloat(moisturePct) || 0;
      const iPct = parseFloat(impurityPct) || 0;
      
      let rawNet = 0;
      if (activeCompletingTx.gross_weight && !activeCompletingTx.tare_weight) {
        rawNet = Math.max(0, Number(activeCompletingTx.gross_weight) - weightVal);
      } else {
        rawNet = Math.max(0, weightVal - Number(activeCompletingTx.tare_weight || 0));
      }
      
      const deductionKg = Math.round(rawNet * ((mPct + iPct) / 100));
      const payableNetKg = rawNet - deductionKg;

      const deductionDetails = (mPct > 0 || iPct > 0)
        ? `[Lab Deductions: Moisture ${mPct}%, Impurities ${iPct}% | Raw Net: ${rawNet}kg | Deduction: ${deductionKg}kg | Payable Net: ${payableNetKg}kg]`
        : '';

      const combinedRemarks = [activeCompletingTx.remarks, deductionDetails].filter(Boolean).join(' ');

      const payload: any = {
        weight: weightVal,
        remarks: combinedRemarks || undefined,
        is_manual_entry: secondIsManual,
        manual_entry_reason: secondIsManual ? secondManualReason : undefined,
      };

      try {
        const res = await api.post(`/transactions/${activeCompletingTx.id}/complete/`, payload);
        
        // Auto-open printable ticket slip dialog with calculated deduction overlay
        setPrintedTx({
          ...res.data,
          moisture_pct: mPct,
          impurity_pct: iPct,
          deduction_kg: deductionKg,
          payable_net_kg: payableNetKg,
        });
        setActiveCompletingTx(null);
        setSecondWeightInput('');
        setSecondIsManual(false);
        setSecondManualReason('');
        setMoisturePct('0');
        setImpurityPct('0');
        fetchData();
      } catch (err: any) {
        if (err.response?.status === 409 && err.response?.data?.requires_approval) {
          setThresholdModal({
            stage: 'second',
            payload,
            violations: err.response.data.violations || [],
            txId: activeCompletingTx.id,
            extraPrintedData: {
              moisture_pct: mPct,
              impurity_pct: iPct,
              deduction_kg: deductionKg,
              payable_net_kg: payableNetKg,
            }
          });
          setThresholdOperatorNote('');
          return;
        }
        setErrorMsg(err.response?.data ? JSON.stringify(err.response.data) : 'Failed to complete 2nd weighing.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmThresholdException = async () => {
    if (!thresholdModal) return;
    setThresholdSubmitting(true);
    try {
      if (thresholdModal.stage === 'first') {
        await api.post('/transactions/', {
          ...thresholdModal.payload,
          confirm_exception: true,
          exception_reason: thresholdOperatorNote || 'Operator confirmed threshold violation review request',
        });
        setFormVehicle('');
        setFormDriver('');
        setFormSupplier('');
        setFormMaterial('');
        setFormRemarks('');
        setFormIsManual(false);
        setFormManualReason('');
        zeroScale();
      } else {
        await api.post(`/transactions/${thresholdModal.txId}/complete/`, {
          ...thresholdModal.payload,
          confirm_exception: true,
          exception_reason: thresholdOperatorNote || 'Operator confirmed threshold violation review request',
        });
        setActiveCompletingTx(null);
        setSecondWeightInput('');
        setMoisturePct('0');
        setImpurityPct('0');
      }
      setThresholdModal(null);
      setThresholdOperatorNote('');
      fetchData();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to submit exception to supervisor.');
    } finally {
      setThresholdSubmitting(false);
    }
  };

  const handleExceptionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!exceptionModalTx) return;
    setExceptionSubmitting(true);

    try {
      await api.post('/approvals/', {
        transaction: exceptionModalTx.id,
        action: exceptionAction,
        request_reason: exceptionReason,
      });
      setExceptionModalTx(null);
      setExceptionReason('');
      alert('Exception request submitted to Supervisor approval queue.');
      fetchData();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to submit exception request.');
    } finally {
      setExceptionSubmitting(false);
    }
  };

  const filteredCompleted = completedTransactions.filter((tx) => {
    if (!search) return true;
    const q = search.toLowerCase();
    const plate = typeof tx.vehicle === 'object' ? tx.vehicle.license_plate : tx.vehicle_license;
    return (
      (tx.ticket_number && tx.ticket_number.toLowerCase().includes(q)) ||
      (plate && plate.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-6">
      {/* Page Title */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-zinc-900">Weighbridge Terminal Console</h2>
          <p className="text-xs text-zinc-500 mt-0.5">Scale Indicator 01 • Two-Stage Vehicle Weighing Workflow</p>
        </div>
        <button
          onClick={fetchData}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-200 bg-white hover:bg-zinc-100 text-xs font-semibold text-zinc-700 transition-colors"
        >
          <RotateCw className="w-3.5 h-3.5" />
          <span>Refresh Queues</span>
        </button>
      </div>

      {/* Two-Panel Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* LEFT PANEL (45%): Live Scale & 1st Weigh Form */}
        <div className="lg:col-span-5 space-y-4">
          
          {/* Digital Scale Readout Box */}
          <div className="bg-zinc-900 text-white rounded-xl p-5 border border-zinc-800 shadow-sm select-none">
            <div className="flex items-center justify-between text-zinc-400 text-xs font-medium pb-2 border-b border-zinc-800">
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${isStable ? 'bg-zinc-100' : 'bg-zinc-500 animate-ping'}`} />
                <span>{isStable ? 'STABLE' : 'MOTION'}</span>
              </div>
              <Link href="/scale-settings" className="font-mono text-[11px] text-zinc-400 hover:text-white underline">
                {scaleConfig.connectionType.toUpperCase()} SCALE INDICATOR
              </Link>
            </div>

            {/* Monospace Digits */}
            <div className="py-4 text-center">
              <div className="font-mono font-black text-5xl tracking-wider text-white">
                {liveWeight.toLocaleString()} <span className="text-lg font-normal text-zinc-400">kg</span>
              </div>
              <div className="text-[11px] text-zinc-400 mt-1">
                {(liveWeight / 1000).toFixed(2)} Metric Tonnes
              </div>
            </div>

            {/* Anti-Fraud Optical Positioning Sensors Indicator */}
            <div className="mt-3 pt-3 border-t border-zinc-800 flex items-center justify-between text-xs">
              <span className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider">Positioning Sensors:</span>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setFrontBeamClear(!frontBeamClear)}
                  className={`flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-mono font-bold transition-colors ${
                    frontBeamClear ? 'bg-zinc-800 text-zinc-100 border border-zinc-700' : 'bg-zinc-800 text-zinc-400 border border-zinc-600'
                  }`}
                  title="Click to toggle Front IR Beam obstruction"
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${frontBeamClear ? 'bg-zinc-100' : 'bg-zinc-400'}`} />
                  BEAM 1 (FRONT): {frontBeamClear ? 'CLEAR' : 'BLOCKED'}
                </button>
                <button
                  type="button"
                  onClick={() => setRearBeamClear(!rearBeamClear)}
                  className={`flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-mono font-bold transition-colors ${
                    rearBeamClear ? 'bg-zinc-800 text-zinc-100 border border-zinc-700' : 'bg-zinc-800 text-zinc-400 border border-zinc-600'
                  }`}
                  title="Click to toggle Rear IR Beam obstruction"
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${rearBeamClear ? 'bg-zinc-100' : 'bg-zinc-400'}`} />
                  BEAM 2 (REAR): {rearBeamClear ? 'CLEAR' : 'BLOCKED'}
                </button>
              </div>
            </div>

            {/* Quick Scale Hardware Simulation Buttons */}
            <div className="grid grid-cols-2 gap-2 pt-3 border-t border-zinc-800">
              <button
                type="button"
                onClick={captureScaleReading}
                className="py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-semibold transition-colors"
              >
                Simulate Truck On Scale
              </button>
              <button
                type="button"
                onClick={zeroScale}
                className="py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold transition-colors"
              >
                Zero Scale (Tare 0)
              </button>
            </div>
          </div>

          {/* 1st Weighing Card */}
          <div className="bg-white border border-zinc-200 rounded-xl p-5 shadow-sm">
            <div className="flex items-center gap-2 pb-3 mb-4 border-b border-zinc-100">
              <Scale className="w-4 h-4 text-zinc-900" />
              <h3 className="font-bold text-sm text-zinc-900">Step 1: First Weighing</h3>
            </div>

            {errorMsg && (
              <div className="mb-4 p-2.5 rounded-lg bg-zinc-100 border border-zinc-300 text-zinc-900 text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-zinc-700 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handleCreate1stWeighing} className="space-y-3.5 text-xs">
              
              {/* Type Switch */}
              <div className="flex rounded-lg border border-zinc-200 p-0.5 bg-zinc-100">
                <button
                  type="button"
                  onClick={() => setFormWeighingType('gross')}
                  className={`flex-1 py-1.5 rounded-md text-xs font-semibold transition-all ${
                    formWeighingType === 'gross' ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500'
                  }`}
                >
                  Gross (Inbound Loaded)
                </button>
                <button
                  type="button"
                  onClick={() => setFormWeighingType('tare')}
                  className={`flex-1 py-1.5 rounded-md text-xs font-semibold transition-all ${
                    formWeighingType === 'tare' ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500'
                  }`}
                >
                  Tare (Inbound Empty)
                </button>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-zinc-700 uppercase tracking-wider mb-1">
                  Vehicle License Plate *
                </label>
                <select
                  required
                  value={formVehicle}
                  onChange={(e) => handleVehicleSelect(e.target.value)}
                  className="w-full bg-zinc-50 border border-zinc-200 rounded-lg p-2 text-zinc-900 font-semibold focus:outline-none focus:bg-white focus:border-zinc-800"
                >
                  <option value="">Select vehicle...</option>
                  {vehicles.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.license_plate} {v.tare_weight ? `(Tare: ${v.tare_weight}kg)` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-zinc-700 uppercase tracking-wider mb-1">
                    Material *
                  </label>
                  <select
                    required
                    value={formMaterial}
                    onChange={(e) => setFormMaterial(e.target.value)}
                    className="w-full bg-zinc-50 border border-zinc-200 rounded-lg p-2 text-zinc-900 focus:outline-none focus:bg-white focus:border-zinc-800"
                  >
                    <option value="">Select material...</option>
                    {materials.map((m) => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-zinc-700 uppercase tracking-wider mb-1">
                    Driver
                  </label>
                  <select
                    value={formDriver}
                    onChange={(e) => setFormDriver(e.target.value)}
                    className="w-full bg-zinc-50 border border-zinc-200 rounded-lg p-2 text-zinc-900 focus:outline-none focus:bg-white focus:border-zinc-800"
                  >
                    <option value="">Default driver...</option>
                    {drivers.map((d) => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-zinc-700 uppercase tracking-wider mb-1">
                  Supplier / Vendor
                </label>
                <select
                  value={formSupplier}
                  onChange={(e) => setFormSupplier(e.target.value)}
                  className="w-full bg-zinc-50 border border-zinc-200 rounded-lg p-2 text-zinc-900 focus:outline-none focus:bg-white focus:border-zinc-800"
                >
                  <option value="">Direct / Optional...</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

              {/* Manual Override Flag */}
              <div className="p-3 bg-zinc-50 border border-zinc-200 rounded-lg space-y-2">
                <label className="flex items-center gap-2 cursor-pointer text-zinc-800 font-medium">
                  <input
                    type="checkbox"
                    checked={formIsManual}
                    onChange={(e) => {
                      setFormIsManual(e.target.checked);
                      if (e.target.checked && !formManualWeight && liveWeight > 0) {
                        setFormManualWeight(liveWeight.toString());
                      }
                    }}
                    className="rounded text-zinc-900 focus:ring-0"
                  />
                  <span>Manual Entry Override</span>
                </label>
                {formIsManual && (
                  <div className="space-y-2 pt-1 border-t border-zinc-200">
                    <div>
                      <label className="block text-[10px] uppercase font-bold text-zinc-600 mb-1">
                        Manual Weight (kg) *
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        required
                        placeholder="e.g. 15420"
                        value={formManualWeight}
                        onChange={(e) => setFormManualWeight(e.target.value)}
                        className="w-full bg-white border border-zinc-300 rounded p-1.5 font-mono font-bold text-zinc-900 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] uppercase font-bold text-zinc-600 mb-1">
                        Override Justification *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Scale indicator cable severed"
                        value={formManualReason}
                        onChange={(e) => setFormManualReason(e.target.value)}
                        className="w-full bg-white border border-zinc-300 rounded p-1.5 text-zinc-900"
                      />
                    </div>
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-2.5 px-4 rounded-lg bg-zinc-900 hover:bg-black text-white font-semibold text-xs flex items-center justify-center gap-2 shadow-sm transition-all disabled:opacity-50"
              >
                {submitting ? 'Recording Weighing...' : 'Record 1st Weighing to Queue'}
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </form>
          </div>
        </div>

        {/* RIGHT PANEL (55%): Queue of Open Trucks & Completed Weighings */}
        <div className="lg:col-span-7 bg-white border border-zinc-200 rounded-xl shadow-sm flex flex-col overflow-hidden">
          
          {/* Tab Selector & Search */}
          <div className="p-4 border-b border-zinc-200 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex border border-zinc-200 rounded-lg p-0.5 bg-zinc-100 text-xs font-semibold">
              <button
                onClick={() => setActiveTab('open')}
                className={`px-3 py-1.5 rounded-md transition-all ${
                  activeTab === 'open' ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-600'
                }`}
              >
                Open In-Progress ({openTransactions.length})
              </button>
              <button
                onClick={() => setActiveTab('completed')}
                className={`px-3 py-1.5 rounded-md transition-all ${
                  activeTab === 'completed' ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-600'
                }`}
              >
                Completed Transactions
              </button>
            </div>

            {activeTab === 'completed' && (
              <div className="relative w-full sm:w-64">
                <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-2.5 top-2.5" />
                <input
                  type="text"
                  placeholder="Search completed plate / ticket..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full bg-zinc-50 border border-zinc-200 rounded-lg pl-8 pr-3 py-1.5 text-xs text-zinc-900 placeholder-zinc-400 focus:outline-none focus:bg-white focus:border-zinc-800"
                />
              </div>
            )}
          </div>

          {/* Table Content */}
          <div className="flex-1 overflow-x-auto">
            {activeTab === 'open' ? (
              <table className="w-full text-left text-xs">
                <thead className="bg-zinc-50 text-zinc-600 font-bold border-b border-zinc-200 uppercase text-[10px]">
                  <tr>
                    <th className="px-4 py-3">Vehicle Plate</th>
                    <th className="px-4 py-3">Material</th>
                    <th className="px-4 py-3">1st Weigh Value</th>
                    <th className="px-4 py-3">Time In</th>
                    <th className="px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 text-zinc-700">
                  {openTransactions.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-12 text-center text-zinc-400">
                        No trucks currently waiting in scale queue.
                      </td>
                    </tr>
                  ) : (
                    openTransactions.map((tx) => (
                      <tr key={tx.id} className="hover:bg-zinc-50">
                        <td className="px-4 py-3 font-mono font-bold text-zinc-900">
                          {typeof tx.vehicle === 'object' ? tx.vehicle.license_plate : tx.vehicle_license}
                        </td>
                        <td className="px-4 py-3">
                          {typeof tx.material === 'object' ? tx.material.name : tx.material_name}
                        </td>
                        <td className="px-4 py-3 font-mono">
                          {tx.gross_weight ? `Gross: ${Number(tx.gross_weight).toLocaleString()} kg` : `Tare: ${Number(tx.tare_weight).toLocaleString()} kg`}
                        </td>
                        <td className="px-4 py-3 text-zinc-500 font-mono text-[11px]">
                          {new Date(tx.first_weighing_datetime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => {
                              setActiveCompletingTx(tx);
                              setSecondWeightInput(liveWeight > 0 ? liveWeight.toString() : '');
                            }}
                            className="inline-flex items-center gap-1.5 px-3 py-1 rounded bg-zinc-900 hover:bg-black text-white text-[11px] font-semibold transition-colors"
                          >
                            <Scale className="w-3 h-3" />
                            <span>Capture 2nd Weigh</span>
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            ) : (
              <table className="w-full text-left text-xs">
                <thead className="bg-zinc-50 text-zinc-600 font-bold border-b border-zinc-200 uppercase text-[10px]">
                  <tr>
                    <th className="px-4 py-3">Ticket #</th>
                    <th className="px-4 py-3">Vehicle</th>
                    <th className="px-4 py-3">Material</th>
                    <th className="px-4 py-3">Net Weight</th>
                    <th className="px-4 py-3 text-right">Exceptions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 text-zinc-700">
                  {filteredCompleted.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-12 text-center text-zinc-400">
                        No completed weighings found.
                      </td>
                    </tr>
                  ) : (
                    filteredCompleted.map((tx) => (
                      <tr key={tx.id} className="hover:bg-zinc-50">
                        <td className="px-4 py-3 font-mono font-bold text-zinc-900">
                          {tx.ticket_number || `#${tx.id}`}
                        </td>
                        <td className="px-4 py-3 font-mono">
                          {typeof tx.vehicle === 'object' ? tx.vehicle.license_plate : tx.vehicle_license}
                        </td>
                        <td className="px-4 py-3">
                          {typeof tx.material === 'object' ? tx.material.name : tx.material_name}
                        </td>
                        <td className="px-4 py-3 font-mono font-bold text-zinc-900">
                          {tx.net_weight ? `${Number(tx.net_weight).toLocaleString()} kg` : '-'}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => setPrintedTx(tx)}
                              className="p-1 rounded text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100"
                              title="Print Slip"
                            >
                              <Printer className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => {
                                setExceptionModalTx(tx);
                                setExceptionAction('CORRECTION');
                              }}
                              className="px-2 py-0.5 rounded text-[10px] font-semibold bg-zinc-100 hover:bg-zinc-200 text-zinc-700 border border-zinc-200"
                            >
                              Request Exception
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>

      </div>

      {/* 2nd Weighing Completion Modal */}
      {activeCompletingTx && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white border border-zinc-200 rounded-xl shadow-2xl p-6">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-200">
              <h3 className="font-bold text-sm text-zinc-900">Capture 2nd Weighing & Close Ticket</h3>
              <button onClick={() => setActiveCompletingTx(null)} className="text-zinc-400 hover:text-zinc-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-3 p-3 bg-zinc-50 border border-zinc-200 rounded-lg text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-zinc-500">Vehicle:</span>
                <span className="font-bold text-zinc-900">
                  {typeof activeCompletingTx.vehicle === 'object' ? activeCompletingTx.vehicle.license_plate : activeCompletingTx.vehicle_license}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">1st Weighing:</span>
                <span className="font-mono text-zinc-900">
                  {activeCompletingTx.gross_weight
                    ? `Gross: ${Number(activeCompletingTx.gross_weight).toLocaleString()} kg`
                    : `Tare: ${Number(activeCompletingTx.tare_weight).toLocaleString()} kg`}
                </span>
              </div>
            </div>

            <form onSubmit={handleComplete2ndWeighing} className="mt-4 space-y-3.5 text-xs">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-bold text-zinc-700 uppercase tracking-wider">
                    {activeCompletingTx.gross_weight ? 'Tare Weight (Empty kg) *' : 'Gross Weight (Loaded kg) *'}
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      const firstVal = Number(activeCompletingTx.gross_weight || activeCompletingTx.tare_weight || 14000);
                      const sim = activeCompletingTx.gross_weight
                        ? Math.max(2000, firstVal - Math.floor(Math.random() * 8000) - 2000)
                        : firstVal + Math.floor(Math.random() * 8000) + 2000;
                      setSecondWeightInput(sim.toString());
                    }}
                    className="text-[10px] text-zinc-600 hover:underline"
                  >
                    Use Live Scale Reading
                  </button>
                </div>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={secondWeightInput}
                  onChange={(e) => setSecondWeightInput(e.target.value)}
                  placeholder="e.g. 7450"
                  className="w-full bg-zinc-50 border border-zinc-200 rounded-lg p-2.5 text-base font-bold font-mono text-zinc-900 focus:outline-none focus:bg-white focus:border-zinc-800"
                />
              </div>

              {/* Lab Quality Deductions (Moisture & Impurities) */}
              <div className="p-3 bg-zinc-50 border border-zinc-200 rounded-lg space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-zinc-800 uppercase tracking-wider">
                    Lab Quality Deductions (Optional)
                  </span>
                  <span className="text-[10px] text-zinc-500 font-mono">Formula: Net - % Deducation</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] text-zinc-600 font-medium mb-1">
                      Moisture Content (%)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max="100"
                      value={moisturePct}
                      onChange={(e) => setMoisturePct(e.target.value)}
                      placeholder="0.0"
                      className="w-full bg-white border border-zinc-200 rounded px-2 py-1 text-xs font-mono text-zinc-900 focus:outline-none focus:border-zinc-800"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-zinc-600 font-medium mb-1">
                      Impurities / Foreign (%)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max="100"
                      value={impurityPct}
                      onChange={(e) => setImpurityPct(e.target.value)}
                      placeholder="0.0"
                      className="w-full bg-white border border-zinc-200 rounded px-2 py-1 text-xs font-mono text-zinc-900 focus:outline-none focus:border-zinc-800"
                    />
                  </div>
                </div>
              </div>

              {secondWeightInput && (
                <div className="p-3 bg-zinc-100 border border-zinc-200 rounded-lg space-y-1.5 text-xs">
                  {(() => {
                    const firstVal = Number(activeCompletingTx.gross_weight || activeCompletingTx.tare_weight || 0);
                    const secVal = parseFloat(secondWeightInput) || 0;
                    const rawNet = activeCompletingTx.gross_weight ? Math.max(0, firstVal - secVal) : Math.max(0, secVal - firstVal);
                    const mVal = parseFloat(moisturePct) || 0;
                    const iVal = parseFloat(impurityPct) || 0;
                    const dedKg = Math.round(rawNet * ((mVal + iVal) / 100));
                    const payNet = rawNet - dedKg;
                    return (
                      <>
                        <div className="flex justify-between items-center text-zinc-600">
                          <span>Raw Net Weight:</span>
                          <span className="font-mono font-bold text-zinc-800">{rawNet.toLocaleString()} kg</span>
                        </div>
                        {(mVal > 0 || iVal > 0) && (
                          <div className="flex justify-between items-center text-zinc-500 text-[11px]">
                            <span>Total Deduction ({(mVal + iVal).toFixed(1)}%):</span>
                            <span className="font-mono text-zinc-700">-{dedKg.toLocaleString()} kg</span>
                          </div>
                        )}
                        <div className="flex justify-between items-center text-zinc-900 font-bold pt-1 border-t border-zinc-200">
                          <span>Payable / Commercial Net:</span>
                          <span className="font-mono text-sm">{payNet.toLocaleString()} kg</span>
                        </div>
                      </>
                    );
                  })()}
                </div>
              )}

              {/* Manual Override Flag for 2nd Weighing */}
              <div className="p-3 bg-zinc-50 border border-zinc-200 rounded-lg space-y-2">
                <label className="flex items-center gap-2 cursor-pointer text-zinc-800 font-medium">
                  <input
                    type="checkbox"
                    checked={secondIsManual}
                    onChange={(e) => setSecondIsManual(e.target.checked)}
                    className="rounded text-zinc-900 focus:ring-0"
                  />
                  <span>Manual Entry Override</span>
                </label>
                {secondIsManual && (
                  <div className="pt-1 border-t border-zinc-200">
                    <label className="block text-[10px] uppercase font-bold text-zinc-600 mb-1">
                      Override Justification *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Indicator serial communication timeout"
                      value={secondManualReason}
                      onChange={(e) => setSecondManualReason(e.target.value)}
                      className="w-full bg-white border border-zinc-300 rounded p-1.5 text-zinc-900"
                    />
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-zinc-200">
                <button
                  type="button"
                  onClick={() => setActiveCompletingTx(null)}
                  className="px-3 py-1.5 rounded-lg border border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-1.5 rounded-lg bg-zinc-900 hover:bg-black text-white font-semibold shadow-sm"
                >
                  {submitting ? 'Completing...' : 'Complete & Generate Ticket'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Auto-Opened Printable Ticket Slip Dialog */}
      {printedTx && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white border border-zinc-200 rounded-2xl shadow-2xl p-6 print:m-0 print:p-2">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-200 print:hidden">
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-zinc-900" />
                <h3 className="font-bold text-sm text-zinc-900">Weighbridge Certificate Slip</h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-black text-white text-xs font-semibold"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print Slip</span>
                </button>
                <button
                  onClick={() => setPrintedTx(null)}
                  className="p-1 rounded text-zinc-400 hover:text-zinc-600"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Official Slip Content */}
            <div className="mt-4 p-5 border border-zinc-300 rounded-xl text-xs space-y-4 bg-white">
              <div className="text-center pb-3 border-b border-zinc-200">
                <h4 className="font-black text-base uppercase tracking-wider text-zinc-900">SMART-WEIGH SYSTEM</h4>
                <p className="text-[10px] text-zinc-500 font-medium">OFFICIAL WEIGHBRIDGE WEIGHT SLIP</p>
                <p className="font-mono font-bold text-xs mt-1 text-zinc-900">
                  {printedTx.ticket_number || `#TX-${printedTx.id}`}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 text-[11px]">
                <div>
                  <span className="text-zinc-500 block">Vehicle Plate</span>
                  <span className="font-mono font-bold text-zinc-900">
                    {typeof printedTx.vehicle === 'object' ? printedTx.vehicle.license_plate : printedTx.vehicle_license}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-zinc-500 block">Material</span>
                  <span className="font-semibold text-zinc-900">
                    {typeof printedTx.material === 'object' ? printedTx.material.name : printedTx.material_name}
                  </span>
                </div>
              </div>

              <div className="border-t border-b border-zinc-200 py-2.5 space-y-1 font-mono text-xs">
                <div className="flex justify-between">
                  <span>Gross Weight:</span>
                  <span className="font-bold text-zinc-900">{Number(printedTx.gross_weight || 0).toLocaleString()} kg</span>
                </div>
                <div className="flex justify-between">
                  <span>Tare Weight:</span>
                  <span className="font-bold text-zinc-900">{Number(printedTx.tare_weight || 0).toLocaleString()} kg</span>
                </div>
                <div className="flex justify-between font-bold text-zinc-800">
                  <span>Raw Net Weight:</span>
                  <span>{Number(printedTx.net_weight || 0).toLocaleString()} kg</span>
                </div>
                {(printedTx.deduction_kg > 0 || printedTx.moisture_pct > 0 || printedTx.impurity_pct > 0) && (
                  <>
                    <div className="flex justify-between text-zinc-600 text-[11px] pt-1 border-t border-dashed border-zinc-200">
                      <span>Lab Deductions (M: {printedTx.moisture_pct}%, I: {printedTx.impurity_pct}%):</span>
                      <span className="font-bold text-zinc-800">-{Number(printedTx.deduction_kg || 0).toLocaleString()} kg</span>
                    </div>
                    <div className="flex justify-between text-sm font-bold text-zinc-900 pt-1 border-t border-zinc-200">
                      <span>CERTIFIED PAYABLE NET:</span>
                      <span>{Number(printedTx.payable_net_kg || printedTx.net_weight || 0).toLocaleString()} kg</span>
                    </div>
                  </>
                )}
                {!(printedTx.deduction_kg > 0 || printedTx.moisture_pct > 0 || printedTx.impurity_pct > 0) && (
                  <div className="flex justify-between text-sm font-bold text-zinc-900 pt-1 border-t border-zinc-100">
                    <span>CERTIFIED NET:</span>
                    <span>{Number(printedTx.net_weight || 0).toLocaleString()} kg</span>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-6 pt-4 text-[10px] text-center text-zinc-500">
                <div className="border-t border-zinc-300 pt-1">Operator Signature</div>
                <div className="border-t border-zinc-300 pt-1">Driver Signature</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Exception Request Dialog */}
      {exceptionModalTx && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white border border-zinc-200 rounded-xl shadow-2xl p-6">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-200">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-zinc-900" />
                <h3 className="font-bold text-sm text-zinc-900">Submit Exception Request</h3>
              </div>
              <button onClick={() => setExceptionModalTx(null)} className="text-zinc-400 hover:text-zinc-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleExceptionSubmit} className="mt-4 space-y-3.5 text-xs">
              <div>
                <label className="block text-[11px] font-bold text-zinc-700 uppercase tracking-wider mb-1">
                  Requested Action *
                </label>
                <select
                  value={exceptionAction}
                  onChange={(e: any) => setExceptionAction(e.target.value)}
                  className="w-full bg-zinc-50 border border-zinc-200 rounded-lg p-2 text-zinc-900 focus:outline-none focus:border-zinc-800"
                >
                  <option value="CORRECTION">Weight Correction</option>
                  <option value="REVERSAL">Transaction Reversal</option>
                  <option value="CANCELLATION">Ticket Cancellation</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-zinc-700 uppercase tracking-wider mb-1">
                  Operator Justification / Reason *
                </label>
                <textarea
                  rows={3}
                  required
                  value={exceptionReason}
                  onChange={(e) => setExceptionReason(e.target.value)}
                  placeholder="Describe the discrepancy for the Supervisor to review..."
                  className="w-full bg-zinc-50 border border-zinc-200 rounded-lg p-2 text-zinc-900 focus:outline-none focus:bg-white focus:border-zinc-800"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-zinc-200">
                <button
                  type="button"
                  onClick={() => setExceptionModalTx(null)}
                  className="px-3 py-1.5 rounded-lg border border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={exceptionSubmitting}
                  className="px-4 py-1.5 rounded-lg bg-zinc-900 hover:bg-black text-white font-semibold"
                >
                  {exceptionSubmitting ? 'Submitting...' : 'Submit to Supervisor'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Threshold Breach Warning Modal */}
      {thresholdModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-rose-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start gap-3.5 border-b border-rose-100 pb-4">
              <div className="p-3 bg-rose-100 text-rose-700 rounded-xl">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-base text-zinc-900">Operational Limit Exceeded</h3>
                <p className="text-xs text-rose-600 font-medium mt-0.5">
                  Weighbridge safety threshold breach detected. Direct completion is locked.
                </p>
              </div>
              <button
                onClick={() => setThresholdModal(null)}
                className="text-zinc-400 hover:text-zinc-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="my-4 space-y-3">
              {thresholdModal.violations.map((v, i) => (
                <div key={i} className="p-3 rounded-xl bg-rose-50/70 border border-rose-200 text-xs space-y-1.5 font-sans">
                  <div className="flex items-center justify-between font-bold text-rose-900">
                    <span className="flex items-center gap-1.5">
                      <ShieldAlert className="w-4 h-4 text-rose-600" />
                      {v.rule}
                    </span>
                    <span className="font-mono bg-rose-200/80 px-2 py-0.5 rounded text-[10px]">
                      +{v.delta} kg ({v.delta_pct}%)
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-700 font-mono leading-relaxed">
                    {v.message}
                  </p>
                  <div className="grid grid-cols-2 gap-2 pt-1 border-t border-rose-200/60 font-mono text-[11px]">
                    <div>
                      <span className="text-zinc-500 block text-[10px]">Captured Weight</span>
                      <span className="font-bold text-zinc-900">{v.actual} kg</span>
                    </div>
                    <div>
                      <span className="text-zinc-500 block text-[10px]">Allowed Limit</span>
                      <span className="font-bold text-zinc-900">{v.limit} kg</span>
                    </div>
                  </div>
                </div>
              ))}

              <div className="p-3 rounded-xl bg-zinc-50 border border-zinc-200 text-xs">
                <label className="block text-[11px] font-bold text-zinc-700 uppercase tracking-wider mb-1">
                  Operator Discrepancy Note (Forwarded to Supervisor)
                </label>
                <textarea
                  rows={2}
                  value={thresholdOperatorNote}
                  onChange={(e) => setThresholdOperatorNote(e.target.value)}
                  placeholder="e.g. Verified customer overweight permit / heavy wet payload..."
                  className="w-full bg-white border border-zinc-200 rounded-lg p-2 text-zinc-900 focus:outline-none focus:border-zinc-800 text-xs"
                />
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 pt-3 border-t border-zinc-200 text-xs">
              <button
                type="button"
                onClick={() => setThresholdModal(null)}
                className="px-4 py-2 rounded-lg border border-zinc-200 bg-white hover:bg-zinc-100 text-zinc-700 font-semibold"
              >
                Re-weigh / Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmThresholdException}
                disabled={thresholdSubmitting}
                className="px-4 py-2 rounded-lg bg-zinc-900 hover:bg-black text-white font-semibold flex items-center gap-1.5 shadow-sm disabled:opacity-50"
              >
                <ShieldAlert className="w-4 h-4 text-amber-400" />
                <span>{thresholdSubmitting ? 'Routing...' : 'Route to Supervisor Queue'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
