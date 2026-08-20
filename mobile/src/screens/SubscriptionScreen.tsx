import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  TextInput,
  Switch,
  SafeAreaView,
  ScrollView,
} from 'react-native';
import { useAppStore } from '../store/appStore';
import { fetchSubscriptions, pauseSubscription, createSubscription } from '../api/subscriptions';
import dayjs from 'dayjs';
import { useTheme } from '../theme/ThemeContext';

// Wallet credit amounts credited when a plan is purchased.
const PLAN_WALLET_CREDITS: Record<string, number> = {
  p1: 1000,  // Lunch Weekly
  p2: 3500,  // Lunch Monthly
  p3: 1000,  // Dinner Weekly
  p4: 4000,  // Dinner Monthly
  p5: 7500,  // Lunch + Dinner Combo
};

const AVAILABLE_PLANS = [
  {
    id: 'p1',
    title: 'Lunch Weekly',
    type: 'Lunch',
    meals: 7,
    price: 649,
    duration: '1 Week',
    tag: '🆕 Starter',
    desc: '7 lunch tiffin meals • Mon–Sun',
  },
  {
    id: 'p2',
    title: 'Lunch Monthly',
    type: 'Lunch',
    meals: 30,
    price: 2199,
    duration: '1 Month',
    tag: '🔥 Most Popular',
    desc: '30 lunch tiffin meals • Mon–Sun',
  },
  {
    id: 'p3',
    title: 'Dinner Weekly',
    type: 'Dinner',
    meals: 7,
    price: 699,
    duration: '1 Week',
    tag: '⭐ Best Value',
    desc: '7 dinner tiffin meals • Mon–Sun',
  },
  {
    id: 'p4',
    title: 'Dinner Monthly',
    type: 'Dinner',
    meals: 30,
    price: 2499,
    duration: '1 Month',
    tag: '🌙 Night Saver',
    desc: '30 dinner tiffin meals • Mon–Sun',
  },
  {
    id: 'p5',
    title: 'Lunch + Dinner Combo',
    type: 'Combo',
    meals: 60,
    price: 4299,
    duration: '1 Month',
    tag: '👑 Premium',
    desc: '60 meals (Lunch & Dinner) • Mon–Sun',
  },
];

