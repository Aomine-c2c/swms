'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { 
  Scale, 
  ArrowUpRight, 
  Clock, 
  CheckCircle, 
  AlertTriangle, 
  Truck, 
  PlusCircle, 
  RotateCw 
} from 'lucide-react';
import { api } from '@/lib/api';
import { WeighingTransaction } from '@/types';
import { RouteGuard } from '@/components/auth/RouteGuard';

export default function DashboardPage() {
  const [stats, setStats] = useState({
    todayTransactions: 0,
    openTransactions: 0,
    pendingApprovals: 0,
    todayTonnage: 0,
  });
  const [recentTransactions, setRecentTransactions] = useState<WeighingTransaction[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const [txRes, summaryRes, approvalsRes] = await Promise.allSettled([
        api.get('/transactions/?page_size=6'),
        api.get('/reports/dashboard/operator_summary/'),
        api.get('/approvals/?status=PENDING'),
      ]);

      if (txRes.status === 'fulfilled') {
        const txData = txRes.value.data.results || txRes.value.data || [];
        setRecentTransactions(txData);
      }

      let openCount = 0;
      let completedCount = 0;
      let totalTon = 0;

      if (summaryRes.status === 'fulfilled') {
        const summary = summaryRes.value.data;
        openCount = summary.open_count || 0;
        completedCount = summary.completed_today_count || 0;
        totalTon = summary.today_tonnage || 0;
      }

      let pendingAppCount = 0;
      if (approvalsRes.status === 'fulfilled') {
        const approvals = approvalsRes.value.data.results || approvalsRes.value.data || [];
        pendingAppCount = Array.isArray(approvals) ? approvals.length : 0;
      }

      setStats({
        todayTransactions: completedCount,
        openTransactions: openCount,
        pendingApprovals: pendingAppCount,
        todayTonnage: totalTon,
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  return (
    <RouteGuard permission="view_dashboards" roles={['Administrator', 'Manager', 'Supervisor']}>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-zinc-900">Dashboard & Overview</h2>
            <p className="text-xs text-zinc-500 mt-0.5">Terminal throughput and operational KPIs</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={fetchDashboardData}
              disabled={loading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-200 bg-white hover:bg-zinc-100 text-xs font-semibold text-zinc-700 transition-colors"
            >
              <RotateCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
            <Link
              href="/transactions"
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-black text-xs font-semibold text-white transition-all shadow-sm"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Weighbridge Console</span>
            </Link>
          </div>
        </div>

        {/* Metric Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 rounded-xl bg-white border border-zinc-200 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">Completed Today</span>
              <div className="p-1.5 rounded-md bg-zinc-100 text-zinc-900">
                <CheckCircle className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-bold text-zinc-900 font-mono tabular-nums">{stats.todayTransactions}</div>
              <p className="text-[11px] text-zinc-400 mt-0.5">Closed weighings</p>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-white border border-zinc-200 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">Open in Queue</span>
              <div className="p-1.5 rounded-md bg-zinc-100 text-zinc-900">
                <Clock className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-bold text-zinc-900 font-mono tabular-nums">{stats.openTransactions}</div>
              <p className="text-[11px] text-zinc-400 mt-0.5">Awaiting 2nd weigh</p>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-white border border-zinc-200 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">Total Tonnage</span>
              <div className="p-1.5 rounded-md bg-zinc-100 text-zinc-900">
                <Scale className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-bold text-zinc-900 font-mono tabular-nums">
                {(stats.todayTonnage / 1000).toFixed(2)} <span className="text-sm font-normal text-zinc-500">t</span>
              </div>
              <p className="text-[11px] text-zinc-400 mt-0.5">{stats.todayTonnage.toLocaleString()} kg net</p>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-white border border-zinc-200 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">Pending Approvals</span>
              <div className="p-1.5 rounded-md bg-zinc-100 text-zinc-900">
                <AlertTriangle className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-bold text-zinc-900 font-mono tabular-nums">{stats.pendingApprovals}</div>
              <p className="text-[11px] text-zinc-400 mt-0.5">Exceptions to review</p>
            </div>
          </div>
        </div>

        {/* Recent Transactions List */}
        <div className="rounded-xl bg-white border border-zinc-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-zinc-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Truck className="w-4 h-4 text-zinc-900" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-900">Recent Weighings</h3>
            </div>
            <Link
              href="/transactions"
              className="text-xs text-zinc-600 hover:text-zinc-900 font-medium flex items-center gap-1"
            >
              <span>View Terminal</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-50 text-zinc-600 font-bold border-b border-zinc-200 uppercase text-[10px]">
                <tr>
                  <th className="px-4 py-3">Ticket / Date</th>
                  <th className="px-4 py-3">Vehicle</th>
                  <th className="px-4 py-3">Material</th>
                  <th className="px-4 py-3">Net (kg)</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 text-zinc-700">
                {recentTransactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-zinc-50">
                    <td className="px-4 py-2.5 font-mono font-bold text-zinc-900">
                      {tx.ticket_number || `#${tx.id}`}
                    </td>
                    <td className="px-4 py-2.5 font-mono">
                      {typeof tx.vehicle === 'object' ? tx.vehicle.license_plate : tx.vehicle_license}
                    </td>
                    <td className="px-4 py-2.5">
                      {typeof tx.material === 'object' ? tx.material.name : tx.material_name}
                    </td>
                    <td className="px-4 py-2.5 font-mono font-bold text-zinc-900">
                      {tx.net_weight ? Number(tx.net_weight).toLocaleString() : '-'}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-semibold bg-zinc-100 text-zinc-800 border border-zinc-200">
                        {tx.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </RouteGuard>
  );
}
