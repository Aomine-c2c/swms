'use client';

import React, { useEffect, useState, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  FileText,
  Printer,
  Search,
  CheckCircle,
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
  FileCheck
} from 'lucide-react';
import { api } from '@/lib/api';

function TicketContent() {
  const searchParams = useSearchParams();
  const ticketParam = searchParams.get('ticket');
  const [ticketQuery, setTicketQuery] = useState(ticketParam || '');
  const [ticketData, setTicketData] = useState<any | null>(null);
  const [ticketObj, setTicketObj] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reprinting, setReprinting] = useState(false);

  // Enhancements State
  const [ticketFormat, setTicketFormat] = useState<'A4' | 'THERMAL'>('A4');
  const [showSigModal, setShowSigModal] = useState(false);
  const [operatorSig, setOperatorSig] = useState<string | null>(null);
  const [driverSig, setDriverSig] = useState<string | null>(null);
  const [activeSigner, setActiveSigner] = useState<'operator' | 'driver'>('operator');

  // Canvas ref for interactive signature
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDrawing = useRef(false);

  const fetchTicket = async (query: string) => {
    if (!query) return;
    try {
      setLoading(true);
      setError(null);
      const res = await api.get(`/tickets/?ticket_number=${encodeURIComponent(query)}`);
      const results = res.data.results || res.data || [];
      if (results.length > 0) {
        setTicketObj(results[0]);
        // Prefer transaction_details if populated
        setTicketData(results[0].transaction_details || results[0]);
      } else {
        // Fallback to fetch transaction directly
        const txRes = await api.get(`/transactions/${query}/`).catch(() => null);
        if (txRes?.data) {
          setTicketData(txRes.data);
          // Try to get corresponding ticket
          const tRes = await api.get(`/tickets/?transaction_id=${txRes.data.id}`).catch(() => null);
          const tList = tRes?.data?.results || tRes?.data || [];
          if (tList.length > 0) setTicketObj(tList[0]);
        } else {
          setError('Ticket or transaction not found.');
          setTicketData(null);
          setTicketObj(null);
        }
      }
    } catch {
      setError('Failed to fetch ticket.');
      setTicketData(null);
      setTicketObj(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (ticketParam) {
      fetchTicket(ticketParam);
    }
  }, [ticketParam]);

  const handlePrint = async () => {
    if (ticketObj?.id) {
      try {
        setReprinting(true);
        const res = await api.post(`/tickets/${ticketObj.id}/reprint/`);
        setTicketObj(res.data);
      } catch {
        // Continue to print even if tracking fails
      } finally {
        setReprinting(false);
      }
    }
    if (typeof window !== 'undefined') {
      window.print();
    }
  };

  const handleEmailDispatch = () => {
    const ticketNo = ticketObj?.ticket_number || ticketData?.ticket_number || `TX-${ticketData?.id}`;
    const subject = encodeURIComponent(`Weighbridge Certificate ${ticketNo}`);
    const body = encodeURIComponent(
      `Official Weighbridge Certificate ${ticketNo}\nVehicle: ${
        ticketData?.vehicle?.license_plate || ticketData?.vehicle_license || 'N/A'
      }\nCertified Net Weight: ${ticketData?.net_weight ? Number(ticketData.net_weight).toLocaleString() : '-'} kg\nIssued: ${new Date().toLocaleString()}`
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

  const printCount = ticketObj?.print_count ?? 1;
  const isReprint = printCount > 1;

  return (
    <div className="space-y-6">
      {/* Header with Title and Global Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 print:hidden">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-zinc-900">Weighbridge Tickets & Certificates</h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            Search, preview, sign, and print official certified weighment documentation
          </p>
        </div>

        {ticketData && (
          <div className="flex items-center gap-2">
            {/* Format Switcher */}
            <div className="flex border border-zinc-200 rounded-lg p-0.5 bg-zinc-100 text-xs font-semibold mr-1">
              <button
                type="button"
                onClick={() => setTicketFormat('A4')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-all ${
                  ticketFormat === 'A4' ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500'
                }`}
              >
                <FileCheck className="w-3.5 h-3.5" />
                <span>Standard A4</span>
              </button>
              <button
                type="button"
                onClick={() => setTicketFormat('THERMAL')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-all ${
                  ticketFormat === 'THERMAL' ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500'
                }`}
              >
                <Receipt className="w-3.5 h-3.5" />
                <span>80mm Thermal</span>
              </button>
            </div>

            <button
              onClick={handleEmailDispatch}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-zinc-200 bg-white hover:bg-zinc-100 text-xs font-semibold text-zinc-700 transition-colors"
              title="Send via Email"
            >
              <Mail className="w-3.5 h-3.5" />
              <span>Email</span>
            </button>

            <button
              onClick={handlePrint}
              disabled={reprinting}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-zinc-900 hover:bg-black text-xs font-semibold text-white transition-all shadow-sm"
            >
              <Printer className="w-4 h-4" />
              <span>{isReprint ? 'Print Duplicate Slip' : 'Print Official Slip'}</span>
            </button>
          </div>
        )}
      </div>

      {/* Search Bar */}
      <div className="flex gap-2 max-w-md print:hidden">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-2.5" />
          <input
            type="text"
            placeholder="Enter ticket number (e.g. TKT-2026-...) or ID..."
            value={ticketQuery}
            onChange={(e) => setTicketQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && fetchTicket(ticketQuery)}
            className="w-full bg-white border border-zinc-200 rounded-lg pl-10 pr-4 py-2 text-xs text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-zinc-800"
          />
        </div>
        <button
          onClick={() => fetchTicket(ticketQuery)}
          className="px-4 py-2 rounded-lg bg-zinc-900 hover:bg-black text-xs font-semibold text-white transition-colors"
        >
          {loading ? 'Searching...' : 'Search'}
        </button>
      </div>

      {error && (
        <div className="p-3 bg-zinc-100 border border-zinc-300 rounded-lg text-zinc-800 text-xs print:hidden">
          {error}
        </div>
      )}

      {/* TICKET DISPLAY CONTAINER */}
      {ticketData ? (
        ticketFormat === 'A4' ? (
          /* ================= STANDARD A4 CERTIFICATE ================= */
          <div className="relative max-w-2xl mx-auto bg-white text-zinc-900 p-8 rounded-2xl shadow-sm border border-zinc-200 print:shadow-none print:border-none print:m-0 print:p-4 overflow-hidden">
            {/* Watermark for reprints */}
            {isReprint && (
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center opacity-10 rotate-[-30deg] select-none">
                <span className="text-7xl font-black font-mono tracking-widest text-zinc-900">
                  DUPLICATE #{printCount}
                </span>
              </div>
            )}

            {/* Header */}
            <div className="flex items-center justify-between border-b-2 border-zinc-900 pb-4 mb-6">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-lg bg-zinc-900 text-white">
                  <Scale className="w-6 h-6" />
                </div>
                <div>
                  <h1 className="font-black text-lg tracking-wider text-zinc-900 uppercase">
                    Smart-Weigh System
                  </h1>
                  <p className="text-xs text-zinc-600 font-medium">Official Weighbridge Weight Certificate</p>
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm font-mono font-bold text-zinc-900">
                  {ticketObj?.ticket_number || ticketData.ticket_number || `TKT-#${ticketData.id}`}
                </div>
                <div className="text-[10px] text-zinc-500 font-mono">
                  Issued: {new Date().toLocaleDateString()} • Print #{printCount}
                </div>
              </div>
            </div>

            {/* Metadata Grid */}
            <div className="grid grid-cols-2 gap-6 text-xs mb-8">
              <div className="space-y-3">
                <div>
                  <span className="block text-[10px] uppercase font-bold text-zinc-400">Vehicle Plate</span>
                  <span className="font-mono text-base font-bold text-zinc-900">
                    {typeof ticketData.vehicle === 'object' ? ticketData.vehicle?.license_plate : ticketData.vehicle_license || ticketData.vehicle}
                  </span>
                </div>
                <div>
                  <span className="block text-[10px] uppercase font-bold text-zinc-400">Driver</span>
                  <span className="font-semibold text-zinc-800">
                    {typeof ticketData.driver === 'object' ? ticketData.driver?.name : ticketData.driver_name || 'Standard Carrier Driver'}
                  </span>
                </div>
                <div>
                  <span className="block text-[10px] uppercase font-bold text-zinc-400">Supplier / Vendor</span>
                  <span className="font-semibold text-zinc-800">
                    {typeof ticketData.supplier === 'object' ? ticketData.supplier?.name : ticketData.supplier_name || 'Direct Commercial'}
                  </span>
                </div>
              </div>

              <div className="space-y-3 text-right">
                <div>
                  <span className="block text-[10px] uppercase font-bold text-zinc-400">Material</span>
                  <span className="font-bold text-zinc-900">
                    {typeof ticketData.material === 'object' ? ticketData.material?.name : ticketData.material_name || ticketData.material}
                  </span>
                </div>
                <div>
                  <span className="block text-[10px] uppercase font-bold text-zinc-400">1st Weighing Time</span>
                  <span className="font-mono text-zinc-700">
                    {ticketData.first_weighing_datetime ? new Date(ticketData.first_weighing_datetime).toLocaleString() : '-'}
                  </span>
                </div>
                <div>
                  <span className="block text-[10px] uppercase font-bold text-zinc-400">2nd Weighing Time</span>
                  <span className="font-mono text-zinc-700">
                    {ticketData.second_weighing_datetime ? new Date(ticketData.second_weighing_datetime).toLocaleString() : '-'}
                  </span>
                </div>
              </div>
            </div>

            {/* Weight Breakdown */}
            <div className="border border-zinc-200 rounded-xl overflow-hidden mb-6">
              <table className="w-full text-xs">
                <thead className="bg-zinc-50 font-bold text-zinc-600 border-b border-zinc-200">
                  <tr>
                    <th className="px-4 py-2.5 text-left uppercase text-[10px]">Weight Parameter</th>
                    <th className="px-4 py-2.5 text-right uppercase text-[10px]">Reading</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 font-mono">
                  <tr>
                    <td className="px-4 py-2.5 text-zinc-700">Gross Weight (Loaded)</td>
                    <td className="px-4 py-2.5 text-right font-bold text-zinc-900">
                      {ticketData.gross_weight ? `${Number(ticketData.gross_weight).toLocaleString()} kg` : '-'}
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2.5 text-zinc-700">Tare Weight (Empty)</td>
                    <td className="px-4 py-2.5 text-right font-bold text-zinc-900">
                      {ticketData.tare_weight ? `${Number(ticketData.tare_weight).toLocaleString()} kg` : '-'}
                    </td>
                  </tr>
                  <tr className="bg-zinc-100 font-bold text-zinc-900 text-sm">
                    <td className="px-4 py-3 font-sans">TOTAL CERTIFIED NET WEIGHT</td>
                    <td className="px-4 py-3 text-right text-base text-zinc-900">
                      {ticketData.net_weight ? `${Number(ticketData.net_weight).toLocaleString()} kg` : '-'}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Remarks / Lab Quality Note */}
            {ticketData.remarks && (
              <div className="mb-6 p-3 bg-zinc-50 border border-zinc-200 rounded-lg text-xs font-mono text-zinc-700">
                <span className="font-bold font-sans text-zinc-900 block mb-0.5 text-[11px]">Audit / Lab Notes:</span>
                {ticketData.remarks}
              </div>
            )}

            {/* Signatures & QR Code Section */}
            <div className="grid grid-cols-3 gap-6 pt-6 border-t border-dashed border-zinc-300 items-end text-xs">
              {/* Operator Signature */}
              <div className="text-center">
                <div
                  onClick={() => {
                    setActiveSigner('operator');
                    setShowSigModal(true);
                  }}
                  className="h-16 border-b border-zinc-400 flex items-center justify-center cursor-pointer hover:bg-zinc-50 transition-colors"
                  title="Click to sign digitally"
                >
                  {operatorSig ? (
                    <img src={operatorSig} alt="Operator Sig" className="max-h-14 object-contain" />
                  ) : (
                    <span className="text-[10px] text-zinc-400 flex items-center gap-1 print:hidden">
                      <PenTool className="w-3 h-3" /> Click to Sign
                    </span>
                  )}
                </div>
                <p className="mt-1 font-semibold text-zinc-700 text-[11px]">Weighbridge Operator</p>
                <p className="text-[10px] text-zinc-500 font-mono">
                  {ticketData.operator_name || 'System Operator'}
                </p>
              </div>

              {/* Security QR Code */}
              <div className="flex flex-col items-center justify-center text-center">
                <div className="p-2 border border-zinc-200 rounded-lg bg-zinc-50">
                  <div className="w-16 h-16 bg-zinc-900 flex items-center justify-center text-white rounded">
                    <QrCode className="w-10 h-10" />
                  </div>
                </div>
                <span className="text-[9px] text-zinc-500 font-mono mt-1">SECURE VERIFY</span>
              </div>

              {/* Driver Signature */}
              <div className="text-center">
                <div
                  onClick={() => {
                    setActiveSigner('driver');
                    setShowSigModal(true);
                  }}
                  className="h-16 border-b border-zinc-400 flex items-center justify-center cursor-pointer hover:bg-zinc-50 transition-colors"
                  title="Click to sign digitally"
                >
                  {driverSig ? (
                    <img src={driverSig} alt="Driver Sig" className="max-h-14 object-contain" />
                  ) : (
                    <span className="text-[10px] text-zinc-400 flex items-center gap-1 print:hidden">
                      <PenTool className="w-3 h-3" /> Click to Sign
                    </span>
                  )}
                </div>
                <p className="mt-1 font-semibold text-zinc-700 text-[11px]">Vehicle Driver</p>
                <p className="text-[10px] text-zinc-500 font-mono">
                  {typeof ticketData.driver === 'object' ? ticketData.driver?.name : ticketData.driver_name || 'Driver Signature'}
                </p>
              </div>
            </div>
          </div>
        ) : (
          /* ================= 80MM THERMAL RECEIPT FORMAT ================= */
          <div className="relative max-w-xs mx-auto bg-white text-zinc-900 p-5 rounded-2xl shadow-sm border border-zinc-200 font-mono text-xs print:shadow-none print:border-none print:m-0 print:p-2">
            {isReprint && (
              <div className="text-center py-1 bg-zinc-100 border border-zinc-300 rounded font-bold text-[10px] uppercase tracking-wider mb-3">
                *** DUPLICATE REPRINT #{printCount} ***
              </div>
            )}

            <div className="text-center pb-3 border-b border-dashed border-zinc-300">
              <h2 className="font-black text-sm uppercase tracking-wide">SMART-WEIGH SYSTEM</h2>
              <p className="text-[10px] text-zinc-500">WEIGHBRIDGE CERTIFICATE</p>
              <p className="font-bold text-xs mt-1">
                {ticketObj?.ticket_number || ticketData.ticket_number || `TX-${ticketData.id}`}
              </p>
              <p className="text-[10px] text-zinc-500">{new Date().toLocaleString()}</p>
            </div>

            <div className="py-3 space-y-1.5 border-b border-dashed border-zinc-300 text-[11px]">
              <div className="flex justify-between">
                <span className="text-zinc-500">PLATE:</span>
                <span className="font-bold">
                  {typeof ticketData.vehicle === 'object' ? ticketData.vehicle?.license_plate : ticketData.vehicle_license || ticketData.vehicle}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">MATERIAL:</span>
                <span>{typeof ticketData.material === 'object' ? ticketData.material?.name : ticketData.material_name || ticketData.material}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">SUPPLIER:</span>
                <span>{typeof ticketData.supplier === 'object' ? ticketData.supplier?.name : ticketData.supplier_name || 'Direct'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">OPERATOR:</span>
                <span>{ticketData.operator_name || 'Scale 01'}</span>
              </div>
            </div>

            <div className="py-3 space-y-1 border-b-2 border-zinc-900 text-xs">
              <div className="flex justify-between">
                <span>GROSS:</span>
                <span className="font-bold">{ticketData.gross_weight ? Number(ticketData.gross_weight).toLocaleString() : '-'} kg</span>
              </div>
              <div className="flex justify-between">
                <span>TARE:</span>
                <span className="font-bold">{ticketData.tare_weight ? Number(ticketData.tare_weight).toLocaleString() : '-'} kg</span>
              </div>
              <div className="flex justify-between text-sm font-black pt-1 border-t border-zinc-200">
                <span>NET WT:</span>
                <span>{ticketData.net_weight ? Number(ticketData.net_weight).toLocaleString() : '-'} kg</span>
              </div>
            </div>

            {ticketData.remarks && (
              <div className="py-2 text-[10px] text-zinc-600 border-b border-dashed border-zinc-300">
                NOTE: {ticketData.remarks}
              </div>
            )}

            <div className="py-4 space-y-6 text-center text-[10px]">
              <div>
                {operatorSig && <img src={operatorSig} alt="Sig" className="h-8 mx-auto object-contain" />}
                <div className="border-t border-zinc-400 pt-0.5">Operator Signature</div>
              </div>
              <div>
                {driverSig && <img src={driverSig} alt="Sig" className="h-8 mx-auto object-contain" />}
                <div className="border-t border-zinc-400 pt-0.5">Driver Signature</div>
              </div>
            </div>

            <div className="text-center pt-2 text-[9px] text-zinc-400 border-t border-dashed border-zinc-300">
              * VALID ONLY WITH SIGNATURE *
            </div>
          </div>
        )
      ) : (
        <div className="p-12 text-center rounded-xl bg-white border border-zinc-200 text-zinc-500 text-xs">
          Search for a ticket number or navigate from the Weighbridge table to inspect and print slips.
        </div>
      )}

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

            {/* Canvas Area */}
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
    <Suspense fallback={<div className="text-xs text-zinc-400">Loading tickets...</div>}>
      <TicketContent />
    </Suspense>
  );
}
