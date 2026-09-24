import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { useAppStore } from '../store/appStore';
import { navigate } from './navigationRef';

let Notifications: any = null;
try {
  Notifications = require('expo-notifications');
  // Configure notification presentation unconditionally
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
} catch (e) {
  console.log('expo-notifications module fallback');
}

/**
 * Configure Android notification channels with MAX importance for status bar heads-up popups
 */
export async function setupNotificationChannel() {
  if (!Notifications || Platform.OS !== 'android') return;
  try {
    const channelConfig = {
      name: 'AFoodoo Order Updates 🍲',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#D84315',
      sound: 'default',
      enableVibrate: true,
      showBadge: true,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility?.PUBLIC,
      bypassDnd: true,
    };
    await Notifications.setNotificationChannelAsync('order_updates', channelConfig);
    await Notifications.setNotificationChannelAsync('default', {
      ...channelConfig,
      name: 'AFoodoo Notifications',
    });
  } catch (e) {}
}

if (Notifications && Platform.OS === 'android') {
  setupNotificationChannel().catch(() => {});
}

import AsyncStorage from '@react-native-async-storage/async-storage';

let cachedPushToken: string | null = null;

// Synchronously or asynchronously retrieve cached token for instant attachment to orders
export async function getCachedPushToken(): Promise<string | null> {
  if (cachedPushToken) return cachedPushToken;
  try {
    cachedPushToken = await AsyncStorage.getItem('@cached_expo_push_token');
    return cachedPushToken;
  } catch (e) {
    return null;
  }
}

export function getCachedPushTokenSync(): string | null {
  return cachedPushToken;
}

/**
 * Register device push token (for standalone builds, dev client, and physical devices)
 */
export async function registerForPushNotificationsAsync(userId?: string): Promise<string | null> {
  if (!Notifications) {
    return null;
  }

  try {
    await setupNotificationChannel();
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') return null;

    let token: string | null = null;
    try {
      const pushTokenData = await Notifications.getExpoPushTokenAsync({
        projectId: 'fb04d89b-b5b3-4d16-a220-7e5f3a90d82c',
      });
      token = pushTokenData.data;
    } catch (e) {
      // Fallback for native FCM device token
      try {
        const deviceToken = await Notifications.getDevicePushTokenAsync();
        token = deviceToken.data;
      } catch (devErr) {}
    }

    if (token) {
      cachedPushToken = token;
      AsyncStorage.setItem('@cached_expo_push_token', token).catch(() => {});
    }

    // Sync Push Token to user document in Cloud Firestore for background push delivery
    if (token && userId) {
      try {
        const { doc, setDoc } = require('firebase/firestore');
        const { firestore } = require('../firebaseConfig');
        const tokenPayload = {
          expo_push_token: token,
          fcm_token: token,
          push_token: token,
          updated_at: new Date().toISOString(),
        };

        // Save under provided userId
        await setDoc(doc(firestore, 'users', userId), tokenPayload, { merge: true });

        // Normalize phone digits to also update alternate format (e.g., usr_9876543210 and usr_919876543210)
        const digits = userId.replace(/\D/g, '');
        if (digits.length === 10) {
          await setDoc(doc(firestore, 'users', `usr_91${digits}`), tokenPayload, { merge: true }).catch(() => {});
        } else if (digits.length === 12 && digits.startsWith('91')) {
          await setDoc(doc(firestore, 'users', `usr_${digits.slice(2)}`), tokenPayload, { merge: true }).catch(() => {});
        }
      } catch (e) {}
    }

    return token;
  } catch (error) {
    console.log('Push token registration notice:', error);
    return null;
  }
}

/**
 * Present instant status bar heads-up popup banner in Android/iOS
 */
export async function triggerLocalNotification(
  title: string,
  body: string,
  data?: Record<string, any>
) {
  if (!Notifications) return;

  try {
    await setupNotificationChannel();
    await Notifications.scheduleNotificationAsync({
      content: {
        title: title,
        body: body,
        sound: 'default',
        priority: Notifications.AndroidNotificationPriority?.MAX || 'max',
        vibrate: [0, 250, 250, 250],
        channelId: 'order_updates',
        data: data || {},
      },
      trigger: null, // immediate
    });
  } catch (e) {
    console.log('Local status bar notification notice:', e);
  }
}

export function initNotificationListeners(onPaymentRejected?: (paymentRequestId: string) => void) {
  if (!Notifications) return () => {};

  try {
    const responseListener = Notifications.addNotificationResponseReceivedListener((response: any) => {
      const data = response.notification.request.content.data;
      if (data) {
        if (data.orderId) {
          navigate('Tracking', { orderId: data.orderId });
        } else if (data.type === 'payment_rejected' && data.paymentRequestId) {
          if (onPaymentRejected) {
            onPaymentRejected(data.paymentRequestId);
          }
        }
      }
    });

    return () => {
      Notifications.removeNotificationSubscription(responseListener);
    };
  } catch (e) {
    return () => {};
  }
}

