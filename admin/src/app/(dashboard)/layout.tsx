'use client';

import React from 'react';
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
} from 'lucide-react';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();

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

  return (
    <div className="min-h-screen flex bg-slate-950 text-slate-100">
      {/* Sidebar Navigation */}
      <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col justify-between shrink-0">
        <div>
          {/* Top Brand Bar */}
          <div className="h-16 px-6 flex items-center gap-3 border-b border-slate-800">
            <span className="text-2xl">🍲</span>
            <div>
              <h1 className="font-extrabold text-slate-100 text-base leading-tight">AFoodoo</h1>
              <p className="text-[10px] font-semibold text-orange-400 uppercase tracking-widest">
                Ops Dashboard
              </p>
            </div>
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
                  className={`flex items-center gap-3 px-3.5 py-3 rounded-xl text-xs font-semibold transition-all ${
                    isActive
                      ? 'bg-orange-600 text-white shadow-lg shadow-orange-600/25'
                      : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span>{item.name}</span>
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
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Header */}
        <header className="h-16 bg-slate-900/80 backdrop-blur border-b border-slate-800 px-8 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-medium text-slate-400">
            <Radio className="h-4 w-4 text-emerald-400 animate-pulse" />
            <span>Cloud Firebase (<span className="text-emerald-400 font-bold">afoodoo</span>) Real-Time Sync Active</span>
          </div>

          <div className="flex items-center gap-4 text-xs">
            <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-3 py-1 rounded-full font-semibold flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
              Live Gateway Connected
            </span>
            <span className="text-slate-400">{user?.email}</span>
          </div>
        </header>

        {/* Page Content Viewport */}
        <main className="flex-1 overflow-y-auto p-8">{children}</main>
      </div>
    </div>
  );
}
