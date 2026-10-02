'use client';

import React, { useEffect, useState } from 'react';
import { 
  Download, 
  RotateCw,
  FileSpreadsheet
} from 'lucide-react';
import { api } from '@/lib/api';
import { RouteGuard } from '@/components/auth/RouteGuard';

export default function ReportsPage() {
  const [reportType, setReportType] = useState<'tonnage' | 'status' | 'activity'>('tonnage');
  const [period, setPeriod] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const [groupBy, setGroupBy] = useState<'material' | 'supplier' | 'vehicle'>('material');
  const [reportData, setReportData] = useState<any[]>([]);
  const [groupField, setGroupField] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const fetchReport = async () => {
    try {
      setLoading(true);
      const res = await api.get('/reports/engine/generate/', {
        params: {
          type: reportType,
          period,
          group_by: groupBy,
        },
      });
      setReportData(res.data.data || []);
      setGroupField(res.data.group_field || '');
    } catch (err) {
      console.error('Failed to generate report:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, [reportType, period, groupBy]);

  const handleExportCsv = async () => {
    try {
      const res = await api.get('/reports/engine/export/', {
        params: {
          type: reportType,
          period,
          group_by: groupBy,
        },
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${reportType}_report_${period}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch {
      alert('Failed to export CSV report.');
    }
  };

  return (
    <RouteGuard roles={['Supervisor', 'Manager', 'Administrator']}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-zinc-900">Analytics & Reports</h2>
            <p className="text-xs text-zinc-500 mt-0.5">
              Query aggregate tonnage, truck throughput, and export certified records
            </p>
          </div>
          <button
            onClick={handleExportCsv}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-black text-xs font-semibold text-white shadow-sm"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
        </div>

        {/* Filter Toolbar */}
        <div className="p-3.5 bg-white border border-zinc-200 rounded-xl flex flex-wrap gap-4 text-xs items-center shadow-sm">
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-1">Report Category</label>
            <select
              value={reportType}
              onChange={(e: any) => setReportType(e.target.value)}
              className="bg-zinc-50 border border-zinc-200 rounded-lg px-2.5 py-1.5 text-zinc-900 focus:outline-none focus:bg-white focus:border-zinc-800"
            >
              <option value="tonnage">Tonnage Aggregation</option>
              <option value="status">Status Breakdown</option>
              <option value="activity">User Audit Activity</option>
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-1">Time Period</label>
            <select
              value={period}
              onChange={(e: any) => setPeriod(e.target.value)}
              className="bg-zinc-50 border border-zinc-200 rounded-lg px-2.5 py-1.5 text-zinc-900 focus:outline-none focus:bg-white focus:border-zinc-800"
            >
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </div>

          {reportType === 'tonnage' && (
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-1">Group By</label>
              <select
                value={groupBy}
                onChange={(e: any) => setGroupBy(e.target.value)}
                className="bg-zinc-50 border border-zinc-200 rounded-lg px-2.5 py-1.5 text-zinc-900 focus:outline-none focus:bg-white focus:border-zinc-800"
              >
                <option value="material">Material</option>
                <option value="supplier">Supplier</option>
                <option value="vehicle">Vehicle</option>
              </select>
            </div>
          )}
        </div>

        {/* Data Table */}
        <div className="rounded-xl bg-white border border-zinc-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-50 text-zinc-600 font-bold border-b border-zinc-200 uppercase text-[10px]">
                <tr>
                  {reportType === 'tonnage' && (
                    <>
                      <th className="px-4 py-3">Category Group</th>
                      <th className="px-4 py-3">Transactions</th>
                      <th className="px-4 py-3 text-right">Net Weight (kg)</th>
                      <th className="px-4 py-3 text-right">Tonnage (t)</th>
                    </>
                  )}
                  {reportType === 'status' && (
                    <>
                      <th className="px-4 py-3">Transaction Status</th>
                      <th className="px-4 py-3 text-right">Total Count</th>
                    </>
                  )}
                  {reportType === 'activity' && (
                    <>
                      <th className="px-4 py-3">Operator</th>
                      <th className="px-4 py-3">Action</th>
                      <th className="px-4 py-3 text-right">Operations Count</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 text-zinc-700">
                {reportData.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-zinc-400">
                      No records found for the selected query.
                    </td>
                  </tr>
                ) : (
                  reportData.map((row, idx) => (
                    <tr key={idx} className="hover:bg-zinc-50">
                      {reportType === 'tonnage' && (
                        <>
                          <td className="px-4 py-3 font-semibold text-zinc-900">{row[groupField] || 'Unassigned'}</td>
                          <td className="px-4 py-3 font-mono">{row.transaction_count}</td>
                          <td className="px-4 py-3 text-right font-mono font-bold text-zinc-900">
                            {Number(row.total_net_weight || 0).toLocaleString()} kg
                          </td>
                          <td className="px-4 py-3 text-right font-mono font-bold text-zinc-900">
                            {((row.total_net_weight || 0) / 1000).toFixed(2)} t
                          </td>
                        </>
                      )}
                      {reportType === 'status' && (
                        <>
                          <td className="px-4 py-3 font-semibold text-zinc-900">{row.status}</td>
                          <td className="px-4 py-3 text-right font-mono font-bold text-zinc-900">{row.count}</td>
                        </>
                      )}
                      {reportType === 'activity' && (
                        <>
                          <td className="px-4 py-3 font-semibold text-zinc-900">{row.user__username || 'System'}</td>
                          <td className="px-4 py-3">{row.action}</td>
                          <td className="px-4 py-3 text-right font-mono font-bold text-zinc-900">{row.count}</td>
                        </>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </RouteGuard>
  );
}
