import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { useAppStore } from '../store/appStore';
import { navigate } from './navigationRef';

let Notifications: any = null;
try {
  Notifications = require('expo-notifications');
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
 * Register device push token (for standalone builds)
 */
export async function registerForPushNotificationsAsync(): Promise<string | null> {
  if (!Notifications || Constants.appOwnership === 'expo') return null;

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
      projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || 'afoodoo',
    });
    return pushTokenData.data;
  } catch (error) {
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
