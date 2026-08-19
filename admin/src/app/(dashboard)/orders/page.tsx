'use client';

import React, { useEffect, useState } from 'react';
import { db } from '../../../lib/firebase';
import { collection, onSnapshot, doc, updateDoc, addDoc, getDoc } from 'firebase/firestore';
import { Order, OrderStatus } from '../../../types';
import { ShoppingBag, Truck, CheckCircle, Clock, MapPin, Key, RotateCcw, History, AlertCircle } from 'lucide-react';
import { sendExpoPushNotification } from '../../../lib/pushService';

export default function OrderQueuePage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'active' | 'history'>('active');
  const [selectedSlotFilter, setSelectedSlotFilter] = useState<'all' | 'lunch' | 'dinner'>('all');
  const [selectedZoneFilter, setSelectedZoneFilter] = useState<'all' | 'zone_1' | 'zone_2' | 'zone_3'>('all');

  // Real-Time Cloud Firestore listener for orders collection
  useEffect(() => {
    try {
      const unsub = onSnapshot(
        collection(db, 'orders'),
        snap => {
          if (!snap.empty) {
            const list = snap.docs
              .map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as Order))
              .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
            setOrders(list);
          } else {
            setOrders([]);
          }
          setLoading(false);
        },
        err => {
          console.log('orders listener status:', err.message);
          setLoading(false);
        }
      );
      return unsub;
    } catch (e) {
      setLoading(false);
    }
  }, []);

  const handleAdvanceStatus = async (orderId: string, nextStatus: OrderStatus) => {
    try {
      const targetOrder = orders.find(o => o.id === orderId);

      await updateDoc(doc(db, 'orders', orderId), {
        status: nextStatus,
      });

      await addDoc(collection(db, 'audit_logs'), {
        action_type: 'ORDER_STATUS_UPDATED',
        admin_email: 'admin@afoodoo.com',
        details: `Advanced order #${orderId.slice(-6)} status to "${nextStatus}"`,
        timestamp: new Date().toISOString(),
      });

      // Fetch user's push token and dispatch system push notification
      if (targetOrder) {
        let fcmToken: string | null = null;
        const userPhoneDigits = (targetOrder.user_phone || '').replace(/\D/g, '');
        const userDocId = targetOrder.user_id || `usr_${userPhoneDigits}`;

        try {
          const userSnap = await getDoc(doc(db, 'users', userDocId));
          if (userSnap.exists()) {
            fcmToken = userSnap.data()?.fcm_token || null;
          }
        } catch (uErr) {}

        if (fcmToken) {
          let pushTitle = '🍲 AFoodoo Order Update';
          let pushBody = `Your order #${orderId.slice(-6)} status is now ${nextStatus}.`;

          if (nextStatus === 'preparing') {
            pushTitle = '👨‍🍳 Kitchen Preparing';
            pushBody = `Your meal "${targetOrder.menu_title || 'Tiffin'}" is now being freshly prepared in our kitchen!`;
          } else if (nextStatus === 'out_for_delivery') {
            pushTitle = '🚚 Out for Delivery';
            pushBody = `Your tiffin is on the way! Rider OTP Code: ${targetOrder.otp_code || ''}`;
          } else if (nextStatus === 'delivered') {
            pushTitle = '😋 Meal Delivered';
            pushBody = `Your tiffin meal "${targetOrder.menu_title || ''}" has been delivered! Enjoy your hot meal.`;
          }

          sendExpoPushNotification([fcmToken], pushTitle, pushBody, {
            orderId: orderId,
            status: nextStatus,
          });
        }
      }
    } catch (e: any) {
      alert(`Error updating order status: ${e.message}`);
    }
  };

  const handleToggleTiffinReturn = async (orderId: string, currentReturned: boolean) => {
    const newStatus = !currentReturned;
    try {
      await updateDoc(doc(db, 'orders', orderId), {
        tiffin_returned: newStatus,
      });

      await addDoc(collection(db, 'audit_logs'), {
        action_type: 'TIFFIN_RETURN_TOGGLED',
        admin_email: 'admin@afoodoo.com',
        details: `Flagged tiffin return for order #${orderId.slice(-6)} as ${newStatus ? 'Returned' : 'Pending'}`,
        timestamp: new Date().toISOString(),
      });
    } catch (e: any) {
      alert(`Error toggling tiffin return: ${e.message}`);
    }
  };

  const filteredOrders = orders.filter(order => {
    const isCompleted = order.status === 'delivered' || order.status === 'cancelled';

    if (activeTab === 'active' && isCompleted) return false;
    if (activeTab === 'history' && !isCompleted) return false;

    if (selectedSlotFilter === 'lunch' && !order.meal_slot_id?.includes('lunch')) return false;
    if (selectedSlotFilter === 'dinner' && !order.meal_slot_id?.includes('dinner')) return false;
    if (selectedZoneFilter !== 'all' && order.delivery_zone_id !== selectedZoneFilter) return false;

    return true;
  });

  const getStatusBadge = (status: OrderStatus) => {
    const badges: Record<string, { label: string; color: string }> = {
      booked: { label: 'Booked', color: 'bg-blue-500/10 text-blue-400 border-blue-500/30' },
      preparing: { label: 'Kitchen Preparing', color: 'bg-amber-500/10 text-amber-400 border-amber-500/30' },
      out_for_delivery: { label: 'Out for Delivery', color: 'bg-purple-500/10 text-purple-400 border-purple-500/30' },
      delivered: { label: 'Delivered', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' },
      cancelled: { label: 'Cancelled', color: 'bg-rose-500/10 text-rose-400 border-rose-500/30' },
    };
    const current = badges[status] || badges.booked;
    return (
      <span className={`px-2.5 py-1 rounded-md text-[10px] font-extrabold uppercase border ${current.color}`}>
        {current.label}
      </span>
    );
  };

  return (
    <div className="space-y-8">
      {/* Header & Filter Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-3">
            <ShoppingBag className="h-7 w-7 text-orange-400" />
            <span>Live Order Queue & Historic Dispatch</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Real-time delivery fulfillment pipeline, rider OTP verification, and historic order logs.
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={selectedSlotFilter}
            onChange={e => setSelectedSlotFilter(e.target.value as any)}
            className="bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-xs font-semibold text-slate-200"
          >
            <option value="all">All Meal Slots</option>
            <option value="lunch">Lunch Tiffins Only</option>
            <option value="dinner">Dinner Tiffins Only</option>
          </select>

          <select
            value={selectedZoneFilter}
            onChange={e => setSelectedZoneFilter(e.target.value as any)}
            className="bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-xs font-semibold text-slate-200"
          >
            <option value="all">All Delivery Zones</option>
            <option value="zone_1">Andheri West</option>
            <option value="zone_2">BKC Tech Park</option>
            <option value="zone_3">Lower Parel</option>
          </select>
        </div>
      </div>

      {/* Tabs: Active Queue vs Order History */}
      <div className="flex items-center gap-4 border-b border-slate-800 pb-1">
        <button
          onClick={() => setActiveTab('active')}
          className={`pb-3 font-bold text-sm transition-all border-b-2 flex items-center gap-2 ${
            activeTab === 'active'
              ? 'text-orange-400 border-orange-500'
              : 'text-slate-400 border-transparent hover:text-slate-200'
          }`}
        >
          <ShoppingBag className="h-4 w-4" />
          <span>Active Orders Queue ({orders.filter(o => o.status !== 'delivered' && o.status !== 'cancelled').length})</span>
        </button>

        <button
          onClick={() => setActiveTab('history')}
          className={`pb-3 font-bold text-sm transition-all border-b-2 flex items-center gap-2 ${
            activeTab === 'history'
              ? 'text-orange-400 border-orange-500'
              : 'text-slate-400 border-transparent hover:text-slate-200'
          }`}
        >
          <History className="h-4 w-4" />
          <span>Past Order History ({orders.filter(o => o.status === 'delivered' || o.status === 'cancelled').length})</span>
        </button>
      </div>

      {/* Orders Grid */}
      {loading ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center text-slate-400 text-xs">
          Loading live orders from Cloud Firestore...
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center text-slate-500 text-xs">
          No {activeTab === 'active' ? 'active' : 'past'} orders match the current filters. Customer bookings will display here in real-time.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredOrders.map(order => (
            <div
              key={order.id}
              className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-xl flex flex-col justify-between"
            >
              <div className="space-y-3">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div>
                    <h3 className="font-extrabold text-slate-100 text-base">#{order.id.slice(-8)}</h3>
                    <p className="text-xs text-orange-400 font-bold">{order.menu_title || 'Tiffin Meal'}</p>
                  </div>
                  {getStatusBadge(order.status)}
                </div>

                {/* Customer Details */}
                <div className="space-y-1 text-xs">
                  <div className="text-slate-200 font-bold">{order.user_name || 'Customer'}</div>
                  <div className="text-slate-400 font-mono">{order.user_phone || 'N/A'}</div>
                </div>

                {/* Delivery Address Box */}
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-xs space-y-1">
                  <div className="flex items-center gap-1.5 text-slate-400 font-semibold">
                    <MapPin className="h-3.5 w-3.5 text-orange-400 shrink-0" />
                    <span>{order.delivery_address?.label || 'Address'}</span>
                  </div>
                  <p className="text-slate-200 text-[11px] leading-snug">
                    {order.delivery_address?.line1 || 'Customer Address'}
                  </p>
                </div>

                {/* Slot & OTP Box */}
                <div className="flex items-center justify-between bg-slate-950 p-3 rounded-xl border border-slate-800 text-xs">
                  <div>
                    <span className="text-[10px] text-slate-500 font-bold uppercase block">Slot</span>
                    <span className="font-semibold text-slate-200">{order.slot_name || 'Tiffin Slot'}</span>
                  </div>
                  {order.otp_code ? (
                    <div className="text-right">
                      <span className="text-[10px] text-slate-500 font-bold uppercase block">Rider OTP</span>
                      <span className="font-black text-amber-400 font-mono text-sm">{order.otp_code}</span>
                    </div>
                  ) : null}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 border-t border-slate-800 space-y-2">
                {order.status === 'booked' && (
                  <button
                    onClick={() => handleAdvanceStatus(order.id, 'preparing')}
                    className="w-full bg-amber-600 hover:bg-amber-500 text-white font-bold py-2 rounded-xl text-xs shadow-md transition-all flex items-center justify-center gap-2"
                  >
                    <Clock className="h-3.5 w-3.5" /> Start Kitchen Preparing
                  </button>
                )}

                {order.status === 'preparing' && (
                  <button
                    onClick={() => handleAdvanceStatus(order.id, 'out_for_delivery')}
                    className="w-full bg-purple-600 hover:bg-purple-500 text-white font-bold py-2 rounded-xl text-xs shadow-md transition-all flex items-center justify-center gap-2"
                  >
                    <Truck className="h-3.5 w-3.5" /> Dispatch Out for Delivery
                  </button>
                )}

                {order.status === 'out_for_delivery' && (
                  <button
                    onClick={() => handleAdvanceStatus(order.id, 'delivered')}
                    className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2 rounded-xl text-xs shadow-md transition-all flex items-center justify-center gap-2"
                  >
                    <CheckCircle className="h-3.5 w-3.5" /> Confirm Delivery
                  </button>
                )}

                <div className="flex items-center justify-between pt-1">
                  <button
                    onClick={() => handleToggleTiffinReturn(order.id, !!order.tiffin_returned)}
                    className={`text-[11px] font-semibold px-2.5 py-1 rounded-lg border transition-all flex items-center gap-1 ${
                      order.tiffin_returned
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                        : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200'
                    }`}
                  >
                    <RotateCcw className="h-3 w-3" />
                    <span>{order.tiffin_returned ? 'Tiffin Returned ✓' : 'Mark Tiffin Returned'}</span>
                  </button>

                  <span className="text-[10px] text-slate-500 font-mono">
                    {order.created_at ? new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
