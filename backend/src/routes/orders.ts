import { Router, Request, Response, NextFunction } from 'express';
import { firestore, fcm } from '../firebase';
import admin from 'firebase-admin';
import { body, validationResult } from 'express-validator';
import dayjs from 'dayjs';

const router = Router();

// POST /api/orders – place a new order
router.post(
  '/',
  [
    body('user_id').isString(),
    body('menu_item_id').isString(),
    body('meal_slot_id').isString(),
    body('delivery_address').isObject(),
  ],
  async (req: Request, res: Response, next: NextFunction) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const { user_id, menu_item_id, meal_slot_id, delivery_address } = req.body;
    try {
      // Load meal slot to check cutoff on server time
      const slotDoc = await firestore.collection('meal_slots').doc(meal_slot_id).get();
      if (!slotDoc.exists) {
        return res.status(404).json({ error: 'Meal slot not found' });
      }
      const slotData = slotDoc.data() as any;
      const now = dayjs();
      const cutoff = dayjs(slotData.booking_cutoff_time.toDate());
      if (!now.isBefore(cutoff)) {
        return res.status(400).json({ error: 'Booking cutoff time has passed' });
      }

      // Firestore transaction to ensure atomic quantity update
      const orderRef = firestore.collection('orders').doc();
      await firestore.runTransaction(async transaction => {
        const menuItemRef = firestore.collection('menu_items').doc(menu_item_id);
        const menuItemSnap = await transaction.get(menuItemRef);
        if (!menuItemSnap.exists) {
          throw new Error('Menu item not found');
        }
        const menuItem = menuItemSnap.data() as any;
        if (!menuItem.is_available) {
          throw new Error('Menu item not available');
        }
        if (menuItem.quantity_booked >= menuItem.max_quantity) {
          throw new Error('Menu item sold out');
        }
        // Increment quantity_booked
        transaction.update(menuItemRef, {
          quantity_booked: admin.firestore.FieldValue.increment(1),
        });
        // Create order document
        // orderRef defined outside transaction
        const orderData = {
          user_id,
          menu_item_id,
          meal_slot_id,
          status: 'booked',
          delivery_address,
          payment_status: 'pending',
          created_at: admin.firestore.Timestamp.now(),
        };
        transaction.set(orderRef, orderData);
        // Send notification to user
        const payload = {
          notification: {
            title: 'Order Confirmed',
            body: `Your order for ${menuItem.title} is confirmed.`,
          },
        };
        // Assume device token stored under users/<uid>/deviceTokens collection
        const tokenSnap = await firestore
          .collection('users')
          .doc(user_id)
          .collection('deviceTokens')
          .get();
        const tokens = tokenSnap.docs.map(d => d.id);
        if (tokens.length > 0) {
          await fcm.sendToDevice(tokens, payload);
        }
      });
      res.status(201).json({ orderId: orderRef.id, message: 'Order placed successfully' });
    } catch (err: any) {
      next(err);
    }
  }
);

// PATCH /api/orders/:id/status – update order status (e.g., preparing, out_for_delivery, delivered)
router.patch(
  '/:id/status',
  [
    body('status').isIn(['booked', 'preparing', 'out_for_delivery', 'delivered', 'cancelled']),
  ],
  async (req: Request, res: Response, next: NextFunction) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const { id } = req.params;
    const { status } = req.body;
    try {
      const orderRef = firestore.collection('orders').doc(id);
      await orderRef.update({ status });
      const snap = await orderRef.get();
      res.json({ id: snap.id, ...snap.data() });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/orders/:id/pay – placeholder for payment handling (updates payment_status)
router.post(
  '/:id/pay',
  [
    body('payment_status').isIn(['paid', 'pending', 'failed']),
  ],
  async (req: Request, res: Response, next: NextFunction) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const { id } = req.params;
    const { payment_status } = req.body;
    try {
      const orderRef = firestore.collection('orders').doc(id);
      await orderRef.update({ payment_status });
      const snap = await orderRef.get();
      res.json({ id: snap.id, ...snap.data() });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