export default function SubscriptionScreen({ navigation }: any) {
  const { theme } = useTheme();
  const user = useAppStore(state => state.user);
  const subscriptions = useAppStore(state => state.subscriptions);
  const setSubscriptions = useAppStore(state => state.setSubscriptions);
  const creditWalletBalance = useAppStore(state => state.creditWalletBalance);

  const [availablePlans, setAvailablePlans] = useState<any[]>(AVAILABLE_PLANS);
  const [skipDate, setSkipDate] = useState(dayjs().add(1, 'day').format('YYYY-MM-DD'));
  const [selectedPlan, setSelectedPlan] = useState<any>(AVAILABLE_PLANS[1]);
  const [autoRenew, setAutoRenew] = useState(true);
  const [loading, setLoading] = useState(false);

  // Live Cloud Firestore listener for admin-managed meal plans
  useEffect(() => {
    try {
      const { collection, onSnapshot } = require('firebase/firestore');
      const { firestore } = require('../firebaseConfig');
      const unsub = onSnapshot(collection(firestore, 'meal_plans'), (snap: any) => {
        if (!snap.empty) {
          const list = snap.docs
            .map((d: any) => ({ id: d.id, ...d.data() }))
            .filter((p: any) => p.active ?? true);
          if (list.length > 0) {
            setAvailablePlans(list);
            setSelectedPlan(list[0]);
          }
        }
      });
      return unsub;
    } catch (e) {}
  }, []);

  // Live Cloud Firestore subscription listener for user's active plan packs
  useEffect(() => {
    if (!user?.phone) return;
    const cleanPhone = user.phone.trim();
    const userDocId = user.id || `usr_${cleanPhone.replace(/\D/g, '')}`;

    try {
      const { collection, onSnapshot } = require('firebase/firestore');
      const { firestore } = require('../firebaseConfig');
      const unsub = onSnapshot(collection(firestore, 'subscriptions'), (snap: any) => {
        if (!snap.empty) {
          const list = snap.docs
            .map((d: any) => ({ id: d.id, ...d.data() }))
            .filter((d: any) => d.user_phone === cleanPhone || d.user_id === userDocId);
          if (list.length > 0) {
            setSubscriptions(list);
          }
        }
      });
      return unsub;
    } catch (e) {}
  }, [user?.phone, user?.id]);

  // Read live UPI ID from Cloud Firestore settings/delivery_config
  const [upiId, setUpiId] = useState('afoodoo@upi');
  const [merchantName, setMerchantName] = useState('AFoodoo Kitchen');

  useEffect(() => {
    try {
      const { doc, onSnapshot } = require('firebase/firestore');
      const { firestore } = require('../firebaseConfig');
      const unsub = onSnapshot(doc(firestore, 'settings', 'delivery_config'), (snap: any) => {
        if (snap.exists()) {
          const d = snap.data();
          if (d.upi_id) setUpiId(d.upi_id);
          if (d.merchant_name) setMerchantName(d.merchant_name);
        }
      });
      return unsub;
    } catch (e) {}
  }, []);

  const handleSubscribe = async () => {
    if (!user) {
      Alert.alert('Login Required', 'Please sign in to buy a subscription pack.');
      return;
    }

    const { generateUpiUrl } = require('../utils/upi');
    const { Linking } = require('react-native');
    const upiUrl = generateUpiUrl({
      upiId: upiId || 'afoodoo@upi',
      merchantName: merchantName || 'AFoodoo Kitchen',
      amount: selectedPlan.price,
      note: `AFoodoo Plan — ${selectedPlan.title}`,
    });

    try {
      const canOpen = await Linking.canOpenURL(upiUrl);
      if (canOpen) {
        await Linking.openURL(upiUrl);
      } else {
        Alert.alert(
          'UPI App Required 📱',
          `Please install a UPI app (Google Pay, PhonePe, Paytm, BHIM) or pay directly to UPI ID: ${upiId}`
        );
      }
    } catch (e) {}

    // Show UTR payment confirmation dialog
    Alert.prompt(
      'Confirm UPI Payment 📱',
      `Enter the 12-digit UPI Transaction / UTR Ref Number received in your payment app for ${selectedPlan.title} (₹${selectedPlan.price}):`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Confirm & Activate Plan',
          onPress: async (utrNumber?: string) => {
            setLoading(true);
            const startDate = new Date().toISOString();
            const durationDays = selectedPlan.duration === '1 Week' ? 7 : 30;
            const endDate = new Date(Date.now() + durationDays * 86400000).toISOString();
            const cleanPhone = user.phone ? user.phone.trim() : '';
            const userDocId = user.id || `usr_${cleanPhone.replace(/\D/g, '')}`;
            const subDocId = `sub_${Date.now()}`;

            const subDocData = {
              id: subDocId,
              user_id: userDocId,
              user_phone: cleanPhone,
              user_name: user.name || `Customer (${cleanPhone})`,
              plan_type: selectedPlan.title,
              meals_remaining: selectedPlan.meals,
              total_meals: selectedPlan.meals,
              start_date: startDate,
              end_date: endDate,
              status: 'ACTIVE',
              is_paused: false,
              paused_dates: [],
              auto_renew: autoRenew,
              utr_number: utrNumber || 'UPI_DIRECT',
              payment_method: 'upi',
              created_at: startDate,
            };

            try {
              const { doc, setDoc, updateDoc, arrayUnion } = require('firebase/firestore');
              const { firestore } = require('../firebaseConfig');
              await setDoc(doc(firestore, 'subscriptions', subDocId), subDocData);
              await updateDoc(doc(firestore, 'users', userDocId), {
                subscription_ids: arrayUnion(subDocId),
                active_subscription: selectedPlan.title,
              });
            } catch (fsErr) {}

            const creditAmount = selectedPlan.wallet_credit || PLAN_WALLET_CREDITS[selectedPlan.id] || selectedPlan.price || 0;
            if (creditAmount > 0) {
              creditWalletBalance(creditAmount, `Wallet Bonus — ${selectedPlan.title} Purchase 🎁`, 'plan_credit');
            }

            setLoading(false);
            Alert.alert(
              'Subscription Activated! 🎉',
              `You unlocked ${selectedPlan.meals} meals with ${selectedPlan.title}.\n\n🎁 ₹${creditAmount.toLocaleString('en-IN')} credited to your AFoodoo Wallet!`
            );
          },
        },
      ],
      'plain-text',
      '',
      'number-pad'
    );
  };

  const handlePause = async (subId: string) => {
    if (!skipDate) {
      Alert.alert('Select Date', 'Please enter a skip date (YYYY-MM-DD)');
      return;
    }

    try {
      const { doc, updateDoc, arrayUnion } = require('firebase/firestore');
      const { firestore } = require('../firebaseConfig');
      await updateDoc(doc(firestore, 'subscriptions', subId), {
        is_paused: true,
        status: 'PAUSED',
        paused_dates: arrayUnion(skipDate),
      });
    } catch (e) {
      console.log('Notice pausing subscription in Firestore:', e);
    }

    setSubscriptions(
      subscriptions.map((s: any) =>
        s.id === subId
          ? {
              ...s,
              is_paused: true,
              status: 'PAUSED',
              paused_dates: s.paused_dates ? [...s.paused_dates, skipDate] : [skipDate],
            }
          : s
      )
    );

    Alert.alert(
      'Meal Delivery Paused ⏸️',
      `Your meal delivery for ${skipDate} has been paused. It is flagged live on the Admin portal.`
    );
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={[styles.pageTitle, { color: theme.textPrimary }]}>Tiffin Packs & Subscriptions 🍱</Text>

        {/* Active Subscriptions List */}
        <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>Active Subscriptions</Text>
        {subscriptions && subscriptions.length > 0 ? (
          subscriptions.map((sub: any) => (
            <View
              key={sub.id}
              style={[
                styles.activeCard,
                { backgroundColor: theme.surface, borderColor: theme.surfaceBorder },
              ]}
            >
              <View style={styles.activeHeaderRow}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.activeTitle, { color: theme.textPrimary }]}>{sub.plan_type}</Text>
                  <Text style={[styles.activeDate, { color: theme.textSecondary }]}>
                    Valid until {dayjs(sub.end_date).format('MMM DD, YYYY')}
                  </Text>
                </View>
                <View style={[styles.mealsBadge, { backgroundColor: theme.primary }]}>
                  <Text style={styles.mealsBadgeCount}>{sub.meals_remaining}</Text>
                  <Text style={styles.mealsBadgeLabel}>Meals Left</Text>
                </View>
              </View>

              <View style={[styles.divider, { backgroundColor: theme.surfaceBorder }]} />

              <Text style={[styles.pauseHeading, { color: theme.textPrimary }]}>Pause / Skip Specific Day's Meal</Text>
              <Text style={[styles.pauseSub, { color: theme.textSecondary }]}>
                Free up a slot count without losing a meal balance.
              </Text>
              <View style={styles.pauseRow}>
                <TextInput
                  style={[
                    styles.dateInput,
                    {
                      backgroundColor: theme.inputBg,
                      borderColor: theme.inputBorder,
                      color: theme.inputText,
                    },
                  ]}
                  value={skipDate}
                  onChangeText={setSkipDate}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={theme.textMuted}
                />
                <TouchableOpacity
                  style={[styles.pauseButton, { backgroundColor: theme.primary }]}
                  onPress={() => handlePause(sub.id)}
                >
                  <Text style={[styles.pauseButtonText, { color: theme.buttonText }]}>Skip Meal ⏸️</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        ) : (
          <View
            style={[
              styles.noSubBox,
              { backgroundColor: theme.surface, borderColor: theme.surfaceBorder },
            ]}
          >
            <Text style={[styles.noSubText, { color: theme.textPrimary }]}>No active subscription pack found.</Text>
            <Text style={[styles.noSubHint, { color: theme.textSecondary }]}>Choose a plan below to get started 👇</Text>
          </View>
        )}

        {/* Buy New Subscription Pack */}
        <Text style={[styles.sectionTitle, { color: theme.textPrimary, marginTop: 24 }]}>Buy New Meal Pack</Text>
        <Text style={[styles.planNote, { color: theme.textMuted }]}>
          ℹ️ Pricing managed by admin portal. Shown prices are indicative.
        </Text>

        {availablePlans.map((plan: any) => {
          const isSelected = selectedPlan && selectedPlan.id === plan.id;
          const walletCredit = plan.wallet_credit || PLAN_WALLET_CREDITS[plan.id] || plan.price || 0;
          const saving = walletCredit > plan.price ? walletCredit - plan.price : 0;
          return (
            <TouchableOpacity
              key={plan.id}
              style={[
                styles.planCard,
                {
                  backgroundColor: isSelected ? theme.primaryLight : theme.surface,
                  borderColor: isSelected ? theme.primary : theme.surfaceBorder,
                },
              ]}
              onPress={() => setSelectedPlan(plan)}
            >
              <View style={styles.planHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.planTitle, { color: theme.textPrimary }]}>{plan.title}</Text>
                  <Text style={[styles.planDesc, { color: theme.textSecondary }]}>{plan.description || plan.desc}</Text>
                </View>
                {plan.tag ? (
                  <View
                    style={[
                      styles.tagBadge,
                      { backgroundColor: theme.accentBadgeBg },
                      plan.category === 'Combo' && { backgroundColor: theme.primaryLight },
                    ]}
                  >
                    <Text style={[styles.tagText, { color: theme.accent }]}>{plan.tag}</Text>
                  </View>
                ) : null}
              </View>

              {/* Wallet Credit Banner */}
              <View
                style={[
                  styles.walletCreditBanner,
                  { backgroundColor: theme.statusSuccessBg, borderColor: theme.statusSuccessText },
                ]}
              >
                <Text style={styles.walletCreditIcon}>💳</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.walletCreditLabel, { color: theme.statusSuccessText }]}>
                    WALLET CREDIT ON PURCHASE
                  </Text>
                  <Text style={[styles.walletCreditAmount, { color: theme.statusSuccessText }]}>
                    ₹{walletCredit.toLocaleString('en-IN')}
                    <Text style={styles.walletCreditSaving}>
                      {saving > 0 ? `  +₹${saving.toLocaleString('en-IN')} bonus` : ''}
                    </Text>
                  </Text>
                </View>
              </View>

              <View style={styles.planPriceRow}>
                <Text style={[styles.planDuration, { color: theme.textSecondary }]}>
                  📅 {plan.duration} • {plan.meals} meals
                </Text>
                <Text style={[styles.planPrice, { color: theme.primary }]}>
                  ₹{Number(plan.price || 0).toLocaleString('en-IN')}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}

        {/* Auto Renew Switch */}
        <View style={styles.switchRow}>
          <Text style={[styles.switchLabel, { color: theme.textPrimary }]}>Auto-renew plan when meals run out</Text>
          <Switch
            value={autoRenew}
            onValueChange={setAutoRenew}
            trackColor={{ false: theme.inputBorder, true: '#FFAB91' }}
            thumbColor={autoRenew ? theme.primary : theme.inputBg}
          />
        </View>

        <TouchableOpacity
          style={[styles.buyButton, { backgroundColor: theme.primary }]}
          onPress={handleSubscribe}
          disabled={loading}
        >
          <Text style={[styles.buyButtonText, { color: theme.buttonText }]}>
            {loading
              ? 'Activating Plan...'
              : `📱 Pay ₹${selectedPlan.price.toLocaleString('en-IN')} via Direct UPI`}
          </Text>
          {!loading && (
            <Text style={styles.buyButtonSub}>
              0% Fee • Instant 1-Tap GPay / PhonePe / Paytm Payment
            </Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  container: { padding: 20 },
  pageTitle: { fontSize: 22, fontWeight: '800', marginBottom: 16 },
  sectionTitle: { fontSize: 16, fontWeight: '700', marginBottom: 12 },
  planNote: { fontSize: 11, marginBottom: 12, fontStyle: 'italic' },
  activeCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
  },
  activeHeaderRow: { flexDirection: 'row', alignItems: 'center' },
  activeTitle: { fontSize: 16, fontWeight: '700' },
  activeDate: { fontSize: 12, marginTop: 2 },
  mealsBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, alignItems: 'center' },
  mealsBadgeCount: { fontSize: 16, fontWeight: '800', color: '#FFF' },
  mealsBadgeLabel: { fontSize: 9, color: '#FFE0B2', fontWeight: '700' },
  divider: { height: 1, marginVertical: 14 },
  pauseHeading: { fontSize: 13, fontWeight: '700' },
  pauseSub: { fontSize: 11, marginBottom: 10 },
  pauseRow: { flexDirection: 'row', alignItems: 'center' },
  dateInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
    marginRight: 10,
    minHeight: 44,
  },
  pauseButton: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    minHeight: 44,
    justifyContent: 'center',
  },
  pauseButtonText: { fontSize: 13, fontWeight: '700' },
  noSubBox: { borderRadius: 12, padding: 20, alignItems: 'center', borderWidth: 1, marginBottom: 8 },
  noSubText: { fontSize: 14, fontWeight: '700' },
  noSubHint: { fontSize: 12, marginTop: 4 },
  planCard: {
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1.5,
  },
  planHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
  planTitle: { fontSize: 16, fontWeight: '700' },
  planDesc: { fontSize: 12, marginTop: 2 },
  tagBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, marginLeft: 8 },
  tagText: { fontSize: 10, fontWeight: '700' },
  planPriceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  planDuration: { fontSize: 12 },
  planPrice: { fontSize: 20, fontWeight: '800' },
  walletCreditBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 8,
    borderWidth: 1,
  },
  walletCreditIcon: { fontSize: 18, marginRight: 10 },
  walletCreditLabel: { fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },
  walletCreditAmount: { fontSize: 16, fontWeight: '800', marginTop: 1 },
  walletCreditSaving: { fontSize: 11, fontWeight: '700' },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginVertical: 16 },
  switchLabel: { fontSize: 13, flex: 1, marginRight: 12 },
  buyButton: {
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
    minHeight: 52,
    justifyContent: 'center',
  },
  buyButtonText: { fontSize: 16, fontWeight: '700' },
  buyButtonSub: { color: '#FFE0B2', fontSize: 12, fontWeight: '600', marginTop: 4 },
});
