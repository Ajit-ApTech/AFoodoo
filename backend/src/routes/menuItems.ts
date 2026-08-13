import { Router, Request, Response, NextFunction } from 'express';
import { firestore } from '../firebase';
import { body, query, validationResult } from 'express-validator';
import admin from 'firebase-admin';
import { MenuItem } from '../types';

const router = Router();

// GET menu items for a specific slot and date (existing behavior)
router.get(
  '/',
  [
    query('slotId').isString(),
    query('date').isISO8601(),
  ],
  async (req: Request, res: Response, next: NextFunction) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const { slotId, date } = req.query as { slotId: string; date: string };
    try {
      const snap = await firestore
        .collection('menu_items')
        .where('meal_slot_id', '==', slotId)
        .where('date', '==', admin.firestore.Timestamp.fromDate(new Date(date)))
        .get();
      const items = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      res.json(items);
    } catch (err) {
      next(err);
    }
  }
);

// GET single menu item by ID
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const doc = await firestore.collection('menu_items').doc(req.params.id).get();
    if (!doc.exists) return res.status(404).json({ error: 'Menu item not found' });
    res.json({ id: doc.id, ...doc.data() });
  } catch (err) {
    next(err);
  }
});

// POST create a new menu item
router.post(
  '/',
  [
    body('meal_slot_id').isString(),
    body('date').isISO8601(),
    body('title').isString(),
    body('description').optional().isString(),
    body('image_url').optional().isString(),
    body('veg_flag').isBoolean(),
    body('price').isNumeric(),
    body('is_available').isBoolean(),
    body('max_quantity').isInt({ min: 1 }),
    body('quantity_booked').optional().isInt({ min: 0 }),
  ],
  async (req: Request, res: Response, next: NextFunction) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const {
      meal_slot_id,
      date,
      title,
      description = '',
      image_url = '',
      veg_flag,
      price,
      is_available,
      max_quantity,
      quantity_booked = 0,
    } = req.body;
    try {
      const ref = firestore.collection('menu_items').doc();
      const data: Partial<MenuItem> = {
        meal_slot_id,
        date: admin.firestore.Timestamp.fromDate(new Date(date)),
        title,
        description,
        image_url,
        veg_flag,
        price,
        is_available,
        max_quantity,
        quantity_booked,
      };
      await ref.set(data);
      res.status(201).json({ id: ref.id, ...data });
    } catch (err) {
      next(err);
    }
  }
);

// PATCH update an existing menu item
router.patch(
  '/:id',
  [
    body('meal_slot_id').optional().isString(),
    body('date').optional().isISO8601(),
    body('title').optional().isString(),
    body('description').optional().isString(),
    body('image_url').optional().isString(),
    body('veg_flag').optional().isBoolean(),
    body('price').optional().isNumeric(),
    body('is_available').optional().isBoolean(),
    body('max_quantity').optional().isInt({ min: 1 }),
    body('quantity_booked').optional().isInt({ min: 0 }),
  ],
  async (req: Request, res: Response, next: NextFunction) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const updates: any = { ...req.body };
    if (updates.date) {
      updates.date = admin.firestore.Timestamp.fromDate(new Date(updates.date));
    }
    try {
      const ref = firestore.collection('menu_items').doc(req.params.id);
      await ref.update(updates);
      const snap = await ref.get();
      res.json({ id: snap.id, ...snap.data() });
    } catch (err) {
      next(err);
    }
  }
);

// DELETE a menu item
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await firestore.collection('menu_items').doc(req.params.id).delete();
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

export default router;
