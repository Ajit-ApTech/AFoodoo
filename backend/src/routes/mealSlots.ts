import { Router, Request, Response, NextFunction } from 'express';
import { firestore } from '../firebase';
import { body, validationResult } from 'express-validator';
import admin from 'firebase-admin';
import { MealSlot } from '../types';

const router = Router();

// GET all meal slots
router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const snap = await firestore.collection('meal_slots').get();
    const slots = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json(slots);
  } catch (err) {
    next(err);
  }
});

// GET active slots (kept for backwards compatibility)
router.get('/active', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const snap = await firestore.collection('meal_slots').where('active', '==', true).get();
    const slots = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json(slots);
  } catch (err) {
    next(err);
  }
});

// GET single meal slot by ID
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const doc = await firestore.collection('meal_slots').doc(req.params.id).get();
    if (!doc.exists) return res.status(404).json({ error: 'Meal slot not found' });
    res.json({ id: doc.id, ...doc.data() });
  } catch (err) {
    next(err);
  }
});

// POST create a new meal slot
router.post(
  '/',
  [
    body('name').isString(),
    body('booking_open_time').isISO8601(),
    body('booking_cutoff_time').isISO8601(),
    body('delivery_start_time').isISO8601(),
    body('delivery_end_time').isISO8601(),
    body('active').optional().isBoolean(),
  ],
  async (req: Request, res: Response, next: NextFunction) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const {
      name,
      booking_open_time,
      booking_cutoff_time,
      delivery_start_time,
      delivery_end_time,
      active = false,
    } = req.body;
    try {
      const ref = firestore.collection('meal_slots').doc();
      const data: Partial<MealSlot> = {
        name,
        booking_open_time: admin.firestore.Timestamp.fromDate(new Date(booking_open_time)),
        booking_cutoff_time: admin.firestore.Timestamp.fromDate(new Date(booking_cutoff_time)),
        delivery_start_time: admin.firestore.Timestamp.fromDate(new Date(delivery_start_time)),
        delivery_end_time: admin.firestore.Timestamp.fromDate(new Date(delivery_end_time)),
        active,
      };
      await ref.set(data);
      res.status(201).json({ id: ref.id, ...data });
    } catch (err) {
      next(err);
    }
  }
);

// PATCH update an existing meal slot
router.patch(
  '/:id',
  [
    body('name').optional().isString(),
    body('booking_open_time').optional().isISO8601(),
    body('booking_cutoff_time').optional().isISO8601(),
    body('delivery_start_time').optional().isISO8601(),
    body('delivery_end_time').optional().isISO8601(),
    body('active').optional().isBoolean(),
  ],
  async (req: Request, res: Response, next: NextFunction) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const updates: any = {};
    const fields = [
      'name',
      'booking_open_time',
      'booking_cutoff_time',
      'delivery_start_time',
      'delivery_end_time',
      'active',
    ];
    for (const f of fields) {
      if (req.body[f] !== undefined) {
        if (f.endsWith('_time')) {
          updates[f] = admin.firestore.Timestamp.fromDate(new Date(req.body[f]));
        } else {
          updates[f] = req.body[f];
        }
      }
    }
    try {
      const ref = firestore.collection('meal_slots').doc(req.params.id);
      await ref.update(updates);
      const snap = await ref.get();
      res.json({ id: snap.id, ...snap.data() });
    } catch (err) {
      next(err);
    }
  }
);

// DELETE a meal slot
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await firestore.collection('meal_slots').doc(req.params.id).delete();
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

export default router;
