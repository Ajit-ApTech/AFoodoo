'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { db } from '../../../lib/firebase';
import {
  collection,
  onSnapshot,
  doc,
  updateDoc,
  increment,
  addDoc,
  deleteDoc,
  getDoc,
} from 'firebase/firestore';
import {
  Repeat,
  Calendar,
  PauseCircle,
  PlayCircle,
  PlusCircle,
  X,
  CheckCircle,
  Search,
  Filter,
  Download,
  CalendarDays,
  User,
  Phone,
  Check,
  Pause,
  AlertTriangle,
  Clock,
  Utensils,
  ChevronLeft,
  ChevronRight,
  Trash2,
  XCircle,
} from 'lucide-react';
import { sendExpoPushNotification } from '../../../lib/pushService';

interface SubscriptionDoc {
  id: string;
  user_id?: string;
  user_name?: string;
  user_phone?: string;
  plan_id?: string;
  plan_type?: string;
  plan_title?: string;
  price?: number;
  amount_paid?: number;
  meals_total?: number;
  meals_remaining?: number;
  status?: string;
  is_paused?: boolean;
  paused_dates?: string[];
  start_date?: string;
  end_date?: string;
  auto_renew?: boolean;
  daily_menu?: Record<string, { id?: string; name?: string; price?: number }>;
  created_at?: string;
  last_auto_booked_date?: string;
  cancellation_requested?: boolean;
  cancellation_reason?: string;
  cancelled_at?: string;
  cancelled_by?: string;
}

