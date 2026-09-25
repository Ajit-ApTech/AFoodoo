'use client';

import React, { useState, useEffect } from 'react';
import { db } from '../../../lib/firebase';
import {
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  doc,
  query,
  onSnapshot,
} from 'firebase/firestore';
import {
  Bell,
  Send,
  CheckCircle2,
  Smartphone,
  Trash2,
  Clock,
  RefreshCw,
  AlertTriangle,
  Radio,
  Package,
} from 'lucide-react';
import { sendExpoPushNotification } from '../../../lib/pushService';

interface BroadcastItem {
  id: string;
  title: string;
  body: string;
  segment?: string;
  timestamp?: string;
}

interface CustomerNotificationItem {
  id: string;
  title: string;
  body: string;
  user_phone?: string;
  user_id?: string;
  order_id?: string;
  status?: string;
  timestamp?: string;
}

function isSentToday(isoString?: string): boolean {
  if (!isoString) return false;
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return false;
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

function formatDateTime(isoString?: string): string {
  if (!isoString) return 'Just now';
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return isoString;
  return d.toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function PushBroadcasterPage() {
  const [title, setTitle] = useState('🍱 Special Dinner Menu Tonight!');
  const [body, setBody] = useState('Enjoy 10% off Paneer Butter Masala tiffin meal! Order before 7 PM cutoff.');
  const [segment, setSegment] = useState('all_users');
  const [loading, setLoading] = useState(false);
  const [sentSuccess, setSentSuccess] = useState(false);

  // Notifications management state
  const [broadcasts, setBroadcasts] = useState<BroadcastItem[]>([]);
  const [customerNotifs, setCustomerNotifs] = useState<CustomerNotificationItem[]>([]);
  const [activeTab, setActiveTab] = useState<'broadcasts' | 'orders'>('broadcasts');
  const [actionLoading, setActionLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Realtime subscription to broadcast_notifications
  useEffect(() => {
    try {
      const q = collection(db, 'broadcast_notifications');
      const unsub = onSnapshot(q, snap => {
        const list: BroadcastItem[] = snap.docs
          .map(d => ({ id: d.id, ...d.data() } as BroadcastItem))
          .sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''));
        setBroadcasts(list);
      });
      return unsub;
    } catch (e) {
      console.error('Error listening to broadcast_notifications:', e);
    }
  }, []);

  // Realtime subscription to customer_notifications (order lifecycle updates)
  useEffect(() => {
    try {
      const q = collection(db, 'customer_notifications');
      const unsub = onSnapshot(q, snap => {
        const list: CustomerNotificationItem[] = snap.docs
          .map(d => ({ id: d.id, ...d.data() } as CustomerNotificationItem))
          .sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''));
        setCustomerNotifs(list);
      });
      return unsub;
    } catch (e) {
      console.error('Error listening to customer_notifications:', e);
    }
  }, []);

  const handleSendBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !body) return;
    setLoading(true);

    try {
      // 1. Write broadcast notification document to Cloud Firestore broadcast_notifications collection
      await addDoc(collection(db, 'broadcast_notifications'), {
        title,
        body,
        segment,
        timestamp: new Date().toISOString(),
      });

      // 2. Write audit log to audit_logs collection
      await addDoc(collection(db, 'audit_logs'), {
        action_type: 'PUSH_BROADCAST',
        admin_email: 'admin@afoodoo.com',
        details: `Dispatched broadcast push notification "${title}" to segment: ${segment}`,
        timestamp: new Date().toISOString(),
      });

      // 3. Gather all registered customer push tokens and dispatch system push notification
      try {
        const usersSnap = await getDocs(collection(db, 'users'));
        const tokens: string[] = [];
        usersSnap.docs.forEach(docSnap => {
          const data = docSnap.data();
          const token = data.expo_push_token || data.fcm_token;
          if (token) {
            tokens.push(token);
          }
        });

        if (tokens.length > 0) {
          await sendExpoPushNotification(tokens, title, body, { type: 'BROADCAST' });
        }
      } catch (pushErr) {
        console.log('Push broadcast payload error:', pushErr);
      }

      setSentSuccess(true);
      setTimeout(() => setSentSuccess(false), 5000);
    } catch (e: any) {
      alert(`Error broadcasting notification: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Delete a single broadcast notification
  const handleDeleteBroadcast = async (id: string, itemTitle: string) => {
    if (!confirm(`Delete broadcast "${itemTitle}"? It will instantly disappear from all customer devices.`)) {
      return;
    }
    setActionLoading(true);
    try {
      await deleteDoc(doc(db, 'broadcast_notifications', id));
      setStatusMessage(`Deleted broadcast "${itemTitle}" successfully.`);
      setTimeout(() => setStatusMessage(null), 4000);
    } catch (err: any) {
      alert(`Error deleting broadcast: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  // Clear ALL broadcast notifications from admin
  const handleClearAllBroadcasts = async () => {
    if (broadcasts.length === 0) return;
    if (
      !confirm(
        `Are you sure you want to clear ALL ${broadcasts.length} broadcast notifications? They will be removed immediately from all connected customer apps.`
      )
    ) {
      return;
    }
    setActionLoading(true);
    try {
      const deletePromises = broadcasts.map(b => deleteDoc(doc(db, 'broadcast_notifications', b.id)));
      await Promise.all(deletePromises);
      setStatusMessage(`Cleared all ${broadcasts.length} broadcast notifications.`);
      setTimeout(() => setStatusMessage(null), 4000);
    } catch (err: any) {
      alert(`Error clearing broadcasts: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  // Clear expired broadcasts older than today's 12:00 AM midnight
  const handleClearExpiredBroadcasts = async () => {
    const expired = broadcasts.filter(b => !isSentToday(b.timestamp));
    if (expired.length === 0) {
      alert('No expired broadcasts found. All existing broadcasts were sent today.');
      return;
    }
    if (
      !confirm(
        `Clear ${expired.length} expired broadcasts older than today (sent before 12:00 AM)?`
      )
    ) {
      return;
    }
    setActionLoading(true);
    try {
      const deletePromises = expired.map(b => deleteDoc(doc(db, 'broadcast_notifications', b.id)));
      await Promise.all(deletePromises);
      setStatusMessage(`Cleared ${expired.length} expired broadcasts successfully.`);
      setTimeout(() => setStatusMessage(null), 4000);
    } catch (err: any) {
      alert(`Error clearing expired broadcasts: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  // Delete a single customer order notification
  const handleDeleteCustomerNotif = async (id: string) => {
    setActionLoading(true);
    try {
      await deleteDoc(doc(db, 'customer_notifications', id));
      setStatusMessage('Order notification cleared successfully.');
      setTimeout(() => setStatusMessage(null), 3000);
    } catch (err: any) {
      alert(`Error deleting order notification: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  // Clear ALL customer order notifications
  const handleClearAllCustomerNotifs = async () => {
    if (customerNotifs.length === 0) return;
    if (!confirm(`Clear all ${customerNotifs.length} order notifications?`)) return;
    setActionLoading(true);
    try {
      const deletePromises = customerNotifs.map(n => deleteDoc(doc(db, 'customer_notifications', n.id)));
      await Promise.all(deletePromises);
      setStatusMessage(`Cleared all ${customerNotifs.length} order notifications.`);
      setTimeout(() => setStatusMessage(null), 4000);
    } catch (err: any) {
      alert(`Error clearing order notifications: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-3">
          <Bell className="h-7 w-7 text-purple-400" />
          <span>Push Notification Broadcaster & Manager</span>
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Dispatch promotional or cutoff push notifications to customer apps, or clear active announcements in real-time. (Note: Customer apps automatically auto-clear all notifications daily at 12:00 AM midnight).
        </p>
      </div>

      {statusMessage && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-xl p-4 text-xs font-bold flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5 shrink-0" />
          <span>{statusMessage}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Composer Form */}
        <form
          onSubmit={handleSendBroadcast}
          className="md:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-5"
        >
          <h3 className="text-lg font-bold text-white border-b border-slate-800 pb-3">
            Compose Broadcast Message
          </h3>

          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">
              Target Audience Segment
            </label>
            <select
              value={segment}
              onChange={e => setSegment(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-xs font-semibold text-slate-100"
            >
              <option value="all_users">All Mobile App Users (All Customers)</option>
              <option value="active_subscribers">Active Subscribers Only</option>
              <option value="inactive_users">Inactive / Lapsed Diners</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">
              Notification Header Title
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g. 15-min Cutoff Warning ⏰"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm font-bold text-slate-100"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">
              Message Payload Body
            </label>
            <textarea
              required
              rows={3}
              value={body}
              onChange={e => setBody(e.target.value)}
              placeholder="Enter message details..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-xs text-slate-100"
            />
          </div>

          {sentSuccess ? (
            <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-xl p-4 text-xs font-bold flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5" />
              <span>Broadcast dispatched live to Cloud Firestore & logged to Security Audit Trail!</span>
            </div>
          ) : null}

          <div className="pt-2">
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-purple-600 hover:bg-purple-500 text-white font-bold py-3.5 px-6 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 text-sm"
            >
              <Send className="h-4 w-4" />
              <span>{loading ? 'Broadcasting Push...' : 'Send Live Push Broadcast Now'}</span>
            </button>
          </div>
        </form>

        {/* Live Device Preview Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col justify-between">
          <div className="space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
              <Smartphone className="h-4 w-4 text-purple-400" />
              <span>Live Phone Banner Preview</span>
            </h3>

            {/* Notification Banner Stub */}
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-1 shadow-inner">
              <div className="flex items-center justify-between text-[10px] text-slate-400">
                <span className="font-bold flex items-center gap-1 text-orange-400">🍲 AFoodoo App</span>
                <span>now</span>
              </div>
              <p className="font-bold text-xs text-slate-100">{title || 'Notification Title'}</p>
              <p className="text-[11px] text-slate-300 leading-snug">{body || 'Notification body content...'}</p>
            </div>
          </div>

          <div className="text-[11px] text-slate-500 pt-4 border-t border-slate-800 space-y-1">
            <div className="flex items-center gap-1.5 text-slate-400 font-semibold">
              <Clock className="w-3.5 h-3.5 text-purple-400" />
              <span>Auto-Clear Rules:</span>
            </div>
            <p>
              Customers cannot manually clear notifications. All notifications automatically auto-clear from customer apps daily at 12:00 AM midnight.
            </p>
          </div>
        </div>
      </div>

      {/* Notifications Management & Clearance Section */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800">
              <button
                type="button"
                onClick={() => setActiveTab('broadcasts')}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  activeTab === 'broadcasts'
                    ? 'bg-purple-600 text-white shadow'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Radio className="w-3.5 h-3.5" />
                <span>Broadcasts ({broadcasts.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('orders')}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  activeTab === 'orders'
                    ? 'bg-purple-600 text-white shadow'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Package className="w-3.5 h-3.5" />
                <span>Order Alerts ({customerNotifs.length})</span>
              </button>
            </div>
          </div>

          {/* Action Buttons for Clearance */}
          <div className="flex items-center gap-2.5">
            {activeTab === 'broadcasts' && (
              <>
                <button
                  type="button"
                  disabled={actionLoading || broadcasts.length === 0}
                  onClick={handleClearExpiredBroadcasts}
                  className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold px-3 py-2 rounded-xl text-xs border border-slate-700 transition disabled:opacity-50"
                  title="Delete broadcasts sent prior to today's 12:00 AM"
                >
                  <Clock className="w-3.5 h-3.5 text-amber-400" />
                  <span>Clear Expired (&lt; 12 AM)</span>
                </button>
                <button
                  type="button"
                  disabled={actionLoading || broadcasts.length === 0}
                  onClick={handleClearAllBroadcasts}
                  className="flex items-center gap-1.5 bg-red-600/20 hover:bg-red-600/30 text-red-400 font-semibold px-3 py-2 rounded-xl text-xs border border-red-500/30 transition disabled:opacity-50"
                  title="Delete all broadcast announcements from Firestore"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Clear All Broadcasts</span>
                </button>
              </>
            )}

            {activeTab === 'orders' && (
              <button
                type="button"
                disabled={actionLoading || customerNotifs.length === 0}
                onClick={handleClearAllCustomerNotifs}
                className="flex items-center gap-1.5 bg-red-600/20 hover:bg-red-600/30 text-red-400 font-semibold px-3 py-2 rounded-xl text-xs border border-red-500/30 transition disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear All Order Alerts</span>
              </button>
            )}
          </div>
        </div>

        {/* Tab 1: Broadcasts List */}
        {activeTab === 'broadcasts' && (
          <div>
            {broadcasts.length === 0 ? (
              <div className="py-12 text-center text-slate-500 text-xs">
                No active broadcast notifications in Firestore. Send one above!
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950/60 text-slate-400 uppercase tracking-wider text-[10px] border-b border-slate-800">
                    <tr>
                      <th className="py-3 px-4">Title & Details</th>
                      <th className="py-3 px-4">Audience</th>
                      <th className="py-3 px-4">Date & Time</th>
                      <th className="py-3 px-4">12 AM Status</th>
                      <th className="py-3 px-4 text-right">Admin Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {broadcasts.map(item => {
                      const today = isSentToday(item.timestamp);
                      return (
                        <tr key={item.id} className="hover:bg-slate-800/40 transition">
                          <td className="py-3 px-4 max-w-md">
                            <p className="font-bold text-slate-100">{item.title}</p>
                            <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-2">{item.body}</p>
                          </td>
                          <td className="py-3 px-4">
                            <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-800 text-slate-300 border border-slate-700">
                              {item.segment || 'all_users'}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-slate-300 font-medium whitespace-nowrap">
                            {formatDateTime(item.timestamp)}
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap">
                            {today ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                Active Today
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-medium bg-slate-800 text-slate-400 border border-slate-700">
                                Auto-Cleared in App (&lt; 12 AM)
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right whitespace-nowrap">
                            <button
                              type="button"
                              disabled={actionLoading}
                              onClick={() => handleDeleteBroadcast(item.id, item.title)}
                              className="inline-flex items-center gap-1 bg-red-600/10 hover:bg-red-600/20 text-red-400 font-semibold px-2.5 py-1.5 rounded-lg text-xs border border-red-500/20 transition disabled:opacity-50"
                              title="Delete notification permanently"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Clear</span>
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
        )}

        {/* Tab 2: Customer Order Alerts List */}
        {activeTab === 'orders' && (
          <div>
            {customerNotifs.length === 0 ? (
              <div className="py-12 text-center text-slate-500 text-xs">
                No customer order notifications recorded in Firestore.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950/60 text-slate-400 uppercase tracking-wider text-[10px] border-b border-slate-800">
                    <tr>
                      <th className="py-3 px-4">Title & Message</th>
                      <th className="py-3 px-4">Customer</th>
                      <th className="py-3 px-4">Date & Time</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-right">Admin Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {customerNotifs.map(item => {
                      const today = isSentToday(item.timestamp);
                      return (
                        <tr key={item.id} className="hover:bg-slate-800/40 transition">
                          <td className="py-3 px-4 max-w-md">
                            <p className="font-bold text-slate-100">{item.title}</p>
                            <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-2">{item.body}</p>
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap text-slate-300">
                            {item.user_phone ? `📱 ${item.user_phone}` : item.user_id || 'All'}
                          </td>
                          <td className="py-3 px-4 text-slate-300 font-medium whitespace-nowrap">
                            {formatDateTime(item.timestamp)}
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap">
                            {today ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                Active Today
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-medium bg-slate-800 text-slate-400 border border-slate-700">
                                Auto-Cleared in App (&lt; 12 AM)
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right whitespace-nowrap">
                            <button
                              type="button"
                              disabled={actionLoading}
                              onClick={() => handleDeleteCustomerNotif(item.id)}
                              className="inline-flex items-center gap-1 bg-red-600/10 hover:bg-red-600/20 text-red-400 font-semibold px-2.5 py-1.5 rounded-lg text-xs border border-red-500/20 transition disabled:opacity-50"
                              title="Delete notification permanently"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Clear</span>
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
        )}
      </div>
    </div>
  );
}
