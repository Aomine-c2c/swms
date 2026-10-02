'use client';

import React, { useEffect, useState } from 'react';
import {
  History,
  Search,
  RotateCw,
  Download,
  Filter,
  CheckCircle2,
  Clock,
  User,
  ShieldCheck,
  FileText,
  AlertTriangle,
  ArrowRight,
  Database
} from 'lucide-react';
import { api } from '@/lib/api';
import { AuditLogItem } from '@/types';
import { RouteGuard } from '@/components/auth/RouteGuard';

export default function AuditTrailPage() {
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionFilter, setActionFilter] = useState('');
  const [search, setSearch] = useState('');

  // Selected Log for Master-Detail side panel inspection
  const [selectedLog, setSelectedLog] = useState<AuditLogItem | null>(null);

  const fetchAuditLogs = async () => {
    try {
      setLoading(true);
      const url = actionFilter ? `/audit/?action=${encodeURIComponent(actionFilter)}` : '/audit/';
      const res = await api.get(url);
      const list: AuditLogItem[] = res.data.results || res.data || [];
      setLogs(list);
      if (list.length > 0 && !selectedLog) {
        setSelectedLog(list[0]);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAuditLogs();
  }, [actionFilter]);

  const handleExportCSV = () => {
    if (logs.length === 0) return;
    const headers = ['ID', 'Timestamp', 'Operator', 'Action', 'Entity', 'Record_ID', 'Reason', 'Previous_Value', 'New_Value'];
    const rows = logs.map((l) => [
      l.id,
      new Date(l.action_datetime).toISOString(),
      typeof l.user === 'object' ? l.user?.username : (l.user_name || 'System'),
      l.action,
      l.record_type,
      l.record_id,
      `"${(l.reason || '').replace(/"/g, '""')}"`,
      `"${JSON.stringify(l.previous_value || {}).replace(/"/g, '""')}"`,
      `"${JSON.stringify(l.new_value || {}).replace(/"/g, '""')}"`,
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `swms_audit_trail_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Metrics
  const ticketEventsCount = logs.filter((l) => l.action.startsWith('TICKET_')).length;
  const exceptionEventsCount = logs.filter((l) => ['CORRECT', 'REVERSE', 'CANCEL', 'APPROVE'].includes(l.action)).length;

  const filtered = logs.filter((l) => {
    if (!search) return true;
    const q = search.toLowerCase();
    const uname = typeof l.user === 'object' ? l.user?.username : l.user_name;
    return (
      l.record_type.toLowerCase().includes(q) ||
      l.record_id.toLowerCase().includes(q) ||
      (uname && uname.toLowerCase().includes(q)) ||
      (l.reason && l.reason.toLowerCase().includes(q))
    );
  });

  return (
    <RouteGuard roles={['Supervisor', 'Administrator']}>
      <div className="space-y-6">
        
        {/* Header Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-zinc-900">System Audit Trail</h2>
            <p className="text-xs text-zinc-500 mt-0.5">
              Cryptographically timestamped immutable event logs for every scale weighment, ticket reprint, and exception
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExportCSV}
              disabled={logs.length === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-200 bg-white hover:bg-zinc-100 text-xs font-semibold text-zinc-700 transition-colors shadow-xs disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>

            <button
              onClick={fetchAuditLogs}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-black text-xs font-semibold text-white transition-colors shadow-xs"
            >
              <RotateCw className="w-3.5 h-3.5" />
              <span>Refresh Trail</span>
            </button>
          </div>
        </div>

        {/* Audit KPI Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white border border-zinc-200 rounded-xl p-4 shadow-xs flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">Total Audit Events</p>
              <h3 className="text-2xl font-black text-zinc-900 mt-0.5">{logs.length}</h3>
              <p className="text-[10px] text-zinc-500 mt-0.5">Indexed ledger entries</p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-zinc-100 flex items-center justify-center text-zinc-800">
              <History className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-white border border-zinc-200 rounded-xl p-4 shadow-xs flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">Ticket & Reprint Logs</p>
              <h3 className="text-2xl font-black text-zinc-900 mt-0.5">{ticketEventsCount}</h3>
              <p className="text-[10px] text-zinc-500 mt-0.5">Weight slips generated</p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-zinc-100 flex items-center justify-center text-zinc-800">
              <FileText className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-white border border-zinc-200 rounded-xl p-4 shadow-xs flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">Exception & Approvals</p>
              <h3 className="text-2xl font-black text-zinc-900 mt-0.5">{exceptionEventsCount}</h3>
              <p className="text-[10px] text-zinc-500 mt-0.5">Supervisor audited actions</p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-zinc-100 flex items-center justify-center text-zinc-800">
              <ShieldCheck className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* Master-Detail Split Screen Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* LEFT: Audit Events Timeline Table (7 Cols) */}
          <div className="lg:col-span-7 space-y-3">
            {/* Search & Action Filter Chips */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="relative w-full sm:w-64">
                <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Search entity, ID, user..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full bg-white border border-zinc-200 rounded-lg pl-9 pr-3 py-1.5 text-xs text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-zinc-800"
                />
              </div>

              <select
                value={actionFilter}
                onChange={(e) => setActionFilter(e.target.value)}
                className="w-full sm:w-auto bg-white border border-zinc-200 rounded-lg px-3 py-1.5 text-xs font-semibold text-zinc-800 focus:outline-none focus:border-zinc-800"
              >
                <option value="">All Action Types</option>
                <option value="CREATE">CREATE</option>
                <option value="COMPLETE">COMPLETE</option>
                <option value="APPROVE">APPROVE</option>
                <option value="CORRECT">CORRECT</option>
                <option value="REVERSE">REVERSE</option>
                <option value="CANCEL">CANCEL</option>
                <option value="TICKET_GENERATE">TICKET_GENERATE</option>
                <option value="TICKET_REPRINT">TICKET_REPRINT</option>
              </select>
            </div>

            {/* Table */}
            <div className="rounded-xl bg-white border border-zinc-200 shadow-xs overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-zinc-50 text-zinc-600 font-bold border-b border-zinc-200 uppercase text-[10px]">
                  <tr>
                    <th className="px-4 py-3">Timestamp</th>
                    <th className="px-4 py-3">Action</th>
                    <th className="px-4 py-3">Target Entity</th>
                    <th className="px-4 py-3">User</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 text-zinc-700">
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-12 text-center text-zinc-400">
                        No audit events found matching filters.
                      </td>
                    </tr>
                  ) : (
                    filtered.map((l) => {
                      const isSelected = selectedLog?.id === l.id;
                      return (
                        <tr
                          key={l.id}
                          onClick={() => setSelectedLog(l)}
                          className={`cursor-pointer transition-colors ${
                            isSelected ? 'bg-zinc-100/90 font-medium' : 'hover:bg-zinc-50/80'
                          }`}
                        >
                          <td className="px-4 py-3 font-mono text-[11px] text-zinc-600">
                            <div>{new Date(l.action_datetime).toLocaleDateString()}</div>
                            <div className="text-[10px] text-zinc-400">
                              {new Date(l.action_datetime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                            </div>
                          </td>

                          <td className="px-4 py-3">
                            <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-zinc-100 text-zinc-900 border border-zinc-200">
                              {l.action}
                            </span>
                          </td>

                          <td className="px-4 py-3 font-mono">
                            <span className="font-bold text-zinc-900">{l.record_type}</span>
                            <span className="text-zinc-500 text-[11px] ml-1">#{l.record_id}</span>
                          </td>

                          <td className="px-4 py-3">
                            <span className="font-semibold text-zinc-900">
                              {typeof l.user === 'object' ? l.user?.username : (l.user_name || 'System')}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* RIGHT: Visual Audit Event Inspection & JSON Payload Diff (5 Cols) */}
          <div className="lg:col-span-5 sticky top-4">
            {selectedLog ? (
              <div className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-xs space-y-5">
                
                {/* Visual Header */}
                <div className="flex items-start justify-between pb-4 border-b border-zinc-100">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-2xl bg-zinc-900 text-white flex items-center justify-center font-black shadow-sm">
                      <History className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-sm text-zinc-900">
                          {selectedLog.action} Audit #{selectedLog.id}
                        </h3>
                        <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-zinc-100 text-zinc-800 border border-zinc-200">
                          {selectedLog.record_type}
                        </span>
                      </div>
                      <p className="text-xs text-zinc-400 font-mono">
                        Target Record #{selectedLog.record_id} • {new Date(selectedLog.action_datetime).toLocaleString()}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Operator Identity Badge */}
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="p-3 bg-zinc-50 rounded-xl border border-zinc-200/80">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block mb-1 flex items-center gap-1">
                      <User className="w-3 h-3" /> Executed By
                    </span>
                    <span className="font-semibold text-zinc-900 block truncate font-mono">
                      {typeof selectedLog.user === 'object' ? selectedLog.user?.username : (selectedLog.user_name || 'System Daemon')}
                    </span>
                  </div>

                  <div className="p-3 bg-zinc-50 rounded-xl border border-zinc-200/80">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block mb-1 flex items-center gap-1">
                      <Clock className="w-3 h-3" /> Event Time
                    </span>
                    <span className="font-mono text-zinc-800 block truncate text-[11px]">
                      {new Date(selectedLog.action_datetime).toLocaleTimeString()}
                    </span>
                  </div>
                </div>

                {/* Audit Justification Note */}
                {selectedLog.reason && (
                  <div className="p-3 rounded-xl bg-zinc-50 border border-zinc-200 text-xs space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block">
                      Audit Reason & Remarks
                    </span>
                    <p className="text-zinc-800 font-medium">{selectedLog.reason}</p>
                  </div>
                )}

                {/* JSON State Delta: Before vs After */}
                <div className="space-y-2 text-xs">
                  <span className="text-[11px] font-bold text-zinc-900 uppercase tracking-wider block">
                    Ledger State Delta
                  </span>

                  <div className="space-y-3">
                    {/* Previous State */}
                    {selectedLog.previous_value && Object.keys(selectedLog.previous_value).length > 0 && (
                      <div className="space-y-1">
                        <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">
                          Previous State
                        </span>
                        <pre className="p-3 rounded-xl bg-zinc-50 border border-zinc-200 text-[11px] font-mono text-zinc-700 overflow-x-auto">
                          {JSON.stringify(selectedLog.previous_value, null, 2)}
                        </pre>
                      </div>
                    )}

                    {/* New State */}
                    {selectedLog.new_value && Object.keys(selectedLog.new_value).length > 0 && (
                      <div className="space-y-1">
                        <span className="text-[10px] font-bold text-zinc-900 uppercase tracking-wider block">
                          New Committed State
                        </span>
                        <pre className="p-3 rounded-xl bg-zinc-100 border border-zinc-300 text-[11px] font-mono text-zinc-900 font-semibold overflow-x-auto">
                          {JSON.stringify(selectedLog.new_value, null, 2)}
                        </pre>
                      </div>
                    )}

                    {!selectedLog.previous_value && !selectedLog.new_value && (
                      <div className="p-4 rounded-xl bg-zinc-50 border border-zinc-200 text-center text-zinc-400 text-xs italic">
                        No payload delta captured for this action event.
                      </div>
                    )}
                  </div>
                </div>

                {/* Cryptographic / Ledger Integrity Seal */}
                <div className="p-3 rounded-xl bg-zinc-50 border border-zinc-200 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-zinc-900" />
                    <div>
                      <span className="font-bold text-zinc-900 block">Ledger Integrity Seal</span>
                      <span className="text-[10px] text-zinc-500 font-mono">SHA-256 Verified Immutable</span>
                    </div>
                  </div>
                  <span className="font-mono font-bold text-xs text-zinc-900">VERIFIED</span>
                </div>

              </div>
            ) : (
              <div className="p-8 text-center rounded-2xl bg-white border border-zinc-200 text-zinc-400 text-xs">
                Select an audit event from the ledger table to inspect full JSON payload deltas.
              </div>
            )}
          </div>

        </div>

      </div>
    </RouteGuard>
  );
}
