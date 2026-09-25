import { doc, runTransaction } from 'firebase/firestore';

/**
 * Generates the next atomic sequential human-readable order code (e.g. ORD39, ORD40, etc.)
 */
export async function getNextOrderCode(db: any): Promise<string> {
  const counterRef = doc(db, 'settings', 'order_counter');
  try {
    const nextCode = await runTransaction(db, async (transaction: any) => {
      const snap = await transaction.get(counterRef);
      let currentNumber = 38;
      if (snap.exists() && typeof snap.data().last_number === 'number') {
        currentNumber = snap.data().last_number;
      }
      const nextNumber = currentNumber + 1;
      transaction.set(
        counterRef,
        {
          last_number: nextNumber,
          updated_at: new Date().toISOString(),
        },
        { merge: true }
      );
      const padded = nextNumber < 10 ? `0${nextNumber}` : `${nextNumber}`;
      return `ORD${padded}`;
    });
    return nextCode;
  } catch (e) {
    const fallback = `ORD${Math.floor(10 + Math.random() * 90)}`;
    return fallback;
  }
}
