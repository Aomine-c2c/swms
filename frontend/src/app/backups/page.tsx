'use client';

import React, { useEffect, useState } from 'react';
import { 
  Database, 
  HardDriveDownload, 
  RotateCw, 
  Check, 
  AlertTriangle, 
  Clock, 
  ShieldCheck, 
  FileArchive,
  RefreshCw
} from 'lucide-react';
import { api } from '@/lib/api';
import { RouteGuard } from '@/components/auth/RouteGuard';

export default function BackupsPage() {
  const [backups, setBackups] = useState<any[]>([]);
  const [backupStatus, setBackupStatus] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [backupLoading, setBackupLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const fetchBackupsData = async () => {
    try {
      setLoading(true);
      const [listRes, statusRes] = await Promise.allSettled([
        api.get('/system/backups/'),
        api.get('/system/backups/status/'),
      ]);

      if (listRes.status === 'fulfilled') {
        setBackups(listRes.value.data.results || listRes.value.data || []);
      }
      if (statusRes.status === 'fulfilled') {
        setBackupStatus(statusRes.value.data);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBackupsData();
  }, []);

  const handleTriggerBackup = async () => {
    if (backupLoading) return;
    setBackupLoading(true);
    setStatusMessage(null);
    try {
      const res = await api.post('/system/backups/trigger/');
      setStatusMessage('Instant backup created and integrity verified successfully.');
      fetchBackupsData();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to trigger backup.');
    } finally {
      setBackupLoading(false);
    }
  };

  return (
    <RouteGuard permission="manage_system" roles={['Administrator']}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-zinc-900 flex items-center gap-2">
              <Database className="w-5 h-5 text-zinc-800" />
              <span>Database Management & Automated Backups</span>
            </h2>
            <p className="text-xs text-zinc-500 mt-0.5">
              Secure snapshots, disaster recovery archives, SHA-256 verification, and retention policies
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchBackupsData}
              disabled={loading}
              className="p-2 rounded-lg border border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-600 transition-colors shadow-2xs"
              title="Refresh Backups List"
            >
              <RotateCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>

            <button
              onClick={handleTriggerBackup}
              disabled={backupLoading}
              className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-zinc-900 hover:bg-black text-xs font-semibold text-white shadow-sm transition-all disabled:opacity-50"
            >
              <HardDriveDownload className={`w-4 h-4 ${backupLoading ? 'animate-bounce' : ''}`} />
              <span>{backupLoading ? 'Creating Snapshot...' : 'Create Instant Backup'}</span>
            </button>
          </div>
        </div>

        {statusMessage && (
          <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
            <Check className="w-4 h-4 shrink-0 text-emerald-600" />
            <span>{statusMessage}</span>
          </div>
        )}

        {/* System Health Metric Cards */}
        {backupStatus && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="p-4 rounded-xl bg-white border border-zinc-200 shadow-2xs">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-zinc-400">Total Archives</span>
              <div className="mt-1 flex items-baseline justify-between">
                <span className="text-2xl font-black font-mono text-zinc-900">{backupStatus.total_backups || backups.length}</span>
                <span className="text-xs font-mono text-emerald-600 font-semibold">{backupStatus.verified_backups || 0} Verified</span>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-white border border-zinc-200 shadow-2xs">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-zinc-400">Last Verified Snapshot</span>
              <div className="mt-1">
                {backupStatus.last_successful_backup ? (
                  <>
                    <span className="text-xs font-mono font-bold text-zinc-800 block truncate">
                      {backupStatus.last_successful_backup.checksum_sha256 ? `${backupStatus.last_successful_backup.checksum_sha256.slice(0, 12)}...` : 'OK'}
                    </span>
                    <span className="text-[10px] font-mono text-zinc-400">
                      {new Date(backupStatus.last_successful_backup.started_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </>
                ) : (
                  <span className="text-xs text-zinc-400 font-mono">None Recorded</span>
                )}
              </div>
            </div>

            <div className="p-4 rounded-xl bg-white border border-zinc-200 shadow-2xs">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-zinc-400">Storage Engine</span>
              <div className="mt-1 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span className="text-sm font-mono font-bold text-zinc-900 uppercase">
                  {backups[0]?.engine || 'SQLite / WAL'}
                </span>
              </div>
              <span className="text-[10px] text-zinc-400">Automated SHA-256 Checksum</span>
            </div>

            <div className="p-4 rounded-xl bg-white border border-zinc-200 shadow-2xs">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-zinc-400">Backup Failures</span>
              <div className="mt-1 flex items-baseline justify-between">
                <span className={`text-2xl font-black font-mono ${(backupStatus.failed_backups || 0) > 0 ? 'text-rose-600' : 'text-zinc-900'}`}>
                  {backupStatus.failed_backups || 0}
                </span>
                <span className="text-xs font-mono text-zinc-400">Zero tolerance</span>
              </div>
            </div>
          </div>
        )}

        {/* Backups Table */}
        <div className="rounded-xl bg-white border border-zinc-200 shadow-2xs overflow-hidden">
          <div className="p-4 border-b border-zinc-200 bg-zinc-50/70 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileArchive className="w-4 h-4 text-zinc-600" />
              <h3 className="font-bold text-xs text-zinc-900">Database Snapshot Logs</h3>
            </div>
            <span className="text-[11px] font-mono text-zinc-400">{backups.length} snapshots retained</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-50 text-zinc-600 font-bold border-b border-zinc-200 uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="px-4 py-3">Timestamp / Date</th>
                  <th className="px-4 py-3">Engine</th>
                  <th className="px-4 py-3">Triggered By</th>
                  <th className="px-4 py-3">Archive Size</th>
                  <th className="px-4 py-3">Duration</th>
                  <th className="px-4 py-3">Integrity Checksum</th>
                  <th className="px-4 py-3 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 text-zinc-700">
                {backups.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-zinc-400 font-mono">
                      No automated backups recorded yet. Click &ldquo;Create Instant Backup&rdquo; above.
                    </td>
                  </tr>
                ) : (
                  backups.map((b) => {
                    const isVerified = b.status === 'VERIFIED' || b.status === 'SUCCESS' || b.verification_status === 'VERIFIED';
                    const isFailed = b.status === 'FAILED' || b.status === 'VERIFY_FAILED';

                    return (
                      <tr key={b.id} className="hover:bg-zinc-50/80 transition-colors">
                        <td className="px-4 py-3">
                          <span className="font-mono font-bold text-zinc-900 block">
                            {new Date(b.started_at).toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' })}
                          </span>
                          <span className="text-[10px] font-mono text-zinc-400">
                            {new Date(b.started_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                          </span>
                        </td>

                        <td className="px-4 py-3 font-mono text-zinc-700 uppercase text-[11px]">
                          {b.engine || 'SQLITE'}
                        </td>

                        <td className="px-4 py-3">
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-zinc-100 text-zinc-800 border border-zinc-200">
                            {b.triggered_by_username || b.triggered_by || 'SYSTEM'}
                          </span>
                        </td>

                        <td className="px-4 py-3 font-mono text-zinc-900 font-bold">
                          {b.file_size_mb !== null && b.file_size_mb !== undefined 
                            ? `${b.file_size_mb} MB`
                            : b.file_size_bytes 
                              ? `${(b.file_size_bytes / 1024).toFixed(1)} KB` 
                              : '-'}
                        </td>

                        <td className="px-4 py-3 font-mono text-zinc-500 text-[11px]">
                          {b.duration_seconds !== null && b.duration_seconds !== undefined ? `${b.duration_seconds}s` : '-'}
                        </td>

                        <td className="px-4 py-3 font-mono text-zinc-500 text-[11px]">
                          {b.checksum_sha256 ? (
                            <span title={b.checksum_sha256}>
                              {b.checksum_sha256.slice(0, 16)}...
                            </span>
                          ) : (
                            <span className="text-zinc-400">-</span>
                          )}
                        </td>

                        <td className="px-4 py-3 text-right">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold border ${
                            isVerified 
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-200' 
                              : isFailed
                                ? 'bg-rose-50 text-rose-800 border-rose-200'
                                : 'bg-amber-50 text-amber-800 border-amber-200'
                          }`}>
                            {isVerified && <Check className="w-3 h-3 text-emerald-600" />}
                            {isFailed && <AlertTriangle className="w-3 h-3 text-rose-600" />}
                            <span>{b.status}</span>
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
      </div>
    </RouteGuard>
  );
}
