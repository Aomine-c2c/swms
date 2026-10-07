'use client';

import React, { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { 
  Scale, 
  ArrowUpRight, 
  Clock, 
  CheckCircle, 
  AlertTriangle, 
  Truck, 
  RotateCw,
  Search,
  Check,
  TrendingUp,
  Zap,
  Layers,
  FileText,
  X,
  Gauge,
  ArrowRight,
  Wifi,
  BarChart3,
  Activity,
  Printer,
  ExternalLink
} from 'lucide-react';
import { api } from '@/lib/api';
import { WeighingTransaction, Vehicle, Material, Driver, Supplier } from '@/types';
import { RouteGuard } from '@/components/auth/RouteGuard';
import { useScale } from '@/lib/scale-context';

export default function DashboardPage() {
  const { liveWeight, isStable, zeroScale, simulateWeight, isConnected, connectionStatus, reconnect } = useScale();

  const [stats, setStats] = useState({
    todayTransactions: 0,
    openTransactions: 0,
    pendingApprovals: 0,
    todayTonnage: 0,
  });

  const [materialsMoved, setMaterialsMoved] = useState<{ material__name: string; total_weight: number }[]>([]);
  const [trends, setTrends] = useState<{ first_weighing_datetime__date: string; count: number; tonnage?: number }[]>([]);
  const [openQueue, setOpenQueue] = useState<WeighingTransaction[]>([]);
  const [recentTransactions, setRecentTransactions] = useState<WeighingTransaction[]>([]);
  const [loading, setLoading] = useState(true);

  // Live scale sparkline history (last 16 telemetry points)
  const [weightHistory, setWeightHistory] = useState<number[]>([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);

  // Filter & Search in Table
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'Completed' | 'Pending Verification'>('ALL');
  const [trendMetric, setTrendMetric] = useState<'count' | 'tonnage'>('count');

  // Quick 1st Weighing Modal
  const [isQuickWeighModalOpen, setIsQuickWeighModalOpen] = useState(false);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);

  const [formVehicle, setFormVehicle] = useState('');
  const [formMaterial, setFormMaterial] = useState('');
  const [formDriver, setFormDriver] = useState('');
  const [formSupplier, setFormSupplier] = useState('');
  const [formWeighingType, setFormWeighingType] = useState<'gross' | 'tare'>('gross');
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Quick 2nd Weighing Modal
  const [activeCompletingTx, setActiveCompletingTx] = useState<WeighingTransaction | null>(null);
  const [completingWeight, setCompletingWeight] = useState<string>('');
  const [completingSubmitting, setCompletingSubmitting] = useState(false);
  const [completingError, setCompletingError] = useState<string | null>(null);

  // In-cockpit Ticket Preview Modal
  const [previewTicketTx, setPreviewTicketTx] = useState<WeighingTransaction | null>(null);
  const [previewFormat, setPreviewFormat] = useState<'A4' | 'THERMAL'>('A4');
  const [isReprinting, setIsReprinting] = useState(false);

  // Update telemetry sparkline on live weight change
  useEffect(() => {
    setWeightHistory((prev) => {
      const next = [...prev.slice(1), liveWeight];
      return next;
    });
  }, [liveWeight]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const [txRes, openRes, operatorSummaryRes, managerSummaryRes, approvalsRes, masterRes] = await Promise.allSettled([
        api.get('/transactions/?page_size=40'),
        api.get('/transactions/?status=Open&page_size=20'),
        api.get('/reports/dashboard/operator_summary/'),
        api.get('/reports/dashboard/manager_summary/'),
        api.get('/approvals/?status=PENDING&page_size=100'),
        Promise.all([
          api.get('/vehicles/?status=Active'),
          api.get('/materials/?status=Active'),
          api.get('/drivers/?status=Active'),
          api.get('/suppliers/?status=Active')
        ])
      ]);

      if (txRes.status === 'fulfilled') {
        const txData = txRes.value.data.results || txRes.value.data || [];
        setRecentTransactions(txData);
      }

      if (openRes.status === 'fulfilled') {
        const openData = openRes.value.data.results || openRes.value.data || [];
        setOpenQueue(openData);
      }

      let openCount = 0;
      let completedCount = 0;
      let totalTon = 0;

      if (operatorSummaryRes.status === 'fulfilled') {
        const summary = operatorSummaryRes.value.data;
        openCount = summary.open_transactions ?? summary.open_count ?? 0;
      }

      if (managerSummaryRes.status === 'fulfilled') {
        const mgr = managerSummaryRes.value.data;
        totalTon = Number(mgr.daily_tonnage || 0);
        completedCount = mgr.vehicle_count || 0;
        setMaterialsMoved(mgr.materials_moved || []);
        setTrends(mgr.transaction_trends || []);
      }

      let pendingAppCount = 0;
      if (approvalsRes.status === 'fulfilled') {
        const appData = approvalsRes.value.data;
        if (appData.count !== undefined) {
          pendingAppCount = appData.count;
        } else {
          const approvals = appData.results || appData || [];
          pendingAppCount = Array.isArray(approvals) ? approvals.length : 0;
        }
      }

      setStats({
        todayTransactions: completedCount,
        openTransactions: openCount,
        pendingApprovals: pendingAppCount,
        todayTonnage: totalTon,
      });

      if (masterRes.status === 'fulfilled') {
        const [v, m, d, s] = masterRes.value;
        setVehicles(v.data.results || v.data || []);
        setMaterials(m.data.results || m.data || []);
        setDrivers(d.data.results || d.data || []);
        setSuppliers(s.data.results || s.data || []);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const handleOpenQuick1st = () => {
    setFormVehicle('');
    setFormMaterial('');
    setFormDriver('');
    setFormSupplier('');
    setFormWeighingType('gross');
    setFormError(null);
    setIsQuickWeighModalOpen(true);
  };

  const handleVehicleSelect = (vId: string) => {
    setFormVehicle(vId);
    const sel = vehicles.find((v) => v.id.toString() === vId);
    if (sel?.default_driver) {
      setFormDriver(sel.default_driver.toString());
    }
  };

  const handleSubmitQuick1st = async (e: React.FormEvent) => {
    e.preventDefault();
    if (liveWeight <= 0) {
      setFormError('Scale reading is zero. Please place truck or simulate scale weight.');
      return;
    }
    setFormSubmitting(true);
    setFormError(null);

    try {
      const payload: any = {
        vehicle: parseInt(formVehicle),
        material: parseInt(formMaterial),
        first_weighing_datetime: new Date().toISOString(),
      };
      if (formDriver) payload.driver = parseInt(formDriver);
      if (formSupplier) payload.supplier = parseInt(formSupplier);

      if (formWeighingType === 'gross') {
        payload.gross_weight = liveWeight;
      } else {
        payload.tare_weight = liveWeight;
      }

      await api.post('/transactions/', payload);
      setIsQuickWeighModalOpen(false);
      zeroScale();
      fetchDashboardData();
    } catch (err: any) {
      setFormError(err.response?.data?.error || JSON.stringify(err.response?.data || 'Weighing submission failed.'));
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleOpenQuick2nd = (tx: WeighingTransaction) => {
    setActiveCompletingTx(tx);
    setCompletingWeight(liveWeight > 0 ? liveWeight.toString() : '');
    setCompletingError(null);
  };

  const handleSubmitQuick2nd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCompletingTx) return;
    const wVal = parseFloat(completingWeight);
    if (isNaN(wVal) || wVal <= 0) {
      setCompletingError('Enter a valid scale reading greater than zero.');
      return;
    }

    setCompletingSubmitting(true);
    setCompletingError(null);
    try {
      await api.post(`/transactions/${activeCompletingTx.id}/complete/`, {
        weight: wVal,
      });
      setActiveCompletingTx(null);
      zeroScale();
      fetchDashboardData();
    } catch (err: any) {
      setCompletingError(err.response?.data?.error || JSON.stringify(err.response?.data || 'Failed to complete transaction.'));
    } finally {
      setCompletingSubmitting(false);
    }
  };

  const filteredTransactions = useMemo(() => {
    return recentTransactions.filter((tx) => {
      if (tx.status === 'Open') return false; // Open items live in the Yard Queue panel

      const q = search.toLowerCase();
      const ticketStr = (tx.ticket_number || `#${tx.id}`).toLowerCase();
      const vehicleStr = (
        tx.vehicle_details?.license_plate || 
        (typeof tx.vehicle === 'object' && tx.vehicle ? tx.vehicle.license_plate : '') || 
        tx.vehicle_license || 
        ''
      ).toLowerCase();
      const materialStr = (
        tx.material_details?.name || 
        (typeof tx.material === 'object' && tx.material ? tx.material.name : '') || 
        tx.material_name || 
        ''
      ).toLowerCase();
      const driverStr = (
        tx.driver_details?.name || 
        (typeof tx.driver === 'object' && tx.driver ? tx.driver.name : '') || 
        tx.driver_name || 
        ''
      ).toLowerCase();

      const matchesSearch = ticketStr.includes(q) || vehicleStr.includes(q) || materialStr.includes(q) || driverStr.includes(q);
      if (!matchesSearch) return false;

      if (statusFilter === 'ALL') return true;
      return tx.status === statusFilter;
    });
  }, [recentTransactions, search, statusFilter]);

  const maxTrend = useMemo(() => {
    if (!trends.length) return 1;
    return Math.max(...trends.map((t) => t.count), 1);
  }, [trends]);

  const maxTonnageTrend = useMemo(() => {
    if (!trends.length) return 1;
    return Math.max(...trends.map((t) => Number(t.tonnage || 0)), 1);
  }, [trends]);

  const totalCommodityKg = useMemo(() => {
    return materialsMoved.reduce((acc, m) => acc + (Number(m.total_weight) || 0), 0);
  }, [materialsMoved]);

  const isScaleOccupied = liveWeight > 500;
  const trafficLightState = isScaleOccupied ? 'RED' : 'GREEN';

  // Generate SVG path for live telemetry sparkline (width: 120, height: 26)
  const sparklinePoints = useMemo(() => {
    const maxVal = Math.max(...weightHistory, 1000);
    const w = 120;
    const h = 26;
    const step = w / (weightHistory.length - 1);
    const coords = weightHistory.map((val, i) => {
      const x = i * step;
      const y = h - (val / maxVal) * (h - 4) - 2;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });
    return coords.join(' ');
  }, [weightHistory]);

  // Generate SVG path for 7-Day smooth continuous line graph (width: 400, height: 120)
  const trendLineSvg = useMemo(() => {
    if (trends.length < 2) return null;
    const w = 400;
    const h = 120;
    const step = w / (trends.length - 1);
    const isCount = trendMetric === 'count';
    const maxVal = isCount ? maxTrend : maxTonnageTrend;
    
    const points = trends.map((t, i) => {
      const val = isCount ? t.count : Number(t.tonnage || 0);
      const x = i * step;
      const y = h - (val / (maxVal || 1)) * (h - 28) - 14;
      return { x, y, raw: val };
    });

    const dLine = points.reduce((acc, p, i) => {
      return i === 0 ? `M ${p.x} ${p.y}` : `${acc} L ${p.x} ${p.y}`;
    }, '');

    const dArea = `${dLine} L ${w} ${h} L 0 ${h} Z`;

    return { points, dLine, dArea, isCount };
  }, [trends, maxTrend, maxTonnageTrend, trendMetric]);

  return (
    <RouteGuard permission="view_dashboards" roles={['Administrator', 'Manager', 'Supervisor', 'Operator', 'Weighbridge Operator']}>
      {/* STRICT VIEWPORT WRAPPER: fits completely without outer page scrolling */}
      <div className="h-[calc(100vh-5rem)] flex flex-col gap-3 min-w-0 overflow-hidden">
        
        {/* COMPACT INDUSTRIAL COCKPIT HEADER WITH LIVE SCALE SPARKLINE */}
        <div className="shrink-0 rounded-xl bg-zinc-950 text-white px-4 py-3 border border-zinc-800 shadow-md">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            
            {/* Left Identity & Telemetry Sparkline */}
            <div className="flex items-center gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-mono text-[9px] font-bold tracking-wider">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    BAY-01 ACTIVE
                  </span>
                  <span className="text-zinc-500 text-xs hidden sm:inline font-mono">• SMART WEIGHBRIDGE COCKPIT</span>
                </div>
                <h1 className="text-base sm:text-lg font-black tracking-tight text-white mt-0.5">
                  Terminal Command Center
                </h1>
              </div>

              {/* Real-Time Live Scale Sparkline Graph */}
              <div className="hidden lg:flex items-center gap-2 bg-zinc-900/90 border border-zinc-800 px-3 py-1.5 rounded-lg shadow-inner">
                <div className="flex flex-col">
                  <span className="text-[8px] font-mono font-bold text-zinc-500 uppercase tracking-wider flex items-center gap-1">
                    <Activity className="w-2.5 h-2.5 text-emerald-400" />
                    SCALE STREAM
                  </span>
                  <span className="text-[10px] font-mono text-zinc-300 font-semibold">{liveWeight} kg</span>
                </div>
                <svg width="120" height="26" className="overflow-visible">
                  <polyline
                    fill="none"
                    stroke="#10b981"
                    strokeWidth="1.75"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    points={sparklinePoints}
                  />
                </svg>
              </div>
            </div>

            {/* Right Telemetry & Actions */}
            <div className="flex items-center gap-3 self-end md:self-auto">
              {/* Traffic Light Signal */}
              <div className="flex items-center gap-1.5 bg-zinc-900 border border-zinc-800 px-2 py-1 rounded-lg shadow-inner">
                <span className="text-[9px] font-mono font-bold text-zinc-500 uppercase">SIGNAL</span>
                <div className="flex items-center gap-1 p-0.5 rounded bg-black border border-zinc-800">
                  <div 
                    className={`w-2.5 h-2.5 rounded-full ${
                      trafficLightState === 'RED' ? 'bg-rose-500 shadow-[0_0_6px_#f43f5e]' : 'bg-zinc-800'
                    }`} 
                    title="Scale Occupied"
                  />
                  <div 
                    className={`w-2.5 h-2.5 rounded-full ${
                      trafficLightState === 'GREEN' ? 'bg-emerald-400 shadow-[0_0_6px_#34d399]' : 'bg-zinc-800'
                    }`} 
                    title="Scale Clear"
                  />
                </div>
              </div>

              {/* 7-Segment Digital Indicator */}
              <div className="bg-black border border-zinc-800 rounded-lg px-3 py-1 flex items-center gap-2 shadow-inner">
                <div className="text-right">
                  <div className="flex items-center justify-end gap-1 text-[8px] font-mono text-zinc-500 uppercase">
                    <span className={`w-1.5 h-1.5 rounded-full ${isStable ? 'bg-emerald-400' : 'bg-amber-400 animate-ping'}`} />
                    <span className={isStable ? 'text-emerald-400 font-bold' : 'text-amber-400'}>
                      {isStable ? 'STABLE' : 'MOTION'}
                    </span>
                  </div>
                  <div className="font-mono text-xl sm:text-2xl font-black text-emerald-400 tracking-wider tabular-nums leading-tight drop-shadow-[0_0_8px_rgba(52,211,153,0.35)]">
                    {liveWeight.toString().padStart(6, ' ')}{' '}
                    <span className="text-[10px] text-emerald-600 font-sans">KG</span>
                  </div>
                </div>

                <div className="flex flex-col gap-1 pl-2 border-l border-zinc-800">
                  <button
                    onClick={() => simulateWeight(Math.floor(Math.random() * 22000) + 12000)}
                    className="px-1.5 py-0.5 text-[9px] font-mono font-bold rounded bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-700/60"
                    title="Simulate truck on scale"
                  >
                    TRUCK
                  </button>
                  <button
                    onClick={zeroScale}
                    className="px-1.5 py-0.5 text-[9px] font-mono font-bold rounded bg-zinc-900 hover:bg-zinc-800 text-zinc-400 border border-zinc-800"
                    title="Zero scale"
                  >
                    ZERO
                  </button>
                </div>
              </div>

              {/* Quick Actions */}
              <button
                onClick={handleOpenQuick1st}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-black text-xs transition-all shadow-md shadow-emerald-500/20 active:scale-95"
              >
                <Zap className="w-3.5 h-3.5 fill-zinc-950" />
                <span>1st Weigh</span>
              </button>

              <button
                onClick={fetchDashboardData}
                disabled={loading}
                className="p-2 rounded-lg border border-zinc-800 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 transition-colors"
                title="Refresh Metrics"
              >
                <RotateCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>

          </div>
        </div>

        {/* COMPACT KPI ROW (4 Cards) */}
        <div className="shrink-0 grid grid-cols-2 lg:grid-cols-4 gap-2.5">
          <div className="px-3.5 py-2.5 rounded-xl bg-white border border-zinc-200/90 shadow-2xs flex items-center justify-between">
            <div>
              <p className="text-[9px] font-mono font-bold uppercase tracking-wider text-zinc-400">Completed Today</p>
              <h3 className="text-xl font-black text-zinc-900 font-mono tracking-tight mt-0.5">{stats.todayTransactions}</h3>
              <p className="text-[9px] text-emerald-600 font-bold flex items-center gap-0.5">
                <Check className="w-2.5 h-2.5" /> Certified
              </p>
            </div>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center border border-emerald-100">
              <CheckCircle className="w-4 h-4" />
            </div>
          </div>

          <div className="px-3.5 py-2.5 rounded-xl bg-white border border-zinc-200/90 shadow-2xs flex items-center justify-between">
            <div>
              <p className="text-[9px] font-mono font-bold uppercase tracking-wider text-zinc-400">Yard Lane Queue</p>
              <h3 className="text-xl font-black text-zinc-900 font-mono tracking-tight mt-0.5">{stats.openTransactions}</h3>
              <p className="text-[9px] text-amber-600 font-bold flex items-center gap-0.5">
                <Clock className="w-2.5 h-2.5" /> In Facility
              </p>
            </div>
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center border border-amber-100">
              <Truck className="w-4 h-4" />
            </div>
          </div>

          <div className="px-3.5 py-2.5 rounded-xl bg-white border border-zinc-200/90 shadow-2xs flex items-center justify-between">
            <div>
              <p className="text-[9px] font-mono font-bold uppercase tracking-wider text-zinc-400">Total Net Mass</p>
              <h3 className="text-xl font-black text-zinc-900 font-mono tracking-tight mt-0.5">
                {(stats.todayTonnage / 1000).toFixed(1)} <span className="text-[10px] font-normal text-zinc-400">t</span>
              </h3>
              <p className="text-[9px] text-zinc-500 font-mono">
                {stats.todayTonnage.toLocaleString()} kg
              </p>
            </div>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center border border-blue-100">
              <Scale className="w-4 h-4" />
            </div>
          </div>

          <div className="px-3.5 py-2.5 rounded-xl bg-white border border-zinc-200/90 shadow-2xs flex items-center justify-between">
            <div>
              <p className="text-[9px] font-mono font-bold uppercase tracking-wider text-zinc-400">Pending Approvals</p>
              <h3 className="text-xl font-black text-zinc-900 font-mono tracking-tight mt-0.5">{stats.pendingApprovals}</h3>
              <p className="text-[9px] text-rose-600 font-bold">
                <Link href="/approvals" className="hover:underline flex items-center gap-0.5">
                  Exceptions <ArrowRight className="w-2.5 h-2.5" />
                </Link>
              </p>
            </div>
            <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-700 flex items-center justify-center border border-rose-100">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
        </div>

        {/* 2 COMPREHENSIVE INDUSTRIAL PANES: STACKED OPERATIONS (7 COLS) + REAL-TIME TELEMETRY & ANALYTICS (5 COLS) */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-3 min-h-0 min-w-0 overflow-hidden">
          
          {/* LEFT 7 COLUMNS: OPERATIONAL COMMAND CENTER (DISPATCHER & CERTIFIED SLIPS STACKED VERTICALLY) */}
          <div className="lg:col-span-7 flex flex-col gap-3 min-h-0 min-w-0 overflow-hidden">
            
            {/* TOP SUB-CARD: YARD LANE DISPATCHER (Expansive horizontal lane queue) */}
            <div className="shrink-0 max-h-[165px] rounded-xl bg-white border border-zinc-200/90 shadow-2xs flex flex-col min-h-0 min-w-0 overflow-hidden">
              {/* Header */}
              <div className="shrink-0 px-3 py-2 border-b border-zinc-200/80 bg-zinc-50/70 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-1 rounded bg-zinc-900 text-white">
                    <Truck className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <h2 className="text-xs font-bold text-zinc-900 leading-none">Yard Lane Dispatcher</h2>
                    <p className="text-[10px] text-zinc-400 mt-0.5">Vehicles currently in yard awaiting 2nd return weigh</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-50 text-amber-800 border border-amber-200">
                    {openQueue.length} Active in Lane
                  </span>
                  <Link href="/transactions" className="text-zinc-600 hover:text-zinc-900 text-[10px] font-bold flex items-center gap-0.5">
                    Console <ArrowUpRight className="w-3 h-3" />
                  </Link>
                </div>
              </div>

              {/* Lane items list */}
              <div className="flex-1 overflow-y-auto divide-y divide-zinc-100 p-1 min-h-0">
                {openQueue.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-center p-4 text-zinc-400 text-xs">
                    <CheckCircle className="w-4 h-4 text-emerald-500 mr-1.5" />
                    All weigh cycles completed. No open trucks in yard lane.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5 p-1">
                    {openQueue.map((tx) => {
                      const license = tx.vehicle_details?.license_plate || (typeof tx.vehicle === 'object' && tx.vehicle ? tx.vehicle.license_plate : '') || tx.vehicle_license || (tx.vehicle ? `Truck #${tx.vehicle}` : 'Truck -');
                      const mat = tx.material_details?.name || (typeof tx.material === 'object' && tx.material ? tx.material.name : '') || tx.material_name || (tx.material ? `Material #${tx.material}` : 'Bulk Cargo');
                      const driver = tx.driver_details?.name || (typeof tx.driver === 'object' && tx.driver ? tx.driver.name : '') || tx.driver_name || 'Assigned Driver';
                      const weightRecorded = tx.gross_weight 
                        ? `${Number(tx.gross_weight).toLocaleString()} kg (Gross)` 
                        : `${Number(tx.tare_weight).toLocaleString()} kg (Tare)`;

                      return (
                        <div key={tx.id} className="p-2 bg-zinc-50/70 hover:bg-zinc-100/80 border border-zinc-200/60 rounded-lg transition-colors flex items-center justify-between gap-2">
                          <div className="min-w-0 space-y-0.5">
                            <div className="flex items-center gap-1.5">
                              <span className="px-1.5 py-0.5 rounded font-mono text-[10px] font-black bg-zinc-900 text-white">
                                {license}
                              </span>
                              <span className="text-[9px] font-mono text-zinc-400 truncate">
                                {tx.ticket_number || `#${tx.id}`}
                              </span>
                            </div>
                            <div className="text-[10px] text-zinc-600 truncate">
                              <span className="font-semibold text-zinc-800">{mat}</span> • <span className="font-mono text-zinc-500">{weightRecorded}</span>
                            </div>
                            <div className="text-[9px] text-zinc-400 truncate">
                              Driver: {driver}
                            </div>
                          </div>

                          <button
                            onClick={() => handleOpenQuick2nd(tx)}
                            className="px-2.5 py-1.5 rounded-lg bg-zinc-900 hover:bg-black text-white text-[10px] font-bold transition-all shadow-2xs flex items-center gap-1 shrink-0 active:scale-95"
                          >
                            <span>2nd Weigh</span>
                            <ArrowRight className="w-3 h-3" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* BOTTOM SUB-CARD: LIVE CERTIFIED SLIPS TABLE (Takes remaining height) */}
            <div className="flex-1 rounded-xl bg-white border border-zinc-200/90 shadow-2xs flex flex-col min-h-0 min-w-0 overflow-hidden">
              
              {/* Header with Search and Status Dropdown Filter */}
              <div className="shrink-0 p-2.5 border-b border-zinc-200/80 bg-zinc-50/70 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <FileText className="w-3.5 h-3.5 text-zinc-700" />
                  <span className="text-xs font-bold text-zinc-900">Certified Weighing Slips</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-zinc-200/70 text-zinc-700">
                    {filteredTransactions.length} Certified
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="w-3 h-3 absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400" />
                    <input
                      type="text"
                      placeholder="Search ticket, plate, driver..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="pl-7 pr-2.5 py-1 text-[11px] bg-white border border-zinc-200 rounded-lg text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-zinc-800 w-44"
                    />
                  </div>

                  {/* Clean Filter Dropdown */}
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as any)}
                    className="px-2 py-1 text-[11px] font-medium bg-white border border-zinc-200 rounded-lg text-zinc-700 focus:outline-none focus:border-zinc-800"
                  >
                    <option value="ALL">All Statuses</option>
                    <option value="Completed">Completed Only</option>
                    <option value="Pending Verification">Pending Only</option>
                  </select>
                </div>
              </div>

              {/* Table Body */}
              <div className="flex-1 overflow-y-auto min-h-0">
                <table className="w-full text-left text-xs">
                  <thead className="bg-zinc-50 text-zinc-500 font-bold border-b border-zinc-200/80 uppercase text-[9px] tracking-wider sticky top-0 z-10">
                    <tr>
                      <th className="px-3 py-2">Ticket / Date</th>
                      <th className="px-3 py-2">Vehicle</th>
                      <th className="px-3 py-2">Commodity</th>
                      <th className="px-3 py-2 text-right">Net Weight</th>
                      <th className="px-3 py-2">Status</th>
                      <th className="px-3 py-2 text-right">Slip</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 text-zinc-700">
                    {filteredTransactions.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-3 py-10 text-center text-zinc-400 text-xs">
                          No certified tickets found matching search query.
                        </td>
                      </tr>
                    ) : (
                      filteredTransactions.map((tx) => {
                        const ticketStr = tx.ticket_number || `#${tx.id.toString().padStart(4, '0')}`;
                        const plate = tx.vehicle_details?.license_plate || (typeof tx.vehicle === 'object' && tx.vehicle ? tx.vehicle.license_plate : '') || tx.vehicle_license || (tx.vehicle ? `Truck #${tx.vehicle}` : '-');
                        const mat = tx.material_details?.name || (typeof tx.material === 'object' && tx.material ? tx.material.name : '') || tx.material_name || (tx.material ? `Material #${tx.material}` : '-');

                        return (
                          <tr key={tx.id} className="hover:bg-zinc-50/80 transition-colors">
                            <td className="px-3 py-2">
                              <span className="font-mono font-bold text-zinc-900 block leading-tight">{ticketStr}</span>
                              <span className="text-[9px] font-mono text-zinc-400">
                                {new Date(tx.first_weighing_datetime).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </td>

                            <td className="px-3 py-2">
                              <span className="inline-block px-1.5 py-0.5 rounded font-mono font-bold text-[10px] text-zinc-900 bg-zinc-100 border border-zinc-200">
                                {plate}
                              </span>
                            </td>

                            <td className="px-3 py-2 font-medium text-zinc-800 truncate max-w-[140px]">
                              {mat}
                            </td>

                            <td className="px-3 py-2 text-right font-mono font-bold text-zinc-900">
                              {tx.net_weight ? (
                                <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200/60">
                                  {Number(tx.net_weight).toLocaleString()} kg
                                </span>
                              ) : (
                                <span className="text-zinc-400">-</span>
                              )}
                            </td>

                            <td className="px-3 py-2">
                              <span
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-semibold border ${
                                  tx.status === 'Completed'
                                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                    : 'bg-rose-50 text-rose-800 border-rose-200'
                                }`}
                              >
                                {tx.status}
                              </span>
                            </td>

                            <td className="px-3 py-2 text-right">
                              <button
                                type="button"
                                onClick={() => setPreviewTicketTx(tx)}
                                className="px-2.5 py-1 rounded border border-zinc-200 hover:bg-zinc-100 hover:border-zinc-300 text-[10px] font-semibold text-zinc-800 transition-colors shadow-2xs cursor-pointer active:scale-95"
                              >
                                View
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Table Footer */}
              <div className="shrink-0 px-3 py-1.5 border-t border-zinc-100 bg-zinc-50/50 flex items-center justify-between text-[10px] text-zinc-500">
                <span>{filteredTransactions.length} certified transactions loaded</span>
                <Link href="/reports" className="text-zinc-900 font-bold hover:underline flex items-center gap-0.5">
                  Full Analytics <ArrowRight className="w-2.5 h-2.5" />
                </Link>
              </div>

            </div>

          </div>

          {/* RIGHT 5 COLUMNS: EXPANSIVE CONTINUOUS TELEMETRY & COMMODITY ANALYTICS SUITE */}
          <div className="lg:col-span-5 flex flex-col gap-3 min-h-0 min-w-0 overflow-hidden">
            
            {/* CARD 1: CONTINUOUS 7-DAY LINE GRAPH WITH METRIC TOGGLE */}
            <div className="flex-[1.2] rounded-xl bg-white border border-zinc-200/90 shadow-2xs p-4 flex flex-col justify-between min-h-0 min-w-0">
              <div className="shrink-0 flex items-center justify-between mb-2">
                <div>
                  <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-zinc-800 flex items-center gap-1.5">
                    <TrendingUp className="w-3.5 h-3.5 text-emerald-600" /> Continuous 7-Day Velocity
                  </span>
                  <p className="text-[9px] font-mono text-zinc-400 mt-0.5">Scale throughput & payload curve</p>
                </div>
                
                {/* Metric Mode Switcher */}
                <div className="flex border border-zinc-200 rounded-lg p-0.5 bg-zinc-100 text-[9px] font-mono font-bold">
                  <button
                    onClick={() => setTrendMetric('count')}
                    className={`px-2 py-0.5 rounded transition-all ${
                      trendMetric === 'count' ? 'bg-white text-zinc-900 shadow-2xs' : 'text-zinc-500 hover:text-zinc-800'
                    }`}
                  >
                    Trucks
                  </button>
                  <button
                    onClick={() => setTrendMetric('tonnage')}
                    className={`px-2 py-0.5 rounded transition-all ${
                      trendMetric === 'tonnage' ? 'bg-white text-zinc-900 shadow-2xs' : 'text-zinc-500 hover:text-zinc-800'
                    }`}
                  >
                    Tonnage (t)
                  </button>
                </div>
              </div>

              {!trendLineSvg ? (
                <div className="flex-1 flex items-center justify-center text-xs text-zinc-400 font-mono">
                  Loading volume trends...
                </div>
              ) : (
                <div className="flex-1 flex flex-col justify-between min-h-0 pt-1">
                  <div className="relative w-full flex-1 min-h-[110px]">
                    <svg viewBox="0 0 400 120" className="w-full h-full overflow-visible" preserveAspectRatio="none">
                      <defs>
                        <linearGradient id="trendGradientExpanded" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#10b981" stopOpacity="0.32" />
                          <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
                        </linearGradient>
                      </defs>

                      {/* Smooth filled area under line */}
                      <path d={trendLineSvg.dArea} fill="url(#trendGradientExpanded)" />

                      {/* Continuous line graph curve */}
                      <path
                        d={trendLineSvg.dLine}
                        fill="none"
                        stroke="#10b981"
                        strokeWidth="2.75"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />

                      {/* Interactive Data points */}
                      {trendLineSvg.points.map((p, idx) => (
                        <g key={idx} className="group cursor-pointer">
                          <circle
                            cx={p.x}
                            cy={p.y}
                            r="4"
                            fill="#ffffff"
                            stroke="#059669"
                            strokeWidth="2.5"
                            className="transition-transform duration-150 group-hover:scale-125"
                          />
                          {/* Value tag on hover / persistent */}
                          <text
                            x={p.x}
                            y={p.y - 8}
                            textAnchor="middle"
                            className="text-[9px] font-mono font-bold fill-zinc-700 select-none"
                          >
                            {trendMetric === 'count' ? p.raw : `${(p.raw / 1000).toFixed(0)}t`}
                          </text>
                        </g>
                      ))}
                    </svg>
                  </div>

                  {/* X-axis date points */}
                  <div className="shrink-0 flex justify-between items-center text-[9px] font-mono text-zinc-500 pt-2 border-t border-zinc-100">
                    {trends.map((t, idx) => {
                      const dateLabel = new Date(t.first_weighing_datetime__date).toLocaleDateString([], { weekday: 'narrow', month: 'numeric', day: 'numeric' });
                      const displayVal = trendMetric === 'count' ? `${t.count} trk` : `${(Number(t.tonnage || 0) / 1000).toFixed(1)}t`;
                      return (
                        <div key={idx} className="flex flex-col items-center">
                          <span className="font-bold text-zinc-800">{displayVal}</span>
                          <span className="text-zinc-400 text-[8px]">{dateLabel}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* CARD 2: COMMODITY TONNAGE MIX PROGRESS BARS */}
            <div className="flex-1 rounded-xl bg-white border border-zinc-200/90 shadow-2xs p-4 flex flex-col justify-between min-h-0 min-w-0">
              <div className="shrink-0 flex items-center justify-between mb-2">
                <div>
                  <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-zinc-800 flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-zinc-800" /> Commodity Distribution
                  </span>
                  <p className="text-[9px] font-mono text-zinc-400 mt-0.5">Payload breakdown across material streams</p>
                </div>
                <span className="text-[10px] font-mono text-zinc-700 font-bold bg-zinc-100 px-2 py-0.5 rounded border border-zinc-200">
                  {(totalCommodityKg / 1000).toFixed(1)} t Total
                </span>
              </div>

              {materialsMoved.length === 0 ? (
                <div className="flex-1 flex items-center justify-center text-xs text-zinc-400 font-mono">
                  No material movements logged today.
                </div>
              ) : (
                <div className="flex-1 flex flex-col justify-center space-y-3 overflow-y-auto pr-1">
                  {materialsMoved.map((m, idx) => {
                    const weightKg = Number(m.total_weight) || 0;
                    const pct = totalCommodityKg > 0 ? Math.round((weightKg / totalCommodityKg) * 100) : 0;
                    return (
                      <div key={idx} className="space-y-1">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="font-semibold text-zinc-800 truncate max-w-[170px]">{m.material__name || 'Bulk Material'}</span>
                          <span className="font-mono text-zinc-900 font-bold">
                            {(weightKg / 1000).toFixed(1)} t <span className="text-zinc-400 font-normal">({pct}%)</span>
                          </span>
                        </div>
                        <div className="h-2 w-full bg-zinc-100 rounded-full overflow-hidden">
                          <div 
                            style={{ width: `${pct}%` }} 
                            className="h-full bg-zinc-900 rounded-full transition-all duration-300"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="shrink-0 pt-2 border-t border-zinc-100 flex items-center justify-between text-[10px] text-zinc-500">
                <span>Enterprise Mass Flow</span>
                <Link href="/materials" className="text-zinc-900 font-bold hover:underline flex items-center gap-0.5">
                  View Materials Master <ArrowRight className="w-2.5 h-2.5" />
                </Link>
              </div>
            </div>

          </div>

        </div>

        {/* MODAL: QUICK 1ST WEIGHING */}
        {isQuickWeighModalOpen && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <div className="w-full max-w-lg bg-white border border-zinc-200 rounded-2xl shadow-2xl p-6 overflow-hidden">
              <div className="flex items-center justify-between pb-3 border-b border-zinc-200">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-emerald-500 text-zinc-950 font-bold">
                    <Zap className="w-4 h-4 fill-zinc-950" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-zinc-900">Fast Inbound 1st Weighing</h3>
                    <p className="text-[10px] text-zinc-400">Capture initial weighbridge weight</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsQuickWeighModalOpen(false)}
                  className="p-1 rounded-lg text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Digital Indicator inside Modal */}
              <div className="mt-4 p-4 rounded-xl bg-black border border-zinc-800 text-white flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500">Live Indicator</span>
                  <div className="font-mono text-3xl font-black text-emerald-400 tabular-nums">
                    {liveWeight.toLocaleString()} <span className="text-xs text-zinc-500 font-sans">KG</span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => simulateWeight(Math.floor(Math.random() * 22000) + 12000)}
                    className="px-2.5 py-1 text-xs font-mono rounded bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-200"
                  >
                    Simulate
                  </button>
                  <button
                    type="button"
                    onClick={zeroScale}
                    className="px-2.5 py-1 text-xs font-mono rounded bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-400"
                  >
                    Zero
                  </button>
                </div>
              </div>

              {formError && (
                <div className="mt-3 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <form onSubmit={handleSubmitQuick1st} className="mt-4 space-y-3.5 text-xs">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-1">
                    Select Vehicle (License Plate) *
                  </label>
                  <select
                    required
                    value={formVehicle}
                    onChange={(e) => handleVehicleSelect(e.target.value)}
                    className="w-full bg-zinc-50 border border-zinc-200 rounded-lg px-3 py-2 text-zinc-900 focus:outline-none focus:bg-white focus:border-zinc-800"
                  >
                    <option value="">-- Choose Truck --</option>
                    {vehicles.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.license_plate} {v.carrier_name ? `(${v.carrier_name})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-1">
                      Material Commodity *
                    </label>
                    <select
                      required
                      value={formMaterial}
                      onChange={(e) => setFormMaterial(e.target.value)}
                      className="w-full bg-zinc-50 border border-zinc-200 rounded-lg px-3 py-2 text-zinc-900 focus:outline-none focus:bg-white focus:border-zinc-800"
                    >
                      <option value="">-- Material --</option>
                      {materials.map((m) => (
                        <option key={m.id} value={m.id}>{m.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-1">
                      Initial Weight Type
                    </label>
                    <select
                      value={formWeighingType}
                      onChange={(e: any) => setFormWeighingType(e.target.value)}
                      className="w-full bg-zinc-50 border border-zinc-200 rounded-lg px-3 py-2 text-zinc-900 focus:outline-none focus:bg-white focus:border-zinc-800"
                    >
                      <option value="gross">Gross (Full Truck In)</option>
                      <option value="tare">Tare (Empty Truck In)</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-1">
                      Assigned Driver (Optional)
                    </label>
                    <select
                      value={formDriver}
                      onChange={(e) => setFormDriver(e.target.value)}
                      className="w-full bg-zinc-50 border border-zinc-200 rounded-lg px-3 py-2 text-zinc-900 focus:outline-none focus:bg-white focus:border-zinc-800"
                    >
                      <option value="">-- Driver --</option>
                      {drivers.map((d) => (
                        <option key={d.id} value={d.id}>{d.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-1">
                      Supplier / Vendor (Optional)
                    </label>
                    <select
                      value={formSupplier}
                      onChange={(e) => setFormSupplier(e.target.value)}
                      className="w-full bg-zinc-50 border border-zinc-200 rounded-lg px-3 py-2 text-zinc-900 focus:outline-none focus:bg-white focus:border-zinc-800"
                    >
                      <option value="">-- Supplier --</option>
                      {suppliers.map((s) => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="pt-3 border-t border-zinc-200 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsQuickWeighModalOpen(false)}
                    className="px-3.5 py-2 rounded-lg border border-zinc-200 text-zinc-600 hover:bg-zinc-100 font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={formSubmitting || liveWeight <= 0}
                    className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold transition-all shadow-md"
                  >
                    {formSubmitting ? 'Recording...' : 'Record 1st Weigh'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL: QUICK 2ND WEIGHING */}
        {activeCompletingTx && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <div className="w-full max-w-md bg-white border border-zinc-200 rounded-2xl shadow-2xl p-6">
              <div className="flex items-center justify-between pb-3 border-b border-zinc-200">
                <div>
                  <h3 className="font-bold text-sm text-zinc-900">Complete 2nd Weighing</h3>
                  <p className="text-[10px] text-zinc-400">
                    Ticket {activeCompletingTx.ticket_number || `#${activeCompletingTx.id}`}
                  </p>
                </div>
                <button
                  onClick={() => setActiveCompletingTx(null)}
                  className="p-1 rounded-lg text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {completingError && (
                <div className="mt-3 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs">
                  {completingError}
                </div>
              )}

              <form onSubmit={handleSubmitQuick2nd} className="mt-4 space-y-3.5 text-xs">
                <div className="p-3 bg-zinc-50 rounded-xl border border-zinc-200 space-y-1.5 font-mono">
                  <div className="flex justify-between text-zinc-500 text-[11px]">
                    <span>Vehicle:</span>
                    <span className="font-bold text-zinc-900">
                      {typeof activeCompletingTx.vehicle === 'object' && activeCompletingTx.vehicle ? activeCompletingTx.vehicle.license_plate : activeCompletingTx.vehicle_license}
                    </span>
                  </div>
                  <div className="flex justify-between text-zinc-500 text-[11px]">
                    <span>1st Weight Captured:</span>
                    <span className="font-bold text-zinc-900">
                      {activeCompletingTx.gross_weight 
                        ? `${Number(activeCompletingTx.gross_weight).toLocaleString()} kg (Gross)` 
                        : `${Number(activeCompletingTx.tare_weight).toLocaleString()} kg (Tare)`}
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-1">
                    2nd Scale Reading (kg) *
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      required
                      placeholder="e.g. 14200"
                      value={completingWeight}
                      onChange={(e) => setCompletingWeight(e.target.value)}
                      className="w-full bg-zinc-50 border border-zinc-200 rounded-lg px-3 py-2 text-zinc-900 font-mono font-bold focus:outline-none focus:bg-white focus:border-zinc-800"
                    />
                    <button
                      type="button"
                      onClick={() => setCompletingWeight(liveWeight.toString())}
                      className="px-3 py-2 rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-800 font-bold shrink-0 font-mono"
                    >
                      From Scale
                    </button>
                  </div>
                </div>

                <div className="pt-3 border-t border-zinc-200 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveCompletingTx(null)}
                    className="px-3.5 py-2 rounded-lg border border-zinc-200 text-zinc-600 hover:bg-zinc-100 font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={completingSubmitting}
                    className="px-4 py-2 rounded-lg bg-zinc-900 hover:bg-black text-white font-bold transition-all shadow-md"
                  >
                    {completingSubmitting ? 'Calculating Net...' : 'Complete & Generate Ticket'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ================= IN-COCKPIT TICKET PREVIEW MODAL ================= */}
        {previewTicketTx && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl border border-zinc-200 w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
              {/* Header */}
              <div className="px-5 py-3.5 border-b border-zinc-200 flex items-center justify-between bg-zinc-50 shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-lg bg-zinc-900 text-white">
                    <FileText className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-zinc-900 text-sm flex items-center gap-2">
                      Weighbridge Certificate
                      <span className="font-mono text-xs px-2 py-0.5 rounded bg-zinc-200/80 text-zinc-800">
                        {previewTicketTx.ticket_number || `#${previewTicketTx.id.toString().padStart(4, '0')}`}
                      </span>
                    </h3>
                    <p className="text-[11px] text-zinc-500 font-mono">
                      Timestamp: {new Date(previewTicketTx.first_weighing_datetime).toLocaleString()}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {/* Format Toggle */}
                  <div className="flex bg-zinc-200/80 p-0.5 rounded-lg text-xs font-semibold">
                    <button
                      type="button"
                      onClick={() => setPreviewFormat('A4')}
                      className={`px-2.5 py-1 rounded-md transition-all ${
                        previewFormat === 'A4' ? 'bg-white text-zinc-900 shadow-2xs' : 'text-zinc-600 hover:text-zinc-900'
                      }`}
                    >
                      Standard A4
                    </button>
                    <button
                      type="button"
                      onClick={() => setPreviewFormat('THERMAL')}
                      className={`px-2.5 py-1 rounded-md transition-all ${
                        previewFormat === 'THERMAL' ? 'bg-white text-zinc-900 shadow-2xs' : 'text-zinc-600 hover:text-zinc-900'
                      }`}
                    >
                      Thermal 80mm
                    </button>
                  </div>

                  <Link
                    href={`/tickets?ticket=${encodeURIComponent(previewTicketTx.ticket_number || previewTicketTx.id.toString())}`}
                    target="_blank"
                    className="p-1.5 rounded-lg hover:bg-zinc-200 text-zinc-600 hover:text-zinc-900 transition-colors"
                    title="Open in Full Ticket Studio"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </Link>

                  <button
                    type="button"
                    onClick={() => setPreviewTicketTx(null)}
                    className="p-1.5 rounded-lg hover:bg-zinc-200 text-zinc-500 hover:text-zinc-800 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Ticket Preview Body */}
              <div className="flex-1 overflow-y-auto p-5 bg-zinc-100/60">
                {previewFormat === 'A4' ? (
                  /* Standard A4 Formatted Slip */
                  <div className="bg-white border border-zinc-200 rounded-xl p-6 shadow-xs max-w-xl mx-auto space-y-5">
                    {/* Brand & Certificate Header */}
                    <div className="flex items-start justify-between border-b border-zinc-200 pb-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-zinc-900 flex items-center justify-center text-white">
                            <Scale className="w-4 h-4" />
                          </div>
                          <div>
                            <h2 className="font-extrabold text-zinc-900 text-sm tracking-tight">SMART WEIGHBRIDGE</h2>
                            <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">Certified Weighment Terminal</p>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 mb-1">
                          {previewTicketTx.status}
                        </span>
                        <p className="font-mono font-bold text-zinc-900 text-xs">
                          {previewTicketTx.ticket_number || `TX-#${previewTicketTx.id}`}
                        </p>
                      </div>
                    </div>

                    {/* Transaction Metadata Grid */}
                    <div className="grid grid-cols-2 gap-3 p-3.5 bg-zinc-50 rounded-xl border border-zinc-200/80 text-xs">
                      <div>
                        <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider block">Vehicle Plate</span>
                        <span className="font-mono font-bold text-zinc-900 text-sm">
                          {previewTicketTx.vehicle_details?.license_plate ||
                            (typeof previewTicketTx.vehicle === 'object' && previewTicketTx.vehicle ? previewTicketTx.vehicle.license_plate : '') ||
                            previewTicketTx.vehicle_license ||
                            `Truck #${previewTicketTx.vehicle}`}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider block">Commodity / Material</span>
                        <span className="font-bold text-zinc-900 text-sm">
                          {previewTicketTx.material_details?.name ||
                            (typeof previewTicketTx.material === 'object' && previewTicketTx.material ? previewTicketTx.material.name : '') ||
                            previewTicketTx.material_name ||
                            `Material #${previewTicketTx.material}`}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider block">Weighbridge Scale</span>
                        <span className="font-semibold text-zinc-800">Scale 01 (Static Weighbridge)</span>
                      </div>
                      <div>
                        <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider block">Operator</span>
                        <span className="font-semibold text-zinc-800">{previewTicketTx.operator_name || 'Terminal Operator'}</span>
                      </div>
                    </div>

                    {/* Weight Breakdown */}
                    <div className="border border-zinc-200 rounded-xl overflow-hidden text-xs">
                      <div className="grid grid-cols-3 bg-zinc-100/80 px-3 py-2 font-bold text-zinc-700 border-zinc-200 border-b text-center">
                        <div>Gross Mass</div>
                        <div>Tare Mass</div>
                        <div className="text-emerald-700">Certified Net Mass</div>
                      </div>
                      <div className="grid grid-cols-3 px-3 py-3 font-mono font-bold text-zinc-900 text-center items-center bg-white">
                        <div>
                          <div className="text-sm">
                            {previewTicketTx.gross_weight ? `${Number(previewTicketTx.gross_weight).toLocaleString()} kg` : '-'}
                          </div>
                          <div className="text-[9px] text-zinc-400 font-normal font-sans">
                            {new Date(previewTicketTx.first_weighing_datetime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </div>
                        <div>
                          <div className="text-sm">
                            {previewTicketTx.tare_weight ? `${Number(previewTicketTx.tare_weight).toLocaleString()} kg` : 'Pending'}
                          </div>
                          <div className="text-[9px] text-zinc-400 font-normal font-sans">
                            {previewTicketTx.second_weighing_datetime ? new Date(previewTicketTx.second_weighing_datetime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}
                          </div>
                        </div>
                        <div className="text-emerald-700">
                          <div className="text-base font-black">
                            {previewTicketTx.net_weight ? `${Number(previewTicketTx.net_weight).toLocaleString()} kg` : '-'}
                          </div>
                          <div className="text-[9px] text-emerald-600 font-semibold font-sans">
                            {previewTicketTx.net_weight ? `${(Number(previewTicketTx.net_weight) / 1000).toFixed(2)} t` : '-'}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Sign-off & Verification Footer */}
                    <div className="pt-2 grid grid-cols-2 gap-6 text-center text-xs">
                      <div>
                        <div className="h-10 border-b border-dashed border-zinc-300 flex items-center justify-center text-zinc-400 font-mono text-[10px]">
                          [Digital Operator Certified]
                        </div>
                        <p className="mt-1 text-[10px] font-semibold text-zinc-500">Weighbridge Authority</p>
                      </div>
                      <div>
                        <div className="h-10 border-b border-dashed border-zinc-300 flex items-center justify-center text-zinc-400 font-mono text-[10px]">
                          [Driver Acknowledged]
                        </div>
                        <p className="mt-1 text-[10px] font-semibold text-zinc-500">Vehicle Driver</p>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* 80mm Thermal Receipt */
                  <div className="max-w-xs mx-auto bg-white border border-zinc-300 rounded-lg p-4 font-mono text-xs shadow-xs space-y-3">
                    <div className="text-center pb-2 border-b border-dashed border-zinc-300">
                      <p className="font-black text-sm tracking-wide">SMART WEIGHBRIDGE</p>
                      <p className="text-[10px] text-zinc-500">OFFICIAL SCALE CERTIFICATE</p>
                      <p className="font-bold mt-1 text-zinc-800">
                        {previewTicketTx.ticket_number || `TX-${previewTicketTx.id}`}
                      </p>
                      <p className="text-[10px] text-zinc-400">{new Date(previewTicketTx.first_weighing_datetime).toLocaleString()}</p>
                    </div>

                    <div className="space-y-1 text-[11px] border-b border-dashed border-zinc-300 pb-2">
                      <div className="flex justify-between">
                        <span className="text-zinc-500">PLATE:</span>
                        <span className="font-bold">
                          {previewTicketTx.vehicle_details?.license_plate || previewTicketTx.vehicle_license || `TRK #${previewTicketTx.vehicle}`}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-500">COMMODITY:</span>
                        <span>{previewTicketTx.material_details?.name || previewTicketTx.material_name || `MAT #${previewTicketTx.material}`}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-500">OPERATOR:</span>
                        <span>{previewTicketTx.operator_name || 'Terminal 01'}</span>
                      </div>
                    </div>

                    <div className="space-y-1 border-b-2 border-zinc-900 pb-2 text-[11px]">
                      <div className="flex justify-between">
                        <span>GROSS WT:</span>
                        <span>{previewTicketTx.gross_weight ? `${Number(previewTicketTx.gross_weight).toLocaleString()} kg` : '-'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>TARE WT:</span>
                        <span>{previewTicketTx.tare_weight ? `${Number(previewTicketTx.tare_weight).toLocaleString()} kg` : '-'}</span>
                      </div>
                      <div className="flex justify-between font-bold text-sm pt-1 border-t border-zinc-200">
                        <span>NET MASS:</span>
                        <span>{previewTicketTx.net_weight ? `${Number(previewTicketTx.net_weight).toLocaleString()} kg` : '-'}</span>
                      </div>
                    </div>

                    <div className="text-center text-[9px] text-zinc-400 pt-1">
                      *** LEGAL FOR TRADE WEIGHMENT ***
                    </div>
                  </div>
                )}
              </div>

              {/* Modal Actions Footer */}
              <div className="px-5 py-3 border-t border-zinc-200 bg-white flex items-center justify-between shrink-0">
                <span className="text-xs text-zinc-500 font-mono">
                  Scale Audit ID: {previewTicketTx.id}
                </span>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPreviewTicketTx(null)}
                    className="px-3 py-1.5 rounded-lg border border-zinc-200 hover:bg-zinc-100 text-xs font-semibold text-zinc-600 transition-colors"
                  >
                    Close
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (typeof window !== 'undefined') window.print();
                    }}
                    className="px-4 py-1.5 rounded-lg bg-zinc-900 hover:bg-black text-white text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 active:scale-95"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    Print Ticket
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </RouteGuard>
  );
}
