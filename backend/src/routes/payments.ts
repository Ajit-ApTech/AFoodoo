import { Router, Request, Response } from 'express';
import { db } from '../firebase';
import { requireAdminRole, AdminRequest } from '../middleware/adminAuth';
import { logger } from '../logger';
import { sendPushNotification, getAdminTokens, getUserPushTokens } from '../utils/pushHelper';
import { PaymentRequest, PaymentRequestStatus } from '../types';

const router = Router();

// Wallet credit mapping for subscription plans
const PLAN_WALLET_CREDITS: Record<string, number> = {
  'Lunch Weekly': 1000,
  'Dinner Weekly': 1200,
  'Lunch & Dinner Weekly': 2200,
  'Lunch Monthly (30 Days)': 4500,
  'Dinner Monthly (30 Days)': 5200,
  'Lunch & Dinner Monthly (30 Days)': 9500,
};

/**
 * POST /api/payments/request
 * Initiated by customer after tapping UPI payment
 */
router.post('/request', async (req: Request, res: Response) => {
  const {
    type,
    user_id,
    user_name,
    user_phone,
    amount,
    order_payload,
    wallet_payload,
    subscription_payload,
  } = req.body;

  if (!type || !user_id || !amount) {
    return res.status(400).json({ error: 'type, user_id, and amount are required.' });
  }

  if (!['order', 'wallet_topup', 'subscription'].includes(type)) {
    return res.status(400).json({ error: 'Invalid payment request type.' });
  }

  if (!db) {
    return res.status(500).json({ error: 'Database service is currently unavailable.' });
  }

  try {
    // 1. Duplicate Prevention: Check for existing active pending request
    const existingSnap = await db
      .collection('payment_requests')
      .where('user_id', '==', user_id)
      .where('type', '==', type)
      .where('status', 'in', ['pending', 'utr_submitted'])
      .limit(5)
      .get();

    if (!existingSnap.empty) {
      // Check if for the same specific item/slot if it is an order
      if (type === 'order' && order_payload?.meal_slot_id) {
        const dup = existingSnap.docs.find(
          d => d.data().order_payload?.meal_slot_id === order_payload.meal_slot_id
        );
        if (dup) {
          return res.status(400).json({
            error: 'You already have a pending payment verification for this meal slot. Please wait for admin approval.',
            existing_request_id: dup.id,
          });
        }
      } else if (type === 'wallet_topup' || type === 'subscription') {
        return res.status(400).json({
          error: 'You already have a pending verification request. Please wait for confirmation.',
          existing_request_id: existingSnap.docs[0].id,
        });
      }
    }

    const now = new Date();
    const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000); // 2 hours auto-expiry

    const newRequest: Partial<PaymentRequest> = {
      type,
      user_id,
      user_name: user_name || 'Customer',
      user_phone: user_phone || '',
      amount: Number(amount),
      status: 'pending',
      order_payload: order_payload || null,
      wallet_payload: wallet_payload || null,
      subscription_payload: subscription_payload || null,
      utr_number: null,
      utr_submitted_at: null,
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
      expires_at: expiresAt.toISOString(),
    };

    const docRef = await db.collection('payment_requests').add(newRequest);

    // 2. Dispatch push notification to all admin devices
    const adminTokens = await getAdminTokens();
    const typeLabel =
      type === 'order'
        ? `Meal Order (${order_payload?.menu_title || 'Tiffin'})`
        : type === 'wallet_topup'
        ? 'Wallet Top-Up'
        : `Subscription (${subscription_payload?.plan_title || 'Plan'})`;

    sendPushNotification(
      adminTokens,
      '💰 New Payment Verification',
      `₹${amount} from ${user_name || 'Customer'} — ${typeLabel}`,
      {
        type: 'new_payment_request',
        paymentRequestId: docRef.id,
        amount: String(amount),
        customerName: user_name || 'Customer',
      }
    );

    res.json({
      success: true,
      payment_request_id: docRef.id,
      message: 'Payment verification request submitted successfully.',
    });
  } catch (e: any) {
    logger.error('Error creating payment request', { error: e.message });
    res.status(500).json({ error: e.message });
  }
});

/**
 * PATCH /api/payments/:id/approve
 * Admin approves payment -> confirms Order / Wallet Topup / Subscription
 */
