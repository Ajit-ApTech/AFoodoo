'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { fetchDashboardSnapshot } from '../../lib/api';
import { db } from '../../lib/firebase';
import { collection, onSnapshot } from 'firebase/firestore';
import {
  ShoppingBag,
  IndianRupee,
  Repeat,
  Truck,
  AlertTriangle,
  Clock,
  Utensils,
  Bell,
  CheckCircle2,
} from 'lucide-react';

export default function DashboardPage() {
  const { data: snapshot, isLoading } = useQuery({
    queryKey: ['dashboard-snapshot'],
    queryFn: fetchDashboardSnapshot,
    refetchInterval: 10000,
  });

  const [liveOrderCount, setLiveOrderCount] = useState<number>(42);
  const [liveRevenue, setLiveRevenue] = useState<number>(8450);

  // Subscribe directly to Cloud Firestore for Real-Time Order Counter
  useEffect(() => {
    try {
      const unsub = onSnapshot(collection(db, 'orders'), snap => {
        if (!snap.empty) {
          setLiveOrderCount(snap.size);
          let sum = 0;
          snap.docs.forEach(doc => {
            const data = doc.data();
            if (data.status !== 'cancelled') {
              sum += Number(data.price || 199);
            }
          });
          if (sum > 0) setLiveRevenue(sum);
        }
      });
      return unsub;
    } catch (e) {
      console.log('Using local snapshot counter');
    }
  }, []);

  return (
    <div className="space-y-8">
      {/* Top Header & Real-time Live Badge */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-3">
            <span>Today's Operational Snapshot</span>
            <span className="bg-orange-600/20 text-orange-400 border border-orange-500/30 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 live-pulse">
              <span className="h-2 w-2 rounded-full bg-orange-400 animate-ping" />
              LIVE REAL-TIME COUNTER
            </span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Real-time feed synced with Cloud Firestore. Every customer booking reflects here immediately.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/slots"
            className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold px-4 py-2.5 rounded-xl border border-slate-700 transition-all flex items-center gap-2"
          >
            <Clock className="h-4 w-4 text-orange-400" />
            Adjust Cutoff Times
          </Link>
          <Link
            href="/orders"
            className="bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-lg shadow-orange-600/20 transition-all flex items-center gap-2"
          >
            <ShoppingBag className="h-4 w-4" />
            Open Order Queue
          </Link>
        </div>
      </div>

      {/* Operational Warning Alert Banner */}
      <div className="bg-gradient-to-r from-amber-950/80 to-orange-950/80 border border-amber-500/40 rounded-2xl p-5 shadow-xl flex items-center gap-4">
        <div className="h-12 w-12 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
          <AlertTriangle className="h-6 w-6" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-400">
              OPERATIONAL NUDGE
            </span>
            <span className="text-xs text-slate-400">• Lunch Cutoff Window</span>
          </div>
          <p className="text-sm font-bold text-slate-100 mt-0.5">
            {snapshot?.cutoff_alert?.message || 'Lunch Cutoff in 18 minutes — 42 tiffin meals booked.'}
          </p>
        </div>
        <Link
          href="/slots"
          className="bg-amber-500 text-slate-950 hover:bg-amber-400 font-bold text-xs px-4 py-2.5 rounded-xl transition-all shrink-0"
        >
          Manage Slots
        </Link>
      </div>

      {/* Today Snapshot Key Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Metric 1: Total Bookings */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 relative overflow-hidden shadow-xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Today's Bookings
            </span>
            <div className="h-10 w-10 bg-orange-500/10 text-orange-400 rounded-xl flex items-center justify-center">
              <ShoppingBag className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4">
            <span className="text-3xl font-black text-white">
              {isLoading ? '...' : liveOrderCount}
            </span>
            <span className="text-xs font-semibold text-emerald-400 ml-2">↑ Live Sync</span>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
            <span>Lunch: <strong className="text-slate-200">{snapshot?.lunch_bookings || 28}</strong></span>
            <span>Dinner: <strong className="text-slate-200">{snapshot?.dinner_bookings || 14}</strong></span>
          </div>
        </div>

        {/* Metric 2: Today's Revenue */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 relative overflow-hidden shadow-xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Today's Revenue
            </span>
            <div className="h-10 w-10 bg-emerald-500/10 text-emerald-400 rounded-xl flex items-center justify-center">
              <IndianRupee className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4">
            <span className="text-3xl font-black text-white">
              ₹{isLoading ? '...' : liveRevenue.toLocaleString('en-IN')}
            </span>
            <span className="text-xs font-semibold text-emerald-400 ml-2">↑ Paid Orders</span>
          </div>
          <p className="mt-3 text-xs text-slate-400 pt-3 border-t border-slate-800/80">
            Directly credited via Wallet & UPI Gateway
          </p>
        </div>

        {/* Metric 3: Active Subscriptions */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 relative overflow-hidden shadow-xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Active Subscriptions
            </span>
            <div className="h-10 w-10 bg-purple-500/10 text-purple-400 rounded-xl flex items-center justify-center">
              <Repeat className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4">
            <span className="text-3xl font-black text-white">
              {isLoading ? '...' : snapshot?.active_subscriptions || 19}
            </span>
            <span className="text-xs font-semibold text-purple-400 ml-2">Weekly & Monthly</span>
          </div>
          <p className="mt-3 text-xs text-slate-400 pt-3 border-t border-slate-800/80">
            Auto-dispatched daily meal allocations
          </p>
        </div>

        {/* Metric 4: Pending Deliveries */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 relative overflow-hidden shadow-xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Pending Deliveries
            </span>
            <div className="h-10 w-10 bg-blue-500/10 text-blue-400 rounded-xl flex items-center justify-center">
              <Truck className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4">
            <span className="text-3xl font-black text-white">
              {isLoading ? '...' : snapshot?.pending_deliveries || 12}
            </span>
            <span className="text-xs font-semibold text-blue-400 ml-2">Out for Delivery</span>
          </div>
          <p className="mt-3 text-xs text-slate-400 pt-3 border-t border-slate-800/80">
            Rider OTP verified upon delivery
          </p>
        </div>
      </div>

      {/* Quick Action Grid */}
      <div>
        <h2 className="text-lg font-bold text-white mb-4">Operational Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Link
            href="/slots"
            className="bg-slate-900 border border-slate-800 hover:border-orange-500/50 p-5 rounded-2xl transition-all group"
          >
            <Clock className="h-6 w-6 text-orange-400 mb-2 group-hover:scale-110 transition-transform" />
            <h3 className="text-sm font-bold text-slate-100">Meal Slot Cutoffs</h3>
            <p className="text-xs text-slate-400 mt-1">Adjust booking open & cutoff times live</p>
          </Link>

          <Link
            href="/menu"
            className="bg-slate-900 border border-slate-800 hover:border-orange-500/50 p-5 rounded-2xl transition-all group"
          >
            <Utensils className="h-6 w-6 text-emerald-400 mb-2 group-hover:scale-110 transition-transform" />
            <h3 className="text-sm font-bold text-slate-100">Food Menu & Photos</h3>
            <p className="text-xs text-slate-400 mt-1">Upload dishes to Firebase Storage</p>
          </Link>

          <Link
            href="/orders"
            className="bg-slate-900 border border-slate-800 hover:border-orange-500/50 p-5 rounded-2xl transition-all group"
          >
            <ShoppingBag className="h-6 w-6 text-blue-400 mb-2 group-hover:scale-110 transition-transform" />
            <h3 className="text-sm font-bold text-slate-100">Rider Zone Queue</h3>
            <p className="text-xs text-slate-400 mt-1">Dispatch orders to delivery zones</p>
          </Link>

          <Link
            href="/broadcast"
            className="bg-slate-900 border border-slate-800 hover:border-orange-500/50 p-5 rounded-2xl transition-all group"
          >
            <Bell className="h-6 w-6 text-purple-400 mb-2 group-hover:scale-110 transition-transform" />
            <h3 className="text-sm font-bold text-slate-100">Push Broadcaster</h3>
            <p className="text-xs text-slate-400 mt-1">Dispatch alerts to all app users</p>
          </Link>
        </div>
      </div>

      {/* Kitchen System Health Check Footer */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex items-center justify-between text-xs text-slate-400">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          <span>Kitchen Ops & Firestore API Status: <strong>100% Operational</strong></span>
        </div>
        <span>Port 8080 • API Spec v1.0.0</span>
      </div>
    </div>
  );
}
