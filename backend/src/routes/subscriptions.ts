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

export default router;
