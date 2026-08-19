'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../context/AuthContext';
import { AdminRole } from '../../../types';
import { ShieldCheck, Utensils, Truck, Lock, UserCheck } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [email, setEmail] = useState('admin@afoodoo.com');
  const [password, setPassword] = useState('AdminPass123!');
  const [role, setRole] = useState<AdminRole>('super_admin');
  const [loading, setLoading] = useState(false);

  const handleSignIn = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => {
      login(email, role);
      router.push('/');
    }, 400);
  };

  const handleQuickDemoRole = (targetRole: AdminRole) => {
    const emails: Record<AdminRole, string> = {
      super_admin: 'admin@afoodoo.com',
      kitchen_staff: 'kitchen@afoodoo.com',
      delivery_manager: 'rider.dispatch@afoodoo.com',
    };
    setRole(targetRole);
    setEmail(emails[targetRole]);
    setPassword('AdminPass123!');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 px-4 py-12">
      <div className="max-w-md w-full space-y-8 bg-slate-900 border border-slate-800 p-8 rounded-2xl shadow-2xl">
        {/* Brand Header */}
        <div className="text-center">
          <div className="mx-auto h-16 w-16 bg-orange-600/10 border border-orange-500/30 rounded-2xl flex items-center justify-center mb-4">
            <span className="text-3xl">🍲</span>
          </div>
          <h2 className="text-3xl font-extrabold text-white tracking-tight">
            AFoodoo Admin Portal
          </h2>
          <p className="mt-2 text-sm text-slate-400">
            Real-Time Operational Control • Kitchen & Fleet Management
          </p>
        </div>

        {/* Role Selector Tabs */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
            Select Operational Role
          </label>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => handleQuickDemoRole('super_admin')}
              className={`flex flex-col items-center justify-center p-3 rounded-xl border text-xs font-semibold transition-all ${
                role === 'super_admin'
                  ? 'bg-orange-600/20 border-orange-500 text-orange-400'
                  : 'bg-slate-800/50 border-slate-700/60 text-slate-400 hover:bg-slate-800'
              }`}
            >
              <ShieldCheck className="h-4 w-4 mb-1" />
              Super Admin
            </button>

            <button
              type="button"
              onClick={() => handleQuickDemoRole('kitchen_staff')}
              className={`flex flex-col items-center justify-center p-3 rounded-xl border text-xs font-semibold transition-all ${
                role === 'kitchen_staff'
                  ? 'bg-orange-600/20 border-orange-500 text-orange-400'
                  : 'bg-slate-800/50 border-slate-700/60 text-slate-400 hover:bg-slate-800'
              }`}
            >
              <Utensils className="h-4 w-4 mb-1" />
              Kitchen Staff
            </button>

            <button
              type="button"
              onClick={() => handleQuickDemoRole('delivery_manager')}
              className={`flex flex-col items-center justify-center p-3 rounded-xl border text-xs font-semibold transition-all ${
                role === 'delivery_manager'
                  ? 'bg-orange-600/20 border-orange-500 text-orange-400'
                  : 'bg-slate-800/50 border-slate-700/60 text-slate-400 hover:bg-slate-800'
              }`}
            >
              <Truck className="h-4 w-4 mb-1" />
              Fleet Manager
            </button>
          </div>
        </div>

        {/* Login Form */}
        <form className="mt-6 space-y-5" onSubmit={handleSignIn}>
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Admin Email Address
            </label>
            <div className="relative">
              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500"
                placeholder="admin@afoodoo.com"
              />
              <UserCheck className="absolute right-3.5 top-3.5 h-4 w-4 text-slate-500" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Secret Passcode
            </label>
            <div className="relative">
              <input
                type="password"
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500"
                placeholder="••••••••••••"
              />
              <Lock className="absolute right-3.5 top-3.5 h-4 w-4 text-slate-500" />
            </div>
          </div>

          {/* Role Access Notice */}
          <div className="bg-slate-800/60 border border-slate-700/80 rounded-xl p-3.5 text-xs text-slate-400">
            <span className="font-semibold text-orange-400">Access Scope: </span>
            {role === 'super_admin' && 'Full unrestricted access to all modules, analytics, and wallet overrides.'}
            {role === 'kitchen_staff' && 'Operational access restricted to Dashboard, Meal Slot Cutoffs, Food Menu, & Live Orders.'}
            {role === 'delivery_manager' && 'Access restricted to Live Orders Queue, Zone Dispatch, & Reusable Container Tracking.'}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white font-bold py-3.5 px-4 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2"
          >
            {loading ? (
              <span>Authenticating...</span>
            ) : (
              <>
                <span>Sign In to Admin Portal</span>
                <span>→</span>
              </>
            )}
          </button>
        </form>

        {/* Real Cloud Firebase Sync Banner */}
        <div className="text-center pt-2">
          <p className="text-xs text-slate-500">
            ⚡ Connected to Cloud Firebase (<span className="text-slate-400">afoodoo</span>) • Syncs live with mobile app
          </p>
        </div>
      </div>
    </div>
  );
}
