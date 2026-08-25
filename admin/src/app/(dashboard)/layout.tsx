'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '../../context/AuthContext';
import {
  LayoutDashboard,
  Clock,
  UtensilsCrossed,
  Users,
  ShoppingBag,
  Repeat,
  BarChart3,
  Bell,
  ShieldAlert,
  LogOut,
  Radio,
  Package,
  Settings2,
  MapPin,
  Menu,
  X,
  CreditCard,
} from 'lucide-react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../../lib/firebase';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [pendingPaymentsCount, setPendingPaymentsCount] = useState(0);

  // Real-time listener for pending payment requests count
  React.useEffect(() => {
    try {
      const q = query(
        collection(db, 'payment_requests'),
        where('status', 'in', ['pending', 'utr_submitted'])
      );
      const unsub = onSnapshot(
        q,
        snap => {
          setPendingPaymentsCount(snap.size);
        },
        error => {
          // Gracefully handled if Firestore security rules block direct client access
        }
      );
      return unsub;
    } catch (e) {}
  }, []);

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  const navItems = [
    {
      name: 'Dashboard Snapshot',
      href: '/',
      icon: LayoutDashboard,
      roles: ['super_admin', 'kitchen_staff', 'delivery_manager'],
    },
    {
      name: 'Payment Approvals',
      href: '/payment-approvals',
      icon: CreditCard,
      badge: pendingPaymentsCount,
      roles: ['super_admin', 'kitchen_staff'],
    },
    {
      name: 'Meal Slot Cutoffs',
      href: '/slots',
      icon: Clock,
      roles: ['super_admin', 'kitchen_staff'],
    },
    {
      name: 'Food Menu & Photos',
      href: '/menu',
      icon: UtensilsCrossed,
      roles: ['super_admin', 'kitchen_staff'],
    },
    {
      name: 'User Accounts & Wallet',
      href: '/users',
      icon: Users,
      roles: ['super_admin'],
    },
    {
      name: 'Live Order Queue',
      href: '/orders',
      icon: ShoppingBag,
      roles: ['super_admin', 'kitchen_staff', 'delivery_manager'],
    },
    {
      name: 'Meal Subscriptions',
      href: '/subscriptions',
      icon: Repeat,
      roles: ['super_admin'],
    },
    {
      name: 'Meal Plans & Packs',
      href: '/plans',
      icon: Package,
      roles: ['super_admin'],
    },
    {
      name: 'Revenue & Analytics',
      href: '/analytics',
      icon: BarChart3,
      roles: ['super_admin'],
    },
    {
      name: 'Push Broadcaster',
      href: '/broadcast',
      icon: Bell,
      roles: ['super_admin'],
    },
    {
      name: 'System Audit Logs',
      href: '/audit-logs',
      icon: ShieldAlert,
      roles: ['super_admin'],
    },
    {
      name: 'Delivery Settings',
      href: '/settings',
      icon: MapPin,
      roles: ['super_admin'],
    },
  ];

  const userRole = user?.role || 'super_admin';
  const visibleNav = navItems.filter(item => item.roles.includes(userRole));

  const SidebarContent = () => (
    <div className="flex flex-col justify-between h-full">
      <div>
        {/* Top Brand Bar */}
        <div className="h-16 px-6 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="AFoodoo" className="w-8 h-8 rounded-lg object-cover border border-slate-700/60" />
            <div>
              <h1 className="font-extrabold text-slate-100 text-base leading-tight">AFoodoo</h1>
              <p className="text-[10px] font-semibold text-orange-400 uppercase tracking-widest">
                Ops Dashboard
              </p>
            </div>
          </div>
          <button
            onClick={() => setMobileOpen(false)}
            className="lg:hidden text-slate-400 hover:text-white p-1"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Role Badge Indicator */}
        <div className="p-4 mx-4 mt-4 bg-slate-800/60 border border-slate-700/60 rounded-xl">
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-slate-400 font-medium">Logged Role:</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-600/20 text-orange-400 border border-orange-500/30 uppercase">
              {userRole.replace('_', ' ')}
            </span>
          </div>
          <p className="text-xs font-semibold text-slate-200 truncate">{user?.name}</p>
        </div>

        {/* Navigation Links */}
        <nav className="px-3 mt-6 space-y-1">
          {visibleNav.map(item => {
            const Icon = item.icon;
            const isActive = pathname === item.href;

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={`flex items-center justify-between px-3.5 py-3 rounded-xl text-xs font-semibold transition-all ${
                  isActive
                    ? 'bg-orange-600 text-white shadow-lg shadow-orange-600/25'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className="h-4 w-4 shrink-0" />
                  <span>{item.name}</span>
                </div>
                {item.badge != null && item.badge > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-500 text-white animate-pulse">
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* User Footer & Sign Out */}
      <div className="p-4 border-t border-slate-800">
        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 text-xs font-bold transition-all"
        >
          <LogOut className="h-4 w-4" />
          <span>Sign Out</span>
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex bg-slate-950 text-slate-100">
      {/* Desktop Sidebar Navigation */}
      <aside className="hidden lg:flex w-64 bg-slate-900 border-r border-slate-800 flex-col shrink-0">
        <SidebarContent />
      </aside>

      {/* Mobile Drawer Overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <aside className="relative w-72 max-w-[80vw] bg-slate-900 border-r border-slate-800 flex flex-col z-10 shadow-2xl">
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Header */}
        <header className="h-16 bg-slate-900/80 backdrop-blur border-b border-slate-800 px-4 md:px-8 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileOpen(true)}
              className="lg:hidden p-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-200 hover:bg-slate-700"
            >
              <Menu className="h-5 w-5" />
            </button>

            <div className="flex items-center gap-2 text-xs font-medium text-slate-400">
              <Radio className="h-4 w-4 text-emerald-400 animate-pulse shrink-0" />
              <span className="hidden sm:inline">
                Cloud Firebase (<span className="text-emerald-400 font-bold">afoodoo</span>) Real-Time Sync Active
              </span>
              <span className="sm:hidden text-emerald-400 font-bold text-[11px]">Real-Time Sync</span>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-4 text-xs">
            <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-2.5 py-1 rounded-full font-semibold flex items-center gap-1.5 text-[11px]">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
              <span className="hidden sm:inline">Live Gateway Connected</span>
              <span className="sm:hidden">Online</span>
            </span>
            <span className="text-slate-400 hidden md:inline">{user?.email}</span>
          </div>
        </header>

        {/* Page Content Viewport */}
        <main className="flex-1 overflow-y-auto p-4 md:p-8">{children}</main>
      </div>
    </div>
  );
}
