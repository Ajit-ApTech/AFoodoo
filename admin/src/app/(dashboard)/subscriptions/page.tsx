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
} from 'lucide-react';

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
  const getSubStatus = (sub: SubscriptionDoc): 'active' | 'paused' | 'expired' => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    const isExplicitExpired =
      sub.status?.toLowerCase() === 'expired' || sub.status?.toLowerCase() === 'cancelled';
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
      else if (st === 'expired') expired++;

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
      if (activeTab === 'expired' && st !== 'expired') return false;

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

                      {/* Action Button */}
                      <td className="py-4 px-4 text-right" onClick={e => e.stopPropagation()}>
                        <button
                          onClick={() => setSelectedSubForDrawer(sub)}
                          className="px-3.5 py-1.5 rounded-xl bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/30 text-xs font-bold transition shadow-sm"
                        >
                          Manage
                        </button>
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

            {/* Drawer Bottom Close */}
            <div className="pt-4 border-t border-slate-800 flex justify-end">
              <button
                onClick={() => setSelectedSubForDrawer(null)}
                className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold transition"
              >
                Done
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
    </div>
  );
}

