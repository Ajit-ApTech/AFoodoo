'use client';

import React, { useEffect, useState } from 'react';
import { db } from '../../../lib/firebase';
import { collection, onSnapshot, doc, setDoc, updateDoc, deleteDoc, addDoc } from 'firebase/firestore';
import { Package, Plus, Edit2, Trash2, CheckCircle, XCircle, Tag, Wallet, Sparkles, X } from 'lucide-react';

const DEFAULT_PLANS = [
  {
    id: 'plan_p1',
    title: 'Lunch Weekly',
    category: 'Lunch',
    meals: 7,
    duration: '1 Week',
    price: 649,
    wallet_credit: 1000,
    tag: '🆕 Starter',
    description: '7 lunch tiffin meals • Mon–Sun',
    active: true,
  },
  {
    id: 'plan_p2',
    title: 'Lunch Monthly',
    category: 'Lunch',
    meals: 30,
    duration: '1 Month',
    price: 2199,
    wallet_credit: 3500,
    tag: '🔥 Most Popular',
    description: '30 lunch tiffin meals • Mon–Sun',
    active: true,
  },
  {
    id: 'plan_p3',
    title: 'Dinner Weekly',
    category: 'Dinner',
    meals: 7,
    duration: '1 Week',
    price: 699,
    wallet_credit: 1000,
    tag: '⭐ Best Value',
    description: '7 dinner tiffin meals • Mon–Sun',
    active: true,
  },
  {
    id: 'plan_p4',
    title: 'Dinner Monthly',
    category: 'Dinner',
    meals: 30,
    duration: '1 Month',
    price: 2499,
    wallet_credit: 4000,
    tag: '🌙 Night Saver',
    description: '30 dinner tiffin meals • Mon–Sun',
    active: true,
  },
  {
    id: 'plan_p5',
    title: 'Lunch + Dinner Combo',
    category: 'Combo',
    meals: 60,
    duration: '1 Month',
    price: 4299,
    wallet_credit: 7500,
    tag: '👑 Premium',
    description: '60 meals (Lunch & Dinner) • Mon–Sun',
    active: true,
  },
];

