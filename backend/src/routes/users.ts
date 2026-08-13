import { Router, Request, Response, NextFunction } from 'express';
import { firestore } from '../firebase';
import { body, validationResult } from 'express-validator';
import admin from 'firebase-admin';
import { User } from '../types';

const router = Router();

// GET all users
router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const snap = await firestore.collection('users').get();
    const users = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json(users);
  } catch (err) {
    next(err);
  }
});

// GET single user by ID
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const doc = await firestore.collection('users').doc(req.params.id).get();
    if (!doc.exists) return res.status(404).json({ error: 'User not found' });
    res.json({ id: doc.id, ...doc.data() });
  } catch (err) {
    next(err);
  }
});

// POST create a new user
router.post(
  '/',
  [
    body('name').isString(),
    body('phone').isString(),
    body('addresses').optional().isArray(),
    body('wallet_balance').optional().isNumeric(),
    body('subscription_ids').optional().isArray(),
  ],
  async (req: Request, res: Response, next: NextFunction) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const { name, phone, addresses = [], wallet_balance = 0, subscription_ids = [] } = req.body;
    try {
      const userRef = firestore.collection('users').doc();
      const data: Partial<User> = {
        name,
        phone,
        addresses,
        wallet_balance,
        subscription_ids,
        created_at: admin.firestore.Timestamp.now(),
      };
      await userRef.set(data);
      res.status(201).json({ id: userRef.id, ...data });
    } catch (err) {
      next(err);
    }
  }
);

// PATCH update an existing user
router.patch(
  '/:id',
  [
    body('name').optional().isString(),
    body('phone').optional().isString(),
    body('addresses').optional().isArray(),
    body('wallet_balance').optional().isNumeric(),
    body('subscription_ids').optional().isArray(),
  ],
  async (req: Request, res: Response, next: NextFunction) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    try {
      const userRef = firestore.collection('users').doc(req.params.id);
      await userRef.update(req.body);
      const snap = await userRef.get();
      res.json({ id: snap.id, ...snap.data() });
    } catch (err) {
      next(err);
    }
  }
);

// DELETE a user
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await firestore.collection('users').doc(req.params.id).delete();
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

export default router;
