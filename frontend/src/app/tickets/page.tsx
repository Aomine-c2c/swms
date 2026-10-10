'use client';

import React, { useEffect, useState, useRef, useMemo, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  FileText,
  Printer,
  Search,
  CheckCircle2,
  Building2,
  Truck,
  Calendar,
  Scale,
  Download,
  Mail,
  PenTool,
  RotateCcw,
  QrCode,
  ShieldCheck,
  Receipt,
  FileCheck,
  RotateCw,
  Eye,
  Filter,
  CheckSquare,
  Square,
  Copy,
  Layers,
  ArrowRight,
  TrendingUp,
  AlertCircle
} from 'lucide-react';
import { api } from '@/lib/api';
import { DetailPanel } from '@/components/common/DetailPanel';

interface TicketItem {
  id: number;
  ticket_number: string;
  created_at: string;
  updated_at: string;
  generated_datetime: string;
  print_count: number;
  transaction: number;
  printed_by_name?: string;
  transaction_details?: any;
}

function TicketContent() {
  const searchParams = useSearchParams();
  const ticketParam = searchParams.get('ticket');

  const [tickets, setTickets] = useState<TicketItem[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [searchQuery, setSearchQuery] = useState(ticketParam || '');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'Single' | 'Reprinted'>('ALL');

  // Selected ticket for Slide-out Detail Panel
  const [selectedTicket, setSelectedTicket] = useState<TicketItem | null>(null);
  const [isPanelOpen, setIsPanelOpen] = useState(false);

  // Multi-select batch print/export
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  // Format and interactive states inside Detail Panel / Print View
  const [ticketFormat, setTicketFormat] = useState<'A4' | 'THERMAL'>('A4');
  const [showSigModal, setShowSigModal] = useState(false);
  const [operatorSig, setOperatorSig] = useState<string | null>(null);
  const [driverSig, setDriverSig] = useState<string | null>(null);
  const [activeSigner, setActiveSigner] = useState<'operator' | 'driver'>('operator');
  const [reprinting, setReprinting] = useState(false);

  // Canvas ref for interactive signature
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDrawing = useRef(false);

  // Fetch ticket listing
  const fetchTickets = async () => {
    try {
      setLoadingList(true);
      const res = await api.get('/tickets/?page_size=100');
      const list = res.data.results || res.data || [];
      setTickets(list);

      // Auto-open if query param is set
      if (ticketParam) {
        const found = list.find((t: TicketItem) => 
          t.ticket_number.toLowerCase() === ticketParam.toLowerCase() ||
          t.id.toString() === ticketParam ||
          t.transaction.toString() === ticketParam
        );
        if (found) {
          setSelectedTicket(found);
          setIsPanelOpen(true);
        }
      }
    } catch (e) {
      console.error('Failed to load tickets', e);
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => {
    fetchTickets();
  }, []);

  // Filtered tickets
  const filteredTickets = useMemo(() => {
    return tickets.filter((t) => {
      const q = searchQuery.toLowerCase().trim();
      const tx = t.transaction_details || {};
      const plate = tx.vehicle_details?.license_plate || tx.vehicle_license || '';
      const supplier = tx.supplier_details?.name || tx.supplier_name || '';
      const material = tx.material_details?.name || tx.material_name || '';

      const matchesQuery = !q ||
        t.ticket_number.toLowerCase().includes(q) ||
        plate.toLowerCase().includes(q) ||
        supplier.toLowerCase().includes(q) ||
        material.toLowerCase().includes(q) ||
        t.id.toString().includes(q);

      const matchesStatus =
        statusFilter === 'ALL' ||
        (statusFilter === 'Single' && (t.print_count ?? 1) <= 1) ||
        (statusFilter === 'Reprinted' && (t.print_count ?? 1) > 1);

      return matchesQuery && matchesStatus;
    });
  }, [tickets, searchQuery, statusFilter]);

  // Ribbon KPI stats
  const stats = useMemo(() => {
    const total = tickets.length;
    const reprints = tickets.filter((t) => (t.print_count ?? 1) > 1).length;
    const totalKg = tickets.reduce((acc, t) => {
      const net = Number(t.transaction_details?.net_weight || 0);
      return acc + (isNaN(net) ? 0 : net);
    }, 0);
    return {
      total,
      reprints,
      tonnage: (totalKg / 1000).toFixed(1),
    };
  }, [tickets]);

  const handleOpenDetail = (ticket: TicketItem) => {
    setSelectedTicket(ticket);
    setIsPanelOpen(true);
  };

  const handleToggleSelect = (id: number) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    if (selectedIds.length === filteredTickets.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredTickets.map((t) => t.id));
    }
  };

  const handlePrintSelected = async () => {
    if (selectedTicket) {
      try {
        setReprinting(true);
        const res = await api.post(`/tickets/${selectedTicket.id}/reprint/`);
        setSelectedTicket(res.data);
        fetchTickets();
      } catch {
        // print even if count tracking fails
      } finally {
        setReprinting(false);
      }
    }
    if (typeof window !== 'undefined') {
      window.print();
    }
  };

  const handleDownloadPdf = () => {
    // Industrial printable trigger formatted for client PDF save
    if (typeof window !== 'undefined') {
      window.print();
    }
  };

  const handleEmailDispatch = () => {
    if (!selectedTicket) return;
    const tx = selectedTicket.transaction_details || {};
    const plate = tx.vehicle_details?.license_plate || tx.vehicle_license || 'N/A';
    const net = tx.net_weight ? Number(tx.net_weight).toLocaleString() : '-';
    const subject = encodeURIComponent(`Weighbridge Certificate ${selectedTicket.ticket_number}`);
    const body = encodeURIComponent(
      `Official Weighbridge Certificate ${selectedTicket.ticket_number}\nVehicle: ${plate}\nCertified Net Weight: ${net} kg\nIssued: ${new Date(selectedTicket.generated_datetime).toLocaleString()}`
    );
    window.open(`mailto:?subject=${subject}&body=${body}`, '_blank');
  };

  // Canvas drawing handlers
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    isDrawing.current = true;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const x = 'touches' in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = 'touches' in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top;
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const x = 'touches' in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = 'touches' in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top;
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#09090b';
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    isDrawing.current = false;
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  const saveSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/png');
    if (activeSigner === 'operator') {
      setOperatorSig(dataUrl);
    } else {
      setDriverSig(dataUrl);
    }
    setShowSigModal(false);
  };

  const currentTx = selectedTicket?.transaction_details || {};
  const printCount = selectedTicket?.print_count ?? 1;
  const isReprint = printCount > 1;

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 print:hidden">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-zinc-900 flex items-center gap-2">
            <FileText className="w-5 h-5 text-zinc-800" />
            <span>Weighbridge Tickets & Official Slips</span>
          </h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            Search, preview certificates, inspect reprint logs, and download official weight slips
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchTickets}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-200 bg-white hover:bg-zinc-100 text-xs font-semibold text-zinc-700 transition-colors shadow-xs"
          >
            <RotateCw className="w-3.5 h-3.5" />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* KPI Stats Ribbon */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 print:hidden">
        <div className="bg-white border border-zinc-200 rounded-xl p-3.5 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-zinc-400">Total Slips Issued</span>
            <div className="text-xl font-mono font-black text-zinc-900 mt-0.5">{stats.total}</div>
          </div>
          <div className="w-8 h-8 rounded-lg bg-zinc-100 flex items-center justify-center text-zinc-700">
            <FileCheck className="w-4 h-4" />
          </div>
        </div>

        <div className="bg-white border border-zinc-200 rounded-xl p-3.5 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-zinc-400">Certified Mass</span>
            <div className="text-xl font-mono font-black text-zinc-900 mt-0.5">{stats.tonnage} t</div>
          </div>
          <div className="w-8 h-8 rounded-lg bg-zinc-100 flex items-center justify-center text-zinc-700">
            <Scale className="w-4 h-4" />
          </div>
        </div>

        <div className="bg-white border border-zinc-200 rounded-xl p-3.5 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-zinc-400">Duplicate Reprints</span>
            <div className="text-xl font-mono font-black text-amber-700 mt-0.5">{stats.reprints}</div>
          </div>
          <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center text-amber-700 border border-amber-200">
            <Copy className="w-4 h-4" />
          </div>
        </div>
      </div>

      {/* Advanced Filter & Search Bar */}
      <div className="bg-white border border-zinc-200 rounded-xl p-4 shadow-2xs flex flex-col md:flex-row items-center justify-between gap-3 print:hidden">
        <div className="relative flex-1 w-full">
          <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by ticket number, vehicle plate, supplier, or material..."
            className="w-full bg-zinc-50 border border-zinc-200 rounded-lg pl-9 pr-4 py-2 text-xs text-zinc-900 placeholder-zinc-400 focus:outline-none focus:bg-white focus:border-zinc-800 transition-colors"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          {/* Status Filter Tabs */}
          <div className="flex border border-zinc-200 rounded-lg p-0.5 bg-zinc-100 text-xs font-semibold">
            {(['ALL', 'Single', 'Reprinted'] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1.5 rounded-md transition-all ${
                  statusFilter === s ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-800'
                }`}
              >
                {s === 'ALL' ? 'All Slips' : s === 'Single' ? 'Originals' : 'Duplicates'}
              </button>
            ))}
          </div>

          {selectedIds.length > 0 && (
            <button
              onClick={() => {
                alert(`Batch print queued for ${selectedIds.length} tickets.`);
              }}
              className="px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-black text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm shrink-0"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print ({selectedIds.length})</span>
            </button>
          )}
        </div>
      </div>

      {/* Tickets Explorer Table */}
      <div className="bg-white border border-zinc-200 rounded-xl shadow-xs overflow-hidden print:hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-zinc-50/80 text-zinc-500 font-bold border-b border-zinc-200 uppercase text-[10px] tracking-wider">
              <tr>
                <th className="px-4 py-3 w-8">
                  <button
                    type="button"
                    onClick={handleSelectAll}
                    className="text-zinc-400 hover:text-zinc-700"
                  >
                    {selectedIds.length === filteredTickets.length && filteredTickets.length > 0 ? (
                      <CheckSquare className="w-4 h-4 text-zinc-900" />
                    ) : (
                      <Square className="w-4 h-4" />
                    )}
                  </button>
                </th>
                <th className="px-4 py-3">Ticket #</th>
                <th className="px-4 py-3">Vehicle Plate</th>
                <th className="px-4 py-3">Material</th>
                <th className="px-4 py-3">Supplier / Vendor</th>
                <th className="px-4 py-3 text-right">Net Mass</th>
                <th className="px-4 py-3 text-center">Print Status</th>
                <th className="px-4 py-3">Issued Time</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 text-zinc-700">
              {loadingList ? (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-zinc-400">
                    <div className="w-5 h-5 border-2 border-zinc-900 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    <span>Loading tickets...</span>
                  </td>
                </tr>
              ) : filteredTickets.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-zinc-400 font-medium">
                    No tickets found matching current filters.
                  </td>
                </tr>
              ) : (
                filteredTickets.map((t) => {
                  const tx = t.transaction_details || {};
                  const plate = tx.vehicle_details?.license_plate || tx.vehicle_license || 'N/A';
                  const mat = tx.material_details?.name || tx.material_name || 'General';
                  const sup = tx.supplier_details?.name || tx.supplier_name || 'Direct';
                  const netKg = tx.net_weight ? Number(tx.net_weight).toLocaleString() : '-';
                  const isSelected = selectedIds.includes(t.id);
                  const isDup = (t.print_count ?? 1) > 1;

                  return (
                    <tr
                      key={t.id}
                      onClick={() => handleOpenDetail(t)}
                      className={`hover:bg-zinc-50/80 cursor-pointer transition-colors ${
                        selectedTicket?.id === t.id ? 'bg-zinc-100/60' : ''
                      }`}
                    >
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => handleToggleSelect(t.id)}
                          className="text-zinc-400 hover:text-zinc-700"
                        >
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-zinc-900" />
                          ) : (
                            <Square className="w-4 h-4" />
                          )}
                        </button>
                      </td>
                      <td className="px-4 py-3 font-mono font-bold text-zinc-900 flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5 text-zinc-400" />
                        <span>{t.ticket_number}</span>
                      </td>
                      <td className="px-4 py-3 font-mono font-bold text-zinc-900">{plate}</td>
                      <td className="px-4 py-3 font-semibold text-zinc-800">{mat}</td>
                      <td className="px-4 py-3 text-zinc-600 truncate max-w-[140px]">{sup}</td>
                      <td className="px-4 py-3 text-right font-mono font-black text-zinc-900">{netKg} kg</td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                            isDup
                              ? 'bg-amber-50 text-amber-700 border border-amber-200'
                              : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          }`}
                        >
                          {isDup ? `Reprint #${t.print_count}` : 'Original'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-zinc-500 font-mono text-[11px]">
                        {new Date(t.generated_datetime).toLocaleDateString()} {new Date(t.generated_datetime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleOpenDetail(t)}
                            className="p-1 rounded hover:bg-zinc-200/60 text-zinc-500 hover:text-zinc-900"
                            title="Inspect Certificate"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => {
                              setSelectedTicket(t);
                              setIsPanelOpen(true);
                              setTimeout(handlePrintSelected, 100);
                            }}
                            className="p-1 rounded hover:bg-zinc-200/60 text-zinc-500 hover:text-zinc-900"
                            title="Quick Print"
                          >
                            <Printer className="w-4 h-4" />
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

      {/* UNIVERSAL REUSABLE SLIDE-OUT DETAIL PANEL FOR TICKET CERTIFICATE */}
      <DetailPanel
        isOpen={isPanelOpen}
        onClose={() => setIsPanelOpen(false)}
        title={selectedTicket ? selectedTicket.ticket_number : 'Ticket Certificate'}
        subtitle={currentTx.vehicle_details?.license_plate ? `Vehicle ${currentTx.vehicle_details.license_plate} • Certified Certificate` : 'Weighbridge Official Slip'}
        badge={
          isReprint ? (
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-50 text-amber-700 border border-amber-200">
              Duplicate #{printCount}
            </span>
          ) : (
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
              Official Original
            </span>
          )
        }
        width="max-w-2xl"
        headerActions={
          <div className="flex items-center gap-1.5 mr-2">
            {/* Format Switcher */}
            <div className="flex border border-zinc-200 rounded-lg p-0.5 bg-zinc-100 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setTicketFormat('A4')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded transition-all text-[11px] ${
                  ticketFormat === 'A4' ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500'
                }`}
              >
                <FileCheck className="w-3 h-3" />
                <span>A4</span>
              </button>
              <button
                type="button"
                onClick={() => setTicketFormat('THERMAL')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded transition-all text-[11px] ${
                  ticketFormat === 'THERMAL' ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500'
                }`}
              >
                <Receipt className="w-3 h-3" />
                <span>Thermal</span>
              </button>
            </div>

            <button
              onClick={handleEmailDispatch}
              className="p-1.5 rounded-lg border border-zinc-200 bg-white hover:bg-zinc-100 text-zinc-700 text-xs font-semibold"
              title="Send Email"
            >
              <Mail className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleDownloadPdf}
              className="p-1.5 rounded-lg border border-zinc-200 bg-white hover:bg-zinc-100 text-zinc-700 text-xs font-semibold"
              title="Download PDF"
            >
              <Download className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handlePrintSelected}
              disabled={reprinting}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-black text-white text-xs font-semibold shadow-sm"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>{isReprint ? 'Print Duplicate' : 'Print Slip'}</span>
            </button>
          </div>
        }
      >
        {selectedTicket && (
          <div className="space-y-6">
            {/* FORMAT DISPLAY CONTAINER */}
            {ticketFormat === 'A4' ? (
              /* A4 CERTIFICATE IN PANEL */
              <div className="bg-white text-zinc-900 p-6 rounded-xl border border-zinc-200 shadow-sm space-y-6">
                <div className="flex items-center justify-between border-b-2 border-zinc-900 pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-lg bg-zinc-900 text-white">
                      <Scale className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-black text-sm tracking-wide uppercase text-zinc-900">SMART-WEIGH SYSTEM</h3>
                      <p className="text-[10px] text-zinc-500">Official Certified Weighbridge Certificate</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs font-mono font-bold text-zinc-900">{selectedTicket.ticket_number}</div>
                    <div className="text-[9px] text-zinc-400 font-mono">
                      Issued: {new Date(selectedTicket.generated_datetime).toLocaleDateString()}
                    </div>
                  </div>
                </div>

                {/* Metadata Grid */}
                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div className="space-y-2">
                    <div>
                      <span className="block text-[9px] uppercase font-bold text-zinc-400">Vehicle License</span>
                      <span className="font-mono text-sm font-bold text-zinc-900">
                        {currentTx.vehicle_details?.license_plate || currentTx.vehicle_license || 'N/A'}
                      </span>
                    </div>
                    <div>
                      <span className="block text-[9px] uppercase font-bold text-zinc-400">Driver</span>
                      <span className="font-semibold text-zinc-800">
                        {currentTx.driver_details?.name || currentTx.driver_name || 'Standard Driver'}
                      </span>
                    </div>
                    <div>
                      <span className="block text-[9px] uppercase font-bold text-zinc-400">Supplier / Vendor</span>
                      <span className="font-semibold text-zinc-800">
                        {currentTx.supplier_details?.name || currentTx.supplier_name || 'Direct Commercial'}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2 text-right">
                    <div>
                      <span className="block text-[9px] uppercase font-bold text-zinc-400">Material</span>
                      <span className="font-bold text-zinc-900">
                        {currentTx.material_details?.name || currentTx.material_name || 'Aggregate'}
                      </span>
                    </div>
                    <div>
                      <span className="block text-[9px] uppercase font-bold text-zinc-400">1st Weighing Time</span>
                      <span className="font-mono text-zinc-700 text-[11px]">
                        {currentTx.first_weighing_datetime ? new Date(currentTx.first_weighing_datetime).toLocaleString() : '-'}
                      </span>
                    </div>
                    <div>
                      <span className="block text-[9px] uppercase font-bold text-zinc-400">2nd Weighing Time</span>
                      <span className="font-mono text-zinc-700 text-[11px]">
                        {currentTx.second_weighing_datetime ? new Date(currentTx.second_weighing_datetime).toLocaleString() : '-'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Weight Breakdown */}
                <div className="border border-zinc-200 rounded-lg overflow-hidden text-xs">
                  <table className="w-full">
                    <thead className="bg-zinc-50 border-b border-zinc-200 uppercase text-[9px] font-mono text-zinc-500">
                      <tr>
                        <th className="px-3 py-2 text-left">Classification</th>
                        <th className="px-3 py-2 text-right">Mass (kg)</th>
                        <th className="px-3 py-2 text-right">Mass (Metric Tonnes)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100 font-mono">
                      <tr>
                        <td className="px-3 py-2 font-semibold text-zinc-700">Gross Weight (Loaded)</td>
                        <td className="px-3 py-2 text-right font-bold text-zinc-900">
                          {currentTx.gross_weight ? Number(currentTx.gross_weight).toLocaleString() : '-'}
                        </td>
                        <td className="px-3 py-2 text-right text-zinc-500">
                          {currentTx.gross_weight ? (Number(currentTx.gross_weight) / 1000).toFixed(2) : '-'}
                        </td>
                      </tr>
                      <tr>
                        <td className="px-3 py-2 font-semibold text-zinc-700">Tare Weight (Empty)</td>
                        <td className="px-3 py-2 text-right font-bold text-zinc-900">
                          {currentTx.tare_weight ? Number(currentTx.tare_weight).toLocaleString() : '-'}
                        </td>
                        <td className="px-3 py-2 text-right text-zinc-500">
                          {currentTx.tare_weight ? (Number(currentTx.tare_weight) / 1000).toFixed(2) : '-'}
                        </td>
                      </tr>
                      <tr className="bg-zinc-900 text-white font-bold">
                        <td className="px-3 py-2.5">CERTIFIED NET PAYABLE WEIGHT</td>
                        <td className="px-3 py-2.5 text-right text-sm">
                          {currentTx.net_weight ? Number(currentTx.net_weight).toLocaleString() : '-'} kg
                        </td>
                        <td className="px-3 py-2.5 text-right text-sm">
                          {currentTx.net_weight ? (Number(currentTx.net_weight) / 1000).toFixed(2) : '-'} t
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Signatures & Security QR */}
                <div className="grid grid-cols-3 gap-3 pt-3 border-t border-zinc-100 items-center text-center text-xs">
                  <div>
                    <div
                      onClick={() => {
                        setActiveSigner('operator');
                        setShowSigModal(true);
                      }}
                      className="h-12 border-b border-zinc-400 flex items-center justify-center cursor-pointer hover:bg-zinc-50 transition-colors"
                    >
                      {operatorSig ? (
                        <img src={operatorSig} alt="Operator Sig" className="max-h-10 object-contain" />
                      ) : (
                        <span className="text-[10px] text-zinc-400 flex items-center gap-1">
                          <PenTool className="w-3 h-3" /> Sign
                        </span>
                      )}
                    </div>
                    <p className="mt-1 font-semibold text-zinc-700 text-[10px]">Operator: {selectedTicket.printed_by_name || 'System'}</p>
                  </div>

                  <div className="flex flex-col items-center justify-center">
                    <div className="p-1 border border-zinc-200 rounded-lg bg-zinc-50">
                      <div className="w-12 h-12 bg-zinc-900 flex items-center justify-center text-white rounded">
                        <QrCode className="w-8 h-8" />
                      </div>
                    </div>
                    <span className="text-[8px] font-mono text-zinc-400 mt-1">VERIFIED</span>
                  </div>

                  <div>
                    <div
                      onClick={() => {
                        setActiveSigner('driver');
                        setShowSigModal(true);
                      }}
                      className="h-12 border-b border-zinc-400 flex items-center justify-center cursor-pointer hover:bg-zinc-50 transition-colors"
                    >
                      {driverSig ? (
                        <img src={driverSig} alt="Driver Sig" className="max-h-10 object-contain" />
                      ) : (
                        <span className="text-[10px] text-zinc-400 flex items-center gap-1">
                          <PenTool className="w-3 h-3" /> Sign
                        </span>
                      )}
                    </div>
                    <p className="mt-1 font-semibold text-zinc-700 text-[10px]">Driver Signature</p>
                  </div>
                </div>
              </div>
            ) : (
              /* THERMAL RECEIPT FORMAT IN PANEL */
              <div className="max-w-xs mx-auto bg-white text-zinc-900 p-5 rounded-xl border border-zinc-200 font-mono text-xs space-y-3">
                <div className="text-center pb-2 border-b border-dashed border-zinc-300">
                  <h4 className="font-black text-xs uppercase">SMART-WEIGH SYSTEM</h4>
                  <p className="text-[10px] text-zinc-500">WEIGHBRIDGE CERTIFICATE</p>
                  <p className="font-bold text-xs mt-0.5">{selectedTicket.ticket_number}</p>
                  <p className="text-[9px] text-zinc-400">{new Date(selectedTicket.generated_datetime).toLocaleString()}</p>
                </div>

                <div className="space-y-1 text-[11px] pb-2 border-b border-dashed border-zinc-300">
                  <div className="flex justify-between">
                    <span className="text-zinc-500">PLATE:</span>
                    <span className="font-bold">{currentTx.vehicle_details?.license_plate || currentTx.vehicle_license || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-500">MATERIAL:</span>
                    <span>{currentTx.material_details?.name || currentTx.material_name || 'Aggregate'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-500">SUPPLIER:</span>
                    <span>{currentTx.supplier_details?.name || currentTx.supplier_name || 'Direct'}</span>
                  </div>
                </div>

                <div className="space-y-1 text-xs pb-2 border-b-2 border-zinc-900">
                  <div className="flex justify-between">
                    <span>GROSS:</span>
                    <span>{currentTx.gross_weight ? Number(currentTx.gross_weight).toLocaleString() : '-'} kg</span>
                  </div>
                  <div className="flex justify-between">
                    <span>TARE:</span>
                    <span>{currentTx.tare_weight ? Number(currentTx.tare_weight).toLocaleString() : '-'} kg</span>
                  </div>
                  <div className="flex justify-between font-black text-sm pt-1 border-t border-zinc-200">
                    <span>NET:</span>
                    <span>{currentTx.net_weight ? Number(currentTx.net_weight).toLocaleString() : '-'} kg</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </DetailPanel>

      {/* DIGITAL SIGNATURE CAPTURE MODAL */}
      {showSigModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-white rounded-xl border border-zinc-200 shadow-2xl p-5 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-zinc-200">
              <h3 className="font-bold text-xs uppercase tracking-wider text-zinc-900">
                Sign Digital Certificate ({activeSigner === 'operator' ? 'Operator' : 'Driver'})
              </h3>
              <button
                type="button"
                onClick={() => setShowSigModal(false)}
                className="text-zinc-400 hover:text-zinc-600 text-xs font-bold"
              >
                ✕
              </button>
            </div>

            <div className="border border-zinc-300 rounded-lg overflow-hidden bg-white">
              <canvas
                ref={canvasRef}
                width={340}
                height={160}
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                onTouchStart={startDrawing}
                onTouchMove={draw}
                onTouchEnd={stopDrawing}
                className="cursor-crosshair w-full h-40 bg-white"
              />
            </div>

            <div className="flex justify-between items-center pt-2">
              <button
                type="button"
                onClick={clearCanvas}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-200 text-xs text-zinc-600 hover:bg-zinc-100"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Clear</span>
              </button>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowSigModal(false)}
                  className="px-3 py-1.5 rounded-lg border border-zinc-200 text-xs text-zinc-600 hover:bg-zinc-100"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={saveSignature}
                  className="px-4 py-1.5 rounded-lg bg-zinc-900 hover:bg-black text-white text-xs font-semibold"
                >
                  Apply Signature
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function TicketsPage() {
  return (
    <Suspense fallback={<div className="text-xs text-zinc-400 p-8 text-center">Loading tickets console...</div>}>
      <TicketContent />
    </Suspense>
  );
}
