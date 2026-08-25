import { db, messaging } from '../firebase';
import { logger } from '../logger';

/**
 * Dispatch high-importance push notification banner to target tokens (FCM & Expo Push)
 */
export async function sendPushNotification(
  tokens: string[],
  title: string,
  body: string,
  data: Record<string, any> = {}
) {
  if (!tokens || tokens.length === 0) return;

  const uniqueTokens = Array.from(new Set(tokens.filter(t => typeof t === 'string' && t.trim().length > 0)));
  if (uniqueTokens.length === 0) return;

  const expoTokens = uniqueTokens.filter(t => t.startsWith('ExponentPushToken[') || t.startsWith('ExpoPushToken['));
  const fcmTokens = uniqueTokens.filter(t => !t.startsWith('ExponentPushToken[') && !t.startsWith('ExpoPushToken['));

  // 1. Send to Expo Push Tokens (for React Native / Expo standalone and dev clients)
  if (expoTokens.length > 0) {
    const messages = expoTokens.map(token => ({
      to: token,
      sound: 'default',
      title: title,
      body: body,
      data: data,
      priority: 'high',
      channelId: 'order_updates',
      android: {
        channelId: 'order_updates',
        priority: 'high',
        sound: 'default',
      },
    }));

    try {
      const response = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Accept-encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(messages),
      });
      const result = await response.json();
      logger.info('Expo Push sent result', { result });
    } catch (e: any) {
      logger.warn('Expo Push dispatch notice', { error: e?.message });
    }
  }

  // 2. Send to native FCM tokens
  if (fcmTokens.length > 0 && messaging) {
    try {
      const fcmMessage = {
        notification: { title, body },
        data: Object.fromEntries(
          Object.entries(data).map(([k, v]) => [k, typeof v === 'string' ? v : JSON.stringify(v)])
        ),
        android: {
          priority: 'high' as const,
          notification: {
            channelId: 'order_updates',
            sound: 'default',
            defaultSound: true,
            defaultVibrateTimings: true,
          },
        },
        apns: {
          payload: {
            aps: {
              sound: 'default',
              badge: 1,
            },
          },
        },
        tokens: fcmTokens,
      };

      await messaging.sendEachForMulticast(fcmMessage);
    } catch (e: any) {
      logger.warn('FCM multicast notice', { error: e?.message });
    }
  }
}

/**
 * Fetch all registered admin push tokens from the `admin_tokens` collection
 */
export async function getAdminTokens(): Promise<string[]> {
  if (!db) return [];
  try {
    const snap = await db.collection('admin_tokens').get();
    const tokens: string[] = [];
    snap.docs.forEach(doc => {
      const d = doc.data();
      if (d.token && typeof d.token === 'string') tokens.push(d.token);
      if (d.expo_push_token && typeof d.expo_push_token === 'string') tokens.push(d.expo_push_token);
    });
    return tokens;
  } catch (e: any) {
    logger.warn('Error fetching admin tokens', { error: e?.message });
    return [];
  }
}

/**
 * Fetch push token for a specific user ID
 */
export async function getUserPushTokens(userId: string): Promise<string[]> {
  if (!db || !userId) return [];
  try {
    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists) return [];
    const data = userDoc.data();
    const tokens: string[] = [];
    if (data?.expo_push_token) tokens.push(data.expo_push_token);
    if (data?.fcm_token) tokens.push(data.fcm_token);
    return tokens;
  } catch (e: any) {
    return [];
  }
}