export default function MealPlansManagementPage() {
  const [plans, setPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [editingPlan, setEditingPlan] = useState<any | null>(null);

  // Form fields
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('Lunch');
  const [meals, setMeals] = useState('30');
  const [duration, setDuration] = useState('1 Month');
  const [price, setPrice] = useState('2199');
  const [walletCredit, setWalletCredit] = useState('3500');
  const [tag, setTag] = useState('🔥 Most Popular');
  const [description, setDescription] = useState('30 lunch tiffin meals • Mon–Sun');
  const [active, setActive] = useState(true);
  const [formLoading, setFormLoading] = useState(false);

  // Subscribe to Cloud Firestore meal_plans collection
  useEffect(() => {
    try {
      const unsub = onSnapshot(
        collection(db, 'meal_plans'),
        snap => {
          if (!snap.empty) {
            const list = snap.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }));
            setPlans(list);
          } else {
            // Auto-seed default plans if collection is empty
            seedDefaultPlans();
          }
          setLoading(false);
        },
        err => {
          console.log('meal_plans listener status:', err.message);
          setLoading(false);
        }
      );
      return unsub;
    } catch (e) {
      setLoading(false);
    }
  }, []);

  const seedDefaultPlans = async () => {
    try {
      for (const p of DEFAULT_PLANS) {
        await setDoc(doc(db, 'meal_plans', p.id), p);
      }
    } catch (e) {
      console.log('Error seeding default meal plans:', e);
    }
  };

  const handleOpenAdd = () => {
    setEditingPlan(null);
    setTitle('');
    setCategory('Lunch');
    setMeals('30');
    setDuration('1 Month');
    setPrice('1999');
    setWalletCredit('3000');
    setTag('🔥 Recommended');
    setDescription('30 tiffin meals • Mon–Sun');
    setActive(true);
    setShowModal(true);
  };

  const handleOpenEdit = (plan: any) => {
    setEditingPlan(plan);
    setTitle(plan.title || '');
    setCategory(plan.category || 'Lunch');
    setMeals(String(plan.meals || 30));
    setDuration(plan.duration || '1 Month');
    setPrice(String(plan.price || 0));
    setWalletCredit(String(plan.wallet_credit || 0));
    setTag(plan.tag || '');
    setDescription(plan.description || '');
    setActive(plan.active ?? true);
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !price || !meals) return;
    setFormLoading(true);

    const planId = editingPlan ? editingPlan.id : `plan_${Date.now()}`;
    const planData = {
      title,
      category,
      meals: parseInt(meals, 10) || 30,
      duration,
      price: parseFloat(price) || 0,
      wallet_credit: parseFloat(walletCredit) || 0,
      tag,
      description,
      active,
      updated_at: new Date().toISOString(),
    };

    try {
      await setDoc(doc(db, 'meal_plans', planId), planData, { merge: true });

      await addDoc(collection(db, 'audit_logs'), {
        action_type: editingPlan ? 'MEAL_PLAN_EDITED' : 'MEAL_PLAN_CREATED',
        admin_email: 'admin@afoodoo.com',
        details: `${editingPlan ? 'Updated' : 'Created'} meal plan "${title}" (Price: ₹${price}, Meals: ${meals})`,
        timestamp: new Date().toISOString(),
      });

      alert(`Successfully ${editingPlan ? 'updated' : 'created'} meal plan "${title}"! Live sync active.`);
      setShowModal(false);
    } catch (e: any) {
      alert(`Error saving meal plan: ${e.message}`);
    } finally {
      setFormLoading(false);
    }
  };

  const handleToggleActive = async (plan: any) => {
    const newActiveState = !(plan.active ?? true);
    try {
      await updateDoc(doc(db, 'meal_plans', plan.id), {
        active: newActiveState,
      });

      await addDoc(collection(db, 'audit_logs'), {
        action_type: 'MEAL_PLAN_STATUS_TOGGLED',
        admin_email: 'admin@afoodoo.com',
        details: `${newActiveState ? 'Activated' : 'Deactivated'} meal plan "${plan.title}"`,
        timestamp: new Date().toISOString(),
      });
    } catch (e: any) {
      alert(`Error toggling plan status: ${e.message}`);
    }
  };

  const handleDeletePlan = async (plan: any) => {
    if (!window.confirm(`Are you sure you want to delete meal plan "${plan.title}"?`)) return;

    try {
      await deleteDoc(doc(db, 'meal_plans', plan.id));

      await addDoc(collection(db, 'audit_logs'), {
        action_type: 'MEAL_PLAN_DELETED',
        admin_email: 'admin@afoodoo.com',
        details: `Deleted meal plan "${plan.title}"`,
        timestamp: new Date().toISOString(),
      });

      alert(`Meal plan "${plan.title}" deleted.`);
    } catch (e: any) {
      alert(`Error deleting meal plan: ${e.message}`);
    }
  };

  return (
    <div className="space-y-8">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-3">
            <Package className="h-7 w-7 text-amber-400" />
            <span>Meal Plans & Pricing Management</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Create, edit, toggle, or delete subscription meal packs. All prices, meal counts, and bonus credits sync live to the customer mobile app.
          </p>
        </div>

        <button
          onClick={handleOpenAdd}
          className="bg-orange-600 hover:bg-orange-500 text-white font-bold px-4 py-2.5 rounded-xl shadow-lg transition-all text-xs flex items-center gap-2 w-fit"
        >
          <Plus className="h-4 w-4" />
          <span>Create New Meal Plan</span>
        </button>
      </div>

      {/* Meal Plans Grid */}
      {loading ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center text-slate-400 text-xs">
          Loading meal plans from Cloud Firestore...
        </div>
      ) : plans.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center text-slate-500 text-xs">
          No meal plans found. Click <strong>"Create New Meal Plan"</strong> above to add one.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {plans.map(plan => (
            <div
              key={plan.id}
              className={`bg-slate-900 border ${
                plan.active ?? true ? 'border-slate-800' : 'border-rose-900/50 opacity-60'
              } rounded-2xl p-6 space-y-4 shadow-xl flex flex-col justify-between`}
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between border-b border-slate-800 pb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-slate-100 text-base">{plan.title}</h3>
                      {plan.tag ? (
                        <span className="bg-amber-500/10 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded text-[10px] font-extrabold">
                          {plan.tag}
                        </span>
                      ) : null}
                    </div>
                    <p className="text-xs text-slate-400 mt-1">{plan.description}</p>
                  </div>
                  {plan.active ?? true ? (
                    <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-2.5 py-1 rounded-md text-[10px] font-extrabold uppercase shrink-0">
                      ACTIVE
                    </span>
                  ) : (
                    <span className="bg-rose-500/10 text-rose-400 border border-rose-500/30 px-2.5 py-1 rounded-md text-[10px] font-extrabold uppercase shrink-0">
                      INACTIVE
                    </span>
                  )}
                </div>

                {/* Price & Wallet Credit Box */}
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-400 font-medium">Customer Price:</span>
                    <span className="text-xl font-extrabold text-white">
                      ₹{Number(plan.price || 0).toLocaleString('en-IN')}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-400 font-medium flex items-center gap-1">
                      <Wallet className="h-3.5 w-3.5 text-emerald-400" /> Wallet Credit:
                    </span>
                    <span className="text-sm font-black text-emerald-400">
                      ₹{Number(plan.wallet_credit || 0).toLocaleString('en-IN')}
                    </span>
                  </div>
                </div>

                <div className="text-xs space-y-1.5 text-slate-400 pt-1">
                  <div className="flex items-center justify-between">
                    <span>Category:</span>
                    <span className="font-semibold text-slate-200">{plan.category}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Total Meals:</span>
                    <span className="font-bold text-purple-400">{plan.meals} Meals</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Duration:</span>
                    <span className="font-mono text-slate-300">{plan.duration}</span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 border-t border-slate-800 flex items-center justify-between gap-2">
                <button
                  onClick={() => handleToggleActive(plan)}
                  className={`px-3 py-1.5 rounded-lg font-bold text-[11px] border transition-all ${
                    plan.active ?? true
                      ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                      : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                  }`}
                >
                  {plan.active ?? true ? 'Deactivate' : 'Activate'}
                </button>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleOpenEdit(plan)}
                    className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-3 py-1.5 rounded-lg font-bold text-[11px] flex items-center gap-1"
                  >
                    <Edit2 className="h-3.5 w-3.5 text-blue-400" /> Edit
                  </button>
                  <button
                    onClick={() => handleDeletePlan(plan)}
                    className="bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 px-3 py-1.5 rounded-lg font-bold text-[11px] flex items-center gap-1"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit Meal Plan Modal */}
      {showModal ? (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
          <form
            onSubmit={handleSubmit}
            className="bg-slate-900 border border-slate-800 max-w-lg w-full rounded-2xl p-6 shadow-2xl space-y-4 my-8"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Package className="h-5 w-5 text-amber-400" />
                <span>{editingPlan ? `Edit "${editingPlan.title}"` : 'Create New Meal Plan'}</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Plan Title</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="e.g. Lunch Monthly"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Category</label>
                <select
                  value={category}
                  onChange={e => setCategory(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white"
                >
                  <option value="Lunch">Lunch</option>
                  <option value="Dinner">Dinner</option>
                  <option value="Combo">Combo (Lunch & Dinner)</option>
                  <option value="Breakfast">Breakfast</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Total Meals Count</label>
                <input
                  type="number"
                  required
                  min="1"
                  value={meals}
                  onChange={e => setMeals(e.target.value)}
                  placeholder="e.g. 30"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-purple-400 font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Duration Label</label>
                <input
                  type="text"
                  required
                  value={duration}
                  onChange={e => setDuration(e.target.value)}
                  placeholder="e.g. 1 Month / 1 Week"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Price (₹)</label>
                <input
                  type="number"
                  required
                  min="0"
                  value={price}
                  onChange={e => setPrice(e.target.value)}
                  placeholder="e.g. 2199"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Wallet Credit Amount (₹)</label>
                <input
                  type="number"
                  required
                  min="0"
                  value={walletCredit}
                  onChange={e => setWalletCredit(e.target.value)}
                  placeholder="e.g. 3500"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-emerald-400 font-bold"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Tag / Badge (Optional)</label>
              <input
                type="text"
                value={tag}
                onChange={e => setTag(e.target.value)}
                placeholder="e.g. 🔥 Most Popular / 👑 Premium"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-amber-300"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Description</label>
              <input
                type="text"
                required
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="e.g. 30 lunch tiffin meals • Mon–Sun"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-200"
              />
            </div>

            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="plan_active_chk"
                checked={active}
                onChange={e => setActive(e.target.checked)}
                className="rounded bg-slate-950 border-slate-800 text-orange-500 focus:ring-orange-500"
              />
              <label htmlFor="plan_active_chk" className="text-xs font-semibold text-slate-300">
                Active & Visible on Customer Mobile App
              </label>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs px-4 py-2.5 rounded-xl border border-slate-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={formLoading}
                className="bg-orange-600 hover:bg-orange-500 text-white font-bold text-xs px-5 py-2.5 rounded-xl shadow-lg"
              >
                {formLoading ? 'Saving...' : editingPlan ? 'Update Plan' : 'Create Meal Plan'}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