router.patch('/:id/approve', requireAdminRole(), async (req: AdminRequest, res: Response) => {
  const { id } = req.params;

  if (!db) {
    return res.status(500).json({ error: 'Database service unavailable.' });
  }

  try {
    const docRef = db.collection('payment_requests').doc(id);
    const docSnap = await docRef.get();

    if (!docSnap.exists) {
      return res.status(404).json({ error: 'Payment request not found.' });
    }

    const data = docSnap.data() as PaymentRequest;

    if (data.status === 'approved') {
      return res.status(400).json({ error: 'Payment request is already approved.' });
    }

    const now = new Date();
    let resultOrderId: string | null = null;
    let resultSubId: string | null = null;

    // 1. Process by request type
    if (data.type === 'order') {
      const orderPayload = data.order_payload || {};
      const orderId = `ord_${Date.now()}`;
      resultOrderId = orderId;

      const orderData = {
        id: orderId,
        user_id: data.user_id,
        user_name: data.user_name,
        user_phone: data.user_phone,
        menu_item_id: orderPayload.menu_item_id || 'item_default',
        menu_title: orderPayload.menu_title || 'Tiffin Meal',
        meal_slot_id: orderPayload.meal_slot_id || 'slot_lunch_today',
        slot_name: orderPayload.slot_name || 'Lunch Tiffin',
        delivery_window: orderPayload.delivery_window || '1:00 PM – 2:00 PM',
        delivery_address: orderPayload.delivery_address || {},
        receiver_name: orderPayload.receiver_name || data.user_name,
        receiver_phone: orderPayload.receiver_phone || data.user_phone,
        payment_method: 'upi',
        payment_status: 'paid',
        status: 'booked',
        price: data.amount,
        otp_code: Math.floor(1000 + Math.random() * 9000).toString(),
        notes: orderPayload.notes || '',
        payment_request_id: id,
        utr_number: data.utr_number || 'UPI_VERIFIED',
        created_at: now.toISOString(),
      };

      await db.collection('orders').doc(orderId).set(orderData);

      // Increment quantity_booked if menuItem exists
      if (orderPayload.menu_item_id) {
        try {
          const itemRef = db.collection('menu_items').doc(orderPayload.menu_item_id);
          const itemSnap = await itemRef.get();
          if (itemSnap.exists) {
            const currentBooked = itemSnap.data()?.quantity_booked || 0;
            await itemRef.update({ quantity_booked: currentBooked + 1 });
          }
        } catch (e) {}
      }
    } else if (data.type === 'wallet_topup') {
      // Credit user's wallet
      const userRef = db.collection('users').doc(data.user_id);
      const userSnap = await userRef.get();
      const currentBalance = userSnap.exists ? userSnap.data()?.wallet_balance || 0 : 0;
      const newBalance = currentBalance + data.amount;

      await userRef.set(
        {
          wallet_balance: newBalance,
          updated_at: now.toISOString(),
        },
        { merge: true }
      );

      // Record transaction
      await db.collection('transactions').add({
        user_id: data.user_id,
        amount: data.amount,
        type: 'topup',
        title: `Wallet Top-Up via UPI (+₹${data.amount})`,
        payment_request_id: id,
        utr_number: data.utr_number || 'UPI_VERIFIED',
        timestamp: now.toISOString(),
      });
    } else if (data.type === 'subscription') {
      const subPayload = data.subscription_payload || {};
      const subId = `sub_${Date.now()}`;
      resultSubId = subId;

      const durationDays = subPayload.duration_days || 30;
      const endDate = new Date(Date.now() + durationDays * 86400000);

      const subData = {
        id: subId,
        user_id: data.user_id,
        user_name: data.user_name,
        user_phone: data.user_phone,
        plan_type: subPayload.plan_title || 'Monthly Tiffin',
        meals_remaining: subPayload.meals || 30,
        total_meals: subPayload.meals || 30,
        start_date: now.toISOString(),
        end_date: endDate.toISOString(),
        status: 'ACTIVE',
        is_paused: false,
        paused_dates: [],
        auto_renew: subPayload.auto_renew || false,
        payment_request_id: id,
        utr_number: data.utr_number || 'UPI_VERIFIED',
        created_at: now.toISOString(),
      };

      await db.collection('subscriptions').doc(subId).set(subData);

      // Credit wallet plan bonus strictly upon admin approval
      const bonusCredit =
        subPayload.wallet_credit_bonus ||
        PLAN_WALLET_CREDITS[subPayload.plan_title] ||
        0;

      if (bonusCredit > 0) {
        const userRef = db.collection('users').doc(data.user_id);
        const userSnap = await userRef.get();
        const currentBal = userSnap.exists ? userSnap.data()?.wallet_balance || 0 : 0;

        await userRef.set(
          {
            wallet_balance: currentBal + bonusCredit,
            updated_at: now.toISOString(),
          },
          { merge: true }
        );

        await db.collection('transactions').add({
          user_id: data.user_id,
          amount: bonusCredit,
          type: 'plan_credit',
          title: `Subscription Plan Bonus (+₹${bonusCredit}) [${subPayload.plan_title}]`,
          payment_request_id: id,
          timestamp: now.toISOString(),
        });
      }
    }

    // 2. Update payment_requests document
    await docRef.update({
      status: 'approved',
      approved_by: req.adminUser?.email || 'Admin',
      approved_at: now.toISOString(),
      updated_at: now.toISOString(),
      result_order_id: resultOrderId,
      result_subscription_id: resultSubId,
    });

    // 3. Add Audit Log
    await db.collection('audit_logs').add({
      admin_id: req.adminUser?.uid || 'admin',
      admin_name: req.adminUser?.email || 'Super Admin',
      action_type: 'payment_approval',
      target_id: id,
      details: `Approved ₹${data.amount} for ${data.user_name} (${data.type})`,
      timestamp: now,
    });

    // 4. Send customer high-priority push banner notification
    const customerTokens = await getUserPushTokens(data.user_id);
    const title =
      data.type === 'order'
        ? 'Order Confirmed! 🎉'
        : data.type === 'wallet_topup'
        ? 'Wallet Top-Up Approved! 💳'
        : 'Subscription Activated! 🍱';

    const body =
      data.type === 'order'
        ? `Your order for ₹${data.amount} is confirmed and sent to our kitchen.`
        : data.type === 'wallet_topup'
        ? `₹${data.amount} has been added to your AFoodoo wallet balance.`
        : `Your ${data.subscription_payload?.plan_title || 'Plan'} has been activated.`;

    sendPushNotification(customerTokens, title, body, {
      type: 'payment_approved',
      paymentRequestId: id,
      orderId: resultOrderId,
      subscriptionId: resultSubId,
    });

    res.json({
      success: true,
      message: 'Payment approved successfully.',
      result_order_id: resultOrderId,
      result_subscription_id: resultSubId,
    });
  } catch (e: any) {
    logger.error('Error approving payment', { error: e.message });
    res.status(500).json({ error: e.message });
  }
});

