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
    console.error('Error sending Expo push notification:', error.message);
  }
}
