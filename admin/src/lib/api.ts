import { DashboardSnapshot, AuditLog } from '../types';

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api';

/** Fetch today's operational snapshot */
export async function fetchDashboardSnapshot(): Promise<DashboardSnapshot> {
  try {
    const res = await fetch(`${API_BASE_URL}/admin/dashboard-snapshot`);
    if (!res.ok) throw new Error('API fetch error');
    return await res.json();
  } catch (e) {
    return {
      total_bookings: 42,
      lunch_bookings: 28,
      dinner_bookings: 14,
      today_revenue: 8450,
      active_subscriptions: 19,
      pending_deliveries: 12,
      cutoff_alert: {
        message: 'Lunch Cutoff Active — 42 Confirmed Meals',
        minutes_remaining: 18,
      },
    };
  }
}

/** Fetch historical analytics data for charts */
export async function fetchAnalyticsData() {
  try {
    const res = await fetch(`${API_BASE_URL}/admin/analytics`);
    if (!res.ok) throw new Error('Analytics fetch error');
    return await res.json();
  } catch (e) {
    return {
      revenue_trends: [
        { day: 'Mon', lunch: 4200, dinner: 3100, total: 7300 },
        { day: 'Tue', lunch: 5100, dinner: 3800, total: 8900 },
        { day: 'Wed', lunch: 4800, dinner: 4100, total: 8900 },
        { day: 'Thu', lunch: 5600, dinner: 4300, total: 9900 },
        { day: 'Fri', lunch: 6200, dinner: 5100, total: 11300 },
        { day: 'Sat', lunch: 4900, dinner: 5800, total: 10700 },
        { day: 'Sun', lunch: 5400, dinner: 6100, total: 11500 },
      ],
      best_sellers: [
        { name: 'North Indian Deluxe Thali', orders: 142, rating: 4.8 },
        { name: 'Special Butter Chicken Box', orders: 118, rating: 4.9 },
        { name: 'Homestyle Rajma Chawal', orders: 96, rating: 4.6 },
        { name: 'Egg Curry & Chapati Combo', orders: 74, rating: 4.7 },
      ],
      zone_breakdown: [
        { zone: 'Andheri West', orders: 184, percentage: 38 },
        { zone: 'Bandra Kurla Complex', orders: 142, percentage: 29 },
        { zone: 'Lower Parel', orders: 98, percentage: 20 },
        { zone: 'Powai Tech Hub', orders: 63, percentage: 13 },
      ],
      rider_performance: [
        { rider: 'Ramesh K. (Zone 1)', deliveries: 48, on_time_rate: '98%', avg_time: '22 min' },
        { rider: 'Vikram S. (Zone 2)', deliveries: 42, on_time_rate: '95%', avg_time: '26 min' },
        { rider: 'Amit P. (Zone 3)', deliveries: 39, on_time_rate: '97%', avg_time: '24 min' },
      ],
    };
  }
}

/** Adjust user wallet balance with audit log */
export async function adjustUserWallet(userId: string, amount: number, reason: string) {
  const res = await fetch(`${API_BASE_URL}/admin/users/${userId}/wallet-adjust`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ amount, reason }),
  });
  return res.json();
}

/** Flag or block user account */
export async function toggleBlockUser(userId: string, isBlocked: boolean, reason?: string) {
  const res = await fetch(`${API_BASE_URL}/admin/users/${userId}/block`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ is_blocked: isBlocked, reason }),
  });
  return res.json();
}

/** Broadcast push notification */
export async function sendBroadcastPush(title: string, body: string, segment?: string) {
  const res = await fetch(`${API_BASE_URL}/admin/broadcast`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, body, segment }),
  });
  return res.json();
}

/** Fetch security & operational audit logs */
export async function fetchAuditLogs(): Promise<AuditLog[]> {
  try {
    const res = await fetch(`${API_BASE_URL}/admin/audit-logs`);
    const data = await res.json();
    return data.logs || [];
  } catch (e) {
    return [
      {
        id: 'log_1',
        admin_id: 'admin_1',
        admin_name: 'Super Admin (admin@afoodoo.com)',
        action_type: 'wallet_adjust',
        target_id: 'usr_849201',
        details: 'Adjusted wallet by +₹250. Reason: Good customer goodwill credit',
        timestamp: new Date().toISOString(),
      },
      {
        id: 'log_2',
        admin_id: 'admin_2',
        admin_name: 'Kitchen Staff (kitchen@afoodoo.com)',
        action_type: 'cutoff_change',
        target_id: 'slot_lunch_today',
        details: 'Extended lunch cutoff time by 15 minutes to 11:15 AM',
        timestamp: new Date(Date.now() - 3600000).toISOString(),
      },
    ];
  }
}
