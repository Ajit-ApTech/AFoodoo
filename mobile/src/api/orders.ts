import { API_BASE_URL } from './config';

function getLazyAuthToken(): Promise<string> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { getAuth } = require('firebase/auth');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { app } = require('../firebaseConfig');
    const currentUser = getAuth(app).currentUser;
    return currentUser ? currentUser.getIdToken() : Promise.resolve('');
  } catch {
    return Promise.resolve('');
  }
}

/**
 * Places a new order via the backend API.
 * Returns the created orderId on success.
 */
export async function placeOrder({ userId, menuItemId, slotId, address }: {
  userId: string;
  menuItemId: string;
  slotId: string;
  address: any;
}) {
  const token = await getLazyAuthToken();
  const resp = await fetch(`${API_BASE_URL}/orders`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      user_id: userId,
      menu_item_id: menuItemId,
      meal_slot_id: slotId,
      delivery_address: address,
    }),
  });
  if (!resp.ok) {
    const err = await resp.json();
    throw new Error(err.error || 'Order placement failed');
  }
  const data = await resp.json();
  return data.orderId as string;
}

/**
 * Pay (or update payment status) for an existing order.
 * `status` should be one of 'paid', 'pending', 'failed'.
 */
export async function payOrder(orderId: string, status: 'paid' | 'pending' | 'failed'): Promise<any> {
  const token = await getLazyAuthToken();
  const resp = await fetch(`${API_BASE_URL}/orders/${orderId}/pay`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ payment_status: status }),
  });
  if (!resp.ok) {
    const err = await resp.json();
    throw new Error(err.error || 'Payment update failed');
  }
  return await resp.json();
}
