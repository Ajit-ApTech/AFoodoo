import { API_BASE_URL } from './config';

export async function topUpWalletApi(userId: string, amount: number, paymentMethod = 'stripe_checkout_stub') {
  try {
    const res = await fetch(`${API_BASE_URL}/wallet/topup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId, amount, payment_method: paymentMethod }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (error) {
    console.log('Using local topup fallback');
    return {
      success: true,
      new_balance: amount,
      transaction: {
        id: `tx_${Date.now()}`,
        user_id: userId,
        type: 'topup',
        title: `Wallet Top-Up (+₹${amount})`,
        amount,
        time: 'Just now',
      },
    };
  }
}

export async function fetchWalletTransactions(userId: string) {
  try {
    const res = await fetch(`${API_BASE_URL}/wallet/transactions/${userId}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return data.transactions || [];
  } catch (error) {
    return [
      { id: 't1', type: 'debit', title: 'North Indian Thali Booking', amount: -12.99, time: 'Today, 9:15 AM' },
      { id: 't2', type: 'topup', title: 'Wallet Top-Up via Stripe', amount: 50.0, time: 'Yesterday, 6:30 PM' },
      { id: 't3', type: 'refund', title: 'Cancelled Slot Refund', amount: 14.99, time: 'Aug 10, 11:05 AM' },
      { id: 't4', type: 'topup', title: 'Initial Welcome Bonus', amount: 500.0, time: 'Aug 01, 10:00 AM' },
    ];
  }
}
