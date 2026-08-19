'use client';

import React, { useEffect, useState } from 'react';
import { db } from '../../../lib/firebase';
import { collection, onSnapshot } from 'firebase/firestore';
import { ShieldAlert, ShieldCheck } from 'lucide-react';

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Subscribe to Cloud Firestore audit_logs collection in real time
  useEffect(() => {
    try {
      const unsub = onSnapshot(
        collection(db, 'audit_logs'),
        snap => {
          if (!snap.empty) {
            const list = snap.docs
              .map(d => ({ id: d.id, ...d.data() }))
              .filter(Boolean)
              .sort((a: any, b: any) => (b.timestamp || '').localeCompare(a.timestamp || ''));
            setLogs(list);
          } else {
            setLogs([]);
          }
          setLoading(false);
        },
        err => {
          console.log('audit_logs listener status:', err.message);
          setLoading(false);
        }
      );
      return unsub;
    } catch (e) {
      setLoading(false);
    }
  }, []);

  const getActionBadge = (type: string) => {
    const badges: Record<string, { label: string; color: string }> = {
      WALLET_ADJUSTMENT: { label: 'Wallet Adjustment', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' },
      USER_BLOCKED: { label: 'User Blocked', color: 'bg-rose-500/10 text-rose-400 border-rose-500/30' },
      USER_UNBLOCKED: { label: 'User Unblocked', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' },
      CUTOFF_CHANGE: { label: 'Cutoff Timing Change', color: 'bg-amber-500/10 text-amber-400 border-amber-500/30' },
      MENU_EDIT: { label: 'Menu Photo/Price Edit', color: 'bg-blue-500/10 text-blue-400 border-blue-500/30' },
      PUSH_BROADCAST: { label: 'Push Broadcast', color: 'bg-purple-500/10 text-purple-400 border-purple-500/30' },
    };
    const current = badges[type] || { label: type, color: 'bg-slate-800 text-slate-300 border-slate-700' };
    return (
      <span className={`px-2.5 py-1 rounded-md text-[10px] font-extrabold uppercase border ${current.color}`}>
        {current.label}
      </span>
    );
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-3">
          <ShieldAlert className="h-7 w-7 text-amber-400" />
          <span>Security & Operations Audit Trail</span>
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Immutable audit record of all administrative actions (wallet balance changes, cutoff edits, user bans, price changes).
        </p>
      </div>

      {/* Audit Logs Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/80 text-slate-400 font-semibold uppercase tracking-wider border-b border-slate-800">
              <tr>
                <th className="px-6 py-4">Timestamp</th>
                <th className="px-6 py-4">Admin User</th>
                <th className="px-6 py-4">Action Type</th>
                <th className="px-6 py-4">Action Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80 text-slate-200">
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-slate-400">
                    Loading security audit trail from Cloud Firestore...
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-slate-500">
                    No security audit logs recorded in Cloud Firestore audit_logs collection yet.
                  </td>
                </tr>
              ) : (
                logs.map(log => (
                  <tr key={log.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="px-6 py-4 font-mono text-slate-400 text-[11px]">
                      {log.timestamp ? new Date(log.timestamp).toLocaleString() : 'Recent'}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <ShieldCheck className="h-4 w-4 text-orange-400 shrink-0" />
                        <span className="font-semibold text-slate-100">{log.admin_email || 'Super Admin'}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">{getActionBadge(log.action_type || 'SYSTEM_ACTION')}</td>
                    <td className="px-6 py-4 font-medium text-slate-300 max-w-md">
                      {log.details}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
