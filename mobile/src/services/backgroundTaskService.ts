/**
 * AFoodoo Background Auto-Booking Task
 *
 * Uses expo-task-manager + expo-background-fetch to call the backend
 * /api/subscriptions/auto-book endpoint periodically so orders are
 * booked and push notifications are sent even when the app is closed.
 *
 * Android: system wakes the app every ~15 min (minimum OS-enforced interval).
 * iOS: system decides when to run it (best-effort, guided by usage patterns).
 */

import * as TaskManager from 'expo-task-manager';
import * as BackgroundFetch from 'expo-background-fetch';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const AUTO_BOOKING_TASK = 'AFOODOO_AUTO_BOOKING_TASK';

// The deployed backend URL – falls back to localhost for dev
const BACKEND_URL =
  process.env.EXPO_PUBLIC_BACKEND_URL ||
  process.env.BACKEND_URL ||
  'http://localhost:8080';

/**
 * Define the background task (must be called at the top level of the JS bundle,
 * before any navigation/screens are loaded).
 */
TaskManager.defineTask(AUTO_BOOKING_TASK, async () => {
  try {
    const userId = await AsyncStorage.getItem('@afoodoo_user_id');
    if (!userId) {
      // No logged-in user — nothing to do
      return BackgroundFetch.BackgroundFetchResult.NoData;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25_000); // 25 s timeout

    const response = await fetch(`${BACKEND_URL}/api/subscriptions/auto-book`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ triggered_by: 'background_task', user_id: userId }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      return BackgroundFetch.BackgroundFetchResult.Failed;
    }

    const result = await response.json();
    const booked = result?.bookedCount ?? 0;

    return booked > 0
      ? BackgroundFetch.BackgroundFetchResult.NewData
      : BackgroundFetch.BackgroundFetchResult.NoData;
  } catch (_err) {
    // Network error or aborted – non-fatal
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

/**
 * Register the background fetch task.
 * Call this once after the user logs in (from App.tsx or HomeScreen).
 */
export async function registerAutoBookingBackgroundTask(): Promise<void> {
  try {
    const status = await BackgroundFetch.getStatusAsync();
    if (
      status === BackgroundFetch.BackgroundFetchStatus.Restricted ||
      status === BackgroundFetch.BackgroundFetchStatus.Denied
    ) {
      console.log('[BG] BackgroundFetch is restricted/denied by OS – skipping registration.');
      return;
    }

    const isRegistered = await TaskManager.isTaskRegisteredAsync(AUTO_BOOKING_TASK);
    if (!isRegistered) {
      await BackgroundFetch.registerTaskAsync(AUTO_BOOKING_TASK, {
        minimumInterval: 15 * 60, // 15 minutes (OS-enforced minimum)
        stopOnTerminate: false,   // Keep running after app is force-stopped (Android)
        startOnBoot: true,        // Re-register after device reboot
      });
      console.log('[BG] Auto-booking background task registered ✅');
    }
  } catch (err) {
    console.log('[BG] Background task registration notice:', err);
  }
}

/**
 * Unregister the background task (call on logout).
 */
export async function unregisterAutoBookingBackgroundTask(): Promise<void> {
  try {
    const isRegistered = await TaskManager.isTaskRegisteredAsync(AUTO_BOOKING_TASK);
    if (isRegistered) {
      await BackgroundFetch.unregisterTaskAsync(AUTO_BOOKING_TASK);
      console.log('[BG] Auto-booking background task unregistered.');
    }
  } catch (err) {
    console.log('[BG] Unregister notice:', err);
  }
}