export default function SubscriptionsManagementPage() {
  const [subscriptions, setSubscriptions] = useState<SubscriptionDoc[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters & Search
  const [activeTab, setActiveTab] = useState<'all' | 'active' | 'paused' | 'expired'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [planTypeFilter, setPlanTypeFilter] = useState('ALL');
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7)); // 'YYYY-MM'

  // Drawer & Modals State
  const [selectedSubForDrawer, setSelectedSubForDrawer] = useState<SubscriptionDoc | null>(null);
  const [drawerTab, setDrawerTab] = useState<'overview' | 'calendar' | 'menu'>('overview');

  // Bonus meals modal state
  const [selectedSubForMeals, setSelectedSubForMeals] = useState<SubscriptionDoc | null>(null);
  const [bonusMealCount, setBonusMealCount] = useState('5');
  const [showBonusModal, setShowBonusModal] = useState(false);

  // Manual Skip Date picker in Drawer / Modal
  const [newSkipDate, setNewSkipDate] = useState(new Date().toISOString().split('T')[0]);

  // Subscription Cancellation Modal State
  const [showCancelSubModal, setShowCancelSubModal] = useState(false);
  const [subToCancel, setSubToCancel] = useState<SubscriptionDoc | null>(null);
  const [cancelReason, setCancelReason] = useState('Customer requested cancellation');
  const [customCancelReason, setCustomCancelReason] = useState('');
  const [isProcessingCancel, setIsProcessingCancel] = useState(false);

  // Subscription Deletion Modal State
  const [showDeleteSubModal, setShowDeleteSubModal] = useState(false);
  const [subToDelete, setSubToDelete] = useState<SubscriptionDoc | null>(null);
  const [isProcessingDelete, setIsProcessingDelete] = useState(false);

  // Bulk Cleanup Modal State
  const [showBulkCleanupModal, setShowBulkCleanupModal] = useState(false);
  const [isProcessingBulkCleanup, setIsProcessingBulkCleanup] = useState(false);

  // Subscribe directly to Cloud Firestore subscriptions collection
  useEffect(() => {
    try {
      const unsub = onSnapshot(
        collection(db, 'subscriptions'),
        snap => {
          if (!snap.empty) {
            const list: SubscriptionDoc[] = snap.docs.map(docSnap => ({
              id: docSnap.id,
              ...docSnap.data(),
            }));
            setSubscriptions(list);

            // Keep drawer synced if currently open
            if (selectedSubForDrawer) {
              const updated = list.find(s => s.id === selectedSubForDrawer.id);
              if (updated) setSelectedSubForDrawer(updated);
            }
          } else {
            setSubscriptions([]);
          }
          setLoading(false);
        },
        err => {
          console.log('subscriptions listener error:', err.message);
          setLoading(false);
        }
      );
      return unsub;
    } catch (e) {
      setLoading(false);
    }
  }, [selectedSubForDrawer?.id]);

  // Helper to determine status
  const getSubStatus = (sub: SubscriptionDoc): 'active' | 'paused' | 'expired' | 'cancelled' => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    const isExplicitCancelled = sub.status?.toLowerCase() === 'cancelled';
    if (isExplicitCancelled) {
      return 'cancelled';
    }

    const isExplicitExpired = sub.status?.toLowerCase() === 'expired';
    const isOutOfMeals = typeof sub.meals_remaining === 'number' && sub.meals_remaining <= 0;
    const isPastEndDate = sub.end_date ? new Date(sub.end_date) < now : false;

    if (isExplicitExpired || isOutOfMeals || isPastEndDate) {
      return 'expired';
    }
    if (sub.is_paused || sub.status === 'PAUSED') {
      return 'paused';
    }
    return 'active';
  };

  // Metrics calculation
  const metrics = useMemo(() => {
    let total = subscriptions.length;
    let active = 0;
    let paused = 0;
    let expired = 0;
    let expiringThisWeek = 0;

    const now = new Date();
    const inSevenDays = new Date();
    inSevenDays.setDate(now.getDate() + 7);

    subscriptions.forEach(sub => {
      const st = getSubStatus(sub);
      if (st === 'active') active++;
      else if (st === 'paused') paused++;
      else if (st === 'expired' || st === 'cancelled') expired++;

      if (st === 'active' && sub.end_date) {
        const endDate = new Date(sub.end_date);
        if (endDate >= now && endDate <= inSevenDays) {
          expiringThisWeek++;
        }
      }
    });

    return { total, active, paused, expired, expiringThisWeek };
  }, [subscriptions]);

  // Filtered List
  const filteredSubscriptions = useMemo(() => {
    return subscriptions.filter(sub => {
      const st = getSubStatus(sub);
      if (activeTab === 'active' && st !== 'active') return false;
      if (activeTab === 'paused' && st !== 'paused') return false;
      if (activeTab === 'expired' && st !== 'expired' && st !== 'cancelled') return false;

      if (planTypeFilter !== 'ALL') {
        const planName = (sub.plan_type || sub.plan_title || '').toLowerCase();
        if (!planName.includes(planTypeFilter.toLowerCase())) return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const name = (sub.user_name || '').toLowerCase();
        const phone = (sub.user_phone || '').toLowerCase();
        const plan = (sub.plan_type || sub.plan_title || '').toLowerCase();
        if (!name.includes(q) && !phone.includes(q) && !plan.includes(q)) return false;
      }

      return true;
    });
  }, [subscriptions, activeTab, planTypeFilter, searchQuery]);

  // Current week days (Monday - Sunday) for the Delivery Status Matrix
  const currentWeekDays = useMemo(() => {
    const curr = new Date();
    const dayOfWeek = curr.getDay(); // 0 is Sunday
    // Distance to Monday
    const distanceToMonday = (dayOfWeek + 6) % 7;
    const monday = new Date(curr);
    monday.setDate(curr.getDate() - distanceToMonday);

    const days = [];
    const labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const isoStr = d.toISOString().split('T')[0];
      days.push({
        label: labels[i],
        date: d,
        isoStr,
        dayNum: d.getDate(),
      });
    }
    return days;
  }, []);

  // Toggle pause/resume for subscription
  const handleTogglePauseStatus = async (sub: SubscriptionDoc) => {
    const isCurrentlyPaused = sub.is_paused || sub.status === 'PAUSED';
    const newStatus = isCurrentlyPaused ? 'ACTIVE' : 'PAUSED';

    try {
      await updateDoc(doc(db, 'subscriptions', sub.id), {
        is_paused: !isCurrentlyPaused,
        status: newStatus,
        updated_at: new Date().toISOString(),
      });

      await addDoc(collection(db, 'audit_logs'), {
        action_type: isCurrentlyPaused ? 'SUBSCRIPTION_RESUMED' : 'SUBSCRIPTION_PAUSED',
        admin_email: 'admin@afoodoo.com',
        details: `${isCurrentlyPaused ? 'Resumed' : 'Paused'} subscription for ${
          sub.user_name || sub.user_phone
        } (${sub.plan_type})`,
        user_id: sub.user_id || '',
        user_phone: sub.user_phone || '',
        timestamp: new Date().toISOString(),
      });
    } catch (e: any) {
      alert(`Error updating subscription: ${e.message}`);
    }
  };

  // Add specific skip date
  const handleAddSkipDate = async (sub: SubscriptionDoc, dateToAdd: string) => {
    if (!dateToAdd) return;
    try {
      const existing = sub.paused_dates || [];
      if (existing.includes(dateToAdd)) {
        // Toggle OFF (remove date)
        const updated = existing.filter(d => d !== dateToAdd);
        await updateDoc(doc(db, 'subscriptions', sub.id), {
          paused_dates: updated,
          updated_at: new Date().toISOString(),
        });
      } else {
        // Toggle ON (add date)
        const updated = [...existing, dateToAdd].sort();
        await updateDoc(doc(db, 'subscriptions', sub.id), {
          paused_dates: updated,
          updated_at: new Date().toISOString(),
        });
      }
    } catch (e: any) {
      alert(`Error toggling skip date: ${e.message}`);
    }
  };

  // Add bonus meals
  const handleAddCustomBonusMeals = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSubForMeals || !bonusMealCount) return;

    const countNum = parseInt(bonusMealCount, 10);
    if (isNaN(countNum) || countNum <= 0) {
      alert('Please enter a valid positive meal quantity.');
      return;
    }

    try {
      await updateDoc(doc(db, 'subscriptions', selectedSubForMeals.id), {
        meals_remaining: increment(countNum),
        updated_at: new Date().toISOString(),
      });

      await addDoc(collection(db, 'audit_logs'), {
        action_type: 'BONUS_MEALS_ADDED',
        admin_email: 'admin@afoodoo.com',
        details: `Added ${countNum} bonus meals for ${
          selectedSubForMeals.user_name || selectedSubForMeals.user_phone
        } (${selectedSubForMeals.plan_type})`,
        user_id: selectedSubForMeals.user_id || '',
        user_phone: selectedSubForMeals.user_phone || '',
        timestamp: new Date().toISOString(),
      });

      alert(`Successfully added ${countNum} bonus meals!`);
      setShowBonusModal(false);
      setSelectedSubForMeals(null);
    } catch (e: any) {
      alert(`Error adding bonus meals: ${e.message}`);
    }
  };

  // Monthly Calendar generator for the selected subscriber
  const monthDays = useMemo(() => {
    const [year, month] = selectedMonth.split('-').map(Number);
    const date = new Date(year, month - 1, 1);
    const days = [];
    const firstDayIndex = (date.getDay() + 6) % 7; // Monday = 0

    // Leading blanks
    for (let i = 0; i < firstDayIndex; i++) {
      days.push({ day: null, dateStr: '' });
    }

    const totalDaysInMonth = new Date(year, month, 0).getDate();
    for (let i = 1; i <= totalDaysInMonth; i++) {
      const dStr = `${year}-${String(month).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
      days.push({ day: i, dateStr: dStr });
    }

    return days;
  }, [selectedMonth]);

  // Export CSV
  const handleExportCSV = () => {
    const headers = ['Customer Name', 'Phone', 'Plan', 'Start Date', 'Valid Until', 'Meals Left', 'Status', 'Paused Dates'];
    const rows = filteredSubscriptions.map(s => [
      `"${s.user_name || 'Customer'}"`,
      `"${s.user_phone || ''}"`,
      `"${s.plan_type || s.plan_title || ''}"`,
      s.start_date || '',
      s.end_date || '',
      s.meals_remaining ?? 0,
      getSubStatus(s).toUpperCase(),
      `"${(s.paused_dates || []).join('; ')}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `meal_subscriptions_${selectedMonth}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Cancel Subscription Handler (Admin Only - No automatic wallet credit)
  const handleCancelSubscription = async () => {
    if (!subToCancel) return;
    setIsProcessingCancel(true);
    const finalReason = cancelReason === 'Other' && customCancelReason.trim() ? customCancelReason.trim() : cancelReason;
    const subId = subToCancel.id;
    const userName = subToCancel.user_name || subToCancel.user_phone || 'Customer';

    try {
      // 1. Update subscription in Firestore
      await updateDoc(doc(db, 'subscriptions', subId), {
        status: 'CANCELLED',
        is_paused: false,
        cancellation_requested: false,
        cancelled_at: new Date().toISOString(),
        cancelled_by: 'admin',
        cancellation_reason: finalReason,
        updated_at: new Date().toISOString(),
      });

      // 2. Audit Log (note: refund managed manually by admin)
      await addDoc(collection(db, 'audit_logs'), {
        action_type: 'SUBSCRIPTION_CANCELLED',
        admin_email: 'admin@afoodoo.com',
        details: `Cancelled subscription for ${userName} (${subToCancel.plan_type}). Reason: "${finalReason}". Refund to be managed manually by admin.`,
        user_id: subToCancel.user_id || '',
        user_phone: subToCancel.user_phone || '',
        timestamp: new Date().toISOString(),
      });

      // 3. Customer Push Notification & App Notification Record
      const userPhoneDigits = (subToCancel.user_phone || '').replace(/\D/g, '');
      const userDocId = subToCancel.user_id || (userPhoneDigits ? `usr_${userPhoneDigits}` : '');
      let fcmToken: string | null = (subToCancel as any).expo_push_token || null;
      if (!fcmToken && userDocId) {
        try {
          const userSnap = await getDoc(doc(db, 'users', userDocId));
          if (userSnap.exists()) {
            fcmToken = userSnap.data()?.expo_push_token || userSnap.data()?.fcm_token || null;
          }
        } catch (_) {}
      }

      const pushTitle = '🍱 Subscription Cancelled';
      const pushBody = `Your ${subToCancel.plan_type || 'meal plan'} subscription has been cancelled (${finalReason}). For any refund queries, please contact kitchen support.`;

      try {
        await addDoc(collection(db, 'customer_notifications'), {
          user_id: userDocId,
          user_phone: userPhoneDigits,
          subscription_id: subId,
          title: pushTitle,
          body: pushBody,
          status: 'cancelled',
          timestamp: new Date().toISOString(),
        });
      } catch (_) {}

      if (fcmToken) {
        sendExpoPushNotification([fcmToken], pushTitle, pushBody, {
          subscriptionId: subId,
          status: 'cancelled',
        });
      }

      setShowCancelSubModal(false);
      setSubToCancel(null);
      setIsProcessingCancel(false);
      if (selectedSubForDrawer?.id === subId) {
        setSelectedSubForDrawer(null);
      }
      alert(`Subscription for ${userName} has been cancelled successfully.\n\nNote: If a refund is required, please manage it manually via the user's wallet or UPI.`);
    } catch (err: any) {
      setIsProcessingCancel(false);
      alert(`Failed to cancel subscription: ${err.message}`);
    }
  };

  // Delete Expired/Cancelled Subscription Handler
  const handleDeleteSubscription = async () => {
    if (!subToDelete) return;
    setIsProcessingDelete(true);
    const subId = subToDelete.id;
    const userName = subToDelete.user_name || subToDelete.user_phone || 'Customer';

    try {
      await deleteDoc(doc(db, 'subscriptions', subId));

      await addDoc(collection(db, 'audit_logs'), {
        action_type: 'SUBSCRIPTION_DELETED',
        admin_email: 'admin@afoodoo.com',
        details: `Permanently deleted expired/cancelled subscription #${subId.slice(-6)} for ${userName} (${subToDelete.plan_type})`,
        timestamp: new Date().toISOString(),
      });

      setShowDeleteSubModal(false);
      setSubToDelete(null);
      setIsProcessingDelete(false);
      if (selectedSubForDrawer?.id === subId) {
        setSelectedSubForDrawer(null);
      }
    } catch (err: any) {
      setIsProcessingDelete(false);
      alert(`Failed to delete subscription: ${err.message}`);
    }
  };

  // Bulk Clean Up All Expired/Cancelled Subscriptions
  const handleBulkCleanupExpired = async () => {
    const expiredList = subscriptions.filter(s => {
      const st = getSubStatus(s);
      return st === 'expired' || st === 'cancelled';
    });

    if (expiredList.length === 0) {
      alert('No expired or cancelled subscriptions found to clean up.');
      return;
    }

    setIsProcessingBulkCleanup(true);
    try {
      for (const s of expiredList) {
        await deleteDoc(doc(db, 'subscriptions', s.id));
      }

      await addDoc(collection(db, 'audit_logs'), {
        action_type: 'SUBSCRIPTIONS_BULK_CLEANUP',
        admin_email: 'admin@afoodoo.com',
        details: `Bulk deleted ${expiredList.length} expired/cancelled subscriptions.`,
        timestamp: new Date().toISOString(),
      });

      setShowBulkCleanupModal(false);
      setIsProcessingBulkCleanup(false);
      alert(`Successfully cleaned up ${expiredList.length} expired/cancelled subscriptions!`);
    } catch (err: any) {
      setIsProcessingBulkCleanup(false);
      alert(`Bulk cleanup failed: ${err.message}`);
    }
  };

  return (
    <div className="space-y-8">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-3">
            <div className="p-2 bg-purple-500/10 border border-purple-500/20 rounded-xl">
              <Repeat className="h-6 w-6 text-purple-400" />
            </div>
            <span>Meal Subscriptions</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Manage all active meal subscriptions, view pause/skip dates, and kitchen delivery schedules.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {activeTab === 'expired' && subscriptions.some(s => {
            const st = getSubStatus(s);
            return st === 'expired' || st === 'cancelled';
          }) && (
            <button
              onClick={() => setShowBulkCleanupModal(true)}
              className="flex items-center gap-2 bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30 px-4 py-2.5 rounded-xl text-xs font-semibold transition shadow-sm"
            >
              <Trash2 className="h-4 w-4 text-rose-400" />
              <span>Clean Up Expired</span>
            </button>
          )}

          <button
            onClick={handleExportCSV}
            className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-4 py-2.5 rounded-xl text-xs font-semibold transition shadow-sm"
          >
            <Download className="h-4 w-4" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Metric 4-Card Grid (Matching Mockup) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 flex items-center justify-between shadow-lg">
          <div>
            <span className="text-xs font-semibold text-slate-400 block mb-1">Total Subscriptions</span>
            <span className="text-3xl font-black text-white">{metrics.total}</span>
          </div>
          <div className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400">
            <Repeat className="h-6 w-6" />
          </div>
        </div>

        {/* Card 2: Active */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 flex items-center justify-between shadow-lg">
          <div>
            <span className="text-xs font-semibold text-slate-400 block mb-1">Active</span>
            <span className="text-3xl font-black text-emerald-400">{metrics.active}</span>
          </div>
          <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
            <CheckCircle className="h-6 w-6" />
          </div>
        </div>

        {/* Card 3: Paused */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 flex items-center justify-between shadow-lg">
          <div>
            <span className="text-xs font-semibold text-slate-400 block mb-1">Paused</span>
            <span className="text-3xl font-black text-amber-400">{metrics.paused}</span>
          </div>
          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
            <PauseCircle className="h-6 w-6" />
          </div>
        </div>

        {/* Card 4: Expiring This Week */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 flex items-center justify-between shadow-lg">
          <div>
            <span className="text-xs font-semibold text-slate-400 block mb-1">Expiring This Week</span>
            <span className="text-3xl font-black text-rose-400">{metrics.expiringThisWeek}</span>
          </div>
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400">
            <AlertTriangle className="h-6 w-6" />
          </div>
        </div>
      </div>

      {/* Filter Tabs & Search Controls */}
      <div className="space-y-4">
        {/* Status Tabs */}
        <div className="flex items-center gap-2 border-b border-slate-800 pb-3 overflow-x-auto">
          <button
            onClick={() => setActiveTab('all')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
              activeTab === 'all'
                ? 'bg-purple-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <span>All Plans</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/20">{metrics.total}</span>
          </button>
          <button
            onClick={() => setActiveTab('active')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
              activeTab === 'active'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <span>Active</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/20">{metrics.active}</span>
          </button>
          <button
            onClick={() => setActiveTab('paused')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
              activeTab === 'paused'
                ? 'bg-amber-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <span>Paused</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/20">{metrics.paused}</span>
          </button>
          <button
            onClick={() => setActiveTab('expired')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
              activeTab === 'expired'
                ? 'bg-slate-700 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <span>Expired</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/20">{metrics.expired}</span>
          </button>
        </div>

        {/* Search & Filter Bar */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Search Input */}
          <div className="relative">
            <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search by customer name, phone, plan..."
              className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>

          {/* Plan Type Dropdown */}
          <div className="relative">
            <Filter className="absolute left-3.5 top-3 h-4 w-4 text-slate-500" />
            <select
              value={planTypeFilter}
              onChange={e => setPlanTypeFilter(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500 appearance-none"
            >
              <option value="ALL">All Plan Types</option>
              <option value="Lunch">Lunch Plans</option>
              <option value="Dinner">Dinner Plans</option>
              <option value="Combo">Lunch + Dinner Combo</option>
            </select>
          </div>

          {/* Month Selector */}
          <div className="relative">
            <CalendarDays className="absolute left-3.5 top-3 h-4 w-4 text-slate-500" />
            <input
              type="month"
              value={selectedMonth}
              onChange={e => setSelectedMonth(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>
        </div>
      </div>

      {/* Main Subscriptions Table with Weekly Delivery Dot Matrix */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-400 text-xs">
            Loading live subscriptions from Cloud Firestore...
          </div>
        ) : filteredSubscriptions.length === 0 ? (
          <div className="p-12 text-center text-slate-500 text-xs">
            No matching meal subscriptions found in Cloud Firestore.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/60 text-slate-400 font-bold uppercase tracking-wider">
                  <th className="py-4 px-4 w-10 text-center">#</th>
                  <th className="py-4 px-4">Customer</th>
                  <th className="py-4 px-4">Plan</th>
                  <th className="py-4 px-4">Start Date</th>
                  <th className="py-4 px-4">Valid Until</th>
                  <th className="py-4 px-4 text-center">Meals Left</th>
                  <th className="py-4 px-4">Status</th>
                  <th className="py-4 px-4">Paused / Skipped Dates</th>
                  <th className="py-4 px-4 text-center">
                    <div>This Week Delivery Matrix</div>
                    <div className="text-[10px] font-mono text-slate-500 flex justify-center gap-2 mt-0.5">
                      {currentWeekDays.map(d => (
                        <span key={d.label}>{d.label}</span>
                      ))}
                    </div>
                  </th>
                  <th className="py-4 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {filteredSubscriptions.map((sub, idx) => {
                  const status = getSubStatus(sub);
                  const isPaused = status === 'paused';
                  const isExpired = status === 'expired';
                  const pausedDates = sub.paused_dates || [];

                  // Customer initials
                  const nameStr = sub.user_name || 'Customer';
                  const initials = nameStr
                    .split(' ')
                    .map(n => n[0])
                    .join('')
                    .toUpperCase()
                    .slice(0, 2);

                  return (
                    <tr
                      key={sub.id}
                      className="hover:bg-slate-800/40 transition group cursor-pointer"
                      onClick={() => setSelectedSubForDrawer(sub)}
                    >
                      {/* Checkbox / index */}
                      <td className="py-4 px-4 text-center text-slate-500 font-mono text-[11px]">
                        {idx + 1}
                      </td>

                      {/* Customer Info */}
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded-full bg-gradient-to-tr from-purple-600 to-indigo-500 text-white font-bold text-xs flex items-center justify-center shadow-md">
                            {initials}
                          </div>
                          <div>
                            <div className="font-bold text-slate-200 text-xs">
                              {sub.user_name || 'Customer'}
                            </div>
                            <div className="text-[11px] font-mono text-slate-400">
                              {sub.user_phone || 'No phone'}
                            </div>
                            {sub.cancellation_requested && status !== 'cancelled' && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse mt-1">
                                <AlertTriangle className="h-2.5 w-2.5" /> Cancel Requested
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Plan Name */}
                      <td className="py-4 px-4">
                        <div className="font-semibold text-slate-200">
                          {sub.plan_type || sub.plan_title || 'Tiffin Plan'}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {sub.meals_total ? `${sub.meals_total} meals total` : 'Daily plan'}
                        </div>
                      </td>

                      {/* Start Date */}
                      <td className="py-4 px-4 font-mono text-slate-300 text-[11px]">
                        {sub.start_date ? new Date(sub.start_date).toLocaleDateString() : '—'}
                      </td>

                      {/* Valid Until */}
                      <td className="py-4 px-4 font-mono text-slate-300 text-[11px]">
                        {sub.end_date ? new Date(sub.end_date).toLocaleDateString() : '—'}
                      </td>

                      {/* Meals Left */}
                      <td className="py-4 px-4 text-center">
                        <span className="inline-block px-2.5 py-1 rounded-lg font-black text-sm bg-purple-500/10 text-purple-400 border border-purple-500/20">
                          {sub.meals_remaining ?? 0}
                        </span>
                      </td>

                      {/* Status Badge */}
                      <td className="py-4 px-4">
                        {status === 'active' ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-black uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                            <CheckCircle className="h-3 w-3" /> ACTIVE
                          </span>
                        ) : status === 'paused' ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-black uppercase bg-amber-500/10 text-amber-400 border border-amber-500/30">
                            <PauseCircle className="h-3 w-3" /> PAUSED
                          </span>
                        ) : status === 'cancelled' ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-black uppercase bg-rose-500/10 text-rose-400 border border-rose-500/30" title={sub.cancellation_reason || 'Cancelled by admin'}>
                            <XCircle className="h-3 w-3" /> CANCELLED
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-black uppercase bg-slate-800 text-slate-400 border border-slate-700">
                            EXPIRED
                          </span>
                        )}
                      </td>

                      {/* Paused / Skipped Dates */}
                      <td className="py-4 px-4">
                        {pausedDates.length > 0 ? (
                          <div className="flex flex-wrap gap-1 max-w-[200px]">
                            {pausedDates.slice(0, 3).map(dt => (
                              <span
                                key={dt}
                                className="px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[10px] font-mono"
                              >
                                {dt}
                              </span>
                            ))}
                            {pausedDates.length > 3 ? (
                              <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 text-[10px]">
                                +{pausedDates.length - 3} more
                              </span>
                            ) : null}
                          </div>
                        ) : isPaused ? (
                          <span className="text-[11px] text-amber-400/80">Deliveries Paused</span>
                        ) : (
                          <span className="text-slate-600">—</span>
                        )}
                      </td>

                      {/* Weekly Delivery Status Dot Matrix */}
                      <td className="py-4 px-4 text-center">
                        <div className="inline-flex items-center gap-1.5">
                          {currentWeekDays.map(d => {
                            const isSkipped = pausedDates.includes(d.isoStr) || isPaused;
                            // Check if within plan start & end date
                            const isWithin =
                              (!sub.start_date || d.isoStr >= sub.start_date.split('T')[0]) &&
                              (!sub.end_date || d.isoStr <= sub.end_date.split('T')[0]) &&
                              !isExpired;

                            if (!isWithin) {
                              return (
                                <div
                                  key={d.isoStr}
                                  title={`${d.label} ${d.isoStr}: Not applicable`}
                                  className="h-6 w-6 rounded-full bg-slate-800 text-slate-600 flex items-center justify-center text-[10px]"
                                >
                                  •
                                </div>
                              );
                            }

                            if (isSkipped) {
                              return (
                                <div
                                  key={d.isoStr}
                                  title={`${d.label} ${d.isoStr}: Skipped / Paused`}
                                  className="h-6 w-6 rounded-full bg-amber-500/20 border border-amber-500/50 text-amber-400 flex items-center justify-center text-[10px]"
                                >
                                  <Pause className="h-3 w-3" />
                                </div>
                              );
                            }

                            return (
                              <div
                                key={d.isoStr}
                                title={`${d.label} ${d.isoStr}: Scheduled Delivery`}
                                className="h-6 w-6 rounded-full bg-emerald-500/20 border border-emerald-500/50 text-emerald-400 flex items-center justify-center text-[10px]"
                              >
                                <Check className="h-3 w-3" />
                              </div>
                            );
                          })}
                        </div>
                      </td>

                      {/* Action Buttons */}
                      <td className="py-4 px-4 text-right" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => setSelectedSubForDrawer(sub)}
                            className="px-3 py-1.5 rounded-xl bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/30 text-xs font-bold transition shadow-sm"
                          >
                            Manage
                          </button>

                          {status !== 'expired' && status !== 'cancelled' ? (
                            <button
                              onClick={() => {
                                setSubToCancel(sub);
                                setCancelReason('Customer requested cancellation');
                                setCustomCancelReason('');
                                setShowCancelSubModal(true);
                              }}
                              title="Cancel Subscription Plan"
                              className="px-2.5 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs font-bold transition flex items-center gap-1"
                            >
                              <XCircle className="h-3.5 w-3.5" />
                              <span className="hidden sm:inline">Cancel</span>
                            </button>
                          ) : (
                            <button
                              onClick={() => {
                                setSubToDelete(sub);
                                setShowDeleteSubModal(true);
                              }}
                              title="Delete Expired / Cancelled Record"
                              className="p-1.5 rounded-xl bg-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 border border-slate-700 hover:border-rose-500/30 transition"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Slide-Over Drawer: Customer Plan Details & Monthly Kitchen Schedule (Matching Mockup) */}
      {selectedSubForDrawer ? (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/70 backdrop-blur-sm transition-opacity">
          <div className="w-full max-w-lg bg-slate-900 border-l border-slate-800 h-full overflow-y-auto p-6 shadow-2xl space-y-6 flex flex-col justify-between animate-in slide-in-from-right duration-300">
            {/* Drawer Top */}
            <div className="space-y-6">
              {/* Header */}
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <div>
                  <h2 className="text-lg font-bold text-white">Customer Plan Details</h2>
                  <p className="text-xs text-slate-400">Live sync with customer mobile app</p>
                </div>
                <button
                  onClick={() => setSelectedSubForDrawer(null)}
                  className="p-2 rounded-xl bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Customer Profile Card */}
              <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-full bg-gradient-to-tr from-purple-600 to-indigo-500 text-white font-bold text-base flex items-center justify-center shadow-lg">
                    {(selectedSubForDrawer.user_name || 'C')
                      .split(' ')
                      .map(n => n[0])
                      .join('')
                      .toUpperCase()
                      .slice(0, 2)}
                  </div>
                  <div>
                    <h3 className="font-extrabold text-white text-sm">
                      {selectedSubForDrawer.user_name || 'Customer'}
                    </h3>
                    <p className="text-xs font-mono text-slate-400">
                      {selectedSubForDrawer.user_phone || 'No phone'}
                    </p>
                  </div>
                </div>

                <div>
                  {getSubStatus(selectedSubForDrawer) === 'active' ? (
                    <span className="px-2.5 py-1 rounded-md text-[10px] font-black uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                      ACTIVE
                    </span>
                  ) : getSubStatus(selectedSubForDrawer) === 'paused' ? (
                    <span className="px-2.5 py-1 rounded-md text-[10px] font-black uppercase bg-amber-500/10 text-amber-400 border border-amber-500/30">
                      PAUSED
                    </span>
                  ) : (
                    <span className="px-2.5 py-1 rounded-md text-[10px] font-black uppercase bg-slate-800 text-slate-400 border border-slate-700">
                      EXPIRED
                    </span>
                  )}
                </div>
              </div>

              {/* Drawer Tabs */}
              <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
                <button
                  onClick={() => setDrawerTab('overview')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                    drawerTab === 'overview'
                      ? 'bg-purple-600 text-white'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Overview
                </button>
                <button
                  onClick={() => setDrawerTab('calendar')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                    drawerTab === 'calendar'
                      ? 'bg-purple-600 text-white'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Delivery Calendar
                </button>
                <button
                  onClick={() => setDrawerTab('menu')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                    drawerTab === 'menu'
                      ? 'bg-purple-600 text-white'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Day-Wise Menu
                </button>
              </div>

              {/* Tab 1: Overview */}
              {drawerTab === 'overview' && (
                <div className="space-y-4">
                  {/* Plan Card */}
                  <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-extrabold text-white text-base">
                          {selectedSubForDrawer.plan_type || selectedSubForDrawer.plan_title}
                        </h4>
                        <p className="text-xs text-slate-400">
                          {selectedSubForDrawer.meals_total || 7} meals allocation
                        </p>
                      </div>
                      <span className="text-base font-black text-purple-400">
                        ₹{selectedSubForDrawer.price || selectedSubForDrawer.amount_paid || 899}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-xs pt-2 border-t border-slate-800/80">
                      <div>
                        <span className="text-slate-500 block">Start Date</span>
                        <span className="font-mono text-slate-200">
                          {selectedSubForDrawer.start_date
                            ? new Date(selectedSubForDrawer.start_date).toLocaleDateString()
                            : 'N/A'}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500 block">Valid Until</span>
                        <span className="font-mono text-slate-200">
                          {selectedSubForDrawer.end_date
                            ? new Date(selectedSubForDrawer.end_date).toLocaleDateString()
                            : 'N/A'}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500 block">Meals Remaining</span>
                        <span className="font-black text-sm text-purple-400">
                          {selectedSubForDrawer.meals_remaining ?? 0} /{' '}
                          {selectedSubForDrawer.meals_total ?? 7}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500 block">Auto-Renew</span>
                        <span className="font-semibold text-emerald-400">
                          {selectedSubForDrawer.auto_renew ? 'Enabled' : 'Disabled'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Quick Action Buttons */}
                  <div className="grid grid-cols-2 gap-2.5">
                    <button
                      onClick={() => handleTogglePauseStatus(selectedSubForDrawer)}
                      className={`p-3 rounded-xl font-bold text-xs border transition flex items-center justify-center gap-2 ${
                        selectedSubForDrawer.is_paused || selectedSubForDrawer.status === 'PAUSED'
                          ? 'bg-emerald-600/20 text-emerald-400 border-emerald-500/40 hover:bg-emerald-600/30'
                          : 'bg-amber-600/20 text-amber-400 border-amber-500/40 hover:bg-amber-600/30'
                      }`}
                    >
                      {selectedSubForDrawer.is_paused || selectedSubForDrawer.status === 'PAUSED' ? (
                        <>
                          <PlayCircle className="h-4 w-4" /> Resume Plan
                        </>
                      ) : (
                        <>
                          <PauseCircle className="h-4 w-4" /> Pause Plan
                        </>
                      )}
                    </button>

                    <button
                      onClick={() => {
                        setSelectedSubForMeals(selectedSubForDrawer);
                        setShowBonusModal(true);
                      }}
                      className="p-3 rounded-xl font-bold text-xs bg-purple-600/20 text-purple-300 border border-purple-500/40 hover:bg-purple-600/30 transition flex items-center justify-center gap-2"
                    >
                      <PlusCircle className="h-4 w-4" /> + Bonus Meals
                    </button>
                  </div>

                  {/* Manual Skip Date Input */}
                  <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-2">
                    <label className="text-xs font-semibold text-slate-300 block">
                      Toggle Specific Skip / Pause Date
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="date"
                        value={newSkipDate}
                        onChange={e => setNewSkipDate(e.target.value)}
                        className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500 flex-1 font-mono"
                      />
                      <button
                        onClick={() => handleAddSkipDate(selectedSubForDrawer, newSkipDate)}
                        className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold transition"
                      >
                        Toggle Date
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Tab 2: Interactive Delivery Calendar (Kitchen Guide) */}
              {drawerTab === 'calendar' && (
                <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-white text-xs uppercase tracking-wider">
                      This Month's Delivery Calendar ({selectedMonth})
                    </h4>
                    <span className="text-[10px] text-slate-400">Click any day to toggle skip</span>
                  </div>

                  {/* Legend */}
                  <div className="flex items-center justify-between text-[11px] border-b border-slate-800 pb-2">
                    <div className="flex items-center gap-1.5 text-emerald-400">
                      <div className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                      <span>Scheduled Delivery</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-amber-400">
                      <div className="h-2.5 w-2.5 rounded-full bg-amber-500" />
                      <span>Paused / Skipped</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-slate-500">
                      <div className="h-2.5 w-2.5 rounded-full bg-slate-700" />
                      <span>Not Applicable</span>
                    </div>
                  </div>

                  {/* Calendar Grid */}
                  <div className="grid grid-cols-7 gap-1.5 text-center text-xs">
                    {['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map(h => (
                      <div key={h} className="text-slate-500 font-bold text-[10px] pb-1">
                        {h}
                      </div>
                    ))}
                    {monthDays.map((item, i) => {
                      if (!item.day) {
                        return <div key={`empty-${i}`} className="h-8" />;
                      }

                      const isPausedDate = (selectedSubForDrawer.paused_dates || []).includes(
                        item.dateStr
                      );
                      const isSubPaused =
                        selectedSubForDrawer.is_paused || selectedSubForDrawer.status === 'PAUSED';

                      const isWithinRange =
                        (!selectedSubForDrawer.start_date ||
                          item.dateStr >= selectedSubForDrawer.start_date.split('T')[0]) &&
                        (!selectedSubForDrawer.end_date ||
                          item.dateStr <= selectedSubForDrawer.end_date.split('T')[0]) &&
                        getSubStatus(selectedSubForDrawer) !== 'expired';

                      return (
                        <button
                          key={item.dateStr}
                          onClick={() => handleAddSkipDate(selectedSubForDrawer, item.dateStr)}
                          disabled={!isWithinRange}
                          title={`${item.dateStr}: ${
                            !isWithinRange
                              ? 'Outside plan range'
                              : isPausedDate || isSubPaused
                              ? 'Delivery Paused / Skipped'
                              : 'Scheduled for Delivery'
                          }`}
                          className={`h-8 w-8 mx-auto rounded-full flex items-center justify-center text-xs font-bold transition ${
                            !isWithinRange
                              ? 'text-slate-600 bg-slate-900/40 cursor-not-allowed'
                              : isPausedDate || isSubPaused
                              ? 'bg-amber-500 text-slate-950 font-black shadow-md ring-2 ring-amber-400/50'
                              : 'bg-emerald-600 text-white font-black shadow-md ring-2 ring-emerald-500/50'
                          }`}
                        >
                          {item.day}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Tab 3: Day-Wise Pre-Selected Menu */}
              {drawerTab === 'menu' && (
                <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <h4 className="font-bold text-white text-xs uppercase tracking-wider">
                      Customer Pre-Selected Meals
                    </h4>
                    <span className="text-[10px] text-purple-400 font-mono">Day-wise Schedule</span>
                  </div>

                  {selectedSubForDrawer.daily_menu &&
                  Object.keys(selectedSubForDrawer.daily_menu).length > 0 ? (
                    <div className="space-y-2">
                      {Object.entries(selectedSubForDrawer.daily_menu).map(([dayKey, meal]: any) => (
                        <div
                          key={dayKey}
                          className="flex items-center justify-between p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs"
                        >
                          <div>
                            <span className="font-mono text-purple-400 font-bold block">
                              {dayKey}
                            </span>
                            <span className="font-semibold text-slate-200">
                              {meal.name || 'Selected Dish'}
                            </span>
                          </div>
                          <span className="font-mono text-slate-400">
                            {meal.price ? `₹${meal.price}` : 'Covered'}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-6 text-center text-slate-500 text-xs">
                      Customer is on the standard daily chef special menu (no custom dish overrides).
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Drawer Bottom Actions */}
            <div className="pt-4 border-t border-slate-800 space-y-2">
              {getSubStatus(selectedSubForDrawer) !== 'expired' && getSubStatus(selectedSubForDrawer) !== 'cancelled' ? (
                <button
                  onClick={() => {
                    setSubToCancel(selectedSubForDrawer);
                    setCancelReason('Customer requested cancellation');
                    setCustomCancelReason('');
                    setShowCancelSubModal(true);
                  }}
                  className="w-full py-2.5 bg-rose-600/10 hover:bg-rose-600/20 text-rose-400 border border-rose-500/30 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2"
                >
                  <XCircle className="h-4 w-4" />
                  <span>Cancel Subscription Plan</span>
                </button>
              ) : (
                <button
                  onClick={() => {
                    setSubToDelete(selectedSubForDrawer);
                    setShowDeleteSubModal(true);
                  }}
                  className="w-full py-2.5 bg-rose-600/10 hover:bg-rose-600/20 text-rose-400 border border-rose-500/30 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2"
                >
                  <Trash2 className="h-4 w-4" />
                  <span>Delete Subscription Record</span>
                </button>
              )}

              <button
                onClick={() => setSelectedSubForDrawer(null)}
                className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold transition"
              >
                Close Drawer
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Bonus Meals Modal */}
      {showBonusModal && selectedSubForMeals ? (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <form
            onSubmit={handleAddCustomBonusMeals}
            className="bg-slate-900 border border-slate-800 max-w-md w-full rounded-2xl p-6 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <PlusCircle className="h-5 w-5 text-purple-400" />
                <span>Add Bonus Meals for {selectedSubForMeals.user_name || 'Subscriber'}</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowBonusModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-xs flex justify-between">
              <span className="text-slate-400">Current Meals Remaining:</span>
              <span className="font-bold text-purple-400 text-sm">
                {selectedSubForMeals.meals_remaining ?? 0}
              </span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">
                Enter Custom Bonus Meal Quantity
              </label>
              <input
                type="number"
                required
                min="1"
                max="100"
                value={bonusMealCount}
                onChange={e => setBonusMealCount(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm font-black text-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="e.g. 1, 2, 3, 5, 10..."
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowBonusModal(false)}
                className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs px-4 py-2.5 rounded-xl border border-slate-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs px-5 py-2.5 rounded-xl shadow-lg"
              >
                Add {bonusMealCount} Bonus Meals
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {/* Cancel Subscription Modal */}
      {showCancelSubModal && subToCancel ? (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 max-w-md w-full rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-extrabold text-white flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-rose-400" />
                <span>Cancel Plan: {subToCancel.plan_type}</span>
              </h3>
              <button
                type="button"
                disabled={isProcessingCancel}
                onClick={() => setShowCancelSubModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Subscriber & Plan Summary */}
            <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 text-xs space-y-2">
              <div className="flex justify-between text-slate-300">
                <span>Customer:</span>
                <span className="font-bold text-white">{subToCancel.user_name || subToCancel.user_phone || 'Customer'}</span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>Phone:</span>
                <span className="font-mono text-slate-200">{subToCancel.user_phone || 'N/A'}</span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>Meals Remaining:</span>
                <span className="font-mono font-bold text-purple-400">
                  {subToCancel.meals_remaining ?? 0} / {subToCancel.meals_total ?? '—'} meals
                </span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>Estimated Value of Leftover Meals:</span>
                <span className="font-mono font-bold text-amber-400">
                  ₹{Math.round(((subToCancel.meals_remaining ?? 0) / (subToCancel.meals_total || 1)) * (subToCancel.price || 0))}
                </span>
              </div>
            </div>

            {/* Manual Refund Policy Banner */}
            <div className="bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs p-3 rounded-xl space-y-1">
              <p className="font-bold flex items-center gap-1.5">
                <span>ℹ️</span>
                <span>Manual Refund Management</span>
              </p>
              <p className="text-[11px] text-amber-400/90 leading-relaxed">
                Cancelling this subscription will <strong>not</strong> automatically credit funds to the customer wallet. You can manually adjust the user&apos;s wallet balance in the Users tab or process a direct UPI refund as requested.
              </p>
            </div>

            {/* Reason Selection */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-300 block">
                Select Cancellation Reason:
              </label>
              <div className="space-y-1.5">
                {[
                  'Customer requested cancellation',
                  'Customer relocated / address outside delivery area',
                  'Health or dietary preferences',
                  'Other',
                ].map(r => (
                  <label
                    key={r}
                    className={`flex items-center gap-2.5 p-2 rounded-xl border text-xs cursor-pointer transition-all ${
                      cancelReason === r
                        ? 'bg-purple-500/10 border-purple-500/40 text-purple-300 font-bold'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <input
                      type="radio"
                      name="cancelSubReason"
                      value={r}
                      checked={cancelReason === r}
                      onChange={e => setCancelReason(e.target.value)}
                      className="accent-purple-500"
                    />
                    <span>{r}</span>
                  </label>
                ))}
              </div>

              {cancelReason === 'Other' && (
                <textarea
                  value={customCancelReason}
                  onChange={e => setCustomCancelReason(e.target.value)}
                  placeholder="Enter custom cancellation reason..."
                  rows={2}
                  className="w-full mt-2 bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-purple-500 resize-none"
                />
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                disabled={isProcessingCancel}
                onClick={() => setShowCancelSubModal(false)}
                className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold py-2.5 rounded-xl text-xs transition-all disabled:opacity-50"
              >
                Keep Plan
              </button>
              <button
                type="button"
                disabled={isProcessingCancel}
                onClick={handleCancelSubscription}
                className="flex-1 bg-rose-600 hover:bg-rose-500 text-white font-extrabold py-2.5 rounded-xl text-xs transition-all shadow-lg shadow-rose-600/20 flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                {isProcessingCancel ? (
                  <span>Processing...</span>
                ) : (
                  <>
                    <XCircle className="h-4 w-4" />
                    <span>Confirm Cancel</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Delete Subscription Modal */}
      {showDeleteSubModal && subToDelete ? (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 max-w-md w-full rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-extrabold text-white flex items-center gap-2">
                <Trash2 className="h-5 w-5 text-rose-400" />
                <span>Permanently Delete Record</span>
              </h3>
              <button
                type="button"
                disabled={isProcessingDelete}
                onClick={() => setShowDeleteSubModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 text-xs space-y-1.5">
              <p className="text-slate-200">
                Subscriber: <span className="font-bold text-white">{subToDelete.user_name || subToDelete.user_phone || 'Customer'}</span>
              </p>
              <p className="text-slate-200">
                Plan: <span className="font-bold text-purple-400">{subToDelete.plan_type}</span>
              </p>
              <p className="text-slate-400 text-[11px]">
                Status: <span className="font-mono uppercase text-rose-400 font-bold">{getSubStatus(subToDelete)}</span>
              </p>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              This will permanently delete this expired/cancelled subscription record from Cloud Firestore to keep your workflow clean. This action cannot be undone.
            </p>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                disabled={isProcessingDelete}
                onClick={() => setShowDeleteSubModal(false)}
                className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold py-2.5 rounded-xl text-xs transition-all disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isProcessingDelete}
                onClick={handleDeleteSubscription}
                className="flex-1 bg-rose-600 hover:bg-rose-500 text-white font-extrabold py-2.5 rounded-xl text-xs transition-all shadow-lg shadow-rose-600/20 flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                {isProcessingDelete ? (
                  <span>Deleting...</span>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4" />
                    <span>Delete Record</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Bulk Cleanup Modal */}
      {showBulkCleanupModal ? (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 max-w-md w-full rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-extrabold text-white flex items-center gap-2">
                <Trash2 className="h-5 w-5 text-rose-400" />
                <span>Clean Up All Expired Subscriptions</span>
              </h3>
              <button
                type="button"
                disabled={isProcessingBulkCleanup}
                onClick={() => setShowBulkCleanupModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Are you sure you want to permanently remove all expired and cancelled subscription records from Cloud Firestore?
            </p>
            <p className="text-[11px] text-amber-400/90 bg-amber-500/10 border border-amber-500/20 p-2.5 rounded-xl">
              ⚠️ Active and paused meal subscriptions will <strong>not</strong> be affected.
            </p>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                disabled={isProcessingBulkCleanup}
                onClick={() => setShowBulkCleanupModal(false)}
                className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold py-2.5 rounded-xl text-xs transition-all disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isProcessingBulkCleanup}
                onClick={handleBulkCleanupExpired}
                className="flex-1 bg-rose-600 hover:bg-rose-500 text-white font-extrabold py-2.5 rounded-xl text-xs transition-all shadow-lg shadow-rose-600/20 flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                {isProcessingBulkCleanup ? (
                  <span>Cleaning up...</span>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4" />
                    <span>Confirm Cleanup</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

