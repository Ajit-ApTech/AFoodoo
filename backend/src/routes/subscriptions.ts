import { Router, Request, Response, NextFunction } from 'express';
import { firestore } from '../firebase';
import { body, validationResult } from 'express-validator';
import admin from 'firebase-admin';
import { Subscription } from '../types';

const router = Router();

// GET all subscriptions (optionally filter by userId)
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId } = req.query as { userId?: string };
    const baseRef = firestore.collection('subscriptions');
    const snap = userId ? await baseRef.where('user_id', '==', userId).get() : await baseRef.get();
    const subs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json(subs);
  } catch (err) {
    next(err);
  }
});

// GET a single subscription by ID
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const doc = await firestore.collection('subscriptions').doc(req.params.id).get();
    if (!doc.exists) return res.status(404).json({ error: 'Subscription not found' });
    res.json({ id: doc.id, ...doc.data() });
  } catch (err) {
    next(err);
  }
});

// POST create a new subscription
router.post(
  '/',
  [
    body('user_id').isString(),
    body('plan_type').isString(),
    body('meals_remaining').isInt({ min: 0 }),
    body('start_date').isISO8601(),
    body('end_date').isISO8601(),
    body('auto_renew').optional().isBoolean(),
  ],
  async (req: Request, res: Response, next: NextFunction) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const { user_id, plan_type, meals_remaining, start_date, end_date, auto_renew = false } = req.body;
    try {
      const ref = firestore.collection('subscriptions').doc();
      const data: Partial<Subscription> = {
        user_id,
        plan_type,
        meals_remaining,
        start_date: admin.firestore.Timestamp.fromDate(new Date(start_date)),
        end_date: admin.firestore.Timestamp.fromDate(new Date(end_date)),
        auto_renew,
      };
      await ref.set(data);
      res.status(201).json({ id: ref.id, ...data });
    } catch (err) {
      next(err);
    }
  }
);

// PATCH update an existing subscription
router.patch(
  '/:id',
  [
    body('plan_type').optional().isString(),
    body('meals_remaining').optional().isInt({ min: 0 }),
    body('start_date').optional().isISO8601(),
    body('end_date').optional().isISO8601(),
    body('auto_renew').optional().isBoolean(),
  ],
  async (req: Request, res: Response, next: NextFunction) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const updates: any = { ...req.body };
    if (updates.start_date) updates.start_date = admin.firestore.Timestamp.fromDate(new Date(updates.start_date));
    if (updates.end_date) updates.end_date = admin.firestore.Timestamp.fromDate(new Date(updates.end_date));
    try {
      const ref = firestore.collection('subscriptions').doc(req.params.id);
      await ref.update(updates);
      const snap = await ref.get();
      res.json({ id: snap.id, ...snap.data() });
    } catch (err) {
      next(err);
    }
  }
);

// DELETE a subscription
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await firestore.collection('subscriptions').doc(req.params.id).delete();
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// PATCH pause/skip a subscription – existing endpoint (kept unchanged)
router.patch(
  '/:id/pause',
  [body('skip_date').isISO8601()],
  async (req: Request, res: Response, next: NextFunction) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const subId = req.params.id;
    const { skip_date } = req.body;
    try {
      const subRef = firestore.collection('subscriptions').doc(subId);
      await firestore.runTransaction(async transaction => {
        const subSnap = await transaction.get(subRef);
        if (!subSnap.exists) throw new Error('Subscription not found');
        const newRemaining = admin.firestore.FieldValue.increment(-1);
        transaction.update(subRef, { meals_remaining: newRemaining });
        const skipRef = subRef.collection('skips').doc();
        transaction.set(skipRef, { date: admin.firestore.Timestamp.fromDate(new Date(skip_date)) });
      });
      res.json({ message: 'Subscription paused/skipped for the given date' });
    } catch (err) {
      next(err);
    }
  }
);

import dayjs from 'dayjs';
import { sendPushNotification } from '../utils/pushHelper';
import { logger } from '../logger';

/**
 * Auto-book meals for all active subscriptions whose meal slot is currently OPEN for booking.
 * Can be triggered via background timer or HTTP POST /api/subscriptions/auto-book.
 */
