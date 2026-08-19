'use client';

import React, { useEffect, useState } from 'react';
import { db } from '../../../lib/firebase';
import { collection, onSnapshot, doc, updateDoc, increment, addDoc } from 'firebase/firestore';
import { UserAccount } from '../../../types';
import { Users, Search, Wallet, ShieldAlert, CheckCircle, Ban, History, X } from 'lucide-react';

export default function UsersManagementPage() {
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState<UserAccount | null>(null);
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [userTransactions, setUserTransactions] = useState<any[]>([]);

  const [adjustAmount, setAdjustAmount] = useState('250');
  const [adjustReason, setAdjustReason] = useState('Customer goodwill credit');
  const [loading, setLoading] = useState(false);

  const [dbSubscriptions, setDbSubscriptions] = useState<any[]>([]);

  // Subscribe directly to Cloud Firestore users collection
  useEffect(() => {
    try {
      const unsub = onSnapshot(
        collection(db, 'users'),
        snap => {
          const list = snap.docs.map(docSnap => {
            const data = docSnap.data();
            return {
              id: docSnap.id,
              name: data.name || `Customer (${data.phone || docSnap.id})`,
              phone: data.phone || docSnap.id,
              wallet_balance: data.wallet_balance ?? 500,
              subscription_ids: data.subscription_ids || [],
              active_subscription: data.active_subscription || '',
              role: data.role || 'customer',
              is_blocked: data.is_blocked || false,
              created_at: data.created_at || new Date().toISOString(),
            } as any;
          });
          setUsers(list);
        },
        err => console.log('users listener status:', err.message)
      );
      return unsub;
    } catch (e) {
      console.log('Error listening to users collection');
    }
  }, []);

  // Subscribe to Cloud Firestore subscriptions collection for active plan matching
  useEffect(() => {
    try {
      const unsub = onSnapshot(
        collection(db, 'subscriptions'),
        snap => {
          if (!snap.empty) {
            const list = snap.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }));
            setDbSubscriptions(list);
          }
        },
        err => console.log('subscriptions listener status:', err.message)
      );
      return unsub;
    } catch (e) {}
  }, []);

  // Subscribe to wallet_transactions for selected user when history modal opens
  useEffect(() => {
    if (!showHistoryModal || !selectedUser) return;
    try {
      const unsub = onSnapshot(
        collection(db, 'wallet_transactions'),
        snap => {
          if (!snap.empty) {
            const list = snap.docs
              .map(d => ({ id: d.id, ...d.data() }))
              .filter((tx: any) => tx.user_id === selectedUser.id || tx.user_phone === selectedUser.phone)
              .sort((a: any, b: any) => (b.timestamp || '').localeCompare(a.timestamp || ''));
            setUserTransactions(list);
          } else {
            setUserTransactions([]);
          }
        },
        err => console.log('wallet_transactions listener status:', err.message)
      );
      return unsub;
    } catch (e) {}
  }, [showHistoryModal, selectedUser]);

  const filteredUsers = users.filter(
    u =>
      u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.phone.includes(searchQuery) ||
      u.id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleWalletAdjustSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser || !adjustAmount || !adjustReason) return;
    setLoading(true);

    const amountNum = Number(adjustAmount);
    try {
      // 1. Update user wallet balance in Firestore
      await updateDoc(doc(db, 'users', selectedUser.id), {
        wallet_balance: increment(amountNum),
      });

      // 2. Write audit log to audit_logs collection
      await addDoc(collection(db, 'audit_logs'), {
        action_type: 'WALLET_ADJUSTMENT',
        admin_email: 'admin@afoodoo.com',
        details: `Adjusted wallet by ${amountNum >= 0 ? '+' : ''}₹${amountNum} for ${selectedUser.name} (${selectedUser.phone}). Reason: ${adjustReason}`,
        user_id: selectedUser.id,
        user_phone: selectedUser.phone,
        timestamp: new Date().toISOString(),
      });

      // 3. Write transaction to wallet_transactions collection
      await addDoc(collection(db, 'wallet_transactions'), {
        user_id: selectedUser.id,
        user_phone: selectedUser.phone,
        title: `Admin Wallet Adjustment (${amountNum >= 0 ? '+' : ''}₹${amountNum})`,
        amount: amountNum,
        type: amountNum >= 0 ? 'CREDIT' : 'DEBIT',
        reason: adjustReason,
        timestamp: new Date().toISOString(),
      });

      alert(`Successfully adjusted wallet by ₹${amountNum} for ${selectedUser.name}! Real-time update & audit log written.`);
    } catch (e: any) {
      console.error('Wallet adjust error:', e);
      alert(`Wallet Adjust Error: ${e.message || 'Could not update Firestore user document.'}`);
    }

    setLoading(false);
    setShowWalletModal(false);
  };

  const handleToggleBlock = async (user: UserAccount) => {
    const newBlockedState = !user.is_blocked;
    const confirmMsg = newBlockedState
      ? `Are you sure you want to block ${user.name}? They will be prevented from placing orders and logged out instantly.`
      : `Unblock user account for ${user.name}?`;

    if (!window.confirm(confirmMsg)) return;

    try {
      // Update user is_blocked field in Firestore
      await updateDoc(doc(db, 'users', user.id), {
        is_blocked: newBlockedState,
      });

      // Write audit log
      await addDoc(collection(db, 'audit_logs'), {
        action_type: newBlockedState ? 'USER_BLOCKED' : 'USER_UNBLOCKED',
        admin_email: 'admin@afoodoo.com',
        details: `${newBlockedState ? 'Blocked' : 'Unblocked'} user account for ${user.name} (${user.phone})`,
        user_id: user.id,
        user_phone: user.phone,
        timestamp: new Date().toISOString(),
      });
    } catch (e: any) {
      console.error('User block update error:', e);
      alert(`User Block Error: ${e.message}`);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-3">
            <Users className="h-7 w-7 text-blue-400" />
            <span>User Accounts & Wallet Auditing</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Search live user accounts, adjust wallet balances with audit logs, view transaction history, and flag accounts.
          </p>
        </div>

        {/* Search Input */}
        <div className="relative max-w-xs w-full">
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search name, phone, or ID..."
            className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
          <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-500" />
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/80 text-slate-400 font-semibold uppercase tracking-wider border-b border-slate-800">
              <tr>
                <th className="px-6 py-4">User</th>
                <th className="px-6 py-4">Mobile Number</th>
                <th className="px-6 py-4">Wallet Balance</th>
                <th className="px-6 py-4">Subscription</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80 text-slate-200">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-slate-500">
                    No user accounts found in Cloud Firestore users collection. Customer logins automatically register here.
                  </td>
                </tr>
              ) : (
                filteredUsers.map(user => {
                  const userSub = dbSubscriptions.find(
                    s => (s.user_id === user.id || s.user_phone === user.phone) && s.status !== 'EXPIRED'
                  );
                  const activePlanName = userSub?.plan_type || user.active_subscription;

                  return (
                    <tr key={user.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded-full bg-orange-600/20 border border-orange-500/30 flex items-center justify-center font-bold text-orange-400">
                            {user.name.charAt(0)}
                          </div>
                          <div>
                            <div className="font-bold text-slate-100">{user.name}</div>
                            <div className="text-[10px] text-slate-500">ID: {user.id}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 font-mono text-slate-300">{user.phone}</td>
                      <td className="px-6 py-4">
                        <span className="font-black text-emerald-400 text-sm">
                          ₹{user.wallet_balance.toLocaleString('en-IN')}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {activePlanName || user.subscription_ids.length > 0 ? (
                          <span className="bg-purple-500/10 text-purple-400 border border-purple-500/30 px-2.5 py-1 rounded-md font-semibold text-[10px] uppercase">
                            {activePlanName || 'ACTIVE SUB'}
                          </span>
                        ) : (
                          <span className="text-slate-500 font-medium">None</span>
                        )}
                      </td>
                    <td className="px-6 py-4">
                      {user.is_blocked ? (
                        <span className="bg-rose-500/10 text-rose-400 border border-rose-500/30 px-2.5 py-1 rounded-md font-bold text-[10px] uppercase flex items-center gap-1 w-fit">
                          <Ban className="h-3 w-3" /> Blocked
                        </span>
                      ) : (
                        <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-2.5 py-1 rounded-md font-bold text-[10px] uppercase flex items-center gap-1 w-fit">
                          <CheckCircle className="h-3 w-3" /> Active
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right space-x-2">
                      <button
                        onClick={() => {
                          setSelectedUser(user);
                          setShowHistoryModal(true);
                        }}
                        className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-3 py-1.5 rounded-lg font-bold transition-all text-[11px] inline-flex items-center gap-1"
                        title="View User Transactions"
                      >
                        <History className="h-3.5 w-3.5 text-blue-400" />
                        <span>History</span>
                      </button>

                      <button
                        onClick={() => {
                          setSelectedUser(user);
                          setShowWalletModal(true);
                        }}
                        className="bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/40 px-3 py-1.5 rounded-lg font-bold transition-all text-[11px]"
                      >
                        💳 Adjust Wallet
                      </button>

                      <button
                        onClick={() => handleToggleBlock(user)}
                        className={`px-3 py-1.5 rounded-lg font-bold transition-all text-[11px] border ${
                          user.is_blocked
                            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                            : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                        }`}
                      >
                        {user.is_blocked ? 'Unblock' : 'Block User'}
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Wallet Adjustment Audit Modal */}
      {showWalletModal && selectedUser ? (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <form
            onSubmit={handleWalletAdjustSubmit}
            className="bg-slate-900 border border-slate-800 max-w-md w-full rounded-2xl p-6 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Wallet className="h-5 w-5 text-emerald-400" />
                <span>Adjust Wallet for {selectedUser.name}</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowWalletModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-xs flex justify-between">
              <span className="text-slate-400">Current Balance:</span>
              <span className="font-bold text-emerald-400">
                ₹{selectedUser.wallet_balance.toLocaleString('en-IN')}
              </span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">
                Adjustment Amount (₹) — Use negative number for deduction
              </label>
              <input
                type="number"
                required
                value={adjustAmount}
                onChange={e => setAdjustAmount(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm font-black text-emerald-400"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">
                Required Audit Reason
              </label>
              <textarea
                required
                rows={2}
                value={adjustReason}
                onChange={e => setAdjustReason(e.target.value)}
                placeholder="Goodwill refund, manual cash top-up, dispute settlement..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-100"
              />
            </div>

            <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 text-[11px] text-amber-300">
              ℹ️ <strong>Audit Trail Notice:</strong> Adjusting wallet writes live to <code className="bg-slate-950 px-1 rounded">users</code>, <code className="bg-slate-950 px-1 rounded">audit_logs</code>, and <code className="bg-slate-950 px-1 rounded">wallet_transactions</code> collections.
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowWalletModal(false)}
                className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs px-4 py-2.5 rounded-xl border border-slate-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-5 py-2.5 rounded-xl shadow-lg"
              >
                {loading ? 'Processing...' : 'Confirm Wallet Adjustment'}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {/* User Transaction History Modal */}
      {showHistoryModal && selectedUser ? (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 max-w-lg w-full rounded-2xl p-6 shadow-2xl space-y-4 max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <History className="h-5 w-5 text-blue-400" />
                  <span>User Transactions: {selectedUser.name}</span>
                </h3>
                <p className="text-xs text-slate-400 font-mono mt-0.5">{selectedUser.phone}</p>
              </div>
              <button
                type="button"
                onClick={() => setShowHistoryModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
              {userTransactions.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-500">
                  No wallet transactions found for this user in Cloud Firestore.
                </div>
              ) : (
                userTransactions.map((tx, idx) => {
                  const isCredit = tx.type === 'CREDIT' || tx.type === 'topup' || (tx.amount && tx.amount > 0);
                  const amtVal = Math.abs(tx.amount || 0);

                  return (
                    <div
                      key={tx.id || idx}
                      className="bg-slate-950 border border-slate-800/80 rounded-xl p-3.5 text-xs flex items-center justify-between"
                    >
                      <div>
                        <div className="font-bold text-slate-100">{tx.title || tx.reason || 'Wallet Activity'}</div>
                        {tx.reason && tx.title !== tx.reason ? (
                          <div className="text-[11px] text-slate-400 mt-0.5">Reason: {tx.reason}</div>
                        ) : null}
                        <div className="text-[10px] text-slate-500 font-mono mt-1">
                          {tx.timestamp ? new Date(tx.timestamp).toLocaleString('en-IN') : 'Recent'}
                        </div>
                      </div>
                      <div
                        className={`text-sm font-extrabold ${
                          isCredit ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {isCredit ? `+₹${amtVal}` : `-₹${amtVal}`}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowHistoryModal(false)}
                className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs px-4 py-2.5 rounded-xl border border-slate-700"
              >
                Close History
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
