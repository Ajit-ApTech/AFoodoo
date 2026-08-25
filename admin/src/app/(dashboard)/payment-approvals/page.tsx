'use client';

import React, { useState, useEffect } from 'react';
import {
  collection,
  onSnapshot,
  query,
  orderBy,
  doc,
  updateDoc,
  addDoc,
  increment,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { PaymentRequest } from '../../../types';
import { sendExpoPushNotification } from '../../../lib/pushService';
import {
  CreditCard,
  CheckCircle2,
  XCircle,
  Clock,
  Search,
  Filter,
  RefreshCw,
  AlertCircle,
  User,
  Phone,
  Calendar,
  Layers,
  Sparkles,
  ShoppingBag,
  Repeat,
  Wallet,
  ShieldCheck,
} from 'lucide-react';

export default function PaymentApprovalsPage() {
  const [requests, setRequests] = useState<PaymentRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'pending' | 'utr' | 'approved' | 'rejected' | 'all'>('pending');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Reject modal state
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [selectedReqForReject, setSelectedReqForReject] = useState<PaymentRequest | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  // Toast feedback
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // Real-time Firestore snapshot on payment_requests (pure live data)
  useEffect(() => {
    try {
      const q = query(collection(db, 'payment_requests'), orderBy('created_at', 'desc'));
      const unsubscribe = onSnapshot(
        q,
        snapshot => {
          const list: PaymentRequest[] = snapshot.docs.map(doc => ({
            id: doc.id,
            ...(doc.data() as any),
          }));
          setRequests(list);
          setLoading(false);
        },
        error => {
          console.error('Firestore payment_requests listener error:', error);
          setLoading(false);
        }
      );
      return unsubscribe;
    } catch (e) {
      setLoading(false);
    }
  }, []);

  const handleApprove = async (req: PaymentRequest) => {
    setActionLoading(req.id);
    try {
      const now = new Date().toISOString();
      const adminEmail = 'admin@afoodoo.com';

      // 1. Mark payment_request as approved
      await updateDoc(doc(db, 'payment_requests', req.id), {
        status: 'approved',
        approved_by: adminEmail,
        approved_at: now,
        updated_at: now,
      });

      // 2. Execute the business action depending on type
      if (req.type === 'order' && req.order_payload) {
        const p = req.order_payload;
        const otpCode = Math.floor(1000 + Math.random() * 9000).toString();
        const orderRef = await addDoc(collection(db, 'orders'), {
          user_id: req.user_id,
          user_name: req.user_name,
          user_phone: req.user_phone,
          menu_item_id: p.menu_item_id,
          menu_title: p.menu_title,
          meal_slot_id: p.meal_slot_id,
          slot_name: p.slot_name,
          delivery_window: p.delivery_window,
          status: 'booked',
          delivery_address: p.delivery_address,
          receiver_name: p.receiver_name,
          receiver_phone: p.receiver_phone,
          delivery_lat: p.delivery_lat || null,
          delivery_lng: p.delivery_lng || null,
          delivery_distance_km: p.delivery_distance_km || null,
          maps_link: p.maps_link || null,
          payment_status: 'paid',
          payment_method: 'upi',
          total_amount: req.amount,
          otp_code: otpCode,
          created_at: now,
          updated_at: now,
        });

        // Update payment_request with the created order ID
        await updateDoc(doc(db, 'payment_requests', req.id), {
          result_order_id: orderRef.id,
        });

        // Increment quantity_booked on menu item (best-effort)
        try {
          await updateDoc(doc(db, 'menu_items', p.menu_item_id), {
            quantity_booked: increment(1),
          });
        } catch (_) {}

      } else if (req.type === 'wallet_topup') {
        // Credit wallet balance
        const userDigits = (req.user_phone || '').replace(/\D/g, '');
        const userDocId = req.user_id || `usr_${userDigits}`;
        await updateDoc(doc(db, 'users', userDocId), {
          wallet_balance: increment(req.amount),
          updated_at: now,
        });
        await addDoc(collection(db, 'wallet_transactions'), {
          user_id: req.user_id,
          user_phone: req.user_phone,
          amount: req.amount,
          type: 'credit',
          description: `UPI Wallet Top-Up — Admin Verified`,
          payment_request_id: req.id,
          created_at: now,
        });

      } else if (req.type === 'subscription' && req.subscription_payload) {
        const sp = req.subscription_payload;
        const userDigits = (req.user_phone || '').replace(/\D/g, '');
        const userDocId = req.user_id || `usr_${userDigits}`;
        const subRef = await addDoc(collection(db, 'subscriptions'), {
          user_id: req.user_id,
          user_phone: req.user_phone,
          plan_id: sp.plan_id,
          plan_title: sp.plan_title,
          meals_total: sp.meals,
          meals_remaining: sp.meals,
          status: 'active',
          payment_method: 'upi',
          amount_paid: req.amount,
          payment_request_id: req.id,
          started_at: now,
          created_at: now,
          updated_at: now,
        });
        await updateDoc(doc(db, 'payment_requests', req.id), {
          result_subscription_id: subRef.id,
        });
        // Credit wallet bonus
        const bonus = sp.wallet_credit_bonus || 0;
        if (bonus > 0) {
          await updateDoc(doc(db, 'users', userDocId), {
            wallet_balance: increment(bonus),
            active_subscription: sp.plan_title,
            updated_at: now,
          });
          await addDoc(collection(db, 'wallet_transactions'), {
            user_id: req.user_id,
            user_phone: req.user_phone,
            amount: bonus,
            type: 'credit',
            description: `Subscription Bonus — ${sp.plan_title}`,
            subscription_id: subRef.id,
            created_at: now,
          });
        }
      }

      // 3. Add audit log
      await addDoc(collection(db, 'audit_logs'), {
        admin_email: adminEmail,
        action_type: 'payment_approved',
        target_id: req.id,
        details: `Approved ${req.type} payment of ₹${req.amount} for ${req.user_name} (${req.user_phone})`,
        timestamp: now,
      });

      // 4. Push notification to customer
      try {
        const { getDoc: fsGet, doc: fsDoc } = await import('firebase/firestore');
        const userDigits = (req.user_phone || '').replace(/\D/g, '');
        const userDocId = req.user_id || `usr_${userDigits}`;
        const userSnap = await fsGet(fsDoc(db, 'users', userDocId));
        const token = userSnap.exists()
          ? userSnap.data().expo_push_token || userSnap.data().fcm_token
          : null;
        if (token) {
          await sendExpoPushNotification(
            [token],
            '✅ Payment Confirmed — AFoodoo',
            req.type === 'order'
              ? `Your UPI payment of ₹${req.amount} has been verified! Your meal order is now confirmed.`
              : req.type === 'wallet_topup'
              ? `₹${req.amount} has been added to your AFoodoo Wallet!`
              : `Your ${req.subscription_payload?.plan_title} subscription is now active!`,
            { type: req.type, payment_request_id: req.id }
          );
        }
      } catch (_) {}

      showToast(`✅ Approved ₹${req.amount} payment for ${req.user_name}!`, 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to approve payment. Check Firestore rules.', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleOpenReject = (req: PaymentRequest) => {
    setSelectedReqForReject(req);
    setRejectReason('Payment transaction could not be located in UPI statement.');
    setRejectModalOpen(true);
  };

  const handleConfirmReject = async () => {
    if (!selectedReqForReject) return;
    setActionLoading(selectedReqForReject.id);
    try {
      const now = new Date().toISOString();
      const adminEmail = 'admin@afoodoo.com';

      await updateDoc(doc(db, 'payment_requests', selectedReqForReject.id), {
        status: 'rejected',
        rejected_by: adminEmail,
        rejected_at: now,
        reject_reason: rejectReason.trim(),
        updated_at: now,
      });

      await addDoc(collection(db, 'audit_logs'), {
        admin_email: adminEmail,
        action_type: 'payment_rejected',
        target_id: selectedReqForReject.id,
        details: `Rejected ${selectedReqForReject.type} payment of ₹${selectedReqForReject.amount} for ${selectedReqForReject.user_name}. Reason: ${rejectReason.trim()}`,
        timestamp: now,
      });

      // Push notification to customer
      try {
        const { getDoc: fsGet, doc: fsDoc } = await import('firebase/firestore');
        const userDigits = (selectedReqForReject.user_phone || '').replace(/\D/g, '');
        const userDocId = selectedReqForReject.user_id || `usr_${userDigits}`;
        const userSnap = await fsGet(fsDoc(db, 'users', userDocId));
        const token = userSnap.exists()
          ? userSnap.data().expo_push_token || userSnap.data().fcm_token
          : null;
        if (token) {
          await sendExpoPushNotification(
            [token],
            '⚠️ Payment Not Verified — AFoodoo',
            `Your ₹${selectedReqForReject.amount} payment could not be verified. Reason: ${rejectReason.trim()}. Please open the app and provide your 12-digit UTR number.`,
            { type: selectedReqForReject.type, payment_request_id: selectedReqForReject.id }
          );
        }
      } catch (_) {}

      showToast(`Payment rejected. Customer notified to provide UTR.`, 'success');
      setRejectModalOpen(false);
      setSelectedReqForReject(null);
    } catch (err: any) {
      showToast(err.message || 'Failed to reject payment.', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  // Filter list
  const filteredRequests = requests.filter(req => {
    // Tab filter
    if (activeTab === 'pending' && !['pending', 'utr_submitted'].includes(req.status)) return false;
    if (activeTab === 'utr' && req.status !== 'utr_submitted') return false;
    if (activeTab === 'approved' && req.status !== 'approved') return false;
    if (activeTab === 'rejected' && req.status !== 'rejected' && req.status !== 'permanently_rejected') return false;

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = req.user_name?.toLowerCase().includes(q);
      const matchPhone = req.user_phone?.includes(q);
      const matchUtr = req.utr_number?.toLowerCase().includes(q);
      const matchAmount = String(req.amount).includes(q);
      const matchId = req.id.toLowerCase().includes(q);
      return matchName || matchPhone || matchUtr || matchAmount || matchId;
    }

    return true;
  });

  const pendingCount = requests.filter(r => ['pending', 'utr_submitted'].includes(r.status)).length;
  const utrCount = requests.filter(r => r.status === 'utr_submitted').length;
  const approvedToday = requests.filter(r => {
    if (r.status !== 'approved' || !r.approved_at) return false;
    const date = new Date(r.approved_at);
    const today = new Date();
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    );
  });
  const approvedTotalToday = approvedToday.reduce((sum, r) => sum + (r.amount || 0), 0);

  const typeConfig: Record<string, { label: string; icon: any; color: string }> = {
    order: { label: 'Meal Order', icon: ShoppingBag, color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
    wallet_topup: { label: 'Wallet Top-Up', icon: Wallet, color: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
    subscription: { label: 'Subscription Pack', icon: Repeat, color: 'bg-purple-500/10 text-purple-400 border-purple-500/20' },
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Toast Alert */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl border shadow-xl flex items-center gap-3 animate-fade-in ${
            toast.type === 'success'
              ? 'bg-emerald-950/90 border-emerald-500 text-emerald-200'
              : 'bg-rose-950/90 border-rose-500 text-rose-200'
          }`}
        >
          {toast.type === 'success' ? <CheckCircle2 className="h-5 w-5 text-emerald-400" /> : <AlertCircle className="h-5 w-5 text-rose-400" />}
          <span className="text-sm font-medium">{toast.message}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-100 flex items-center gap-2.5">
            <CreditCard className="h-7 w-7 text-orange-500" />
            Payment Approvals 💰
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Real-time verification queue for UPI orders, wallet top-ups, and subscription packs.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-slate-800/80 border border-slate-700 px-3.5 py-2 rounded-xl text-xs text-slate-300">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <span>Live Firestore Sync</span>
          </div>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Awaiting Verification</span>
            <Clock className="h-5 w-5 text-amber-400" />
          </div>
          <p className="text-3xl font-extrabold text-amber-400 mt-2">{pendingCount}</p>
          <p className="text-[11px] text-slate-500 mt-1">Requires admin approval to confirm</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">UTR Submitted</span>
            <ShieldCheck className="h-5 w-5 text-yellow-400" />
          </div>
          <p className="text-3xl font-extrabold text-yellow-400 mt-2">{utrCount}</p>
          <p className="text-[11px] text-slate-500 mt-1">Customer submitted 12-digit UTR for re-check</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Approved Today</span>
            <CheckCircle2 className="h-5 w-5 text-emerald-400" />
          </div>
          <p className="text-3xl font-extrabold text-emerald-400 mt-2">₹{approvedTotalToday.toLocaleString('en-IN')}</p>
          <p className="text-[11px] text-slate-500 mt-1">{approvedToday.length} verified transactions today</p>
        </div>
      </div>

      {/* Controls & Search */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-900/60 p-3 rounded-2xl border border-slate-800">
        {/* Filter Tabs */}
        <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
          <button
            onClick={() => setActiveTab('pending')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 ${
              activeTab === 'pending'
                ? 'bg-orange-600 text-white shadow-lg shadow-orange-600/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <span>Pending</span>
            {pendingCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-rose-500 text-white text-[10px]">
                {pendingCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('utr')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 ${
              activeTab === 'utr'
                ? 'bg-yellow-600 text-white shadow-lg shadow-yellow-600/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <span>UTR Submitted</span>
            {utrCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-yellow-400 text-slate-950 font-extrabold text-[10px]">
                {utrCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('approved')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all shrink-0 ${
              activeTab === 'approved'
                ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            Approved
          </button>

          <button
            onClick={() => setActiveTab('rejected')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all shrink-0 ${
              activeTab === 'rejected'
                ? 'bg-rose-600 text-white shadow-lg shadow-rose-600/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            Rejected
          </button>

          <button
            onClick={() => setActiveTab('all')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all shrink-0 ${
              activeTab === 'all'
                ? 'bg-slate-700 text-white'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            All History
          </button>
        </div>

        {/* Search Box */}
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search name, phone, UTR..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full bg-slate-950 border border-slate-700/80 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-orange-500"
          />
        </div>
      </div>

      {/* Requests Queue */}
      {loading ? (
        <div className="py-20 text-center">
          <RefreshCw className="h-8 w-8 animate-spin text-orange-500 mx-auto" />
          <p className="text-xs text-slate-400 mt-3 font-medium">Loading payment verification queue...</p>
        </div>
      ) : filteredRequests.length === 0 ? (
        <div className="py-16 text-center bg-slate-900/30 border border-slate-800/80 rounded-2xl">
          <CheckCircle2 className="h-12 w-12 text-slate-600 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-300">No payment requests in this view</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            {activeTab === 'pending'
              ? 'All UPI payments are currently verified and clear!'
              : 'Try changing your search query or selecting a different tab.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredRequests.map(req => {
            const typeInfo = typeConfig[req.type] || typeConfig.order;
            const TypeIcon = typeInfo.icon;
            const isUtrSubmitted = req.status === 'utr_submitted';
            const isPending = req.status === 'pending';
            const isApproved = req.status === 'approved';
            const isRejected = req.status === 'rejected';

            const createdTime = req.created_at
              ? new Date(req.created_at).toLocaleString('en-IN', {
                  hour: '2-digit',
                  minute: '2-digit',
                  day: 'numeric',
                  month: 'short',
                })
              : 'Recently';

            return (
              <div
                key={req.id}
                className={`bg-slate-900 border rounded-2xl p-5 flex flex-col justify-between transition-all relative ${
                  isUtrSubmitted
                    ? 'border-yellow-500/60 shadow-lg shadow-yellow-500/5'
                    : isPending
                    ? 'border-orange-500/40'
                    : isApproved
                    ? 'border-emerald-500/30 opacity-90'
                    : 'border-rose-500/30 opacity-80'
                }`}
              >
                <div>
                  {/* Top Bar: Type + Status */}
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold border ${typeInfo.color}`}>
                      <TypeIcon className="h-3.5 w-3.5" />
                      {typeInfo.label}
                    </span>

                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wide border ${
                        isApproved
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                          : isRejected
                          ? 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                          : isUtrSubmitted
                          ? 'bg-yellow-400 text-slate-950 border-yellow-300 font-black'
                          : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                      }`}
                    >
                      {isUtrSubmitted ? '⚡ UTR Provided' : req.status}
                    </span>
                  </div>

                  {/* Customer Info & Amount */}
                  <div className="flex items-baseline justify-between gap-2 my-2">
                    <div>
                      <h3 className="font-extrabold text-slate-100 text-base flex items-center gap-1.5">
                        <User className="h-4 w-4 text-slate-400" />
                        {req.user_name || 'Customer'}
                      </h3>
                      <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                        <Phone className="h-3 w-3" />
                        {req.user_phone || 'No phone'}
                      </p>
                    </div>

                    <div className="text-right">
                      <span className="text-2xl font-black text-slate-100">₹{req.amount}</span>
                    </div>
                  </div>

                  {/* UTR Highlight Card */}
                  {req.utr_number && (
                    <div className="bg-yellow-500/10 border border-yellow-500/40 rounded-xl p-3 my-3">
                      <div className="flex items-center justify-between text-[11px] text-yellow-300 font-bold mb-1">
                        <span className="flex items-center gap-1">
                          <ShieldCheck className="h-3.5 w-3.5" />
                          Bank UTR / Ref Number:
                        </span>
                        <span className="text-[10px] bg-yellow-400 text-slate-950 px-1.5 py-0.5 rounded font-black">
                          12-DIGIT
                        </span>
                      </div>
                      <p className="font-mono text-base font-black text-yellow-200 tracking-wider">
                        {req.utr_number}
                      </p>
                    </div>
                  )}

                  {/* Specific Payload Details */}
                  <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-3 my-3 text-xs space-y-1.5 text-slate-300">
                    {req.type === 'order' && req.order_payload && (
                      <>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Meal:</span>
                          <span className="font-bold text-slate-200">{req.order_payload.menu_title}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Slot:</span>
                          <span className="text-slate-300">{req.order_payload.slot_name || 'Lunch'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Delivery Address:</span>
                          <span className="text-slate-300 text-right truncate max-w-[180px]">
                            {req.order_payload.delivery_address?.line1 || 'Provided'}
                          </span>
                        </div>
                      </>
                    )}

                    {req.type === 'wallet_topup' && (
                      <div className="flex justify-between">
                        <span className="text-slate-500">Action:</span>
                        <span className="font-semibold text-blue-300">Wallet Top-Up (+₹{req.amount})</span>
                      </div>
                    )}

                    {req.type === 'subscription' && req.subscription_payload && (
                      <>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Plan:</span>
                          <span className="font-bold text-purple-300">{req.subscription_payload.plan_title}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Meals:</span>
                          <span className="text-slate-300">{req.subscription_payload.meals} Meals</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Wallet Bonus:</span>
                          <span className="text-emerald-400 font-bold">+₹{req.subscription_payload.wallet_credit_bonus}</span>
                        </div>
                      </>
                    )}

                    {req.reject_reason && isRejected && (
                      <div className="text-rose-400 text-[11px] pt-1 border-t border-rose-500/20">
                        <strong>Reject Reason:</strong> {req.reject_reason}
                      </div>
                    )}
                  </div>

                  <p className="text-[11px] text-slate-500 flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    Submitted {createdTime}
                  </p>
                </div>

                {/* Bottom Action Buttons */}
                <div className="mt-4 pt-3 border-t border-slate-800/80">
                  {isPending || isUtrSubmitted ? (
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleOpenReject(req)}
                        disabled={actionLoading === req.id}
                        className="flex-1 py-2 px-3 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20 text-xs font-bold transition-all flex items-center justify-center gap-1.5"
                      >
                        <XCircle className="h-3.5 w-3.5" />
                        Reject
                      </button>

                      <button
                        onClick={() => handleApprove(req)}
                        disabled={actionLoading === req.id}
                        className={`flex-[1.5] py-2 px-3 rounded-xl text-white text-xs font-bold transition-all shadow-lg flex items-center justify-center gap-1.5 ${
                          isUtrSubmitted
                            ? 'bg-yellow-500 hover:bg-yellow-400 text-slate-950 shadow-yellow-500/20'
                            : 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/20'
                        }`}
                      >
                        {actionLoading === req.id ? (
                          <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <>
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            {isUtrSubmitted ? 'Verify & Approve' : 'Approve Payment'}
                          </>
                        )}
                      </button>
                    </div>
                  ) : isApproved ? (
                    <div className="flex items-center justify-between text-xs text-emerald-400 font-semibold bg-emerald-950/40 border border-emerald-500/20 rounded-xl px-3 py-2">
                      <span className="flex items-center gap-1.5">
                        <CheckCircle2 className="h-4 w-4" /> Approved
                      </span>
                      <span className="text-[10px] text-slate-400">by {req.approved_by || 'Admin'}</span>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between text-xs text-rose-400 font-semibold bg-rose-950/40 border border-rose-500/20 rounded-xl px-3 py-2">
                      <span className="flex items-center gap-1.5">
                        <XCircle className="h-4 w-4" /> Rejected
                      </span>
                      <span className="text-[10px] text-slate-400">by {req.rejected_by || 'Admin'}</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Rejection Modal */}
      {rejectModalOpen && selectedReqForReject && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-scale-in">
            <div className="flex items-center gap-3 text-rose-400">
              <div className="p-2 rounded-xl bg-rose-500/10 border border-rose-500/20">
                <AlertCircle className="h-6 w-6" />
              </div>
              <div>
                <h3 className="font-extrabold text-slate-100 text-base">Reject Payment Verification</h3>
                <p className="text-xs text-slate-400">₹{selectedReqForReject.amount} from {selectedReqForReject.user_name}</p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              The customer will receive an instant push notification requesting their 12-digit UPI UTR reference number to re-verify.
            </p>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">Reason / Note for Customer</label>
              <textarea
                value={rejectReason}
                onChange={e => setRejectReason(e.target.value)}
                rows={3}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs text-slate-100 focus:outline-none focus:border-rose-500"
                placeholder="e.g. Payment transaction could not be located in UPI bank statement."
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => {
                  setRejectModalOpen(false);
                  setSelectedReqForReject(null);
                }}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmReject}
                disabled={actionLoading !== null}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-lg shadow-rose-600/20 flex items-center gap-2"
              >
                {actionLoading ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <XCircle className="h-3.5 w-3.5" />}
                Confirm Rejection & Request UTR
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