export async function autoBookActiveSubscriptions(): Promise<{
  success: boolean;
  bookedCount: number;
  openSlots: string[];
  details: string[];
}> {
  const details: string[] = [];
  let bookedCount = 0;
  const now = dayjs();
  const todayStr = now.format('YYYY-MM-DD');

  // Helper to parse slot times (e.g., "07:00 AM", "11:59 AM", "01:00 PM", "07:30 PM", or ISO strings)
  const parseTimeToDayjs = (timeVal: any): dayjs.Dayjs | null => {
    if (!timeVal) return null;
    if (timeVal instanceof Date) return dayjs(timeVal);
    if (timeVal?.toDate) return dayjs(timeVal.toDate());
    if (typeof timeVal === 'string') {
      const match = timeVal.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
      if (match) {
        let hours = parseInt(match[1], 10);
        const minutes = parseInt(match[2], 10);
        const ampm = match[3].toUpperCase();
        if (ampm === 'PM' && hours < 12) hours += 12;
        if (ampm === 'AM' && hours === 12) hours = 0;
        return dayjs().set('hour', hours).set('minute', minutes).set('second', 0);
      }
      const parsed = dayjs(timeVal);
      if (parsed.isValid()) return parsed;
    }
    return null;
  };

  // Helper: check if a meal slot is open right now
  const isSlotCurrentlyOpen = (slot: any): boolean => {
    if (!slot || slot.active === false) return false;
    const openStr = slot.booking_open_time || '05:00 AM';
    const cutoffStr = slot.booking_cutoff_time || '11:59 AM';

    let openDayjs = parseTimeToDayjs(openStr);
    let cutoffDayjs = parseTimeToDayjs(cutoffStr);

    if (openDayjs && cutoffDayjs && cutoffDayjs.isBefore(openDayjs)) {
      if (now.isBefore(cutoffDayjs)) {
        openDayjs = openDayjs.subtract(1, 'day');
      } else {
        cutoffDayjs = cutoffDayjs.add(1, 'day');
      }
    }

    if (!openDayjs || !cutoffDayjs) return false;
    return !now.isBefore(openDayjs) && now.isBefore(cutoffDayjs);
  };

  // Helper: match subscription plan to slot
  const doesSubMatchSlot = (sub: any, slot: any): boolean => {
    const planStr = `${sub.plan_type || ''} ${sub.plan_title || ''} ${sub.plan_id || ''}`.toLowerCase();
    const slotStr = `${slot.name || ''} ${slot.title || ''}`.toLowerCase();

    if (planStr.includes('combo') || planStr.includes('lunch + dinner') || planStr.includes('lunch and dinner')) {
      return slotStr.includes('lunch') || slotStr.includes('dinner');
    }
    if (planStr.includes('lunch')) {
      return slotStr.includes('lunch');
    }
    if (planStr.includes('dinner')) {
      return slotStr.includes('dinner');
    }
    return true;
  };

  try {
    const slotsSnap = await firestore.collection('meal_slots').get();
    const allSlots = slotsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const openSlots = allSlots.filter(s => isSlotCurrentlyOpen(s));

    if (openSlots.length === 0) {
      return {
        success: true,
        bookedCount: 0,
        openSlots: [],
        details: ['No meal slots are currently open for booking.'],
      };
    }

    const openSlotNames = openSlots.map((s: any) => s.name || s.id);
    const subsSnap = await firestore.collection('subscriptions').where('status', '==', 'active').get();

    if (subsSnap.empty) {
      return {
        success: true,
        bookedCount: 0,
        openSlots: openSlotNames,
        details: ['No active subscriptions found.'],
      };
    }

    for (const subDoc of subsSnap.docs) {
      const sub = { id: subDoc.id, ...subDoc.data() } as any;

      if (sub.is_paused || sub.status === 'PAUSED') continue;
      if (Array.isArray(sub.paused_dates) && sub.paused_dates.includes(todayStr)) continue;
      if (typeof sub.meals_remaining === 'number' && sub.meals_remaining <= 0) continue;
      if (sub.end_date && now.isAfter(dayjs(sub.end_date), 'day')) continue;

      const userId = sub.user_id;
      if (!userId) continue;

      const userRef = firestore.collection('users').doc(userId);
      const userSnap = await userRef.get();
      const userData = userSnap.exists ? userSnap.data() : null;

      for (const slot of openSlots as any[]) {
        if (!doesSubMatchSlot(sub, slot)) continue;

        const isCombo = `${sub.plan_type || ''} ${sub.plan_title || ''}`.toLowerCase().includes('combo');
        const bookedForSlotToday = sub.last_auto_booked_slots?.[slot.id] === todayStr;
        const alreadyBookedSingle = !isCombo && sub.last_auto_booked_date === todayStr;

        if (bookedForSlotToday || alreadyBookedSingle) {
          continue;
        }

        const codeNum = Math.floor(1000 + Math.random() * 9000);
        const orderCode = `AF-${codeNum}`;

        let selectedDailyDish = sub.daily_menu?.[todayStr];
        let dishName = `${slot.name || 'Tiffin'} Daily Meal`;
        let mealPrice = 150;

        if (selectedDailyDish && (selectedDailyDish.name || selectedDailyDish.title)) {
          dishName = selectedDailyDish.name || selectedDailyDish.title;
          mealPrice = Number(selectedDailyDish.price) || 150;
        } else {
          try {
            const menuSnap = await firestore
              .collection('menu_items')
              .where('meal_slot_id', '==', slot.id)
              .limit(1)
              .get();
            if (!menuSnap.empty) {
              const mData: any = menuSnap.docs[0].data();
              dishName = mData.title || mData.name || dishName;
              mealPrice = Number(mData.price) || mealPrice;
            }
          } catch (mErr) {}
        }

        const userPhone = sub.user_phone || userData?.phone || '';
        const savedAddress = userData?.addresses?.[0] || sub.delivery_address || null;
        if (!savedAddress || !savedAddress.line1 || savedAddress.line1.trim() === '') {
          details.push(`Skipped sub ${sub.id}: No saved delivery address found on customer account.`);
          continue;
        }

        const deliveryLat = savedAddress.latitude ?? null;
        const deliveryLng = savedAddress.longitude ?? null;
        const mapsLink =
          deliveryLat && deliveryLng
            ? `https://www.google.com/maps/search/?api=1&query=${deliveryLat},${deliveryLng}`
            : null;
        const otpCode = Math.floor(1000 + Math.random() * 9000).toString();

        const orderData = {
          order_code: orderCode,
          user_id: userId,
          user_name: sub.user_name || userData?.name || 'Customer',
          customer_name: sub.user_name || userData?.name || 'Customer',
          user_phone: userPhone,
          customer_phone: userPhone,
          delivery_name: savedAddress.receiver_name || sub.user_name || userData?.name || 'Customer',
          delivery_phone: savedAddress.receiver_phone || userPhone,
          delivery_address: {
            label: savedAddress.label || 'Home',
            receiver_name: savedAddress.receiver_name || sub.user_name || userData?.name || 'Customer',
            receiver_phone: savedAddress.receiver_phone || userPhone,
            line1: savedAddress.line1.trim(),
            landmark: savedAddress.landmark || '',
            city: savedAddress.city || '',
            zip: savedAddress.zip || '',
            latitude: deliveryLat,
            longitude: deliveryLng,
          },
          delivery_lat: deliveryLat,
          delivery_lng: deliveryLng,
          delivery_distance_km: savedAddress.distance_km ?? null,
          maps_link: mapsLink,
          otp_code: otpCode,
          menu_title: dishName,
          items: [
            {
              id: 'dish_sub_auto',
              title: dishName,
              name: dishName,
              price: mealPrice,
              quantity: 1,
            },
          ],
          total_amount: mealPrice,
          subtotal: mealPrice,
          delivery_fee: 0,
          platform_fee: 0,
          discount: 0,
          payment_method: 'wallet',
          payment_status: 'paid',
          status: 'booked',
          order_type: 'subscription_auto',
          subscription_id: sub.id,
          booking_date: todayStr,
          slot_name: slot.name || 'Daily Meal',
          created_at: new Date().toISOString(),
          timestamp: new Date().toISOString(),
        };

        const newOrderRef = await firestore.collection('orders').add(orderData);

        if (mealPrice > 0 && userSnap.exists) {
          try {
            await userRef.update({
              wallet_balance: admin.firestore.FieldValue.increment(-mealPrice),
              updated_at: new Date().toISOString(),
            });
            await firestore.collection('wallet_transactions').add({
              user_id: userId,
              user_phone: userPhone,
              title: `Daily Meal: ${dishName}`,
              description: `Auto-booked for ${slot.name} (${orderCode})`,
              amount: mealPrice,
              type: 'debit',
              timestamp: new Date().toISOString(),
              created_at: new Date().toISOString(),
            });
          } catch (wErr) {
            logger.warn('Error adjusting wallet for auto-booking:', { error: (wErr as any)?.message });
          }
        }

        const updatedBookedSlots = { ...(sub.last_auto_booked_slots || {}), [slot.id]: todayStr };
        await firestore.collection('subscriptions').doc(sub.id).update({
          meals_remaining: admin.firestore.FieldValue.increment(-1),
          last_auto_booked_date: todayStr,
          last_auto_booked_slots: updatedBookedSlots,
          updated_at: new Date().toISOString(),
        });

        const pushTokens: string[] = [];
        if (userData?.expo_push_token) pushTokens.push(userData.expo_push_token);
        if (userData?.fcm_token) pushTokens.push(userData.fcm_token);

        if (pushTokens.length > 0) {
          sendPushNotification(
            pushTokens,
            '🍱 Daily Tiffin Auto-Booked!',
            `Your ${slot.name || 'tiffin'} meal (${dishName}) for today has been booked and scheduled with the kitchen!`,
            { orderId: newOrderRef.id, type: 'ORDER_UPDATE' }
          ).catch(() => {});
        }

        bookedCount++;
        details.push(`Auto-booked ${slot.name} for sub ${sub.id} (user: ${userId}, order: ${orderCode})`);
      }
    }

    return {
      success: true,
      bookedCount,
      openSlots: openSlotNames,
      details,
    };
  } catch (error: any) {
    logger.error('Error in autoBookActiveSubscriptions:', { error: error?.message });
    return {
      success: false,
      bookedCount,
      openSlots: [],
      details: [error?.message || 'Unknown error occurred'],
    };
  }
}

// POST /api/subscriptions/auto-book – Trigger automated daily meal booking for currently open meal slots
router.post('/auto-book', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await autoBookActiveSubscriptions();
    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
