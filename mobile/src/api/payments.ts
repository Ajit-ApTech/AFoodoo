import { API_BASE_URL } from './config';
import { firestore } from '../firebaseConfig';

export interface SubmitPaymentRequestParams {
  type: 'order' | 'wallet_topup' | 'subscription';
  userId: string;
  userName: string;
  userPhone: string;
  amount: number;
  orderPayload?: any;
  walletPayload?: any;
  subscriptionPayload?: any;
}

/**
 * Submit a two-stage payment verification request
 */
export async function submitPaymentRequest(params: SubmitPaymentRequestParams): Promise<{
  success: boolean;
  payment_request_id: string;
  message?: string;
}> {
  // 1. Try Backend API endpoint first
  try {
    const res = await fetch(`${API_BASE_URL}/payments/request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: params.type,
        user_id: params.userId,
        user_name: params.userName,
        user_phone: params.userPhone,
        amount: params.amount,
        order_payload: params.orderPayload || null,
        wallet_payload: params.walletPayload || null,
        subscription_payload: params.subscriptionPayload || null,
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Failed to submit payment request.');
    }
    return data;
  } catch (apiError: any) {
    // 2. Client-side fallback to direct Firestore document creation if backend unreachable
    try {
      const { collection, addDoc } = require('firebase/firestore');
      const now = new Date();
      const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000);

      const docRef = await addDoc(collection(firestore, 'payment_requests'), {
        type: params.type,
        user_id: params.userId,
        user_name: params.userName,
        user_phone: params.userPhone,
        amount: params.amount,
        status: 'pending',
        order_payload: params.orderPayload || null,
        wallet_payload: params.walletPayload || null,
        subscription_payload: params.subscriptionPayload || null,
        utr_number: null,
        utr_submitted_at: null,
        created_at: now.toISOString(),
        updated_at: now.toISOString(),
        expires_at: expiresAt.toISOString(),
      });

      return {
        success: true,
        payment_request_id: docRef.id,
        message: 'Payment verification request created in Firestore.',
      };
    } catch (fsErr: any) {
      throw new Error(apiError.message || fsErr.message || 'Unable to submit payment request.');
    }
  }
}

/**
 * Submit 12-digit UTR number for a rejected payment request
 */
export async function submitUtrNumber(paymentRequestId: string, utrNumber: string): Promise<void> {
  const cleanUtr = utrNumber.trim();
  if (!cleanUtr || cleanUtr.length !== 12) {
    throw new Error('Please provide a valid 12-digit UPI UTR / Transaction Reference Number.');
  }

  // 1. Try Backend API
  try {
    const res = await fetch(`${API_BASE_URL}/payments/${paymentRequestId}/utr`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ utr_number: cleanUtr }),
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || 'Failed to submit UTR.');
    }
  } catch (apiErr: any) {
    // 2. Direct Firestore fallback
    try {
      const { doc, updateDoc } = require('firebase/firestore');
      await updateDoc(doc(firestore, 'payment_requests', paymentRequestId), {
        utr_number: cleanUtr,
        utr_submitted_at: new Date().toISOString(),
        status: 'utr_submitted',
        updated_at: new Date().toISOString(),
      });
    } catch (fsErr: any) {
      throw new Error(apiErr.message || fsErr.message || 'Unable to update UTR.');
    }
  }
}

/**
 * Listen for real-time changes to a specific payment request
 */
export function subscribeToPaymentRequest(
  paymentRequestId: string,
  onUpdate: (data: any) => void
): () => void {
  try {
    const { doc, onSnapshot } = require('firebase/firestore');
    const unsub = onSnapshot(doc(firestore, 'payment_requests', paymentRequestId), (snap: any) => {
      if (snap.exists()) {
        onUpdate({ id: snap.id, ...snap.data() });
      }
    });
    return unsub;
  } catch (e) {
    return () => {};
  }
}