/**
 * PATCH /api/payments/:id/reject
 * Admin marks payment as not found / rejected
 */
router.patch('/:id/reject', requireAdminRole(), async (req: AdminRequest, res: Response) => {
  const { id } = req.params;
  const { reason } = req.body;

  if (!db) {
    return res.status(500).json({ error: 'Database service unavailable.' });
  }

  try {
    const docRef = db.collection('payment_requests').doc(id);
    const docSnap = await docRef.get();

    if (!docSnap.exists) {
      return res.status(404).json({ error: 'Payment request not found.' });
    }

    const data = docSnap.data() as PaymentRequest;
    const now = new Date();
    const rejectReason = reason || 'Payment transaction could not be located in UPI statement.';

    await docRef.update({
      status: 'rejected',
      rejected_by: req.adminUser?.email || 'Admin',
      rejected_at: now.toISOString(),
      reject_reason: rejectReason,
      updated_at: now.toISOString(),
    });

    // Audit log
    await db.collection('audit_logs').add({
      admin_id: req.adminUser?.uid || 'admin',
      admin_name: req.adminUser?.email || 'Super Admin',
      action_type: 'payment_rejection',
      target_id: id,
      details: `Rejected ₹${data.amount} for ${data.user_name}. Reason: ${rejectReason}`,
      timestamp: now,
    });

    // Send push notification to customer prompting for UTR
    const customerTokens = await getUserPushTokens(data.user_id);
    sendPushNotification(
      customerTokens,
      'Payment Verification Needed ⚠️',
      `We could not verify your payment of ₹${data.amount}. Please tap here to enter your 12-digit UPI UTR number.`,
      {
        type: 'payment_rejected',
        paymentRequestId: id,
        amount: String(data.amount),
        reason: rejectReason,
      }
    );

    res.json({
      success: true,
      message: 'Payment request marked as rejected.',
    });
  } catch (e: any) {
    logger.error('Error rejecting payment', { error: e.message });
    res.status(500).json({ error: e.message });
  }
});

