import { Router, Request, Response, NextFunction } from 'express';
import { body, validationResult } from 'express-validator';
import { firestore } from '../firebase';

const router = Router();

// In-memory transactions fallback storage
const localTransactions: Record<string, any[]> = {
  'guest-user-456': [
    { id: 'tx_101', type: 'topup', title: 'Wallet Top-Up via Stripe', amount: 50.0, time: 'Yesterday, 6:30 PM' },
    { id: 'tx_102', type: 'debit', title: 'North Indian Thali Booking', amount: -12.99, time: 'Aug 10, 11:05 AM' },
    { id: 'tx_103', type: 'topup', title: 'Initial Welcome Bonus', amount: 300.0, time: 'Aug 01, 10:00 AM' },
  ],
};

// POST /api/wallet/topup - Top up user wallet balance
router.post(
  '/topup',
  [
    body('user_id').isString().notEmpty().withMessage('user_id is required'),
    body('amount').isNumeric().custom(val => val > 0).withMessage('amount must be greater than 0'),
    body('payment_method').optional().isString(),
  ],
  async (req: Request, res: Response, next: NextFunction) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { user_id, amount, payment_method = 'stripe_checkout_stub' } = req.body;

    try {
      let newBalance = 500 + amount;

      // Try updating in Firestore
      try {
        const userRef = firestore.collection('users').doc(user_id);
        const snap = await userRef.get();
        if (snap.exists) {
          const currentBalance = snap.data()?.wallet_balance || 0;
          newBalance = currentBalance + Number(amount);
          await userRef.update({ wallet_balance: newBalance });
        }
      } catch (e) {
        // Fallback for memory mode
      }

      const newTx = {
        id: `tx_${Date.now()}`,
        user_id,
        type: 'topup',
        title: `Wallet Top-Up (+₹${amount})`,
        amount: Number(amount),
        payment_method,
        status: 'completed',
        time: 'Just now',
        created_at: new Date().toISOString(),
      };

      if (!localTransactions[user_id]) {
        localTransactions[user_id] = [];
      }
      localTransactions[user_id].unshift(newTx);

      res.status(200).json({
        success: true,
        message: `Successfully topped up ₹${amount}`,
        new_balance: newBalance,
        transaction: newTx,
      });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/wallet/transactions/:userId - Retrieve wallet transaction history
router.get('/transactions/:userId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.params.userId;
    const history = localTransactions[userId] || localTransactions['guest-user-456'] || [];
    res.json({
      user_id: userId,
      transactions: history,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
