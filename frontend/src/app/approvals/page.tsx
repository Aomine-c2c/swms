'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { 
  Check, 
  X, 
  ShieldAlert, 
  RotateCw,
  Clock,
  KeyRound,
  FileDiff,
  AlertTriangle,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Truck,
  Scale
} from 'lucide-react';
import { api } from '@/lib/api';
import { ApprovalRequest, WeighingTransaction } from '@/types';
import { RouteGuard } from '@/components/auth/RouteGuard';

export default function ApprovalsPage() {
  const [approvals, setApprovals] = useState<ApprovalRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'PENDING' | 'APPROVED' | 'REJECTED' | 'ALL'>('PENDING');

  // Selected Approval for side-by-side inspection
  const [selectedReq, setSelectedReq] = useState<ApprovalRequest | null>(null);

  // Decision Modal State
  const [decisionModal, setDecisionModal] = useState<{ req: ApprovalRequest; action: 'approve' | 'reject' } | null>(null);
  const [supervisorPin, setSupervisorPin] = useState('');
  const [reviewReason, setReviewReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchApprovals = async () => {
    try {
      setLoading(true);
      const res = await api.get('/approvals/?page_size=100');
      const list: ApprovalRequest[] = res.data.results || res.data || [];
      setApprovals(list);
      if (list.length > 0 && !selectedReq) {
        setSelectedReq(list[0]);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchApprovals();
  }, []);

  const handleOpenDecision = (req: ApprovalRequest, action: 'approve' | 'reject', e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setDecisionModal({ req, action });
    setSupervisorPin('');
    setReviewReason('');
    setErrorMsg(null);
  };

  const handleDecisionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!decisionModal) return;
    setSubmitting(true);
    setErrorMsg(null);

    try {
      const payload: any = {
        reason: reviewReason,
      };
      if (decisionModal.action === 'approve') {
        payload.pin = supervisorPin;
      }

      await api.post(`/approvals/${decisionModal.req.id}/${decisionModal.action}/`, payload);
      setDecisionModal(null);
      setSupervisorPin('');
      setReviewReason('');
      fetchApprovals();
    } catch (err: any) {
      setErrorMsg(err.response?.data?.error || err.response?.data?.detail || 'Failed to submit review decision.');
    } finally {
      setSubmitting(false);
    }
  };

  // Metrics
  const pendingCount = approvals.filter((a) => a.status === 'PENDING').length;
  const approvedCount = approvals.filter((a) => a.status === 'APPROVED').length;
  const rejectedCount = approvals.filter((a) => a.status === 'REJECTED').length;

  const filtered = approvals.filter((a) => {
    if (statusFilter === 'ALL') return true;
    return a.status === statusFilter;
  });

  return (
    <RouteGuard roles={['Supervisor', 'Administrator']}>
      <div className="space-y-6">
        
        {/* Header Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-zinc-900">Supervisor Approvals Queue</h2>
            <p className="text-xs text-zinc-500 mt-0.5">
              Dual-control authorizations, operator exception requests, ticket corrections, and weight reversals
            </p>
          </div>
          <button
            onClick={fetchApprovals}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-200 bg-white hover:bg-zinc-100 text-xs font-semibold text-zinc-700 transition-colors shadow-xs"
          >
            <RotateCw className="w-3.5 h-3.5" />
            <span>Refresh Queue</span>
          </button>
        </div>

        {/* KPI Metric Summary Badges */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white border border-zinc-200 rounded-xl p-4 shadow-xs flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">Pending Authorization</p>
              <h3 className="text-2xl font-black text-zinc-900 mt-0.5">{pendingCount}</h3>
              <p className="text-[10px] text-zinc-500 mt-0.5">Requires supervisor review</p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-zinc-100 flex items-center justify-center text-zinc-800">
              <Clock className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-white border border-zinc-200 rounded-xl p-4 shadow-xs flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">Approved Exceptions</p>
              <h3 className="text-2xl font-black text-zinc-900 mt-0.5">{approvedCount}</h3>
              <p className="text-[10px] text-zinc-500 mt-0.5">Executed corrections</p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-zinc-100 flex items-center justify-center text-zinc-800">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-white border border-zinc-200 rounded-xl p-4 shadow-xs flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">Rejected Requests</p>
              <h3 className="text-2xl font-black text-zinc-900 mt-0.5">{rejectedCount}</h3>
              <p className="text-[10px] text-zinc-500 mt-0.5">Denied modifications</p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-zinc-100 flex items-center justify-center text-zinc-800">
              <XCircle className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* Master-Detail Split Screen Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* LEFT: Approval Requests Table (7 Cols) */}
          <div className="lg:col-span-7 space-y-3">
            {/* Filter Tabs */}
            <div className="flex border border-zinc-200 rounded-lg p-0.5 bg-zinc-100 text-xs font-semibold w-fit">
              {(['PENDING', 'APPROVED', 'REJECTED', 'ALL'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setStatusFilter(tab)}
                  className={`px-3 py-1 rounded-md transition-all ${
                    statusFilter === tab ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* Table */}
            <div className="rounded-xl bg-white border border-zinc-200 shadow-xs overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-zinc-50 text-zinc-600 font-bold border-b border-zinc-200 uppercase text-[10px]">
                  <tr>
                    <th className="px-4 py-3">Request ID</th>
                    <th className="px-4 py-3">Action</th>
                    <th className="px-4 py-3">Operator</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Review</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 text-zinc-700">
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-12 text-center text-zinc-400">
                        No requests found in this queue state.
                      </td>
                    </tr>
                  ) : (
                    filtered.map((req) => {
                      const isSelected = selectedReq?.id === req.id;
                      return (
                        <tr
                          key={req.id}
                          onClick={() => setSelectedReq(req)}
                          className={`cursor-pointer transition-colors ${
                            isSelected ? 'bg-zinc-100/90 font-medium' : 'hover:bg-zinc-50/80'
                          }`}
                        >
                          <td className="px-4 py-3 font-mono">
                            <span className="font-bold text-zinc-900 block">#{req.id}</span>
                            <span className="text-[10px] text-zinc-400">
                              {new Date(req.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </td>

                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${
                              req.action === 'OVERWEIGHT_EXCEPTION'
                                ? 'bg-rose-50 text-rose-800 border-rose-200'
                                : req.action === 'TARE_TOLERANCE_EXCEPTION'
                                ? 'bg-amber-50 text-amber-900 border-amber-200'
                                : 'bg-zinc-100 text-zinc-800 border-zinc-200'
                            }`}>
                              {req.action === 'OVERWEIGHT_EXCEPTION' && <AlertTriangle className="w-3 h-3 text-rose-600" />}
                              {req.action === 'TARE_TOLERANCE_EXCEPTION' && <Scale className="w-3 h-3 text-amber-600" />}
                              {req.action.replace('_EXCEPTION', '')}
                            </span>
                          </td>

                          <td className="px-4 py-3">
                            <span className="font-semibold text-zinc-900 block">
                              {typeof req.requested_by === 'object' ? req.requested_by.username : (req.requested_by_name || 'Operator')}
                            </span>
                            <span className="text-[10px] text-zinc-400 font-mono">
                              Tx #{typeof req.transaction === 'object' ? req.transaction.id : req.transaction}
                            </span>
                          </td>

                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold border ${
                              req.status === 'APPROVED'
                                ? 'bg-zinc-100 text-zinc-900 border-zinc-300'
                                : req.status === 'PENDING'
                                ? 'bg-amber-50 text-amber-900 border-amber-200'
                                : 'bg-rose-50 text-rose-800 border-rose-200'
                            }`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${
                                req.status === 'APPROVED' ? 'bg-zinc-900' : req.status === 'PENDING' ? 'bg-amber-500' : 'bg-rose-500'
                              }`} />
                              {req.status}
                            </span>
                          </td>

                          <td className="px-4 py-3 text-right">
                            {req.status === 'PENDING' ? (
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  onClick={(e) => handleOpenDecision(req, 'approve', e)}
                                  className="px-2.5 py-1 rounded bg-zinc-900 hover:bg-black text-white text-[11px] font-semibold flex items-center gap-1 shadow-xs transition-colors"
                                >
                                  <Check className="w-3 h-3" />
                                  <span>Authorize</span>
                                </button>
                                <button
                                  onClick={(e) => handleOpenDecision(req, 'reject', e)}
                                  className="px-2 py-1 rounded border border-zinc-200 bg-white hover:bg-zinc-100 text-zinc-700 text-[11px] font-semibold flex items-center gap-1 transition-colors"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </div>
                            ) : (
                              <span className="text-[10px] font-mono text-zinc-400">Completed</span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* RIGHT: Visual Side-by-Side Diff & Inspection Card (5 Cols) */}
          <div className="lg:col-span-5 sticky top-4">
            {selectedReq ? (
              <div className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-xs space-y-5">
                
                {/* Header */}
                <div className="flex items-start justify-between pb-4 border-b border-zinc-100">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-2xl bg-zinc-900 text-white flex items-center justify-center font-black shadow-sm">
                      <FileDiff className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-sm text-zinc-900">
                          {selectedReq.action} Exception #{selectedReq.id}
                        </h3>
                        <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold ${
                          selectedReq.status === 'APPROVED'
                            ? 'bg-zinc-100 text-zinc-900 border border-zinc-300'
                            : selectedReq.status === 'PENDING'
                            ? 'bg-amber-50 text-amber-900 border border-amber-200'
                            : 'bg-rose-50 text-rose-800 border border-rose-200'
                        }`}>
                          {selectedReq.status}
                        </span>
                      </div>
                      <p className="text-xs text-zinc-400 font-mono">
                        Target Transaction #{typeof selectedReq.transaction === 'object' ? selectedReq.transaction.id : selectedReq.transaction}
                      </p>
                    </div>
                  </div>

                  {selectedReq.status === 'PENDING' && (
                    <button
                      onClick={() => handleOpenDecision(selectedReq, 'approve')}
                      className="px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-black text-white text-xs font-semibold shadow-sm"
                    >
                      Authorize PIN
                    </button>
                  )}
                </div>

                {/* Operator Justification Box */}
                <div className="p-3 rounded-xl bg-zinc-50 border border-zinc-200/80 space-y-1 text-xs">
                  <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                    <span>Operator Request Justification</span>
                    <span className="font-mono">{selectedReq.requested_by_name || 'Scale Operator'}</span>
                  </div>
                  <p className="text-zinc-800 font-medium">{selectedReq.request_reason}</p>
                </div>

                {/* Side-by-Side Change Diff (Before vs Requested After) */}
                <div className="space-y-2 text-xs">
                  <span className="text-[11px] font-bold text-zinc-900 uppercase tracking-wider block">
                    Transaction Audit State Diff
                  </span>

                  <div className="grid grid-cols-2 gap-3">
                    {/* Current State */}
                    <div className="p-3 bg-zinc-50 rounded-xl border border-zinc-200 space-y-2 font-mono">
                      <span className="text-[10px] font-sans font-bold uppercase tracking-wider text-zinc-400 block border-b border-zinc-200 pb-1">
                        Current Transaction State
                      </span>
                      {selectedReq.transaction_details ? (
                        <>
                          <div className="flex justify-between text-[11px]">
                            <span className="text-zinc-500">Gross:</span>
                            <span className="font-bold">{selectedReq.transaction_details.gross_weight || '-'} kg</span>
                          </div>
                          <div className="flex justify-between text-[11px]">
                            <span className="text-zinc-500">Tare:</span>
                            <span className="font-bold">{selectedReq.transaction_details.tare_weight || '-'} kg</span>
                          </div>
                          <div className="flex justify-between text-[11px] pt-1 border-t border-zinc-200">
                            <span className="text-zinc-500">Net:</span>
                            <span className="font-bold">{selectedReq.transaction_details.net_weight || '-'} kg</span>
                          </div>
                        </>
                      ) : (
                        <span className="text-zinc-400 italic">State locked</span>
                      )}
                    </div>

                    {/* Proposed State / Action Impact */}
                    <div className="p-3 bg-zinc-100 rounded-xl border border-zinc-300 space-y-2 font-mono">
                      <span className="text-[10px] font-sans font-bold uppercase tracking-wider text-zinc-900 block border-b border-zinc-300 pb-1">
                        Action Impact: {selectedReq.action.replace('_EXCEPTION', '')}
                      </span>
                      {['OVERWEIGHT_EXCEPTION', 'TARE_TOLERANCE_EXCEPTION'].includes(selectedReq.action) && selectedReq.changes_payload ? (
                        <div className="space-y-1.5 font-sans">
                          <div className={`p-2.5 rounded-lg border text-xs ${
                            selectedReq.action === 'OVERWEIGHT_EXCEPTION'
                              ? 'bg-rose-50 border-rose-200 text-rose-900'
                              : 'bg-amber-50 border-amber-200 text-amber-900'
                          }`}>
                            <div className="flex items-center gap-1.5 font-bold">
                              {selectedReq.action === 'OVERWEIGHT_EXCEPTION' ? (
                                <AlertTriangle className="w-4 h-4 text-rose-600" />
                              ) : (
                                <Scale className="w-4 h-4 text-amber-600" />
                              )}
                              <span>{selectedReq.changes_payload.rule || selectedReq.action}</span>
                            </div>
                            <p className="text-[11px] mt-1 text-zinc-700 leading-relaxed font-mono">
                              {selectedReq.changes_payload.message}
                            </p>
                          </div>
                          <div className="font-mono text-[11px] space-y-1 pt-1">
                            <div className="flex justify-between">
                              <span className="text-zinc-500">Recorded:</span>
                              <span className="font-bold text-zinc-900">{selectedReq.changes_payload.actual} kg</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-zinc-500">Allowed Limit:</span>
                              <span className="font-bold text-zinc-900">{selectedReq.changes_payload.limit} kg</span>
                            </div>
                            <div className="flex justify-between border-t border-zinc-200 pt-1">
                              <span className="text-zinc-500">Exceeded Delta:</span>
                              <span className="font-bold text-rose-600">+{selectedReq.changes_payload.delta} kg ({selectedReq.changes_payload.delta_pct}%)</span>
                            </div>
                          </div>
                        </div>
                      ) : selectedReq.changes_payload ? (
                        Object.entries(selectedReq.changes_payload).map(([k, v]) => (
                          <div key={k} className="flex justify-between text-[11px]">
                            <span className="text-zinc-600">{k}:</span>
                            <span className="font-bold text-zinc-900">{String(v)}</span>
                          </div>
                        ))
                      ) : (
                        <div className="text-[11px] text-zinc-700 font-sans space-y-1">
                          <p className="font-bold">
                            {selectedReq.action === 'REVERSAL'
                              ? 'Reverts closed ticket to Open'
                              : 'Permanently cancels and voids ticket'}
                          </p>
                          <p className="text-[10px] text-zinc-500">Immutable audit log entry created upon signature.</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Supervisor Review Sign-Off Status */}
                {selectedReq.reviewed_by && (
                  <div className="p-3 rounded-xl bg-zinc-50 border border-zinc-200 text-xs space-y-1">
                    <div className="flex items-center justify-between text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                      <span>Supervisor Sign-Off</span>
                      <span className="font-mono">{selectedReq.reviewed_by_name || 'Supervisor'}</span>
                    </div>
                    {selectedReq.review_reason && (
                      <p className="text-zinc-700 italic">"{selectedReq.review_reason}"</p>
                    )}
                  </div>
                )}

              </div>
            ) : (
              <div className="p-8 text-center rounded-2xl bg-white border border-zinc-200 text-zinc-400 text-xs">
                Select an approval request to inspect the side-by-side transaction audit diff.
              </div>
            )}
          </div>

        </div>

        {/* Supervisor 2-Person PIN Authorization Modal */}
        {decisionModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <div className="w-full max-w-md bg-white border border-zinc-200 rounded-2xl shadow-2xl p-6">
              <div className="flex items-center justify-between pb-3 border-b border-zinc-200">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-zinc-900" />
                  <h3 className="font-bold text-sm text-zinc-900 capitalize">
                    {decisionModal.action === 'approve' ? 'Supervisor Dual-Control Authorization' : 'Reject Exception Request'}
                  </h3>
                </div>
                <button onClick={() => setDecisionModal(null)} className="text-zinc-400 hover:text-zinc-600">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {errorMsg && (
                <div className="mt-3 p-2.5 rounded-lg bg-zinc-100 border border-zinc-300 text-zinc-900 text-xs font-semibold flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-zinc-800 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <form onSubmit={handleDecisionSubmit} className="mt-4 space-y-4 text-xs">
                
                {/* PIN Code Entry for Approval */}
                {decisionModal.action === 'approve' && (
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[11px] font-bold text-zinc-700 uppercase tracking-wider flex items-center gap-1">
                        <KeyRound className="w-3.5 h-3.5" /> Supervisor Security PIN *
                      </label>
                      <span className="text-[10px] text-zinc-400 font-mono">Demo PIN: 1234</span>
                    </div>
                    <input
                      type="password"
                      maxLength={6}
                      required
                      placeholder="••••"
                      value={supervisorPin}
                      onChange={(e) => setSupervisorPin(e.target.value)}
                      className="w-full bg-zinc-50 border border-zinc-200 rounded-lg p-3 text-center text-xl font-mono tracking-widest font-black text-zinc-900 focus:outline-none focus:bg-white focus:border-zinc-800"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-[11px] font-bold text-zinc-700 uppercase tracking-wider mb-1">
                    Supervisor Reason / Audit Comment {decisionModal.action === 'reject' ? '*' : '(Optional)'}
                  </label>
                  <textarea
                    rows={2}
                    required={decisionModal.action === 'reject'}
                    value={reviewReason}
                    onChange={(e) => setReviewReason(e.target.value)}
                    placeholder={
                      decisionModal.action === 'approve'
                        ? 'e.g. Verified scale indicator tare drift with physical inspection'
                        : 'e.g. Request denied due to missing lab certificate'
                    }
                    className="w-full bg-zinc-50 border border-zinc-200 rounded-lg p-2.5 text-zinc-900 focus:outline-none focus:bg-white focus:border-zinc-800 resize-none"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-zinc-200">
                  <button
                    type="button"
                    onClick={() => setDecisionModal(null)}
                    className="px-3.5 py-2 rounded-lg border border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-100"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className={`px-4 py-2 rounded-lg text-white font-semibold shadow-sm transition-all ${
                      decisionModal.action === 'approve'
                        ? 'bg-zinc-900 hover:bg-black'
                        : 'bg-zinc-800 hover:bg-zinc-900'
                    }`}
                  >
                    {submitting
                      ? 'Authorizing...'
                      : decisionModal.action === 'approve'
                      ? 'Authorize & Apply Changes'
                      : 'Confirm Rejection'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

      </div>
    </RouteGuard>
  );
}
