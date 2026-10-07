'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { 
  Download, 
  RotateCw, 
  FileSpreadsheet, 
  TrendingUp, 
  Scale, 
  Truck, 
  Layers, 
  Printer, 
  BarChart3, 
  Calendar,
  Filter,
  CheckCircle2
} from 'lucide-react';
import { api } from '@/lib/api';
import { RouteGuard } from '@/components/auth/RouteGuard';

export default function ReportsPage() {
  const [reportType, setReportType] = useState<'tonnage' | 'status' | 'activity' | 'shift'>('tonnage');
  const [period, setPeriod] = useState<'daily' | 'weekly' | 'monthly' | 'custom'>('daily');
  const [groupBy, setGroupBy] = useState<'material' | 'supplier' | 'vehicle'>('material');
  const [reportData, setReportData] = useState<any[]>([]);
  const [groupField, setGroupField] = useState<string>('');
  const [summary, setSummary] = useState<{
    total_net_weight: number;
    total_tonnage: number;
    total_transactions: number;
    average_net_weight: number;
    trend?: { first_weighing_datetime__date: string; tonnage: number; count: number }[];
  } | null>(null);
  const [shiftSummary, setShiftSummary] = useState<any | null>(null);

  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const fetchReport = async () => {
    try {
      setLoading(true);
      const res = await api.get('/reports/engine/generate/', {
        params: {
          type: reportType,
          period,
          group_by: groupBy,
          ...(dateFrom ? { date_from: dateFrom } : {}),
          ...(dateTo ? { date_to: dateTo } : {}),
        },
      });

      if (reportType === 'shift') {
        setReportData(res.data.operators || []);
        setShiftSummary(res.data.summary || null);
        setGroupField('operator__username');
      } else {
        setReportData(res.data.data || []);
        setGroupField(res.data.group_field || '');
        setSummary(res.data.summary || null);
        setShiftSummary(null);
      }
    } catch (err) {
      console.error('Failed to generate report:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, [reportType, period, groupBy, dateFrom, dateTo]);

  const handleExportCsv = async () => {
    try {
      const res = await api.get('/reports/engine/export/', {
        params: {
          type: reportType,
          period,
          group_by: groupBy,
          ...(dateFrom ? { date_from: dateFrom } : {}),
          ...(dateTo ? { date_to: dateTo } : {}),
        },
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${reportType}_report_${period}_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch {
      alert('Failed to export CSV report.');
    }
  };

  const handlePrintReport = () => {
    if (typeof window !== 'undefined') {
      window.print();
    }
  };

  // Calculate percentage share for visual bars
  const maxWeight = useMemo(() => {
    if (!reportData || reportData.length === 0) return 1;
    return Math.max(...reportData.map((r) => Number(r.total_net_weight || r.count || 0)), 1);
  }, [reportData]);

  // Overall totals across current data table
  const totals = useMemo(() => {
    if (reportType === 'tonnage') {
      const totalKg = reportData.reduce((acc, r) => acc + Number(r.total_net_weight || 0), 0);
      const totalCount = reportData.reduce((acc, r) => acc + Number(r.transaction_count || 0), 0);
      return {
        weight: totalKg,
        tonnage: totalKg / 1000,
        count: totalCount,
        avg: totalCount > 0 ? totalKg / totalCount : 0
      };
    }
    const count = reportData.reduce((acc, r) => acc + Number(r.count || 0), 0);
    return { weight: 0, tonnage: 0, count, avg: 0 };
  }, [reportData, reportType]);

  return (
    <RouteGuard roles={['Supervisor', 'Manager', 'Administrator']}>
      <div className="space-y-5 print:space-y-3">
        {/* Header Title & Export Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-200/80 pb-4">
          <div>
            <h2 className="text-xl font-black tracking-tight text-zinc-900 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-emerald-600" />
              Executive Analytics & Operational Reports
            </h2>
            <p className="text-xs text-zinc-500 mt-0.5">
              Certified weighbridge tonnage aggregations, breakdown by commodity, and transaction telemetry
            </p>
          </div>

          <div className="flex items-center gap-2 print:hidden">
            <button
              type="button"
              onClick={handlePrintReport}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-200 bg-white hover:bg-zinc-50 text-xs font-semibold text-zinc-700 shadow-2xs transition-colors"
              title="Print certified PDF ledger"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print / PDF</span>
            </button>

            <button
              type="button"
              onClick={handleExportCsv}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-black text-xs font-semibold text-white shadow-2xs transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>

            <button
              type="button"
              onClick={fetchReport}
              disabled={loading}
              className="p-1.5 rounded-lg border border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-600 transition-colors"
              title="Refresh"
            >
              <RotateCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Filter Toolbar */}
        <div className="p-3 bg-white border border-zinc-200 rounded-xl flex flex-wrap gap-3.5 text-xs items-center shadow-2xs print:hidden">
          <div className="flex items-center gap-1.5 text-zinc-400 font-bold uppercase text-[10px]">
            <Filter className="w-3 h-3 text-zinc-600" />
            <span>Scope:</span>
          </div>

          <div>
            <select
              value={reportType}
              onChange={(e: any) => setReportType(e.target.value)}
              className="bg-zinc-50 border border-zinc-200 rounded-lg px-2.5 py-1 text-zinc-900 font-medium focus:outline-none focus:border-zinc-800"
            >
              <option value="tonnage">Tonnage & Material Ledger</option>
              <option value="shift">Shift & Operator Reconciliation</option>
              <option value="status">Status & Workflow Breakdown</option>
              <option value="activity">User Audit & Operator Operations</option>
            </select>
          </div>

          <div>
            <select
              value={period}
              onChange={(e: any) => setPeriod(e.target.value)}
              className="bg-zinc-50 border border-zinc-200 rounded-lg px-2.5 py-1 text-zinc-900 font-medium focus:outline-none focus:border-zinc-800"
            >
              <option value="daily">Today (Daily)</option>
              <option value="weekly">This Week (Weekly)</option>
              <option value="monthly">This Month (Monthly)</option>
              <option value="custom">Custom Date Range</option>
            </select>
          </div>

          {reportType === 'tonnage' && (
            <div>
              <select
                value={groupBy}
                onChange={(e: any) => setGroupBy(e.target.value)}
                className="bg-zinc-50 border border-zinc-200 rounded-lg px-2.5 py-1 text-zinc-900 font-medium focus:outline-none focus:border-zinc-800"
              >
                <option value="material">Group by Commodity / Material</option>
                <option value="supplier">Group by Supplier</option>
                <option value="vehicle">Group by Vehicle Plate</option>
              </select>
            </div>
          )}

          <div className="flex items-center gap-1.5 ml-auto">
            <span className="text-[10px] text-zinc-400 uppercase font-bold">From:</span>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => {
                setDateFrom(e.target.value);
                setPeriod('custom');
              }}
              className="bg-zinc-50 border border-zinc-200 rounded-lg px-2 py-0.5 text-zinc-900 font-mono text-[11px] focus:outline-none focus:border-zinc-800"
            />
            <span className="text-[10px] text-zinc-400 uppercase font-bold">To:</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => {
                setDateTo(e.target.value);
                setPeriod('custom');
              }}
              className="bg-zinc-50 border border-zinc-200 rounded-lg px-2 py-0.5 text-zinc-900 font-mono text-[11px] focus:outline-none focus:border-zinc-800"
            />
            {(dateFrom || dateTo) && (
              <button
                type="button"
                onClick={() => { setDateFrom(''); setDateTo(''); setPeriod('daily'); }}
                className="px-2 py-0.5 text-[11px] text-zinc-500 hover:text-zinc-800 underline"
              >
                Reset
              </button>
            )}
          </div>
        </div>

        {/* Executive KPI Summary Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="p-3.5 rounded-xl bg-white border border-zinc-200 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-zinc-400">Net Payload</span>
              <Scale className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="mt-1">
              <div className="text-xl font-mono font-black text-zinc-900 tracking-tight">
                {reportType === 'tonnage' ? `${totals.tonnage.toLocaleString(undefined, { maximumFractionDigits: 2 })} t` : `${totals.count} ops`}
              </div>
              <p className="text-[10px] text-zinc-500 font-mono mt-0.5">
                {reportType === 'tonnage' ? `${totals.weight.toLocaleString()} kg total` : 'Across selected criteria'}
              </p>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-white border border-zinc-200 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-zinc-400">Total Transactions</span>
              <Truck className="w-4 h-4 text-blue-600" />
            </div>
            <div className="mt-1">
              <div className="text-xl font-mono font-black text-zinc-900 tracking-tight">
                {totals.count}
              </div>
              <p className="text-[10px] text-emerald-600 font-bold flex items-center gap-0.5 mt-0.5">
                <CheckCircle2 className="w-3 h-3" /> Certified slips
              </p>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-white border border-zinc-200 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-zinc-400">Avg Haul Mass</span>
              <TrendingUp className="w-4 h-4 text-amber-600" />
            </div>
            <div className="mt-1">
              <div className="text-xl font-mono font-black text-zinc-900 tracking-tight">
                {reportType === 'tonnage' ? `${(totals.avg / 1000).toFixed(2)} t` : '-'}
              </div>
              <p className="text-[10px] text-zinc-500 font-mono mt-0.5">
                {reportType === 'tonnage' ? `${Math.round(totals.avg).toLocaleString()} kg / ticket` : 'Not applicable'}
              </p>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-white border border-zinc-200 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-zinc-400">Active Streams</span>
              <Layers className="w-4 h-4 text-purple-600" />
            </div>
            <div className="mt-1">
              <div className="text-xl font-mono font-black text-zinc-900 tracking-tight">
                {reportData.length}
              </div>
              <p className="text-[10px] text-zinc-500 font-sans mt-0.5">
                Distinct categories
              </p>
            </div>
          </div>
        </div>

        {/* Visual Charts & Distribution Bar Card */}
        {reportType === 'tonnage' && reportData.length > 0 && (
          <div className="p-4 bg-white border border-zinc-200 rounded-xl shadow-2xs space-y-3">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-2">
              <h3 className="font-bold text-xs uppercase tracking-wider text-zinc-700 flex items-center gap-1.5">
                <BarChart3 className="w-3.5 h-3.5 text-zinc-600" />
                Commodity Mass Distribution Breakdown
              </h3>
              <span className="text-[10px] font-mono text-zinc-400">
                Top {reportData.length} active streams
              </span>
            </div>

            <div className="space-y-2.5 pt-1">
              {reportData.map((row, idx) => {
                const label = row[groupField] || 'Unassigned';
                const weight = Number(row.total_net_weight || 0);
                const pct = totals.weight > 0 ? (weight / totals.weight) * 100 : 0;
                const barWidth = `${Math.min(Math.max(pct, 2), 100)}%`;

                return (
                  <div key={idx} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-zinc-800" />
                        <span className="font-semibold text-zinc-900">{label}</span>
                        <span className="text-[10px] text-zinc-400 font-mono">({row.transaction_count} trips)</span>
                      </div>
                      <div className="font-mono text-xs text-zinc-800">
                        <span className="font-bold">{(weight / 1000).toFixed(2)} t</span>
                        <span className="text-zinc-400 text-[10px] ml-1.5">({pct.toFixed(1)}%)</span>
                      </div>
                    </div>
                    {/* Progress Track */}
                    <div className="w-full h-2 rounded-full bg-zinc-100 overflow-hidden">
                      <div 
                        className="h-full bg-zinc-900 rounded-full transition-all duration-500 ease-out" 
                        style={{ width: barWidth }} 
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Certified Data Ledger Table */}
        <div className="rounded-xl bg-white border border-zinc-200 shadow-2xs overflow-hidden">
          <div className="px-4 py-3 border-b border-zinc-100 bg-zinc-50/70 flex items-center justify-between">
            <h3 className="font-bold text-xs uppercase tracking-wider text-zinc-700 flex items-center gap-1.5">
              <FileSpreadsheet className="w-3.5 h-3.5 text-zinc-600" />
              Certified Transaction Ledger
            </h3>
            <span className="text-[10px] font-mono text-zinc-500">
              {reportData.length} line items recorded
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-50 text-zinc-500 font-bold border-b border-zinc-200 uppercase text-[10px]">
                <tr>
                  {reportType === 'tonnage' && (
                    <>
                      <th className="px-4 py-2.5">Category Group</th>
                      <th className="px-4 py-2.5 text-center">Transactions</th>
                      <th className="px-4 py-2.5 text-right">Net Mass (kg)</th>
                      <th className="px-4 py-2.5 text-right">Certified Tonnage (t)</th>
                      <th className="px-4 py-2.5 text-right">Share (%)</th>
                    </>
                  )}
                  {reportType === 'status' && (
                    <>
                      <th className="px-4 py-2.5">Transaction Status</th>
                      <th className="px-4 py-2.5 text-right">Total Count</th>
                      <th className="px-4 py-2.5 text-right">Share (%)</th>
                    </>
                  )}
                  {reportType === 'activity' && (
                    <>
                      <th className="px-4 py-2.5">Operator</th>
                      <th className="px-4 py-2.5">Action Executed</th>
                      <th className="px-4 py-2.5 text-right">Operations Count</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 text-zinc-700">
                {reportData.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-12 text-center text-zinc-400">
                      No certified weighing records match the selected date range and filter criteria.
                    </td>
                  </tr>
                ) : (
                  reportData.map((row, idx) => {
                    if (reportType === 'tonnage') {
                      const weight = Number(row.total_net_weight || 0);
                      const pct = totals.weight > 0 ? (weight / totals.weight) * 100 : 0;
                      return (
                        <tr key={idx} className="hover:bg-zinc-50/80 transition-colors">
                          <td className="px-4 py-2.5 font-bold text-zinc-900">{row[groupField] || 'Unassigned'}</td>
                          <td className="px-4 py-2.5 text-center font-mono font-semibold text-zinc-600">{row.transaction_count}</td>
                          <td className="px-4 py-2.5 text-right font-mono text-zinc-700">
                            {weight.toLocaleString()} kg
                          </td>
                          <td className="px-4 py-2.5 text-right font-mono font-bold text-zinc-900">
                            <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200/60">
                              {(weight / 1000).toFixed(2)} t
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-right font-mono text-zinc-500 font-semibold">
                            {pct.toFixed(1)}%
                          </td>
                        </tr>
                      );
                    }

                    if (reportType === 'status') {
                      const count = Number(row.count || 0);
                      const pct = totals.count > 0 ? (count / totals.count) * 100 : 0;
                      return (
                        <tr key={idx} className="hover:bg-zinc-50/80 transition-colors">
                          <td className="px-4 py-2.5 font-bold text-zinc-900">
                            <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold border ${
                              row.status === 'Completed' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' :
                              row.status === 'Pending Verification' ? 'bg-amber-50 text-amber-800 border-amber-200' :
                              'bg-zinc-100 text-zinc-700 border-zinc-200'
                            }`}>
                              {row.status}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-right font-mono font-bold text-zinc-900">{count}</td>
                          <td className="px-4 py-2.5 text-right font-mono text-zinc-500 font-semibold">{pct.toFixed(1)}%</td>
                        </tr>
                      );
                    }

                    return (
                      <tr key={idx} className="hover:bg-zinc-50/80 transition-colors">
                        <td className="px-4 py-2.5 font-bold text-zinc-900">{row.user__username || 'System'}</td>
                        <td className="px-4 py-2.5 font-mono text-zinc-600">{row.action}</td>
                        <td className="px-4 py-2.5 text-right font-mono font-bold text-zinc-900">{row.count}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
              {reportData.length > 0 && reportType === 'tonnage' && (
                <tfoot className="bg-zinc-50 border-t-2 border-zinc-200 font-bold text-xs text-zinc-900">
                  <tr>
                    <td className="px-4 py-2.5 uppercase text-[10px] tracking-wider text-zinc-500">Total Aggregations</td>
                    <td className="px-4 py-2.5 text-center font-mono">{totals.count}</td>
                    <td className="px-4 py-2.5 text-right font-mono">{totals.weight.toLocaleString()} kg</td>
                    <td className="px-4 py-2.5 text-right font-mono text-emerald-800 font-black">
                      {totals.tonnage.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} t
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono">100.0%</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      </div>
    </RouteGuard>
  );
}
