import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { useAppStore } from '../store/appStore';
import { firestore } from '../firebaseConfig';
import { collection, query, where, onSnapshot, DocumentData } from '@firebase/firestore';
import dayjs from 'dayjs';

export default function HomeScreen({ navigation }: any) {
  const user = useAppStore(state => state.user);
  const subscriptions = useAppStore(state => state.subscriptions);
  const activeSlot = useAppStore(state => state.activeSlot);
  const setActiveSlot = useAppStore(state => state.setActiveSlot);

  const [countdown, setCountdown] = useState<string>('');
  const [isSlotOpen, setIsSlotOpen] = useState<boolean>(true);
  const [slotTitle, setSlotTitle] = useState<string>('Lunch Tiffin Slot');
  const [slotTimingText, setSlotTimingText] = useState<string>('8:00 AM – 11:00 AM  •  Delivery 1–2 PM');

  // Realtime Firestore subscription for active meal slot
  useEffect(() => {
    try {
      const q = query(collection(firestore, 'meal_slots'), where('active', '==', true));
      const unsub = onSnapshot(
        q,
        snap => {
          if (!snap.empty) {
            const docData = snap.docs[0].data() as DocumentData;
            const slotObj = { id: snap.docs[0].id, ...docData };
            setActiveSlot(slotObj as any);
            setSlotTitle((slotObj as any).name || 'Lunch Tiffin');
          } else {
            // Fallback default active slot (Lunch 8-11 AM cutoff)
            const fallbackSlot = {
              id: 'slot_lunch_today',
              name: 'Lunch Tiffin Special',
              booking_open_time: new Date(),
              booking_cutoff_time: new Date(Date.now() + 42 * 60000), // 42 mins remaining
              delivery_start_time: new Date(Date.now() + 120 * 60000),
              delivery_end_time: new Date(Date.now() + 180 * 60000),
              active: true,
            };
            setActiveSlot(fallbackSlot as any);
          }
        },
        err => {
          console.log('Firestore meal_slots info:', err.message);
          // Set default fallback slot
          const fallbackSlot = {
            id: 'slot_lunch_today',
            name: 'Lunch Tiffin Special',
            booking_open_time: new Date(),
            booking_cutoff_time: new Date(Date.now() + 42 * 60000),
            delivery_start_time: new Date(Date.now() + 120 * 60000),
            delivery_end_time: new Date(Date.now() + 180 * 60000),
            active: true,
          };
          setActiveSlot(fallbackSlot as any);
        }
      );
      return unsub;
    } catch (e) {
      console.log('Using default local meal slot state');
    }
  }, []);

  // Update countdown timer every second based on server cutoff time
  useEffect(() => {
    const updateTimer = () => {
      if (!activeSlot || !activeSlot.booking_cutoff_time) {
        setCountdown('42m 15s remaining');
        setIsSlotOpen(true);
        return;
      }
      const cutoffDate = activeSlot.booking_cutoff_time.toDate
        ? activeSlot.booking_cutoff_time.toDate()
        : new Date(activeSlot.booking_cutoff_time);

      const now = dayjs();
      const diffMs = cutoffDate.getTime() - now.valueOf();

      if (diffMs > 0) {
        const mins = Math.floor(diffMs / 60000);
        const secs = Math.floor((diffMs % 60000) / 1000);
        setCountdown(`${mins}m ${secs < 10 ? '0' : ''}${secs}s`);
        setIsSlotOpen(true);
      } else {
        setCountdown('Booking Window Closed');
        setIsSlotOpen(false);
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [activeSlot]);

  if (!user) {
    navigation.replace('Auth');
    return null;
  }

  const activeSub = subscriptions && subscriptions.length > 0 ? subscriptions[0] : null;

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />
      <ScrollView contentContainerStyle={styles.container}>
        {/* Header User Greeting */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greetingText}>Welcome back,</Text>
            <Text style={styles.userNameText}>{user.name || 'Food Lover'}</Text>
          </View>
          <TouchableOpacity
            style={styles.walletBadge}
            onPress={() => navigation.navigate('Wallet')}
          >
            <Text style={styles.walletBadgeIcon}>💳</Text>
            <Text style={styles.walletBadgeText}>${user.wallet_balance ?? 500}</Text>
          </TouchableOpacity>
        </View>

        {/* Address Banner */}
        <TouchableOpacity style={styles.addressBar} onPress={() => navigation.navigate('Profile')}>
          <Text style={styles.addressIcon}>📍</Text>
          <Text style={styles.addressText} numberOfLines={1}>
            {user.addresses && user.addresses.length > 0
              ? user.addresses[0].line1
              : 'Set Delivery Address'}
          </Text>
          <Text style={styles.addressArrow}>›</Text>
        </TouchableOpacity>

        {/* Live Booking Window Banner */}
        <View style={[styles.windowBannerCard, !isSlotOpen && styles.windowBannerClosed]}>
          <View style={styles.slotHeaderRow}>
            <View style={styles.slotTitleGroup}>
              <Text style={styles.liveIndicator}>● LIVE BOOKING WINDOW</Text>
              <Text style={styles.slotTitle}>{activeSlot?.name || slotTitle}</Text>
            </View>
            <View style={[styles.statusBadge, !isSlotOpen && styles.statusBadgeClosed]}>
              <Text style={styles.statusBadgeText}>{isSlotOpen ? 'OPEN' : 'CLOSED'}</Text>
            </View>
          </View>

          <Text style={styles.timingText}>{slotTimingText}</Text>

          {/* Countdown Clock */}
          <View style={styles.timerContainer}>
            <Text style={styles.timerLabel}>
              {isSlotOpen ? 'Booking Closes In' : 'Next Window Opens at 5:00 PM (Dinner)'}
            </Text>
            {isSlotOpen ? (
              <Text style={styles.timerClock}>⏳ {countdown}</Text>
            ) : (
              <Text style={styles.timerClockClosed}>🔒 Cutoff Passed</Text>
            )}
          </View>

          <TouchableOpacity
            style={[styles.menuButton, !isSlotOpen && styles.menuButtonDisabled]}
            onPress={() => navigation.navigate('Menu')}
          >
            <Text style={styles.menuButtonText}>
              {isSlotOpen ? "View Today's Menu 🍲" : 'View Upcoming Menu'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Active Subscription Pack Card */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Your Active Subscription</Text>
          <TouchableOpacity onPress={() => navigation.navigate('Subscription')}>
            <Text style={styles.sectionAction}>Manage ›</Text>
          </TouchableOpacity>
        </View>

        {activeSub ? (
          <View style={styles.subCard}>
            <View style={styles.subRow}>
              <View style={styles.subIconBadge}>
                <Text style={styles.subIcon}>📅</Text>
              </View>
              <View style={styles.subInfo}>
                <Text style={styles.subTitle}>{activeSub.plan_type}</Text>
                <Text style={styles.subMeta}>Auto-Renew: {activeSub.auto_renew ? 'ON' : 'OFF'}</Text>
              </View>
              <View style={styles.mealsPill}>
                <Text style={styles.mealsPillCount}>{activeSub.meals_remaining}</Text>
                <Text style={styles.mealsPillLabel}>Meals Left</Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.skipButton}
              onPress={() => navigation.navigate('Subscription')}
            >
              <Text style={styles.skipButtonText}>Pause / Skip Tomorrow's Meal ⏸️</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            style={styles.noSubCard}
            onPress={() => navigation.navigate('Subscription')}
          >
            <Text style={styles.noSubEmoji}>✨</Text>
            <Text style={styles.noSubTitle}>Save with a Monthly Tiffin Pack</Text>
            <Text style={styles.noSubText}>Get 10 or 20 meal packs with priority delivery.</Text>
            <Text style={styles.noSubLink}>Explore Plans & Pass →</Text>
          </TouchableOpacity>
        )}

        {/* Navigation Grid Shortcuts */}
        <Text style={[styles.sectionTitle, { marginTop: 24, marginBottom: 12 }]}>Explore AFoodoo</Text>
        <View style={styles.gridContainer}>
          <TouchableOpacity
            style={styles.gridItem}
            onPress={() => navigation.navigate('Menu')}
          >
            <Text style={styles.gridEmoji}>🍱</Text>
            <Text style={styles.gridTitle}>Browse Menu</Text>
            <Text style={styles.gridSub}>Fresh daily items</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.gridItem}
            onPress={() => navigation.navigate('OrderTracking', { orderId: 'demo-order-123' })}
          >
            <Text style={styles.gridEmoji}>🚴</Text>
            <Text style={styles.gridTitle}>Track Order</Text>
            <Text style={styles.gridSub}>Live status stepper</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.gridItem}
            onPress={() => navigation.navigate('Wallet')}
          >
            <Text style={styles.gridEmoji}>👛</Text>
            <Text style={styles.gridTitle}>AFoodoo Wallet</Text>
            <Text style={styles.gridSub}>Fast 1-tap checkout</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.gridItem}
            onPress={() => navigation.navigate('Profile')}
          >
            <Text style={styles.gridEmoji}>👤</Text>
            <Text style={styles.gridTitle}>Profile & Help</Text>
            <Text style={styles.gridSub}>Addresses & History</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FAF7F2' },
  container: { padding: 20 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  greetingText: { fontSize: 13, color: '#757575', fontWeight: '500' },
  userNameText: { fontSize: 22, fontWeight: '800', color: '#2C2C2C' },
  walletBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF3E0',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#FFE0B2',
  },
  walletBadgeIcon: { fontSize: 14, marginRight: 4 },
  walletBadgeText: { fontSize: 14, fontWeight: '700', color: '#E65100' },
  addressBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#EEEEEE',
  },
  addressIcon: { fontSize: 14, marginRight: 8 },
  addressText: { flex: 1, fontSize: 13, color: '#424242', fontWeight: '500' },
  addressArrow: { fontSize: 18, color: '#9E9E9E', fontWeight: '600' },
  windowBannerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    marginBottom: 24,
    shadowColor: '#D84315',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
    borderLeftWidth: 5,
    borderLeftColor: '#D84315',
  },
  windowBannerClosed: {
    borderLeftColor: '#9E9E9E',
  },
  slotHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  slotTitleGroup: { flex: 1 },
  liveIndicator: { fontSize: 11, fontWeight: '800', color: '#D84315', letterSpacing: 0.5, marginBottom: 2 },
  slotTitle: { fontSize: 20, fontWeight: '800', color: '#2C2C2C' },
  statusBadge: { backgroundColor: '#E8F5E9', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  statusBadgeClosed: { backgroundColor: '#FFEBEE' },
  statusBadgeText: { fontSize: 11, fontWeight: '800', color: '#2E7D32' },
  timingText: { fontSize: 13, color: '#616161', marginTop: 4, marginBottom: 16 },
  timerContainer: { backgroundColor: '#FAF7F2', padding: 14, borderRadius: 12, alignItems: 'center', marginBottom: 16 },
  timerLabel: { fontSize: 12, color: '#757575', fontWeight: '600', marginBottom: 4 },
  timerClock: { fontSize: 22, fontWeight: '800', color: '#D84315' },
  timerClockClosed: { fontSize: 18, fontWeight: '700', color: '#757575' },
  menuButton: { backgroundColor: '#D84315', paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  menuButtonDisabled: { backgroundColor: '#9E9E9E' },
  menuButtonText: { color: '#FFF', fontSize: 15, fontWeight: '700' },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#2C2C2C' },
  sectionAction: { fontSize: 13, fontWeight: '600', color: '#D84315' },
  subCard: { backgroundColor: '#FFF', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#EEEEEE' },
  subRow: { flexDirection: 'row', alignItems: 'center' },
  subIconBadge: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#FFF3E0', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  subIcon: { fontSize: 22 },
  subInfo: { flex: 1 },
  subTitle: { fontSize: 15, fontWeight: '700', color: '#2C2C2C' },
  subMeta: { fontSize: 12, color: '#757575', marginTop: 2 },
  mealsPill: { alignItems: 'center', backgroundColor: '#E65100', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  mealsPillCount: { fontSize: 16, fontWeight: '800', color: '#FFF' },
  mealsPillLabel: { fontSize: 9, fontWeight: '700', color: '#FFE0B2' },
  skipButton: { marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#F5F5F5', alignItems: 'center' },
  skipButtonText: { fontSize: 13, fontWeight: '600', color: '#D84315' },
  noSubCard: { backgroundColor: '#FFF8F0', borderRadius: 16, padding: 20, borderWidth: 1, borderColor: '#FFE0B2', alignItems: 'center' },
  noSubEmoji: { fontSize: 32, marginBottom: 8 },
  noSubTitle: { fontSize: 16, fontWeight: '700', color: '#E65100', marginBottom: 4 },
  noSubText: { fontSize: 13, color: '#6D4C41', textAlign: 'center', marginBottom: 12 },
  noSubLink: { fontSize: 14, fontWeight: '700', color: '#D84315' },
  gridContainer: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  gridItem: { width: '48%', backgroundColor: '#FFF', borderRadius: 16, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: '#EEEEEE' },
  gridEmoji: { fontSize: 28, marginBottom: 8 },
  gridTitle: { fontSize: 14, fontWeight: '700', color: '#2C2C2C' },
  gridSub: { fontSize: 11, color: '#757575', marginTop: 2 },
});
