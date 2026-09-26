import React, { useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  StatusBar,
  Alert,
  Image,
  Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useAppStore } from '../store/appStore';
import { firestore } from '../firebaseConfig';
import { fetchMealSlotsFromRest, fetchMenuItemsFromRest } from '../api/firestoreApi';
import { collection, query, where, onSnapshot, DocumentData } from 'firebase/firestore';
import dayjs from 'dayjs';
import { SkeletonCard } from '../components/UIState';
import { useTheme } from '../theme/ThemeContext';
import { BottomNavBar, BottomTabType } from '../components/BottomNavBar';
import { AnnouncementsModal } from '../components/AnnouncementsModal';

export default function HomeScreen({ navigation }: any) {
  const { theme, isDark } = useTheme();
  const user = useAppStore(state => state.user);
  const setUser = useAppStore(state => state.setUser);
  const subscriptions = useAppStore(state => state.subscriptions);
  const activeSlot = useAppStore(state => state.activeSlot);
  const setActiveSlot = useAppStore(state => state.setActiveSlot);
  const announcementsOpen = useAppStore(state => state.announcementsModalOpen);
  const setAnnouncementsOpen = useAppStore(state => state.setAnnouncementsModalOpen);
  const unreadCount = useAppStore(state => state.unreadAnnouncementsCount);
  const setUnreadCount = useAppStore(state => state.setUnreadAnnouncementsCount);
  const cart = useAppStore(state => state.cart || []);
  const cartTotalCount = (cart || []).reduce((s: number, i: any) => s + (i.quantity || 1), 0);
  const menuItems = useAppStore(state => state.menuItems || []);
  const setMenuItems = useAppStore(state => state.setMenuItems);
  const [allSlots, setAllSlots] = useState<any[]>([]);
  const [nowTime, setNowTime] = useState<dayjs.Dayjs>(dayjs());
  const [loading, setLoading] = useState<boolean>(true);
  const [userSubscriptions, setUserSubscriptions] = useState<any[]>([]);

  // Load menu items if not already cached
  useEffect(() => {
    if (menuItems.length === 0) {
      fetchMenuItemsFromRest().then((items: any[]) => {
        if (items && items.length > 0) setMenuItems(items);
      }).catch(() => {});
    }
  }, []);



  // Register push token & sync fcm_token with Firestore user document
  useEffect(() => {
    if (!user?.phone) return;
    const cleanPhone = user.phone.trim();
    const userDocId = user.id || `usr_${cleanPhone.replace(/\D/g, '')}`;

    try {
      const { registerForPushNotificationsAsync } = require('../services/notificationService');
      registerForPushNotificationsAsync(userDocId).then((token: string | null) => {
        if (token) {
          const { doc, updateDoc } = require('firebase/firestore');
          updateDoc(doc(firestore, 'users', userDocId), {
            fcm_token: token,
            expo_push_token: token,
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
    fetchMealSlotsFromRest()
      .then(restSlots => {
        if (isMounted) {
          if (restSlots.length > 0) {
            setAllSlots(restSlots);
            setActiveSlot(restSlots[0] as any);
          }
          setLoading(false);
        }
      })
      .catch(() => {
        if (isMounted) setLoading(false);
      });

    // Safety fallback: ensure loading never hangs longer than 800ms
    const safetyTimer = setTimeout(() => {
      if (isMounted) setLoading(false);
    }, 800);

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
        clearTimeout(safetyTimer);
        unsub();
      };
    } catch (e) {
      if (isMounted) setLoading(false);
      clearTimeout(safetyTimer);
    }
  }, []);

  // Timer interval to update current time every second for smooth countdowns
  useEffect(() => {
    const timer = setInterval(() => {
      setNowTime(dayjs());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Helper to parse time strings like "10:30 PM", ISO strings, or Date objects into dayjs
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
      // Support ISO string or standard date-time string if cutoff specifies a full date/time
      const parsed = dayjs(timeVal);
      if (parsed.isValid()) return parsed;
    }
    return null;
  };

  // Format remaining time compactly (e.g. 1d 14h 2m 30s, 4h 43m 40s, 25m 12s)
  const formatCountdown = (diffMs: number): string => {
    if (diffMs <= 0) return 'Cutoff Passed';

    const totalSecs = Math.floor(diffMs / 1000);
    const days = Math.floor(totalSecs / 86400);
    const hours = Math.floor((totalSecs % 86400) / 3600);
    const mins = Math.floor((totalSecs % 3600) / 60);
    const secs = totalSecs % 60;

    const parts: string[] = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0 || days > 0) parts.push(`${hours}h`);
    if (mins > 0 || hours > 0 || days > 0) parts.push(`${mins}m`);
    parts.push(`${secs < 10 && (mins > 0 || hours > 0 || days > 0) ? '0' : ''}${secs}s`);

    return parts.join(' ');
  };

  // Realtime subscription listener for user's active & past plans
  useEffect(() => {
    if (!user?.phone) {
      setUserSubscriptions([]);
      return;
    }
    const cleanPhone = user.phone.trim();
    const userDocId = user.id || `usr_${cleanPhone.replace(/\D/g, '')}`;

    try {
      const { collection, onSnapshot, doc, updateDoc } = require('firebase/firestore');
      const unsub = onSnapshot(collection(firestore, 'subscriptions'), (snap: any) => {
        if (!snap.empty) {
          const now = dayjs();
          const list = snap.docs
            .map((d: any) => ({ id: d.id, ...d.data() }))
            .filter((d: any) => d.user_phone === cleanPhone || d.user_id === userDocId);

          setUserSubscriptions(list);

          // Check for expired subscriptions and sync with Firestore status
          list.forEach((sub: any) => {
            const isExpired =
              (sub.end_date && now.isAfter(dayjs(sub.end_date), 'day')) ||
              (typeof sub.meals_remaining === 'number' && sub.meals_remaining <= 0);
            if (isExpired && sub.status === 'active') {
              updateDoc(doc(firestore, 'subscriptions', sub.id), {
                status: 'expired',
                updated_at: new Date().toISOString(),
              }).catch(() => {});
            }
          });
        } else {
          setUserSubscriptions([]);
        }
      });
      return unsub;
    } catch (e) {}
  }, [user?.phone, user?.id]);

  // Automated Daily Meal Booking Engine
  useEffect(() => {
    if (!user?.phone || !activeSlot) return;
    const cleanPhone = user.phone.trim();
    const userDocId = user.id || `usr_${cleanPhone.replace(/\D/g, '')}`;
    const todayStr = dayjs().format('YYYY-MM-DD');

    const now = dayjs();
    const activeSubs = userSubscriptions.filter((sub: any) => {
      const isExpired =
        sub.status === 'expired' ||
        sub.status === 'cancelled' ||
        (sub.end_date && now.isAfter(dayjs(sub.end_date), 'day')) ||
        (typeof sub.meals_remaining === 'number' && sub.meals_remaining <= 0);
      return !isExpired && !sub.is_paused && sub.status !== 'PAUSED';
    });

    if (activeSubs.length === 0) return;

    // Pick primary active sub
    const sub = activeSubs[0];
    const pausedDates = sub.paused_dates || [];
    if (pausedDates.includes(todayStr)) {
      // Meal delivery is paused for today by customer
      return;
    }

    if (sub.last_auto_booked_date === todayStr) {
      // Already auto-booked for today
      return;
    }

    // Auto-create order if within slot
    const autoBookMeal = async () => {
      try {
        const { collection, addDoc, doc, updateDoc, increment } = require('firebase/firestore');
        const { getNextOrderCode } = require('../api/orderCode');
        const { triggerLocalNotification } = require('../services/notificationService');

        const nextCode = await getNextOrderCode();
        let selectedDailyDish = sub.daily_menu?.[todayStr];
        if (!selectedDailyDish) {
          // If no pre-scheduled dish, pick real featured meal from menuItems
          const matchingDish =
            (menuItems || []).find((m: any) => m.slot_id === activeSlot.id || m.is_active) ||
            menuItems?.[0];
          if (matchingDish) {
            selectedDailyDish = {
              id: matchingDish.id,
              name: matchingDish.title || matchingDish.name,
              price: Number(matchingDish.price) || 150,
              extraCharge: 0,
            };
          } else {
            selectedDailyDish = {
              id: 'dish_sub_default',
              name: `${sub.plan_type || 'Tiffin'} Daily Meal`,
              price: 150,
              extraCharge: 0,
            };
          }
        }
        const dishName = selectedDailyDish.name || selectedDailyDish.title || `${sub.plan_type || 'Tiffin'} Daily Meal`;
        const mealPrice = Number(selectedDailyDish.price) || 150;

        // Deduct the selected meal price from customer's subscription wallet balance
        if (mealPrice > 0) {
          try {
            await updateDoc(doc(firestore, 'users', userDocId), {
              wallet_balance: increment(-mealPrice),
              updated_at: new Date().toISOString(),
            });
            await addDoc(collection(firestore, 'wallet_transactions'), {
              user_id: userDocId,
              user_phone: cleanPhone,
              title: `Daily Meal: ${dishName}`,
              description: `Auto-booked for ${activeSlot.name || sub.plan_type || 'Tiffin Slot'} (${nextCode})`,
              amount: mealPrice,
              type: 'debit',
              timestamp: new Date().toISOString(),
              created_at: new Date().toISOString(),
            });
            if (user && user.wallet_balance !== undefined) {
              setUser({ ...user, wallet_balance: Math.max(0, user.wallet_balance - mealPrice) });
            }
          } catch (walletErr) {
            console.log('Notice deducting daily meal price from wallet:', walletErr);
          }
        }

        const savedAddr: any = (user?.addresses && user.addresses.length > 0) ? user.addresses[0] : null;
        const deliveryAddressObj = {
          label: savedAddr?.label || 'Home',
          receiver_name: savedAddr?.receiver_name || sub.user_name || user.name || 'Customer',
          receiver_phone: savedAddr?.receiver_phone || cleanPhone,
          line1: savedAddr?.line1 || (user as any).address || 'M8W2+7RW, North Chotanagpur Division, Potanga',
          landmark: savedAddr?.landmark || 'Near birsa workshop',
          city: savedAddr?.city || 'Potanga',
          zip: savedAddr?.zip || '825311',
          latitude: savedAddr?.latitude ?? 23.660920933979938,
          longitude: savedAddr?.longitude ?? 85.306910625171,
        };
        const deliveryLat = savedAddr?.latitude ?? 23.660920933979938;
        const deliveryLng = savedAddr?.longitude ?? 85.306910625171;
        const mapsLink = `https://www.google.com/maps/search/?api=1&query=${deliveryLat},${deliveryLng}`;
        const otpCode = Math.floor(1000 + Math.random() * 9000).toString();

        await addDoc(collection(firestore, 'orders'), {
          order_code: nextCode,
          user_id: userDocId,
          user_name: sub.user_name || user.name || 'Customer',
          customer_name: sub.user_name || user.name || 'Customer',
          user_phone: cleanPhone,
          customer_phone: cleanPhone,
          delivery_name: deliveryAddressObj.receiver_name,
          delivery_phone: deliveryAddressObj.receiver_phone,
          delivery_address: deliveryAddressObj,
          delivery_lat: deliveryLat,
          delivery_lng: deliveryLng,
          delivery_distance_km: savedAddr?.distance_km ?? null,
          maps_link: mapsLink,
          otp_code: otpCode,
          menu_title: dishName,
          items: [
            {
              id: selectedDailyDish.id || 'dish_sub',
              title: dishName,
              name: dishName,
              price: mealPrice,
              quantity: 1,
            },
          ],
          total_amount: mealPrice,
          subtotal: mealPrice,
          delivery_fee: 0,
          platform_fee: 0,
          discount: 0,
          payment_method: 'wallet',
          payment_status: 'paid',
          status: 'booked',
          order_type: 'subscription_auto',
          subscription_id: sub.id,
          booking_date: todayStr,
          slot_name: activeSlot.name || sub.plan_type || 'Daily Meal',
          created_at: new Date().toISOString(),
          timestamp: new Date().toISOString(),
        });

        await updateDoc(doc(firestore, 'subscriptions', sub.id), {
          meals_remaining: increment(-1),
          last_auto_booked_date: todayStr,
          updated_at: new Date().toISOString(),
        });

        triggerLocalNotification(
          '🍱 Daily Tiffin Auto-Booked!',
          `Your ${dishName} for today has been booked and scheduled with the kitchen!`,
          { type: 'ORDER_UPDATE' }
        );
      } catch (err) {
        console.log('Notice auto-booking daily subscription meal:', err);
      }
    };

    autoBookMeal();
  }, [userSubscriptions, activeSlot, user?.phone]);

  const activeValidSubs = useMemo(() => {
    const now = dayjs();
    return userSubscriptions.filter((sub: any) => {
      const isExpired =
        sub.status === 'expired' ||
        sub.status === 'cancelled' ||
        (sub.end_date && now.isAfter(dayjs(sub.end_date), 'day')) ||
        (typeof sub.meals_remaining === 'number' && sub.meals_remaining <= 0);
      return !isExpired;
    });
  }, [userSubscriptions]);

  const primaryActiveSub = activeValidSubs.length > 0 ? activeValidSubs[0] : null;

  const handleTabSelect = (tab: BottomTabType) => {
    if (tab === 'Home') return;
    if (tab === 'Orders') {
      navigation.navigate('OrderTracking', { orderId: 'ord_849201' });
    } else if (tab === 'Wallet') {
      navigation.navigate('Wallet');
    } else if (tab === 'Account') {
      navigation.navigate('Profile');
    }
  };

  const insets = useSafeAreaInsets();
  const topInset = Math.max(insets.top, Platform.OS === 'android' ? (StatusBar.currentHeight || 38) : 0);

  return (
    <SafeAreaView edges={['left', 'right', 'bottom']} style={[styles.safeArea, { backgroundColor: theme.background, paddingTop: topInset }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={theme.background} />
      <AnnouncementsModal
        visible={announcementsOpen}
        onClose={() => setAnnouncementsOpen(false)}
        onUnreadCountChange={setUnreadCount}
      />
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        {/* Top App Header with Logo (Left), Greeting (Center), Wallet, Bell & Cart (Right) */}
        <View style={styles.topHeader}>
          {/* Left: Brand Logo (Enlarged) */}
          <View style={styles.headerLeftCol}>
            <Image
              source={
                isDark
                  ? require('../../assets/afoodoo-logo-light.png')
                  : require('../../assets/afoodoo-logo-dark.png')
              }
              style={styles.headerBrandLogo}
              resizeMode="contain"
            />
          </View>

          {/* Center: User Greeting */}
          <View style={styles.headerCenterCol}>
            <Text style={[styles.greetingSmallText, { color: theme.textSecondary }]}>Welcome Back 👋</Text>
            <Text style={[styles.userNameHeading, { color: theme.textPrimary }]} numberOfLines={1}>
              {user?.name || 'Ajit'}
            </Text>
          </View>

          {/* Right: Wallet Pill, Bell Notification & Cart Button */}
          <View style={styles.headerRightActions}>
            <TouchableOpacity
              onPress={() => navigation.navigate('Wallet')}
              style={[styles.walletBadgeCompact, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder }]}
              activeOpacity={0.8}
            >
              <Text style={{ fontSize: 12 }}>💳</Text>
              <Text style={[styles.walletTextCompact, { color: theme.primary }]}>
                ₹{(user?.wallet_balance ?? 0).toFixed(0)}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setAnnouncementsOpen(true)}
              style={[styles.headerIconBtn, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder }]}
              activeOpacity={0.7}
            >
              <Text style={{ fontSize: 14 }}>🔔</Text>
              {unreadCount > 0 && (
                <View
                  style={[
                    styles.unreadBadgeDot,
                    { backgroundColor: theme.primary, borderColor: theme.background },
                  ]}
                />
              )}
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => navigation.navigate('Booking', {})}
              style={[styles.headerIconBtn, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder }]}
              activeOpacity={0.7}
            >
              <Text style={{ fontSize: 15 }}>🛒</Text>
              {cartTotalCount > 0 && (
                <View style={styles.cartBadgeDot}>
                  <Text style={styles.cartBadgeText}>{cartTotalCount}</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Delivery Address Capsule */}
        <TouchableOpacity
          style={[styles.addressBar, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder }]}
          onPress={() => navigation.navigate('Profile')}
          activeOpacity={0.7}
        >
          <Text style={styles.addressPin}>📍</Text>
          <Text style={[styles.addressText, { color: theme.textSecondary }]} numberOfLines={1}>
            {user?.addresses?.[0]?.line1
              ? `${user.addresses[0].line1}${user.addresses[0].city ? `, ${user.addresses[0].city}` : ''}`
              : 'M8W2+7RW, North Chotanagpur Division, Potanga'}
          </Text>
          <Text style={[styles.addressCaret, { color: theme.textMuted }]}>⌵</Text>
        </TouchableOpacity>

        {/* Hero Cutoff Window Countdown Card */}
        {loading ? (
          <SkeletonCard count={1} />
        ) : (() => {
          const availableSlots = allSlots.length > 0 ? allSlots : [
            {
              id: 'slot_lunch_special',
              name: 'Lunch special Meal booking',
              booking_open_time: '10:30 PM',
              booking_cutoff_time: '11:59 PM',
              delivery_start_time: '01:00 PM',
              delivery_end_time: '02:30 PM',
              active: true,
            },
          ];

          const currentSlot = activeSlot || availableSlots.find((s: any) => s.active) || availableSlots[0];

          return (
            <View>
              {availableSlots.length > 1 && (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={{ marginBottom: 10 }}
                  contentContainerStyle={{ gap: 8 }}
                >
                  {availableSlots.map((s: any) => {
                    const isSelected = (currentSlot?.id === s.id);
                    return (
                      <TouchableOpacity
                        key={s.id}
                        onPress={() => setActiveSlot(s)}
                        activeOpacity={0.7}
                        style={{
                          paddingHorizontal: 14,
                          paddingVertical: 6,
                          borderRadius: 18,
                          backgroundColor: isSelected ? theme.primary : theme.surface,
                          borderWidth: 1,
                          borderColor: isSelected ? theme.primary : theme.surfaceBorder,
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 12,
                            fontWeight: '700',
                            color: isSelected ? '#FFFFFF' : theme.textSecondary,
                          }}
                        >
                          {s.name?.toLowerCase().includes('lunch') ? '☀️ ' : s.name?.toLowerCase().includes('dinner') ? '🌙 ' : '🍲 '}
                          {s.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              )}

              {(() => {
                const slotItem = currentSlot;
                const openStr = slotItem.booking_open_time || '05:00 AM';
                const cutoffStr = slotItem.booking_cutoff_time || '11:59 AM';
                const delStart = slotItem.delivery_start_time || '12:30 PM';
                const delEnd = slotItem.delivery_end_time || '02:30 PM';
                const timingText = `Book ${openStr} – ${cutoffStr}  •  Delivered ${delStart}–${delEnd}`;

                let openDayjs = parseTimeToDayjs(openStr);
                let cutoffDayjs = parseTimeToDayjs(cutoffStr);

                if (openDayjs && cutoffDayjs && cutoffDayjs.isBefore(openDayjs)) {
                  if (nowTime.isBefore(cutoffDayjs)) {
                    openDayjs = openDayjs.subtract(1, 'day');
                  } else {
                    cutoffDayjs = cutoffDayjs.add(1, 'day');
                  }
                }

                let slotOpen = false;
                let countdownLabel = 'Booking Closes In';
                let countdownStr = 'Closed';
                let badgeStatus = 'CLOSED';
                let badgeBg = '#FEE2E2';
                let badgeTextColor = '#B91C1C';
                let buttonLabel = "View Today's Menu";

                if (openDayjs && nowTime.isBefore(openDayjs)) {
                  // Not open yet! (e.g. 2:08 AM before 5:00 AM)
                  slotOpen = false;
                  countdownLabel = 'Booking Opens In';
                  const diffMs = openDayjs.diff(nowTime);
                  countdownStr = formatCountdown(diffMs);
                  badgeStatus = 'OPENS SOON';
                  badgeBg = isDark ? 'rgba(251, 191, 36, 0.15)' : '#FEF3C7';
                  badgeTextColor = isDark ? '#FBBF24' : '#D97706';
                  buttonLabel = `Opens at ${openStr} • View Menu`;
                } else if (cutoffDayjs && nowTime.isBefore(cutoffDayjs)) {
                  // Window is live!
                  slotOpen = true;
                  countdownLabel = 'Booking Closes In';
                  const diffMs = cutoffDayjs.diff(nowTime);
                  countdownStr = formatCountdown(diffMs);
                  badgeStatus = 'OPEN';
                  badgeBg = isDark ? 'rgba(34, 197, 94, 0.15)' : '#DCFCE7';
                  badgeTextColor = isDark ? '#4ADE80' : '#15803D';
                  buttonLabel = "View Today's Menu";
                } else {
                  // Cutoff has passed!
                  slotOpen = false;
                  countdownLabel = 'Booking Closed';
                  countdownStr = 'Cutoff Passed';
                  badgeStatus = 'CLOSED';
                  badgeBg = isDark ? 'rgba(239, 68, 68, 0.15)' : '#FEE2E2';
                  badgeTextColor = isDark ? '#F87171' : '#B91C1C';
                  buttonLabel = 'Window Closed • View Menu';
                }

                return (
                  <LinearGradient
                    key={slotItem.id}
                    colors={isDark ? ['#241814', '#151214'] : ['#FFF8F3', '#FEDCC7']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={[
                      styles.heroWindowCard,
                      {
                        borderColor: isDark ? 'rgba(250, 90, 22, 0.45)' : 'rgba(250, 90, 22, 0.22)',
                      },
                    ]}
                  >
                    {/* Header Row: Live Indicator + Open/Closed Pill Badge */}
                    <View style={styles.windowHeaderRow}>
                      <View style={styles.liveIndicatorRow}>
                        <View style={[styles.liveDot, { backgroundColor: isDark ? '#FF6B2C' : '#FA5A16' }]} />
                        <Text style={[styles.liveIndicatorText, { color: isDark ? '#FF6B2C' : '#FA5A16' }]}>
                          LIVE BOOKING WINDOW
                        </Text>
                      </View>
                      <View
                        style={[
                          styles.statusBadgePill,
                          { backgroundColor: badgeBg },
                        ]}
                      >
                        <Text
                          style={[
                            styles.statusBadgeText,
                            { color: badgeTextColor },
                          ]}
                        >
                          {badgeStatus}
                        </Text>
                      </View>
                    </View>

                {/* Hero Body: Text & Countdown on Left, Biryani Bowl on Right */}
                <View style={styles.heroBodyRow}>
                  <View style={styles.heroLeftCol}>
                    <Text style={[styles.slotTitleText, { color: isDark ? '#FFFFFF' : '#111827' }]}>
                      {slotItem.name || 'Lunch special Meal booking'}
                    </Text>
                    <Text style={[styles.slotTimingText, { color: isDark ? '#9CA3AF' : '#4B5563' }]}>
                      {timingText}
                    </Text>

                    {/* Accurate Pill Countdown Box */}
                    <View
                      style={[
                        styles.timerBox,
                        {
                          backgroundColor: isDark ? 'rgba(38, 27, 23, 0.90)' : '#FFFFFF',
                          borderColor: isDark ? 'rgba(250, 90, 22, 0.25)' : 'rgba(250, 90, 22, 0.12)',
                          shadowColor: '#000',
                          shadowOffset: { width: 0, height: 2 },
                          shadowOpacity: isDark ? 0.3 : 0.08,
                          shadowRadius: 8,
                          elevation: 3,
                        },
                      ]}
                    >
                      <Text style={styles.timerEmoji}>⏳</Text>
                      <View style={styles.timerCol}>
                        <Text style={[styles.timerLabel, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>
                          {countdownLabel}
                        </Text>
                        <Text
                          style={[
                            styles.timerValue,
                            { color: isDark ? '#FF6B2C' : '#FA5A16' },
                          ]}
                          numberOfLines={1}
                        >
                          {countdownStr}
                        </Text>
                      </View>
                    </View>
                  </View>

                  {/* 3D Meal Graphic on Right: Uses slotItem.image_url if uploaded by Admin, else Light/Dark Biryani Graphic */}
                  <View style={styles.heroImageWrap}>
                    <Image
                      source={
                        slotItem.image_url
                          ? { uri: slotItem.image_url }
                          : isDark
                          ? require('../../assets/hero_biryani_bowl.jpg')
                          : require('../../assets/hero_biryani_bowl_light.jpg')
                      }
                      style={styles.heroDishImage}
                      resizeMode="cover"
                    />
                  </View>
                </View>

                {/* Full-Width Action Button with Circular Arrow */}
                <TouchableOpacity
                  style={[
                    styles.primaryButton,
                    { backgroundColor: theme.primary },
                  ]}
                  onPress={() => {
                    setActiveSlot(slotItem);
                    navigation.navigate('Menu');
                  }}
                  activeOpacity={0.85}
                >
                  <Text
                    style={[
                      styles.primaryButtonText,
                      { color: '#FFFFFF' },
                    ]}
                  >
                    {buttonLabel}
                  </Text>
                  <View style={[styles.buttonArrowCircle, { backgroundColor: '#FFFFFF' }]}>
                    <Text style={[styles.buttonArrowText, { color: theme.primary }]}>›</Text>
                  </View>
                  </TouchableOpacity>
                </LinearGradient>
              );
            })()}
          </View>
        );
      })()}

        {/* Subscription Section Header with View / Manage All Plans Button */}
        <View style={styles.subSectionHeader}>
          <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>
            {primaryActiveSub ? 'Active Subscription' : 'Meal Subscriptions'}
          </Text>
          <TouchableOpacity
            onPress={() => navigation.navigate('Subscription')}
            activeOpacity={0.7}
          >
            <Text style={[styles.seeAllText, { color: theme.primary }]}>
              {primaryActiveSub ? 'Manage All Plans ›' : 'View All Plans ›'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Dynamic Single Plan Subscription Banner */}
        {primaryActiveSub ? (
          <TouchableOpacity
            style={[
              styles.subscriptionBanner,
              {
                backgroundColor: theme.subCardBg,
                borderColor: theme.subCardBorder,
              },
            ]}
            onPress={() => navigation.navigate('Subscription', { manageSubId: primaryActiveSub.id })}
            activeOpacity={0.8}
          >
            <View style={styles.subBannerLeft}>
              <View style={[styles.subIconWrap, { backgroundColor: isDark ? '#143525' : '#DCFCE7' }]}>
                <Image
                  source={require('../../assets/icon_tiffin_box.jpg')}
                  style={styles.subBannerIcon}
                  resizeMode="cover"
                />
              </View>
              <View style={styles.subBannerTextCol}>
                <Text style={[styles.subBannerTitle, { color: theme.textPrimary }]}>
                  {primaryActiveSub.plan_type || primaryActiveSub.plan_title || 'Tiffin Subscription'}
                </Text>
                <Text style={[styles.subBannerDesc, { color: theme.textSecondary }]}>
                  {primaryActiveSub.meals_remaining ?? 0} Meals Remaining •{' '}
                  {primaryActiveSub.is_paused || primaryActiveSub.status === 'PAUSED'
                    ? 'Deliveries Paused'
                    : 'Auto-Dispatched'}
                </Text>
              </View>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View
                style={[
                  styles.activePill,
                  {
                    backgroundColor:
                      primaryActiveSub.is_paused || primaryActiveSub.status === 'PAUSED'
                        ? '#FEF3C7'
                        : '#DCFCE7',
                  },
                ]}
              >
                <Text
                  style={[
                    styles.activePillText,
                    {
                      color:
                        primaryActiveSub.is_paused || primaryActiveSub.status === 'PAUSED'
                          ? '#D97706'
                          : '#15803D',
                    },
                  ]}
                >
                  {primaryActiveSub.is_paused || primaryActiveSub.status === 'PAUSED'
                    ? 'PAUSED'
                    : 'ACTIVE'}
                </Text>
              </View>
              <Text style={[styles.chevronArrow, { color: theme.textMuted }]}>›</Text>
            </View>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[
              styles.subscriptionBanner,
              {
                backgroundColor: theme.subCardBg,
                borderColor: theme.subCardBorder,
              },
            ]}
            onPress={() => navigation.navigate('Subscription')}
            activeOpacity={0.8}
          >
            <View style={styles.subBannerLeft}>
              <View style={[styles.subIconWrap, { backgroundColor: isDark ? '#143525' : '#DCFCE7' }]}>
                <Image
                  source={require('../../assets/icon_tiffin_box.jpg')}
                  style={styles.subBannerIcon}
                  resizeMode="cover"
                />
              </View>
              <View style={styles.subBannerTextCol}>
                <Text style={[styles.subBannerTitle, { color: theme.textPrimary }]}>
                  Subscribe to Daily Tiffins 🍱
                </Text>
                <Text style={[styles.subBannerDesc, { color: theme.textSecondary }]}>
                  Save up to 30% • Auto-dispatched lunch & dinner
                </Text>
              </View>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={[styles.activePill, { backgroundColor: isDark ? '#1E293B' : '#F1F5F9' }]}>
                <Text style={[styles.activePillText, { color: theme.primary }]}>EXPLORE</Text>
              </View>
              <Text style={[styles.chevronArrow, { color: theme.textMuted }]}>›</Text>
            </View>
          </TouchableOpacity>
        )}

        {/* Explore AFoodoo 2x2 Grid */}
        <View style={styles.exploreSectionHeader}>
          <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>Explore AFoodoo</Text>
        </View>

        <View style={styles.gridRow}>
          {/* Browse Menu */}
          <TouchableOpacity
            style={[
              styles.modernGridCard,
              { backgroundColor: theme.menuCardBg, borderColor: theme.menuCardBorder },
            ]}
            onPress={() => navigation.navigate('Menu')}
            activeOpacity={0.8}
          >
            <View style={styles.gridCardTop}>
              <Image source={require('../../assets/icon_browse_menu.jpg')} style={styles.gridCardIcon} />
              <View style={[styles.gridArrowCircle, { backgroundColor: theme.menuCardArrowBg }]}>
                <Text style={[styles.gridArrowChar, { color: theme.textPrimary }]}>›</Text>
              </View>
            </View>
            <Text style={[styles.gridTitle, { color: theme.textPrimary }]}>Browse Menu</Text>
            <Text style={[styles.gridSub, { color: theme.textSecondary }]}>Fresh daily items</Text>
          </TouchableOpacity>

          {/* Track Order */}
          <TouchableOpacity
            style={[
              styles.modernGridCard,
              { backgroundColor: theme.orderCardBg, borderColor: theme.orderCardBorder },
            ]}
            onPress={() => navigation.navigate('OrderTracking', { orderId: 'ord_849201' })}
            activeOpacity={0.8}
          >
            <View style={styles.gridCardTop}>
              <Image source={require('../../assets/icon_track_order.jpg')} style={styles.gridCardIcon} />
              <View style={[styles.gridArrowCircle, { backgroundColor: theme.orderCardArrowBg }]}>
                <Text style={[styles.gridArrowChar, { color: theme.textPrimary }]}>›</Text>
              </View>
            </View>
            <Text style={[styles.gridTitle, { color: theme.textPrimary }]}>Track Order</Text>
            <Text style={[styles.gridSub, { color: theme.textSecondary }]}>Live status stepper</Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.gridRow, { marginTop: 12 }]}>
          {/* Top-Up Wallet */}
          <TouchableOpacity
            style={[
              styles.modernGridCard,
              { backgroundColor: theme.walletCardBg, borderColor: theme.walletCardBorder },
            ]}
            onPress={() => navigation.navigate('Wallet')}
            activeOpacity={0.8}
          >
            <View style={styles.gridCardTop}>
              <Image source={require('../../assets/icon_topup_wallet.jpg')} style={styles.gridCardIcon} />
              <View style={[styles.gridArrowCircle, { backgroundColor: theme.walletCardArrowBg }]}>
                <Text style={[styles.gridArrowChar, { color: theme.textPrimary }]}>›</Text>
              </View>
            </View>
            <Text style={[styles.gridTitle, { color: theme.textPrimary }]}>Top-Up Wallet</Text>
            <Text style={[styles.gridSub, { color: theme.textSecondary }]}>Instant credit</Text>
          </TouchableOpacity>

          {/* Account & Settings */}
          <TouchableOpacity
            style={[
              styles.modernGridCard,
              { backgroundColor: theme.accountCardBg, borderColor: theme.accountCardBorder },
            ]}
            onPress={() => navigation.navigate('Profile')}
            activeOpacity={0.8}
          >
            <View style={styles.gridCardTop}>
              <Image source={require('../../assets/icon_account_settings.jpg')} style={styles.gridCardIcon} />
              <View style={[styles.gridArrowCircle, { backgroundColor: theme.accountCardArrowBg }]}>
                <Text style={[styles.gridArrowChar, { color: theme.textPrimary }]}>›</Text>
              </View>
            </View>
            <Text style={[styles.gridTitle, { color: theme.textPrimary }]}>Account & Settings</Text>
            <Text style={[styles.gridSub, { color: theme.textSecondary }]}>Profile & Help Center</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Persistent Bottom Navigation Bar */}
      <BottomNavBar currentTab="Home" onSelectTab={handleTabSelect} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  container: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 20 },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    paddingTop: 2,
  },
  headerLeftCol: {
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  headerBrandLogo: {
    width: 86,
    height: 36,
  },
  headerCenterCol: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  greetingSmallText: {
    fontSize: 10.5,
    fontWeight: '600',
    marginBottom: 1,
    textAlign: 'center',
  },
  userNameHeading: {
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'center',
  },
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  walletBadgeCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    paddingHorizontal: 7,
    paddingVertical: 5,
    borderRadius: 14,
    minHeight: 30,
  },
  walletTextCompact: {
    fontSize: 11.5,
    fontWeight: '800',
    marginLeft: 3,
  },
  headerIconBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  unreadBadgeDot: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 7,
    height: 7,
    borderRadius: 3.5,
    borderWidth: 1.5,
  },
  cartBadgeDot: {
    position: 'absolute',
    top: -3,
    right: -4,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#FF6B00',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 3,
  },
  cartBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '900',
  },
  addressBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
    marginBottom: 16,
    borderWidth: 1,
    minHeight: 38,
  },
  addressPin: { marginRight: 6, fontSize: 14 },
  addressText: { fontSize: 12, flex: 1, fontWeight: '600' },
  addressCaret: { fontSize: 12, fontWeight: '800', marginLeft: 6 },
  heroWindowCard: {
    borderRadius: 22,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1.5,
    shadowColor: '#FA5A16',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 4,
  },
  windowHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  liveIndicatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
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
    letterSpacing: 0.3,
  },
  heroBodyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  heroLeftCol: {
    flex: 1.15,
    paddingRight: 8,
  },
  slotTitleText: {
    fontSize: 18.5,
    fontWeight: '900',
    marginBottom: 4,
    letterSpacing: -0.3,
  },
  slotTimingText: {
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 12,
    lineHeight: 16,
  },
  timerBox: {
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
  },
  timerEmoji: {
    fontSize: 26,
    marginRight: 10,
  },
  timerCol: {
    flex: 1,
    justifyContent: 'center',
  },
  timerLabel: {
    fontSize: 10.5,
    fontWeight: '600',
    marginBottom: 2,
  },
  timerValue: {
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  heroImageWrap: {
    flex: 0.95,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroDishImage: {
    width: 130,
    height: 130,
    borderRadius: 22,
  },
  primaryButton: {
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 46,
    position: 'relative',
    shadowColor: '#FA5A16',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
  },
  primaryButtonText: {
    fontSize: 15,
    fontWeight: '800',
  },
  buttonArrowCircle: {
    position: 'absolute',
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonArrowText: {
    fontSize: 16,
    fontWeight: '900',
    lineHeight: 18,
  },
  subSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  subscriptionBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1.2,
    marginBottom: 20,
  },
  subBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  subIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginRight: 10,
  },
  subBannerIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
  },
  subBannerTextCol: {
    flex: 1,
  },
  subBannerTitle: {
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 2,
  },
  subBannerDesc: {
    fontSize: 11,
    fontWeight: '500',
  },
  activePill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    marginRight: 6,
  },
  activePillText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  chevronArrow: {
    fontSize: 16,
    fontWeight: '800',
  },
  exploreSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '900',
    letterSpacing: -0.2,
  },
  seeAllText: {
    fontSize: 12,
    fontWeight: '700',
  },
  gridRow: {
    flexDirection: 'row',
    gap: 12,
  },
  modernGridCard: {
    flex: 1,
    borderRadius: 20,
    padding: 14,
    borderWidth: 1.2,
    minHeight: 115,
  },
  gridCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  gridCardIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
  },
  gridArrowCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gridArrowChar: {
    fontSize: 14,
    fontWeight: '800',
    lineHeight: 16,
  },
  gridTitle: {
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 2,
  },
  gridSub: {
    fontSize: 11,
    fontWeight: '500',
  },
});
