'use client';

import React, { useState } from 'react';
import { db } from '../../../lib/firebase';
import { collection, addDoc, getDocs } from 'firebase/firestore';
import { Bell, Send, CheckCircle2, Smartphone } from 'lucide-react';
import { sendExpoPushNotification } from '../../../lib/pushService';

export default function PushBroadcasterPage() {
  const [title, setTitle] = useState('🍱 Special Dinner Menu Tonight!');
  const [body, setBody] = useState('Enjoy 10% off Paneer Butter Masala tiffin meal! Order before 7 PM cutoff.');
  const [segment, setSegment] = useState('all_users');
  const [loading, setLoading] = useState(false);
  const [sentSuccess, setSentSuccess] = useState(false);

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

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-3">
          <Bell className="h-7 w-7 text-purple-400" />
          <span>Push Notification Broadcaster</span>
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Dispatch promotional or cutoff reminder push notifications via FCM / Firebase to connected customer mobile devices.
        </p>
      </div>

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

          <div className="text-[11px] text-slate-500 pt-4 border-t border-slate-800">
            ℹ️ Dispatches in real-time to customer mobile devices via Cloud Firestore broadcast channels.
          </div>
        </div>
      </div>
    </div>
  );
}
