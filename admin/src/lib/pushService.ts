/**
 * Utility service to send system push notifications via Expo Push API
 * to connected Android and iOS mobile devices.
 */
export async function sendExpoPushNotification(
  tokens: string[],
  title: string,
  body: string,
  data?: Record<string, any>
) {
  if (!tokens || tokens.length === 0) {
    console.log('No FCM / Expo push tokens provided for push dispatch.');
    return;
  }

  // Filter valid Expo push tokens
  const validTokens = Array.from(
    new Set(tokens.filter(t => typeof t === 'string' && t.trim().length > 0))
  );

  if (validTokens.length === 0) return;

  const messages = validTokens.map(token => ({
    to: token,
    sound: 'default',
    title: title,
    body: body,
    data: data || {},
    priority: 'high',
    channelId: 'order_updates',
    // Android-specific: ensures FCM uses the MAX importance channel for heads-up banners
    // even when the app is in background or closed
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
    console.log('Expo Push Dispatch result:', result);
    return result;
  } catch (error: any) {
    console.log('Expo push notice (web environment):', error?.message || error);
  }
}

/**
 * Register an admin device push token into the `admin_tokens` collection
 */
export async function registerAdminPushToken(token: string, adminEmail: string = 'admin@afoodoo.com') {
  try {
    const { doc, setDoc } = require('firebase/firestore');
    const { db } = require('./firebase');
    const tokenId = token.replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 64);
    await setDoc(doc(db, 'admin_tokens', tokenId), {
      token: token,
      expo_push_token: token,
      admin_email: adminEmail,
      updated_at: new Date().toISOString(),
    }, { merge: true });
  } catch (e) {}
}

