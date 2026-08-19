import { doc, getDoc, setDoc, updateDoc, increment, addDoc, collection } from 'firebase/firestore';
import { firestore } from '../firebaseConfig';

const API_KEY = 'AIzaSyC57TfyLD_-0PqJa1_rLiX49sSIMJ3XNI4';
const PROJECT_ID = 'afoodoo';
const BASE_URL = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

export function unwrapFirestoreDoc(docObj: any) {
  if (!docObj) return null;
  const id = docObj.name ? docObj.name.split('/').pop() : '';
  const fields = docObj.fields || {};
  const data: any = { id };

  for (const key of Object.keys(fields)) {
    const valObj = fields[key];
    if (!valObj) continue;
    if ('stringValue' in valObj) data[key] = valObj.stringValue;
    else if ('booleanValue' in valObj) data[key] = valObj.booleanValue;
    else if ('integerValue' in valObj) data[key] = Number(valObj.integerValue);
    else if ('doubleValue' in valObj) data[key] = Number(valObj.doubleValue);
    else if ('arrayValue' in valObj) {
      data[key] = (valObj.arrayValue?.values || []).map((v: any) => v.stringValue ?? v.integerValue ?? v);
    }
  }
  return data;
}

export async function fetchMealSlotsFromRest(): Promise<any[]> {
  try {
    const res = await fetch(`${BASE_URL}/meal_slots?key=${API_KEY}`);
    if (!res.ok) return [];
    const data = await res.json();
    const docs = data.documents || [];
    return docs.map(unwrapFirestoreDoc).filter((d: any) => d && (d.active ?? true));
  } catch (e) {
    console.log('Error fetching meal_slots via REST:', e);
    return [];
  }
}

export async function fetchMenuItemsFromRest(): Promise<any[]> {
  try {
    const res = await fetch(`${BASE_URL}/menu_items?key=${API_KEY}`);
    if (!res.ok) return [];
    const data = await res.json();
    const docs = data.documents || [];
    return docs.map(unwrapFirestoreDoc).filter((d: any) => d !== null);
  } catch (e) {
    console.log('Error fetching menu_items via REST:', e);
    return [];
  }
}

export async function fetchOrdersFromRest(phone?: string, userId?: string): Promise<any[]> {
  try {
    const res = await fetch(`${BASE_URL}/orders?key=${API_KEY}`);
    if (!res.ok) return [];
    const data = await res.json();
    const docs = data.documents || [];
    const allOrders = docs.map(unwrapFirestoreDoc).filter((d: any) => d !== null);

    const userDigits = (phone || '').replace(/\D/g, '');
    const cleanUserId = userId || (userDigits ? `usr_${userDigits}` : '');

    return allOrders.filter((o: any) => {
      if (!userDigits && !cleanUserId) return true;
      const oDigits = (o.user_phone || '').replace(/\D/g, '');
      const isPhoneMatch = userDigits && oDigits && (oDigits.endsWith(userDigits) || userDigits.endsWith(oDigits));
      const isIdMatch = cleanUserId && (o.user_id === cleanUserId || o.user_id === userId);
      return isPhoneMatch || isIdMatch;
    });
  } catch (e) {
    console.log('Error fetching orders via REST:', e);
    return [];
  }
}

/** Sync user account with Cloud Firestore users collection */
export async function syncUserWithFirestore(phone: string, defaultName?: string) {
  if (!phone) return null;
  const cleanPhone = phone.trim();
  const userDocId = `usr_${cleanPhone.replace(/\D/g, '')}`;
  const userRef = doc(firestore, 'users', userDocId);

  try {
    const snap = await getDoc(userRef);
    if (snap.exists()) {
      return { id: snap.id, ...snap.data() };
    } else {
      const newUser = {
        name: defaultName || `Customer (${cleanPhone})`,
        phone: cleanPhone,
        wallet_balance: 500,
        subscription_ids: [],
        role: 'customer',
        is_blocked: false,
        created_at: new Date().toISOString(),
      };
      await setDoc(userRef, newUser);
      return { id: userDocId, ...newUser };
    }
  } catch (e) {
    console.log('Error syncing user with Firestore:', e);
    return null;
  }
}

/** Record wallet transaction in Cloud Firestore wallet_transactions collection */
export async function addWalletTransaction(
  userId: string,
  userPhone: string,
  title: string,
  amount: number,
  type: 'CREDIT' | 'DEBIT',
  reason?: string
) {
  try {
    await addDoc(collection(firestore, 'wallet_transactions'), {
      user_id: userId,
      user_phone: userPhone,
      title,
      amount: Math.abs(amount),
      type,
      reason: reason || '',
      timestamp: new Date().toISOString(),
    });
  } catch (e) {
    console.log('Error recording wallet transaction:', e);
  }
}

/** Record system audit log in Cloud Firestore audit_logs collection */
export async function addAuditLog(
  actionType: string,
  adminEmail: string,
  details: string,
  userId?: string,
  userPhone?: string
) {
  try {
    await addDoc(collection(firestore, 'audit_logs'), {
      action_type: actionType,
      admin_email: adminEmail,
      details,
      user_id: userId || '',
      user_phone: userPhone || '',
      timestamp: new Date().toISOString(),
    });
  } catch (e) {
    console.log('Error recording audit log:', e);
  }
}
