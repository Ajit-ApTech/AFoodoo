import { auth } from '../firebaseConfig';
import { Subscription } from '../types';
import { API_BASE_URL } from './config';

async function getAuthToken(): Promise<string> {
  return await (auth.currentUser?.getIdToken() ?? Promise.resolve(''));
}

/** Fetch all subscriptions for a given user */
export async function fetchSubscriptions(userId: string): Promise<Subscription[]> {
  try {
    const token = await getAuthToken();
    const resp = await fetch(`${API_BASE_URL}/subscriptions?userId=${encodeURIComponent(userId)}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to fetch subscriptions');
    }
    const data = await resp.json();
    return data as Subscription[];
  } catch (e) {
    console.log('Using default local subscriptions for user:', userId);
    return [
      {
        id: 'sub-demo-1',
        user_id: userId,
        plan_type: 'Monthly Lunch Pack (20 Meals)',
        meals_remaining: 14,
        start_date: new Date().toISOString(),
        end_date: new Date(Date.now() + 20 * 86400000).toISOString(),
        auto_renew: true,
      },
    ];
  }
}

/** Create a new subscription */
export async function createSubscription(payload: {
  userId: string;
  plan_type: string;
  meals_remaining: number;
  start_date: string;
  end_date: string;
  auto_renew?: boolean;
}): Promise<Subscription> {
  const token = await getAuthToken();
  const resp = await fetch(`${API_BASE_URL}/subscriptions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      user_id: payload.userId,
      plan_type: payload.plan_type,
      meals_remaining: payload.meals_remaining,
      start_date: payload.start_date,
      end_date: payload.end_date,
      auto_renew: payload.auto_renew ?? false,
    }),
  });
  if (!resp.ok) {
    const err = await resp.json();
    throw new Error(err.error || 'Failed to create subscription');
  }
  const data = await resp.json();
  return data as Subscription;
}

/** Pause/skip a subscription for a specific date */
export async function pauseSubscription(subId: string, skipDate: string): Promise<void> {
  const token = await getAuthToken();
  const resp = await fetch(`${API_BASE_URL}/subscriptions/${subId}/pause`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ skip_date: skipDate }),
  });
  if (!resp.ok) {
    const err = await resp.json();
    throw new Error(err.error || 'Failed to pause subscription');
  }
}
