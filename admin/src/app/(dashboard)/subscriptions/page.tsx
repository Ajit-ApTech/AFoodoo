'use client';

import React, { useEffect, useState } from 'react';
import { db } from '../../../lib/firebase';
import { collection, onSnapshot, doc, updateDoc, increment, addDoc } from 'firebase/firestore';
import { Subscription } from '../../../types';
import { Repeat, Calendar, PauseCircle, PlayCircle, PlusCircle, X, CheckCircle, ShieldAlert } from 'lucide-react';

export default function SubscriptionsManagementPage() {
  const [subscriptions, setSubscriptions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Bonus meals modal state
  const [selectedSubForMeals, setSelectedSubForMeals] = useState<any | null>(null);
  const [bonusMealCount, setBonusMealCount] = useState('5');
  const [showBonusModal, setShowBonusModal] = useState(false);

  // Pause date modal state
  const [selectedSubForPause, setSelectedSubForPause] = useState<any | null>(null);
  const [pauseDate, setPauseDate] = useState(new Date().toISOString().split('T')[0]);
  const [showPauseModal, setShowPauseModal] = useState(false);

  // Subscribe directly to Cloud Firestore subscriptions collection
  useEffect(() => {
    try {
      const unsub = onSnapshot(
        collection(db, 'subscriptions'),
        snap => {
          if (!snap.empty) {
            const list = snap.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }));
            setSubscriptions(list);
          } else {
            setSubscriptions([]);
          }
          setLoading(false);
        },
        err => {
          console.log('subscriptions listener status:', err.message);
          setLoading(false);
        }
      );
      return unsub;
    } catch (e) {
      setLoading(false);
    }
  }, []);

  const handleTogglePauseStatus = async (sub: any) => {
    const isCurrentlyPaused = sub.is_paused || sub.status === 'PAUSED';
    const newPausedState = !isCurrentlyPaused;

    if (newPausedState) {
      // Show pause date modal
      setSelectedSubForPause(sub);
      setShowPauseModal(true);
    } else {
      // Resume directly
      if (!window.confirm(`Resume subscription deliveries for ${sub.user_name || sub.user_phone}?`)) return;

      try {
        await updateDoc(doc(db, 'subscriptions', sub.id), {
          is_paused: false,
          status: 'ACTIVE',
        });

        await addDoc(collection(db, 'audit_logs'), {
          action_type: 'SUBSCRIPTION_RESUMED',
          admin_email: 'admin@afoodoo.com',
          details: `Resumed subscription deliveries for ${sub.user_name || sub.user_phone} (${sub.plan_type})`,
          user_id: sub.user_id || '',
          user_phone: sub.user_phone || '',
          timestamp: new Date().toISOString(),
        });
      } catch (e: any) {
        alert(`Error resuming subscription: ${e.message}`);
      }
    }
  };

  const handleConfirmPauseDate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSubForPause || !pauseDate) return;

    try {
      const existingDates = selectedSubForPause.paused_dates || [];
      const updatedDates = Array.from(new Set([...existingDates, pauseDate]));

      await updateDoc(doc(db, 'subscriptions', selectedSubForPause.id), {
        is_paused: true,
        status: 'PAUSED',
        paused_dates: updatedDates,
      });

      await addDoc(collection(db, 'audit_logs'), {
        action_type: 'SUBSCRIPTION_PAUSED',
        admin_email: 'admin@afoodoo.com',
        details: `Paused subscription for ${selectedSubForPause.user_name || selectedSubForPause.user_phone} on date ${pauseDate}`,
        user_id: selectedSubForPause.user_id || '',
        user_phone: selectedSubForPause.user_phone || '',
        timestamp: new Date().toISOString(),
      });

      alert(`Subscription deliveries paused for ${pauseDate}! Live status updated in Cloud Firestore.`);
    } catch (e: any) {
      alert(`Error pausing subscription: ${e.message}`);
    }

    setShowPauseModal(false);
    setSelectedSubForPause(null);
  };

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
      });

      await addDoc(collection(db, 'audit_logs'), {
        action_type: 'BONUS_MEALS_ADDED',
        admin_email: 'admin@afoodoo.com',
        details: `Added ${countNum} custom bonus meals for ${selectedSubForMeals.user_name || selectedSubForMeals.user_phone} (${selectedSubForMeals.plan_type})`,
        user_id: selectedSubForMeals.user_id || '',
        user_phone: selectedSubForMeals.user_phone || '',
        timestamp: new Date().toISOString(),
      });

      alert(`Successfully added ${countNum} bonus meals to ${selectedSubForMeals.user_name || selectedSubForMeals.user_phone}'s plan!`);
    } catch (e: any) {
      alert(`Error adding bonus meals: ${e.message}`);
    }

    setShowBonusModal(false);
    setSelectedSubForMeals(null);
  };

  return (
    <div className="space-y-8">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-3">
            <Repeat className="h-7 w-7 text-purple-400" />
            <span>Active Subscriptions & Meal Allocation</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Manage live active meal subscriptions, view pause/skip dates, pause/resume allocations, and credit custom bonus meal counts.
          </p>
        </div>
      </div>

      {/* Subscriptions Grid */}
      {loading ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center text-slate-400 text-xs">
          Loading live subscriptions from Cloud Firestore...
        </div>
      ) : subscriptions.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center text-slate-500 text-xs">
          No active meal subscriptions found in Cloud Firestore. Customer purchases on mobile will register here in real-time.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {subscriptions.map(sub => {
            const isPaused = sub.is_paused || sub.status === 'PAUSED';
            const pausedDates = sub.paused_dates || [];

            return (
              <div
                key={sub.id}
                className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-xl flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                    <div>
                      <h3 className="font-bold text-slate-100 text-base">{sub.plan_type}</h3>
                      <p className="text-xs text-slate-400">
                        Subscriber: <strong className="text-slate-200">{sub.user_name || 'Customer'}</strong>
                      </p>
                      {sub.user_phone ? (
                        <p className="text-[11px] font-mono text-slate-500">{sub.user_phone}</p>
                      ) : null}
                    </div>
                    {isPaused ? (
                      <span className="bg-amber-500/10 text-amber-400 border border-amber-500/30 px-2.5 py-1 rounded-md text-[10px] font-extrabold uppercase flex items-center gap-1">
                        <PauseCircle className="h-3 w-3" /> PAUSED
                      </span>
                    ) : (
                      <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-2.5 py-1 rounded-md text-[10px] font-extrabold uppercase flex items-center gap-1">
                        <CheckCircle className="h-3 w-3" /> ACTIVE
                      </span>
                    )}
                  </div>

                  {/* Meals Counter & Custom Bonus Button */}
                  <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                        MEALS REMAINING
                      </span>
                      <span className="text-3xl font-black text-purple-400">
                        {sub.meals_remaining ?? 0}
                      </span>
                    </div>
                    <button
                      onClick={() => {
                        setSelectedSubForMeals(sub);
                        setShowBonusModal(true);
                      }}
                      className="bg-purple-600/20 hover:bg-purple-600/30 text-purple-400 border border-purple-500/40 text-xs font-bold px-3 py-2 rounded-xl transition-all flex items-center gap-1.5"
                    >
                      <PlusCircle className="h-4 w-4" />
                      <span>+ Add Bonus Meals</span>
                    </button>
                  </div>

                  {/* Skipped / Paused Dates Badge */}
                  {pausedDates.length > 0 ? (
                    <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 text-[11px] text-amber-300">
                      ⏸️ <strong>Paused / Skipped Dates:</strong>
                      <div className="mt-1 font-mono text-[10px] text-amber-200">
                        {pausedDates.join(', ')}
                      </div>
                    </div>
                  ) : isPaused ? (
                    <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-2.5 text-[11px] text-amber-300">
                      ⏸️ <strong>Deliveries Currently Paused</strong>
                    </div>
                  ) : null}

                  <div className="text-xs space-y-1 text-slate-400 pt-1">
                    <div className="flex items-center justify-between">
                      <span>Auto-Renew:</span>
                      <span className="font-semibold text-slate-200">
                        {sub.auto_renew ? 'Enabled' : 'Disabled'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Start Date:</span>
                      <span className="font-mono text-slate-300">
                        {sub.start_date ? new Date(sub.start_date).toLocaleDateString() : 'N/A'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Valid Until:</span>
                      <span className="font-mono text-slate-300">
                        {sub.end_date ? new Date(sub.end_date).toLocaleDateString() : 'N/A'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Pause / Resume Button */}
                <button
                  onClick={() => handleTogglePauseStatus(sub)}
                  className={`w-full py-2.5 rounded-xl font-bold text-xs border transition-all flex items-center justify-center gap-2 ${
                    isPaused
                      ? 'bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border-emerald-500/40'
                      : 'bg-amber-600/20 hover:bg-amber-600/30 text-amber-400 border-amber-500/40'
                  }`}
                >
                  {isPaused ? (
                    <>
                      <PlayCircle className="h-4 w-4" />
                      <span>Resume Subscription</span>
                    </>
                  ) : (
                    <>
                      <PauseCircle className="h-4 w-4" />
                      <span>Pause Meal Deliveries</span>
                    </>
                  )}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Custom Bonus Meals Modal */}
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

      {/* Pause Date Modal */}
      {showPauseModal && selectedSubForPause ? (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <form
            onSubmit={handleConfirmPauseDate}
            className="bg-slate-900 border border-slate-800 max-w-md w-full rounded-2xl p-6 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <PauseCircle className="h-5 w-5 text-amber-400" />
                <span>Pause Deliveries for {selectedSubForPause.user_name || 'Subscriber'}</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowPauseModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">
                Select Date to Pause / Skip Meal Delivery (YYYY-MM-DD)
              </label>
              <input
                type="date"
                required
                value={pauseDate}
                onChange={e => setPauseDate(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm font-bold text-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowPauseModal(false)}
                className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs px-4 py-2.5 rounded-xl border border-slate-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs px-5 py-2.5 rounded-xl shadow-lg"
              >
                Confirm Pause for {pauseDate}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
