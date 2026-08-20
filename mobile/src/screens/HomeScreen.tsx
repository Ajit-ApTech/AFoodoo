import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  Alert,
} from 'react-native';
import { useAppStore } from '../store/appStore';
import { firestore } from '../firebaseConfig';
import { fetchMealSlotsFromRest } from '../api/firestoreApi';
import { collection, query, where, onSnapshot, DocumentData } from 'firebase/firestore';
import dayjs from 'dayjs';
import { SkeletonCard } from '../components/UIState';
import { useTheme } from '../theme/ThemeContext';

export default function HomeScreen({ navigation }: any) {
  const { theme, isDark } = useTheme();
  const user = useAppStore(state => state.user);
  const setUser = useAppStore(state => state.setUser);
  const subscriptions = useAppStore(state => state.subscriptions);
  const activeSlot = useAppStore(state => state.activeSlot);
  const setActiveSlot = useAppStore(state => state.setActiveSlot);

  const [allSlots, setAllSlots] = useState<any[]>([]);
  const [nowTime, setNowTime] = useState<dayjs.Dayjs>(dayjs());
  const [loading, setLoading] = useState<boolean>(true);

  // Register push token & sync fcm_token with Firestore user document
  useEffect(() => {
    if (!user?.phone) return;
    const cleanPhone = user.phone.trim();
    const userDocId = user.id || `usr_${cleanPhone.replace(/\D/g, '')}`;

    try {
      const { registerForPushNotificationsAsync } = require('../services/notificationService');
      registerForPushNotificationsAsync().then((token: string | null) => {
        if (token) {
          const { doc, updateDoc } = require('firebase/firestore');
          updateDoc(doc(firestore, 'users', userDocId), {
            fcm_token: token,
            last_push_sync: new Date().toISOString(),
          }).catch(() => {});
        }
      });
    } catch (e) {}
  }, [user?.phone, user?.id]);

  // Realtime subscription to logged-in user document for live wallet balance & block status
  useEffect(() => {
    if (!user?.phone) return;
    const cleanPhone = user.phone.trim();
    const userDocId = user.id || `usr_${cleanPhone.replace(/\D/g, '')}`;

    try {
      const { doc, onSnapshot } = require('firebase/firestore');
      const unsub = onSnapshot(doc(firestore, 'users', userDocId), (docSnap: any) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.is_blocked) {
            setUser(null);
            Alert.alert(
              'Account Suspended 🔒',
              'Your account has been suspended by administration. Please contact support.'
            );
            navigation.replace('Auth');
            return;
          }
          if (data.wallet_balance !== undefined && data.wallet_balance !== user.wallet_balance) {
            setUser({ ...user, wallet_balance: data.wallet_balance, is_blocked: false });
          }
        }
      });
      return unsub;
    } catch (e) {
      console.log('Error listening to user document:', e);
    }
  }, [user?.phone, user?.id]);

  const notificationSettings = useAppStore(state => state.notificationSettings);

  // Setup native notification listeners & channel on mount
  useEffect(() => {
    try {
      const { setupNotificationChannel, initNotificationListeners } = require('../services/notificationService');
      setupNotificationChannel();
      const unsub = initNotificationListeners();
      return unsub;
    } catch (e) {}
  }, []);

  // Global Realtime Order Status Notification Listener for Logged-In User
  const prevOrderStatusesRef = React.useRef<Record<string, string>>({});
  const initialOrderLoadRef = React.useRef<boolean>(true);

  useEffect(() => {
    if (!user?.phone) return;
    const userDigits = (user.phone || '').replace(/\D/g, '');
    const userDocId = user.id || (userDigits ? `usr_${userDigits}` : '');

    try {
      const { collection, onSnapshot } = require('firebase/firestore');
      const { triggerLocalNotification } = require('../services/notificationService');

      const unsub = onSnapshot(collection(firestore, 'orders'), (snap: any) => {
        if (!snap.empty) {
          const userOrders = snap.docs
            .map((d: any) => ({ id: d.id, ...d.data() }))
            .filter((o: any) => {
              const oDigits = (o.user_phone || '').replace(/\D/g, '');
              const isPhoneMatch = userDigits && oDigits && (oDigits.endsWith(userDigits) || userDigits.endsWith(oDigits));
              const isIdMatch = userDocId && (o.user_id === userDocId || o.user_id === user?.id);
              return isPhoneMatch || isIdMatch;
            });

          userOrders.forEach((ord: any) => {
            const prevStatus = prevOrderStatusesRef.current[ord.id];
            const newStatus = ord.status;

            if (prevStatus && prevStatus !== newStatus && !initialOrderLoadRef.current) {
              let title = '';
              let body = '';

              if (newStatus === 'preparing') {
                title = '👨‍🍳 Kitchen Preparing';
                body = `Your meal "${ord.menu_title || 'Tiffin'}" is now being freshly prepared in our kitchen!`;
              } else if (newStatus === 'out_for_delivery') {
                title = '🚚 Out for Delivery';
                body = `Your tiffin is on the way! Rider OTP Code: ${ord.otp_code || ''}`;
              } else if (newStatus === 'delivered') {
                title = '😋 Meal Delivered';
                body = `Your tiffin meal "${ord.menu_title || ''}" has been delivered! Enjoy your hot meal.`;
              }

              if (title && body) {
                // 1. Present Status Bar Notification Tray Banner (if order_updates enabled)
                if (notificationSettings?.order_updates ?? true) {
                  triggerLocalNotification(title, body, { orderId: ord.id });
                }

                // 2. Present In-App Alert Popup (if in_app_popups enabled)
                if (notificationSettings?.in_app_popups ?? true) {
                  Alert.alert(title, body, [
                    {
                      text: 'Track Order',
                      onPress: () => navigation.navigate('OrderTracking', { orderId: ord.id }),
                    },
                    { text: 'OK' },
                  ]);
                }
              }
            }
            prevOrderStatusesRef.current[ord.id] = newStatus;
          });
          initialOrderLoadRef.current = false;
        }
      });
      return unsub;
    } catch (e) {}
  }, [user?.phone, user?.id, notificationSettings]);

  // Global Realtime Push Broadcast Notification Listener
  const lastBroadcastIdRef = React.useRef<string>('');
  const initialBroadcastLoadRef = React.useRef<boolean>(true);

  useEffect(() => {
    try {
      const { collection, onSnapshot } = require('firebase/firestore');
      const { triggerLocalNotification } = require('../services/notificationService');

      const unsub = onSnapshot(collection(firestore, 'broadcast_notifications'), (snap: any) => {
        if (!snap.empty) {
          const list = snap.docs
            .map((d: any) => ({ id: d.id, ...d.data() }))
            .sort((a: any, b: any) => (b.timestamp || '').localeCompare(a.timestamp || ''));

          const latestBroadcast = list[0];
          if (latestBroadcast && latestBroadcast.id !== lastBroadcastIdRef.current) {
            if (!initialBroadcastLoadRef.current) {
              const bTitle = latestBroadcast.title || '📢 AFoodoo Announcement';
              const bBody = latestBroadcast.body || '';

              // 1. Present Status Bar Notification Tray Banner (if promo_alerts enabled)
              if (notificationSettings?.promo_alerts ?? true) {
                triggerLocalNotification(bTitle, bBody, { type: 'BROADCAST' });
              }

              // 2. Present In-App Alert Popup (if in_app_popups enabled)
              if (notificationSettings?.in_app_popups ?? true) {
                Alert.alert(bTitle, bBody);
              }
            }
            lastBroadcastIdRef.current = latestBroadcast.id;
          }
          initialBroadcastLoadRef.current = false;
        }
      });
      return unsub;
    } catch (e) {}
  }, [notificationSettings]);

  // Realtime Firestore subscription + REST API fetcher for 100% real Firebase meal slots
  useEffect(() => {
    let isMounted = true;

    // Direct REST API fetch on mount to guarantee immediate real data without SDK timeouts
    fetchMealSlotsFromRest().then(restSlots => {
      if (isMounted && restSlots.length > 0) {
        setAllSlots(restSlots);
        setActiveSlot(restSlots[0] as any);
        setLoading(false);
      }
    });

    try {
      const q = collection(firestore, 'meal_slots');
      const unsub = onSnapshot(
        q,
        snap => {
          if (isMounted && !snap.empty) {
            const list = snap.docs
              .map(d => ({ id: d.id, ...d.data() }))
              .filter((d: any) => d.active ?? true);
            if (list.length > 0) {
              setAllSlots(list);
              setActiveSlot(list[0] as any);
            }
          }
          if (isMounted) setLoading(false);
        },
        err => {
          console.log('Firestore listener info:', err.message);
          if (isMounted) setLoading(false);
        }
      );
      return () => {
        isMounted = false;
        unsub();
      };
    } catch (e) {
      if (isMounted) setLoading(false);
    }
  }, []);

  // Timer interval to update current time every second for smooth countdowns
  useEffect(() => {
    const timer = setInterval(() => {
      setNowTime(dayjs());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Helper to parse time strings like "10:30 PM" or Date objects into dayjs for today
  const parseTimeToDayjs = (timeVal: any): dayjs.Dayjs | null => {
    if (!timeVal) return null;
    if (timeVal instanceof Date) return dayjs(timeVal);
    if (timeVal?.toDate) return dayjs(timeVal.toDate());
    if (typeof timeVal === 'string') {
      const match = timeVal.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
      if (match) {
        let hours = parseInt(match[1], 10);
        const minutes = parseInt(match[2], 10);
        const ampm = match[3].toUpperCase();
        if (ampm === 'PM' && hours < 12) hours += 12;
        if (ampm === 'AM' && hours === 12) hours = 0;
        return dayjs().set('hour', hours).set('minute', minutes).set('second', 0);
      }
    }
    return null;
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={theme.background} />
      <ScrollView contentContainerStyle={styles.container}>
        {/* User Profile Header */}
        <View style={styles.userBar}>
          <TouchableOpacity onPress={() => navigation.navigate('Profile')} style={styles.userInfoRow}>
            <View style={[styles.avatarCircle, { backgroundColor: theme.primary }]}>
              <Text style={styles.avatarText}>{user?.name?.charAt(0) || 'A'}</Text>
            </View>
            <View>
              <Text style={[styles.greetingText, { color: theme.textSecondary }]}>Welcome Back 👋</Text>
              <Text style={[styles.userName, { color: theme.textPrimary }]}>{user?.name || 'AFoodoo Customer'}</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => navigation.navigate('Wallet')}
            style={[styles.walletBadge, { backgroundColor: theme.surface, borderColor: theme.accentBadgeBg }]}
          >
            <Text style={styles.walletEmoji}>💳</Text>
            <Text style={[styles.walletText, { color: theme.primary }]}>
              ₹{(user?.wallet_balance || 500).toFixed(0)}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Delivery Address Pin */}
        <View style={[styles.addressBar, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder }]}>
          <Text style={styles.addressPin}>📍</Text>
          <Text style={[styles.addressText, { color: theme.textSecondary }]} numberOfLines={1}>
            {user?.addresses?.[0]?.line1 || 'Flat 402, Green Park Residency, Sector 15'}
          </Text>
        </View>

        {/* Cutoff Window Countdown Cards — Renders ALL active meal slots */}
        {loading ? (
          <SkeletonCard count={1} />
        ) : (
          allSlots.map((slotItem: any) => {
            const openStr = slotItem.booking_open_time || '08:00 AM';
            const cutoffStr = slotItem.booking_cutoff_time || '11:00 AM';
            const delStart = slotItem.delivery_start_time || '01:00 PM';
            const delEnd = slotItem.delivery_end_time || '02:00 PM';
            const timingText = `Book ${openStr} – ${cutoffStr}  •  Delivered ${delStart}–${delEnd}`;

            const cutoffDayjs = parseTimeToDayjs(cutoffStr);
            let slotOpen = true;
            let countdownStr = '41m 49s';

            if (cutoffDayjs) {
              const diffMs = cutoffDayjs.diff(nowTime);
              if (diffMs > 0) {
                const mins = Math.floor(diffMs / 60000);
                const secs = Math.floor((diffMs % 60000) / 1000);
                countdownStr = `${mins}m ${secs < 10 ? '0' : ''}${secs}s`;
                slotOpen = true;
              } else {
                countdownStr = 'Cutoff Passed';
                slotOpen = false;
              }
            }

            return (
              <View
                key={slotItem.id}
                style={[
                  styles.windowCard,
                  {
                    backgroundColor: theme.surface,
                    borderTopColor: theme.surfaceBorder,
                    borderRightColor: theme.surfaceBorder,
                    borderBottomColor: theme.surfaceBorder,
                    borderLeftColor: theme.primary,
                    borderLeftWidth: 5,
                    borderTopWidth: 1,
                    borderRightWidth: 1,
                    borderBottomWidth: 1,
                  },
                ]}
              >
                {/* Header Row: Live Indicator + Open/Closed Pill Badge */}
                <View style={styles.windowHeaderRow}>
                  <View style={styles.liveIndicatorRow}>
                    <View style={[styles.liveDot, { backgroundColor: theme.primary }]} />
                    <Text style={[styles.liveIndicatorText, { color: theme.primary }]}>
                      LIVE BOOKING WINDOW
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.statusBadgePill,
                      { backgroundColor: slotOpen ? '#E8F5E9' : '#FFEBEE' },
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusBadgeText,
                        { color: slotOpen ? '#2E7D32' : '#C62828' },
                      ]}
                    >
                      {slotOpen ? 'OPEN' : 'CLOSED'}
                    </Text>
                  </View>
                </View>

                {/* Slot Title */}
                <Text style={[styles.slotTitleText, { color: theme.textPrimary }]}>
                  {slotItem.name || 'Meal Tiffin Slot'}
                </Text>

                {/* Timing text on its own dedicated line under title to prevent overflow */}
                <Text style={[styles.slotTimingText, { color: theme.textSecondary }]}>
                  {timingText}
                </Text>

                {/* Inner Timer Container */}
                <View
                  style={[
                    styles.timerBox,
                    {
                      backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#FFF9F5',
                      borderColor: theme.accentBadgeBg,
                    },
                  ]}
                >
                  <Text style={[styles.timerLabel, { color: theme.textMuted }]}>Booking Closes In</Text>
                  <View style={styles.timerRow}>
                    <Text style={styles.timerEmoji}>⌛</Text>
                    <Text style={[styles.timerValue, { color: theme.primary }]}>
                      {countdownStr}
                    </Text>
                  </View>
                </View>

                {/* Action Button */}
                <TouchableOpacity
                  style={[
                    styles.primaryButton,
                    { backgroundColor: slotOpen ? theme.primary : theme.disabledBg },
                  ]}
                  onPress={() => {
                    setActiveSlot(slotItem);
                    navigation.navigate('Menu');
                  }}
                >
                  <Text
                    style={[
                      styles.primaryButtonText,
                      { color: slotOpen ? theme.buttonText : theme.disabledText },
                    ]}
                  >
                    {slotOpen ? "View Today's Menu 🍲" : 'Window Closed - View Menu'}
                  </Text>
                </TouchableOpacity>
              </View>
            );
          })
        )}

        {/* Active Subscription Banner */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>Active Subscriptions</Text>
          <TouchableOpacity onPress={() => navigation.navigate('Subscription')}>
            <Text style={[styles.seeAllText, { color: theme.primary }]}>Manage All</Text>
          </TouchableOpacity>
        </View>

        {subscriptions.length > 0 ? (
          subscriptions.map((sub: any) => (
            <TouchableOpacity
              key={sub.id}
              style={[styles.subCard, { backgroundColor: theme.surface, borderColor: theme.accentBadgeBg }]}
              onPress={() => navigation.navigate('Subscription')}
            >
              <View style={styles.subHeader}>
                <Text style={[styles.subTitle, { color: theme.textPrimary }]}>{sub.plan_type}</Text>
                <View style={[styles.activeTag, { backgroundColor: theme.statusSuccessBg }]}>
                  <Text style={[styles.activeTagText, { color: theme.statusSuccessText }]}>ACTIVE</Text>
                </View>
              </View>
              <Text style={[styles.subDetail, { color: theme.textSecondary }]}>
                {sub.meals_remaining} Meals Remaining • Auto-Dispatched
              </Text>
            </TouchableOpacity>
          ))
        ) : (
          <View style={[styles.noSubCard, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder }]}>
            <Text style={[styles.noSubTitle, { color: theme.textPrimary }]}>No Active Meal Subscription</Text>
            <Text style={[styles.noSubDesc, { color: theme.textSecondary }]}>
              Save 15% on daily meals by subscribing to a 7-day tiffin plan.
            </Text>
            <TouchableOpacity
              style={[styles.subLinkButton, { backgroundColor: theme.primaryLight, borderColor: theme.accentBadgeBg }]}
              onPress={() => navigation.navigate('Subscription')}
            >
              <Text style={[styles.subLinkText, { color: theme.primary }]}>Explore Meal Plans ⭐</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Quick Action 2x2 Grid */}
        <Text style={[styles.sectionTitle, { color: theme.textPrimary, marginTop: 24, marginBottom: 12 }]}>
          Explore AFoodoo
        </Text>
        <View style={styles.gridRow}>
          <TouchableOpacity
            style={[styles.gridCard, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder }]}
            onPress={() => navigation.navigate('Menu')}
          >
            <Text style={styles.gridEmoji}>🍱</Text>
            <Text style={[styles.gridTitle, { color: theme.textPrimary }]}>Browse Menu</Text>
            <Text style={[styles.gridSub, { color: theme.textMuted }]}>Fresh daily items</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.gridCard, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder }]}
            onPress={() => navigation.navigate('OrderTracking', { orderId: 'ord_849201' })}
          >
            <Text style={styles.gridEmoji}>🚴</Text>
            <Text style={[styles.gridTitle, { color: theme.textPrimary }]}>Track Order</Text>
            <Text style={[styles.gridSub, { color: theme.textMuted }]}>Live status stepper</Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.gridRow, { marginTop: 12 }]}>
          <TouchableOpacity
            style={[styles.gridCard, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder }]}
            onPress={() => navigation.navigate('Wallet')}
          >
            <Text style={styles.gridEmoji}>💳</Text>
            <Text style={[styles.gridTitle, { color: theme.textPrimary }]}>Top-Up Wallet</Text>
            <Text style={[styles.gridSub, { color: theme.textMuted }]}>Instant credit</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.gridCard, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder }]}
            onPress={() => navigation.navigate('Profile')}
          >
            <Text style={styles.gridEmoji}>⚙️</Text>
            <Text style={[styles.gridTitle, { color: theme.textPrimary }]}>Account & Settings</Text>
            <Text style={[styles.gridSub, { color: theme.textMuted }]}>Profile & Help Center</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  container: { paddingHorizontal: 20, paddingVertical: 16 },
  userBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  userInfoRow: { flexDirection: 'row', alignItems: 'center', minHeight: 44 },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: { color: '#FFF', fontSize: 18, fontWeight: '800' },
  greetingText: { fontSize: 12, fontWeight: '500' },
  userName: { fontSize: 16, fontWeight: '800' },
  walletBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    minHeight: 44,
  },
  walletEmoji: { fontSize: 14, marginRight: 4 },
  walletText: { fontSize: 14, fontWeight: '800' },
  addressBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    marginBottom: 20,
    borderWidth: 1,
    minHeight: 44,
  },
  addressPin: { marginRight: 6 },
  addressText: { fontSize: 13, flex: 1 },
  windowCard: {
    borderRadius: 20,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderLeftWidth: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  windowHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  liveIndicatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    marginRight: 6,
  },
  liveIndicatorText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  statusBadgePill: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  slotTitleText: {
    fontSize: 21,
    fontWeight: '800',
    marginBottom: 4,
  },
  slotTimingText: {
    fontSize: 13,
    fontWeight: '500',
    marginBottom: 16,
  },
  timerBox: {
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
  },
  timerLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
  },
  timerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timerEmoji: {
    fontSize: 20,
    marginRight: 6,
  },
  timerValue: {
    fontSize: 26,
    fontWeight: '800',
  },
  primaryButton: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    minHeight: 48,
    justifyContent: 'center',
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '700',
  },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontSize: 18, fontWeight: '800' },
  seeAllText: { fontSize: 13, fontWeight: '700' },
  subCard: { borderRadius: 16, padding: 16, borderWidth: 1, marginBottom: 10 },
  subHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  subTitle: { fontSize: 15, fontWeight: '700' },
  activeTag: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  activeTagText: { fontSize: 10, fontWeight: '800' },
  subDetail: { fontSize: 13, marginTop: 4 },
  noSubCard: { borderRadius: 16, padding: 16, borderWidth: 1, alignItems: 'center' },
  noSubTitle: { fontSize: 15, fontWeight: '700', marginBottom: 4 },
  noSubDesc: { fontSize: 12, textAlign: 'center', marginBottom: 12 },
  subLinkButton: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10, borderWidth: 1 },
  subLinkText: { fontSize: 13, fontWeight: '700' },
  gridRow: { flexDirection: 'row', gap: 12 },
  gridCard: { flex: 1, borderRadius: 16, padding: 16, borderWidth: 1 },
  gridEmoji: { fontSize: 24, marginBottom: 8 },
  gridTitle: { fontSize: 14, fontWeight: '700' },
  gridSub: { fontSize: 11, marginTop: 2 },
});