/**
 * PATCH /api/payments/:id/utr
 * Customer submits 12-digit UTR number after rejection
 */
router.patch('/:id/utr', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { utr_number } = req.body;

  if (!utr_number || typeof utr_number !== 'string' || !/^\d{12}$/.test(utr_number.trim())) {
    return res.status(400).json({ error: 'Please enter a valid 12-digit numeric UPI UTR number.' });
  }

  if (!db) {
    return res.status(500).json({ error: 'Database service unavailable.' });
  }

  try {
    const docRef = db.collection('payment_requests').doc(id);
    const docSnap = await docRef.get();

    if (!docSnap.exists) {
      return res.status(404).json({ error: 'Payment request not found.' });
    }

    const data = docSnap.data() as PaymentRequest;
    const now = new Date();
    const cleanUtr = utr_number.trim();

    await docRef.update({
      utr_number: cleanUtr,
      utr_submitted_at: now.toISOString(),
      status: 'utr_submitted',
      updated_at: now.toISOString(),
    });

    // Notify admins that UTR has been submitted
    const adminTokens = await getAdminTokens();
    sendPushNotification(
      adminTokens,
      '🔍 UTR Submitted for Payment',
      `${data.user_name} provided UTR ${cleanUtr} for ₹${data.amount}. Please re-verify.`,
      {
        type: 'utr_submitted',
        paymentRequestId: id,
        utr: cleanUtr,
      }
    );

    res.json({
      success: true,
      message: 'UTR number submitted successfully for re-verification.',
    });
  } catch (e: any) {
    logger.error('Error submitting UTR', { error: e.message });
    res.status(500).json({ error: e.message });
  }
});

/**
 * GET /api/payments/pending
 * Admin fetches pending / UTR submitted payment requests
 */
router.get('/pending', requireAdminRole(), async (_req: AdminRequest, res: Response) => {
  if (!db) {
    return res.status(500).json({ error: 'Database service unavailable.' });
  }

  try {
    const snap = await db
      .collection('payment_requests')
      .where('status', 'in', ['pending', 'utr_submitted'])
      .get();

    const requests: PaymentRequest[] = [];
    const now = Date.now();

    for (const doc of snap.docs) {
      const item = { id: doc.id, ...doc.data() } as PaymentRequest;

      // Auto-expire requests older than expires_at if in pending
      if (item.expires_at && item.status === 'pending') {
        const expTime = new Date(item.expires_at).getTime();
        if (expTime < now) {
          await doc.ref.update({ status: 'expired', updated_at: new Date().toISOString() });
          continue;
        }
      }
      requests.push(item);
    }

    // Sort descending by created_at
    requests.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    res.json({ requests });
  } catch (e: any) {
    logger.error('Error fetching pending payments', { error: e.message });
    res.status(500).json({ error: e.message });
  }
});

/**
 * POST /api/payments/register-admin-token
 * Registers an admin device push token into the `admin_tokens` collection
 */
router.post('/register-admin-token', requireAdminRole(), async (req: AdminRequest, res: Response) => {
  const { token } = req.body;
  if (!token || typeof token !== 'string') {
    return res.status(400).json({ error: 'Token string is required.' });
  }

  if (!db) {
    return res.status(500).json({ error: 'Database service unavailable.' });
  }

  try {
    const tokenId = token.replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 64);
    await db.collection('admin_tokens').doc(tokenId).set({
      token: token,
      expo_push_token: token,
      admin_email: req.adminUser?.email || 'admin',
      updated_at: new Date().toISOString(),
    });

    res.json({ success: true, message: 'Admin push token registered.' });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
