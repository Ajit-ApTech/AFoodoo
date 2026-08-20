import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { useAppStore } from '../store/appStore';
import { navigate } from './navigationRef';

let Notifications: any = null;
try {
  Notifications = require('expo-notifications');
  if (Constants.appOwnership !== 'expo') {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
  }
} catch (e) {
  console.log('expo-notifications module fallback');
}

/**
 * Configure Android notification channel with MAX importance for status bar banners
 */
export async function setupNotificationChannel() {
  if (!Notifications || Platform.OS !== 'android') return;
  try {
    await Notifications.setNotificationChannelAsync('order_updates', {
      name: 'AFoodoo Order Updates 🍲',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#D84315',
      sound: 'default',
    });
  } catch (e) {}
}

/**
 * Register device push token (for standalone builds and physical devices)
 */
export async function registerForPushNotificationsAsync(userId?: string): Promise<string | null> {
  if (!Notifications || Constants.appOwnership === 'expo') {
    // SDK 53 Expo Go emulator suppresses remote push APIs — active on standalone APK builds
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

    const pushTokenData = await Notifications.getExpoPushTokenAsync({
      projectId: 'fb04d89b-b5b3-4d16-a220-7e5f3a90d82c',
    });
    const token = pushTokenData.data;

    // Sync Push Token to user document in Cloud Firestore for background push delivery
    if (token && userId) {
      try {
        const { doc, setDoc } = require('firebase/firestore');
        const { firestore } = require('../firebaseConfig');
        await setDoc(
          doc(firestore, 'users', userId),
          { expo_push_token: token, updated_at: new Date().toISOString() },
          { merge: true }
        );
      } catch (e) {}
    }

    return token;
  } catch (error) {
    console.log('Push token registration notice:', error);
    return null;
  }
}

/**
 * Present instant status bar notification banner in Android/iOS notification tray
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
        data: data || {},
      },
      trigger: null, // immediate
    });
  } catch (e) {
    console.log('Local status bar notification notice:', e);
  }
}

export function initNotificationListeners() {
  if (!Notifications) return () => {};

  try {
    const responseListener = Notifications.addNotificationResponseReceivedListener((response: any) => {
      const data = response.notification.request.content.data;
      if (data && data.orderId) {
        navigate('Tracking', { orderId: data.orderId });
      }
    });

    return () => {
      Notifications.removeNotificationSubscription(responseListener);
    };
  } catch (e) {
    return () => {};
  }
}
