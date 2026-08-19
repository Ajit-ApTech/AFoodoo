'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchAnalyticsData } from '../../../lib/api';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { BarChart3, Download, TrendingUp, Award, MapPin, Truck } from 'lucide-react';

const COLORS = ['#ea580c', '#10b981', '#3b82f6', '#8b5cf6'];

export default function RevenueAnalyticsPage() {
  const { data } = useQuery({
    queryKey: ['admin-analytics'],
    queryFn: fetchAnalyticsData,
  });

  const handleExportCSV = () => {
    if (!data?.revenue_trends) return;
    const headers = 'Day,Lunch Revenue (₹),Dinner Revenue (₹),Total Revenue (₹)\n';
    const rows = data.revenue_trends
      .map((r: any) => `${r.day},${r.lunch},${r.dinner},${r.total}`)
      .join('\n');
    const csvContent = 'data:text/csv;charset=utf-8,' + headers + rows;
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `AFoodoo_Revenue_Report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-3">
            <BarChart3 className="h-7 w-7 text-emerald-400" />
            <span>Revenue & Performance Analytics</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Track daily revenue trends, best-selling dishes, delivery zone volume, and rider on-time rates.
          </p>
        </div>

        <button
          onClick={handleExportCSV}
          className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-lg shadow-emerald-600/20 transition-all flex items-center gap-2"
        >
          <Download className="h-4 w-4" />
          <span>Export CSV Accounting Report</span>
        </button>
      </div>

      {/* Main Revenue Chart */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-emerald-400" />
              <span>Weekly Revenue Trend (Lunch vs Dinner)</span>
            </h3>
            <p className="text-xs text-slate-400">Total gross revenue split by meal window (₹)</p>
          </div>
          <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-3 py-1 rounded-full">
            +18.4% vs last week
          </span>
        </div>

        <div className="h-72 w-full pt-4">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data?.revenue_trends || []}>
              <defs>
                <linearGradient id="lunchGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ea580c" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#ea580c" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="dinnerGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="day" stroke="#64748b" fontSize={12} />
              <YAxis stroke="#64748b" fontSize={12} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#0f172a',
                  borderColor: '#334155',
                  borderRadius: '12px',
                  color: '#fff',
                }}
              />
              <Area type="monotone" dataKey="lunch" stroke="#ea580c" fillOpacity={1} fill="url(#lunchGrad)" name="Lunch Revenue (₹)" />
              <Area type="monotone" dataKey="dinner" stroke="#10b981" fillOpacity={1} fill="url(#dinnerGrad)" name="Dinner Revenue (₹)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Grid: Best Sellers & Zone Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Top Dishes */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Award className="h-5 w-5 text-amber-400" />
            <span>Top Best-Selling Dishes</span>
          </h3>

          <div className="space-y-3">
            {(data?.best_sellers || []).map((item: any, idx: number) => (
              <div key={idx} className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800/80 flex items-center justify-between">
                <div>
                  <div className="font-bold text-slate-100 text-xs">{item.name}</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Rating: ⭐ {item.rating} / 5.0</div>
                </div>
                <span className="font-black text-orange-400 text-xs">{item.orders} Orders</span>
              </div>
            ))}
          </div>
        </div>

        {/* Zone Breakdown */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <MapPin className="h-5 w-5 text-purple-400" />
            <span>Delivery Zone Volume Breakdown</span>
          </h3>

          <div className="h-52 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data?.zone_breakdown || []}
                  dataKey="orders"
                  nameKey="zone"
                  cx="50%"
                  cy="50%"
                  outerRadius={75}
                  label={(entry: any) => entry.zone}
                >
                  {(data?.zone_breakdown || []).map((_: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    borderColor: '#334155',
                    borderRadius: '12px',
                    color: '#fff',
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Rider Performance Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
        <h3 className="text-base font-bold text-white flex items-center gap-2">
          <Truck className="h-5 w-5 text-blue-400" />
          <span>Rider Fleet On-Time Performance</span>
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/80 text-slate-400 font-semibold uppercase border-b border-slate-800">
              <tr>
                <th className="px-4 py-3">Rider Name & Zone</th>
                <th className="px-4 py-3">Deliveries</th>
                <th className="px-4 py-3">On-Time Delivery Rate</th>
                <th className="px-4 py-3">Avg Delivery Window Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 text-slate-200">
              {(data?.rider_performance || []).map((rider: any, idx: number) => (
                <tr key={idx}>
                  <td className="px-4 py-3 font-bold">{rider.rider}</td>
                  <td className="px-4 py-3 font-mono">{rider.deliveries}</td>
                  <td className="px-4 py-3">
                    <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded font-bold">
                      {rider.on_time_rate}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-400">{rider.avg_time}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
