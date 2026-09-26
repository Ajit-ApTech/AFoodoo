'use client';

import React, { useEffect, useState } from 'react';
import { db } from '../../../lib/firebase';
import {
  collection,
  getDocs,
  doc,
  setDoc,
  deleteDoc,
  updateDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { Coupon } from '../../../types';
import {
  Ticket,
  Plus,
  Trash2,
  Copy,
  Check,
  Percent,
  Truck,
  IndianRupee,
  Sparkles,
  CheckCircle2,
  X,
  AlertCircle,
  Clock,
  ArrowUpDown,
} from 'lucide-react';

const INITIAL_COUPONS: Omit<Coupon, 'id'>[] = [
  {
    code: 'AFOODOO50',
    description: '50% off on your order up to ₹50 discount',
    discount_type: 'percentage',
    discount_value: 50,
    max_discount: 50,
    min_order_amount: 99,
    is_active: true,
    created_at: new Date().toISOString(),
  },
  {
    code: 'FIRST50',
    description: 'Welcome offer: 50% discount up to ₹50 for first-time customers',
    discount_type: 'percentage',
    discount_value: 50,
    max_discount: 50,
    min_order_amount: 99,
    is_active: true,
    created_at: new Date().toISOString(),
  },
  {
    code: 'FREEDEL',
    description: '100% Free delivery on all orders above ₹149',
    discount_type: 'free_delivery',
    discount_value: 0,
    min_order_amount: 149,
    is_active: true,
    created_at: new Date().toISOString(),
  },
  {
    code: 'FLAT30',
    description: 'Flat ₹30 off on orders above ₹199',
    discount_type: 'flat',
    discount_value: 30,
    min_order_amount: 199,
    is_active: true,
    created_at: new Date().toISOString(),
  },
];

export default function CouponsPage() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Form State
  const [formCode, setFormCode] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formType, setFormType] = useState<'percentage' | 'flat' | 'free_delivery'>('percentage');
  const [formValue, setFormValue] = useState<number>(20);
  const [formMaxDiscount, setFormMaxDiscount] = useState<number>(50);
  const [formMinOrder, setFormMinOrder] = useState<number>(99);
  const [formIsActive, setFormIsActive] = useState<boolean>(true);

  const fetchCoupons = async () => {
    try {
      setLoading(true);
      const snap = await getDocs(collection(db, 'coupons'));
      const list: Coupon[] = snap.docs.map(d => ({
        id: d.id,
        ...(d.data() as Omit<Coupon, 'id'>),
      }));
      setCoupons(list);
    } catch (err: any) {
      console.error('Error loading coupons:', err);
      setError('Could not load coupons from database.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCoupons();
  }, []);

  const handleCopy = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const handleToggleActive = async (coupon: Coupon) => {
    try {
      const newStatus = !coupon.is_active;
      await updateDoc(doc(db, 'coupons', coupon.id), {
        is_active: newStatus,
      });
      setCoupons(prev =>
        prev.map(c => (c.id === coupon.id ? { ...c, is_active: newStatus } : c))
      );
    } catch (err: any) {
      alert(`Failed to update status: ${err.message}`);
    }
  };

  const handleDelete = async (couponId: string, code: string) => {
    if (!confirm(`Are you sure you want to permanently delete coupon "${code}"?`)) return;
    try {
      await deleteDoc(doc(db, 'coupons', couponId));
      setCoupons(prev => prev.filter(c => c.id !== couponId));
    } catch (err: any) {
      alert(`Failed to delete coupon: ${err.message}`);
    }
  };

  const handleSeedDefaults = async () => {
    try {
      setSaving(true);
      for (const item of INITIAL_COUPONS) {
        await setDoc(doc(db, 'coupons', item.code), item);
      }
      setSuccessMsg('Default initial coupons created successfully!');
      setTimeout(() => setSuccessMsg(''), 3000);
      await fetchCoupons();
    } catch (err: any) {
      alert(`Error initializing coupons: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleCreateCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = formCode.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '');
    if (!cleanCode) {
      alert('Please enter a valid coupon code.');
      return;
    }

    setSaving(true);
    setError('');

    try {
      const newCouponData: Omit<Coupon, 'id'> = {
        code: cleanCode,
        description: formDesc.trim() || `${cleanCode} special promotional discount`,
        discount_type: formType,
        discount_value: formType === 'free_delivery' ? 0 : Number(formValue) || 0,
        max_discount: formType === 'percentage' && formMaxDiscount ? Number(formMaxDiscount) : undefined,
        min_order_amount: Number(formMinOrder) || 0,
        is_active: formIsActive,
        created_at: new Date().toISOString(),
      };

      await setDoc(doc(db, 'coupons', cleanCode), newCouponData);

      setShowModal(false);
      // Reset form
      setFormCode('');
      setFormDesc('');
      setFormType('percentage');
      setFormValue(20);
      setFormMaxDiscount(50);
      setFormMinOrder(99);
      setFormIsActive(true);

      setSuccessMsg(`Coupon "${cleanCode}" created successfully!`);
      setTimeout(() => setSuccessMsg(''), 3000);
      await fetchCoupons();
    } catch (err: any) {
      console.error('Error creating coupon:', err);
      setError(`Failed to create coupon: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const activeCount = coupons.filter(c => c.is_active).length;

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-6 rounded-2xl">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-400">
            <Ticket className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-black text-white flex items-center gap-2">
              Coupons & Discounts
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30">
                {coupons.length} Offers
              </span>
            </h1>
            <p className="text-xs text-slate-400">
              Create, toggle, and manage promo codes that customers can apply at checkout.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {coupons.length === 0 && !loading && (
            <button
              onClick={handleSeedDefaults}
              disabled={saving}
              className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold py-2.5 px-4 rounded-xl border border-slate-700 transition-colors"
            >
              <Sparkles className="h-4 w-4 text-amber-400" />
              Load Default Coupons
            </button>
          )}

          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-slate-950 text-xs font-black py-2.5 px-4 rounded-xl shadow-lg shadow-orange-500/20 transition-all cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            Create New Coupon
          </button>
        </div>
      </div>

      {/* Success Notification */}
      {successMsg && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold px-4 py-3 rounded-xl flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4" />
          {successMsg}
        </div>
      )}

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="text-xs text-slate-400 font-medium">Total Coupons</div>
          <div className="text-2xl font-black text-white mt-1">{coupons.length}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">Configured promo offers</div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="text-xs text-slate-400 font-medium">Active Coupons</div>
          <div className="text-2xl font-black text-emerald-400 mt-1">{activeCount}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">Currently redeemable in app</div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="text-xs text-slate-400 font-medium">Paused / Inactive</div>
          <div className="text-2xl font-black text-slate-400 mt-1">{coupons.length - activeCount}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">Hidden from customer use</div>
        </div>
      </div>

      {/* Coupons List */}
      {loading ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center text-slate-400 text-xs">
          Loading coupons from Cloud Firestore...
        </div>
      ) : coupons.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center space-y-4">
          <div className="h-12 w-12 rounded-full bg-slate-800 flex items-center justify-center mx-auto text-amber-400">
            <Ticket className="h-6 w-6" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">No Coupons Configured Yet</h3>
            <p className="text-xs text-slate-400 mt-1">
              Create your first promotional discount coupon or initialize standard welcome offers.
            </p>
          </div>
          <div className="flex items-center justify-center gap-3 pt-2">
            <button
              onClick={handleSeedDefaults}
              className="bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold py-2 px-4 rounded-xl border border-slate-700"
            >
              Load Default Coupons
            </button>
            <button
              onClick={() => setShowModal(true)}
              className="bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-bold py-2 px-4 rounded-xl"
            >
              Create Coupon
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {coupons.map(coupon => {
            const isPct = coupon.discount_type === 'percentage';
            const isFlat = coupon.discount_type === 'flat';
            const isFreeDel = coupon.discount_type === 'free_delivery';

            return (
              <div
                key={coupon.id}
                className={`bg-slate-900 border rounded-2xl p-5 flex flex-col justify-between transition-all ${
                  coupon.is_active
                    ? 'border-slate-800 shadow-lg shadow-black/40 hover:border-slate-700'
                    : 'border-slate-800/50 opacity-60'
                }`}
              >
                <div className="space-y-3">
                  {/* Top Bar: Code & Active Status */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-black text-amber-400 bg-amber-500/10 border border-amber-500/30 px-2.5 py-1 rounded-lg tracking-wider">
                        {coupon.code}
                      </span>
                      <button
                        onClick={() => handleCopy(coupon.code)}
                        title="Copy code"
                        className="text-slate-400 hover:text-white p-1 rounded transition-colors"
                      >
                        {copiedCode === coupon.code ? (
                          <Check className="h-3.5 w-3.5 text-emerald-400" />
                        ) : (
                          <Copy className="h-3.5 w-3.5" />
                        )}
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleToggleActive(coupon)}
                      className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border transition-all ${
                        coupon.is_active
                          ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400'
                          : 'bg-slate-800 border-slate-700 text-slate-400'
                      }`}
                    >
                      {coupon.is_active ? '● Active' : '○ Paused'}
                    </button>
                  </div>

                  {/* Discount Value Highlight */}
                  <div className="pt-1">
                    <div className="text-xl font-black text-white flex items-center gap-1.5">
                      {isPct && (
                        <>
                          <Percent className="h-5 w-5 text-amber-400" />
                          <span>{coupon.discount_value}% OFF</span>
                        </>
                      )}
                      {isFlat && (
                        <>
                          <span className="text-amber-400 text-lg">₹</span>
                          <span>₹{coupon.discount_value} FLAT OFF</span>
                        </>
                      )}
                      {isFreeDel && (
                        <>
                          <Truck className="h-5 w-5 text-emerald-400" />
                          <span className="text-emerald-400">FREE DELIVERY</span>
                        </>
                      )}
                    </div>
                    <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                      {coupon.description}
                    </p>
                  </div>

                  {/* Conditions & Criteria */}
                  <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3 text-[11px] space-y-1.5 text-slate-400">
                    <div className="flex justify-between items-center">
                      <span>Min Order Subtotal:</span>
                      <span className="font-mono font-bold text-slate-200">
                        {coupon.min_order_amount ? `₹${coupon.min_order_amount}` : 'None (₹0)'}
                      </span>
                    </div>

                    {isPct && (
                      <div className="flex justify-between items-center">
                        <span>Max Discount Cap:</span>
                        <span className="font-mono font-bold text-slate-200">
                          {coupon.max_discount ? `Up to ₹${coupon.max_discount}` : 'Unlimited'}
                        </span>
                      </div>
                    )}

                    <div className="flex justify-between items-center">
                      <span>Type:</span>
                      <span className="capitalize font-semibold text-amber-400/90">
                        {isPct ? 'Percentage Discount' : isFlat ? 'Flat Cash Discount' : 'Free Delivery Waive'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Bottom Actions */}
                <div className="flex items-center justify-between border-t border-slate-800/80 pt-3 mt-4">
                  <span className="text-[10px] text-slate-500 font-mono">
                    ID: {coupon.id.slice(0, 10)}
                  </span>

                  <button
                    onClick={() => handleDelete(coupon.id, coupon.code)}
                    className="text-slate-500 hover:text-red-400 p-1.5 rounded-lg hover:bg-red-500/10 transition-colors flex items-center gap-1 text-[11px] font-medium"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Coupon Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-6 space-y-5 shadow-2xl relative">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-2">
                <Ticket className="h-5 w-5 text-amber-400" />
                <h3 className="text-base font-extrabold text-white">Create New Coupon</h3>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateCoupon} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                  Coupon Code *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. WELCOME100, SUMMER20, FREEDEL"
                  value={formCode}
                  onChange={e => setFormCode(e.target.value.toUpperCase())}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white uppercase font-mono tracking-wider focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                  Offer Description *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 50% off on your lunch special up to ₹50"
                  value={formDesc}
                  onChange={e => setFormDesc(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                  Discount Type
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setFormType('percentage')}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                      formType === 'percentage'
                        ? 'bg-amber-500 text-slate-950 border-amber-500'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <Percent className="h-3.5 w-3.5" />
                    Percentage (%)
                  </button>

                  <button
                    type="button"
                    onClick={() => setFormType('flat')}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                      formType === 'flat'
                        ? 'bg-amber-500 text-slate-950 border-amber-500'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <span>₹</span>
                    Flat Off (₹)
                  </button>

                  <button
                    type="button"
                    onClick={() => setFormType('free_delivery')}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                      formType === 'free_delivery'
                        ? 'bg-amber-500 text-slate-950 border-amber-500'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <Truck className="h-3.5 w-3.5" />
                    Free Delivery
                  </button>
                </div>
              </div>

              {formType !== 'free_delivery' && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                      {formType === 'percentage' ? 'Discount Percentage (%)' : 'Discount Amount (₹)'} *
                    </label>
                    <input
                      type="number"
                      required
                      min={1}
                      max={formType === 'percentage' ? 100 : 1000}
                      value={formValue}
                      onChange={e => setFormValue(parseInt(e.target.value) || 0)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  {formType === 'percentage' && (
                    <div>
                      <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                        Max Cap (₹) (Optional)
                      </label>
                      <input
                        type="number"
                        min={1}
                        placeholder="e.g. 50"
                        value={formMaxDiscount}
                        onChange={e => setFormMaxDiscount(parseInt(e.target.value) || 0)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-amber-500"
                      />
                    </div>
                  )}
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                    Min Order Subtotal (₹)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={formMinOrder}
                    onChange={e => setFormMinOrder(parseInt(e.target.value) || 0)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-amber-500"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">Set to 0 for no minimum</p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                    Initial Status
                  </label>
                  <button
                    type="button"
                    onClick={() => setFormIsActive(!formIsActive)}
                    className={`w-full py-2.5 px-3.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 mt-0.5 transition-all ${
                      formIsActive
                        ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400'
                        : 'bg-slate-950 border-slate-800 text-slate-400'
                    }`}
                  >
                    {formIsActive ? '● Active Immediately' : '○ Paused (Inactive)'}
                  </button>
                </div>
              </div>

              {error && (
                <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-xs p-3 rounded-xl flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {error}
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2.5 rounded-xl text-xs font-black bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 hover:from-amber-600 hover:to-orange-600 shadow-md shadow-orange-500/20 disabled:opacity-50 transition-all cursor-pointer"
                >
                  {saving ? 'Creating...' : 'Save & Launch Coupon'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
