import React, { useEffect, useState, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  TextInput,
  SafeAreaView,
  ScrollView,
  Modal,
  Image,
} from 'react-native';
import { useAppStore } from '../store/appStore';
import { submitPaymentRequest } from '../api/payments';
import dayjs from 'dayjs';
import { useTheme } from '../theme/ThemeContext';
import { UpiPaymentModal } from '../components/UpiPaymentModal';

// Wallet credit amounts credited when a plan is purchased.
const PLAN_WALLET_CREDITS: Record<string, number> = {
  p1: 1000, // Lunch Weekly
  p2: 3500, // Lunch Monthly
  p3: 1000, // Dinner Weekly
  p4: 4000, // Dinner Monthly
  p5: 7500, // Lunch + Dinner Combo
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

export default function SubscriptionScreen({ navigation, route }: any) {
  const { theme, isDark } = useTheme();
  const user = useAppStore(state => state.user);
  const subscriptions = useAppStore(state => state.subscriptions);
  const setSubscriptions = useAppStore(state => state.setSubscriptions);

  // Top Tabs: 'active' | 'past'
  const [activeTab, setActiveTab] = useState<'active' | 'past'>('active');

  const [availablePlans, setAvailablePlans] = useState<any[]>(AVAILABLE_PLANS);
  const [selectedPlan, setSelectedPlan] = useState<any>(AVAILABLE_PLANS[0]);
  const [autoRenew, setAutoRenew] = useState(true);
  const [loading, setLoading] = useState(false);

  // Available Menu Items for Day-Wise Customization
  const [menuItems, setMenuItems] = useState<any[]>([]);

  // Manage Plan Modal (Step 2)
  const [managingSub, setManagingSub] = useState<any | null>(null);
  const managingSubRef = useRef<any>(null);

  useEffect(() => {
    managingSubRef.current = managingSub;
  }, [managingSub]);

  const handleCloseManageModal = () => {
    setManagingSub(null);
    if (route?.params?.manageSubId) {
      navigation.setParams({ manageSubId: undefined });
    }
  };

  // Skip Dates Modal (Step 3) & Confirmation (Step 4)
  const [showSkipModal, setShowSkipModal] = useState(false);
  const [skipStep, setSkipStep] = useState<'picker' | 'confirm'>('picker');
  const [selectedSkipDates, setSelectedSkipDates] = useState<string[]>([]);
  const [skipReason, setSkipReason] = useState('Not at home');

  // Day-Wise Menu Customization Modal
  const [showMenuCustomizer, setShowMenuCustomizer] = useState(false);
  const [customizingSub, setCustomizingSub] = useState<any | null>(null);
  const [selectedDailyMenu, setSelectedDailyMenu] = useState<Record<string, any>>({});
  const [selectingForDateKey, setSelectingForDateKey] = useState<string | null>(null);

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

  // Live Cloud Firestore listener for menu items
  useEffect(() => {
    try {
      const { collection, onSnapshot } = require('firebase/firestore');
      const { firestore } = require('../firebaseConfig');
      const unsub = onSnapshot(collection(firestore, 'menu_items'), (snap: any) => {
        if (!snap.empty) {
          const list = snap.docs.map((d: any) => ({ id: d.id, ...d.data() }));
          setMenuItems(list);
        }
      });
      return unsub;
    } catch (e) {}
  }, []);

  // Live Cloud Firestore subscription listener for user's plans
  useEffect(() => {
    if (!user?.phone) return;
    const cleanPhone = user.phone.trim();
    const userDocId = user.id || `usr_${cleanPhone.replace(/\D/g, '')}`;

    try {
      const { collection, onSnapshot, doc, updateDoc } = require('firebase/firestore');
      const { firestore } = require('../firebaseConfig');
      const unsub = onSnapshot(collection(firestore, 'subscriptions'), (snap: any) => {
        if (!snap.empty) {
          const now = dayjs();
          const list = snap.docs
            .map((d: any) => ({ id: d.id, ...d.data() }))
            .filter((d: any) => d.user_phone === cleanPhone || d.user_id === userDocId);

          setSubscriptions(list);

          // Update expired subscriptions to 'expired' status
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

          // Sync managing sub if open
          if (managingSubRef.current) {
            const fresh = list.find((s: any) => s.id === managingSubRef.current.id);
            if (fresh) setManagingSub(fresh);
          }
        }
      });
      return unsub;
    } catch (e) {}
  }, [user?.phone, user?.id]);

  // Open manage modal if passed via route params (and clear param once consumed)
  useEffect(() => {
    if (route?.params?.manageSubId && subscriptions.length > 0) {
      const target = subscriptions.find((s: any) => s.id === route.params.manageSubId);
      if (target) {
        setManagingSub(target);
        navigation.setParams({ manageSubId: undefined });
      }
    }
  }, [route?.params?.manageSubId, subscriptions]);

  // Active vs Expired separation
  const { activeSubs, expiredSubs } = useMemo(() => {
    const now = dayjs();
    const active: any[] = [];
    const expired: any[] = [];

    subscriptions.forEach((sub: any) => {
      const isExpired =
        sub.status === 'expired' ||
        sub.status === 'cancelled' ||
        (sub.end_date && now.isAfter(dayjs(sub.end_date), 'day')) ||
        (typeof sub.meals_remaining === 'number' && sub.meals_remaining <= 0);

      if (isExpired) {
        expired.push(sub);
      } else {
        active.push(sub);
      }
    });

    return { activeSubs: active, expiredSubs: expired };
  }, [subscriptions]);

  // Read live UPI ID from Cloud Firestore settings/delivery_config
  const [upiId, setUpiId] = useState('afoodoo@upi');
  const [merchantName, setMerchantName] = useState('AFoodoo Kitchen');
  const [customQrUrl, setCustomQrUrl] = useState('');
  const [showUpiModal, setShowUpiModal] = useState(false);

  useEffect(() => {
    try {
      const { doc, onSnapshot } = require('firebase/firestore');
      const { firestore } = require('../firebaseConfig');
      const unsub = onSnapshot(doc(firestore, 'settings', 'delivery_config'), (snap: any) => {
        if (snap.exists()) {
          const d = snap.data();
          if (d.upi_id) setUpiId(d.upi_id);
          if (d.merchant_name) setMerchantName(d.merchant_name);
          if (d.upi_qr_image_url) setCustomQrUrl(d.upi_qr_image_url);
        }
      });
      return unsub;
    } catch (e) {}
  }, []);

  // Dynamic scheduled days for Menu Customization modal (7 days starting today or from sub start_date)
  const menuScheduleDays = useMemo(() => {
    const startDate = customizingSub?.start_date ? dayjs(customizingSub.start_date) : dayjs();
    const count = customizingSub ? (customizingSub.meals_total || 7) : 7;
    const days = [];
    for (let i = 0; i < Math.min(count, 7); i++) {
      const d = startDate.add(i, 'day');
      days.push({
        dateStr: d.format('YYYY-MM-DD'),
        label: d.format('dddd, MMM DD'),
        isToday: d.isSame(dayjs(), 'day'),
      });
    }
    return days;
  }, [customizingSub, selectedPlan]);

  // Total upfront meal upgrades for new plan purchase
  const upfrontUpgradesTotal = useMemo(() => {
    if (customizingSub) return 0;
    let total = 0;
    menuScheduleDays.forEach(wd => {
      const item = selectedDailyMenu[wd.dateStr];
      if (item?.extraCharge > 0) total += Number(item.extraCharge);
    });
    return total;
  }, [customizingSub, selectedDailyMenu, menuScheduleDays]);

  const finalPurchasePrice = (selectedPlan?.price || 0) + upfrontUpgradesTotal;

  const handleSubscribe = () => {
    if (!user) {
      Alert.alert('Login Required', 'Please sign in to buy a subscription pack.');
      return;
    }
    // Step 1: Prompt customer to customize/confirm their day-wise menu before payment!
    setCustomizingSub(null); // null indicates purchasing a new plan

    // Pre-populate upcoming plan days with default dishes from live menu
    const initialMenu: Record<string, any> = { ...selectedDailyMenu };
    const defaultItem = menuItems[0] || {
      id: 'dish_thali_special',
      title: "Chef's Special Thali",
      price: 120,
    };
    const defaultDishName = defaultItem.title || defaultItem.name || "Chef's Special Thali";
    const defaultPrice = defaultItem.price || 120;
    const defaultExtra = Math.max(0, defaultPrice - 128);

    for (let i = 0; i < 7; i++) {
      const dateKey = dayjs().add(i, 'day').format('YYYY-MM-DD');
      if (!initialMenu[dateKey]) {
        initialMenu[dateKey] = {
          id: defaultItem.id || `dish_${i}`,
          name: defaultDishName,
          price: defaultPrice,
          extraCharge: defaultExtra,
        };
      }
    }
    setSelectedDailyMenu(initialMenu);
    setShowMenuCustomizer(true);
  };

  const handleConfirmMenuAndProceedToPay = () => {
    // When purchasing upfront, meal upgrades are added to the UPI payment amount directly
    setShowMenuCustomizer(false);
    setShowUpiModal(true);
  };

  const handleConfirmSubscription = async (utrNumber?: string) => {
    if (!user) return;
    setLoading(true);
    try {
      const cleanPhone = user.phone ? user.phone.trim() : '';
      const userDocId = user.id || `usr_${cleanPhone.replace(/\D/g, '')}`;
      const durationDays = selectedPlan.duration === '1 Week' ? 7 : 30;
      const creditAmount =
        selectedPlan.wallet_credit || PLAN_WALLET_CREDITS[selectedPlan.id] || selectedPlan.price || 0;

      // Mark all selected dishes as covered (paid_upfront: true)
      const finalizedMenu: Record<string, any> = {};
      Object.entries(selectedDailyMenu).forEach(([dateStr, item]: [string, any]) => {
        finalizedMenu[dateStr] = {
          ...item,
          paid_upfront: true,
        };
      });

      await submitPaymentRequest({
        type: 'subscription',
        userId: userDocId,
        userName: user.name || `Customer (${cleanPhone})`,
        userPhone: cleanPhone,
        amount: finalPurchasePrice,
        utrNumber,
        subscriptionPayload: {
          plan_title: selectedPlan.title,
          meals: selectedPlan.meals,
          duration_days: durationDays,
          wallet_credit_bonus: creditAmount,
          auto_renew: autoRenew,
          daily_menu: finalizedMenu,
          base_price: selectedPlan.price,
          meal_upgrades_total: upfrontUpgradesTotal,
        },
      });

      setShowUpiModal(false);
      Alert.alert(
        'Subscription Request Sent ⏳',
        `Your subscription request for ${selectedPlan.title} (₹${finalPurchasePrice}) has been submitted for admin verification.\n\nYour plan and ₹${creditAmount.toLocaleString(
          'en-IN'
        )} wallet bonus will be activated as soon as the admin verifies your payment!`
      );
    } catch (err: any) {
      Alert.alert('Request Notice', err.message || 'Could not submit subscription request.');
    } finally {
      setLoading(false);
    }
  };

  // Toggle Pause/Resume for a Subscription
  const handleTogglePause = async (sub: any) => {
    const isPaused = sub.is_paused || sub.status === 'PAUSED';
    const newStatus = isPaused ? 'active' : 'PAUSED';

    try {
      const { doc, updateDoc } = require('firebase/firestore');
      const { firestore } = require('../firebaseConfig');
      await updateDoc(doc(firestore, 'subscriptions', sub.id), {
        is_paused: !isPaused,
        status: newStatus,
        updated_at: new Date().toISOString(),
      });

      Alert.alert(
        isPaused ? 'Deliveries Resumed ▶️' : 'Deliveries Paused ⏸️',
        isPaused
          ? 'Your meal deliveries have resumed.'
          : 'Your daily meal deliveries are paused. You can resume anytime!'
      );
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  };

  // Open Skip Specific Dates Modal
  const openSkipModalForSub = (sub: any) => {
    setManagingSub(sub);
    setSelectedSkipDates([]);
    setSkipStep('picker');
    setShowSkipModal(true);
  };

  // Confirm and Apply Skipped Dates
  const handleConfirmSkipDates = async () => {
    if (!managingSub || selectedSkipDates.length === 0) return;

    try {
      const { doc, updateDoc } = require('firebase/firestore');
      const { firestore } = require('../firebaseConfig');

      const existingDates = managingSub.paused_dates || [];
      const updatedDates = Array.from(new Set([...existingDates, ...selectedSkipDates])).sort();

      await updateDoc(doc(firestore, 'subscriptions', managingSub.id), {
        paused_dates: updatedDates,
        updated_at: new Date().toISOString(),
      });

      Alert.alert(
        'Meals Skipped Successfully ⏸️',
        `${selectedSkipDates.length} meal(s) have been skipped. These dates will not be delivered and your balance is saved!`
      );
      setShowSkipModal(false);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  };

  // Open Day-Wise Menu Customizer
  const openMenuCustomizer = (sub: any) => {
    setCustomizingSub(sub);
    setSelectedDailyMenu(sub.daily_menu || {});
    setShowMenuCustomizer(true);
  };

  // Save Day-Wise Menu Selection with Wallet Budget Check
  const handleSelectMenuItemForDay = (dish: any, dateKey: string) => {
    const baseDailyAllowance = 128; // standard daily allowance
    const dishPrice = dish.price || 0;
    const extraCharge = Math.max(0, dishPrice - baseDailyAllowance);

    // If modifying an ALREADY ACTIVE subscription, check wallet budget for the upgrade difference
    if (customizingSub) {
      const oldDish = (customizingSub.daily_menu || {})[dateKey];
      const oldExtra = oldDish?.paid_upfront ? (oldDish?.extraCharge || 0) : (oldDish?.extraCharge || 0);
      const upgradeDiff = Math.max(0, extraCharge - oldExtra);

      if (upgradeDiff > 0) {
        const walletBal = user?.wallet_balance ?? 0;
        if (walletBal < upgradeDiff) {
          Alert.alert(
            'Insufficient Wallet Balance 👛',
            `Upgrading this meal to ${dish.name || dish.title} requires ₹${upgradeDiff} extra from your wallet. Your current balance is ₹${walletBal}.\n\nPlease top up your wallet or choose another dish.`,
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Top Up Wallet',
                onPress: () => {
                  setShowMenuCustomizer(false);
                  setManagingSub(null);
                  navigation.navigate('Wallet');
                },
              },
            ]
          );
          return;
        }
      }
    }

    setSelectedDailyMenu((prev: any) => ({
      ...prev,
      [dateKey]: {
        id: dish.id,
        name: dish.name || dish.title,
        price: dishPrice,
        extraCharge,
      },
    }));
    setSelectingForDateKey(null);
  };

  const handleSaveDailyMenuToFirestore = async () => {
    if (!customizingSub || !user) return;
    try {
      // Calculate total incremental upgrade charges for changed dishes
      let totalIncrementalCharge = 0;
      const originalMenu = customizingSub.daily_menu || {};

      Object.entries(selectedDailyMenu).forEach(([dateStr, newDish]: [string, any]) => {
        const oldDish = originalMenu[dateStr];
        const oldExtra = oldDish?.paid_upfront ? (oldDish?.extraCharge || 0) : (oldDish?.extraCharge || 0);
        const newExtra = newDish?.extraCharge || 0;
        if (newExtra > oldExtra) {
          totalIncrementalCharge += (newExtra - oldExtra);
        }
      });

      const walletBal = user?.wallet_balance ?? 0;
      if (totalIncrementalCharge > 0) {
        if (walletBal < totalIncrementalCharge) {
          Alert.alert(
            'Insufficient Wallet Balance 👛',
            `An extra ₹${totalIncrementalCharge} is required from your wallet for your upgraded meals, but your wallet balance is ₹${walletBal}.\n\nPlease top up your wallet to apply these changes.`,
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Top Up Wallet',
                onPress: () => {
                  setShowMenuCustomizer(false);
                  setManagingSub(null);
                  navigation.navigate('Wallet');
                },
              },
            ]
          );
          return;
        }

        // Deduct incremental charge from user's wallet
        const { doc, updateDoc, increment, collection, addDoc } = require('firebase/firestore');
        const { firestore } = require('../firebaseConfig');
        const cleanPhone = user.phone ? user.phone.trim() : '';
        const userDocId = user.id || `usr_${cleanPhone.replace(/\D/g, '')}`;

        await updateDoc(doc(firestore, 'users', userDocId), {
          wallet_balance: increment(-totalIncrementalCharge),
          updated_at: new Date().toISOString(),
        });

        await addDoc(collection(firestore, 'wallet_transactions'), {
          user_id: userDocId,
          user_phone: cleanPhone,
          amount: totalIncrementalCharge,
          type: 'debit',
          title: `Meal Upgrade for ${customizingSub.plan_type || 'Subscription'}`,
          description: `Deducted for premium dish upgrades`,
          subscription_id: customizingSub.id,
          timestamp: new Date().toISOString(),
          created_at: new Date().toISOString(),
        });
      }

      // Mark updated menu dishes as covered
      const updatedMenu: Record<string, any> = {};
      Object.entries(selectedDailyMenu).forEach(([d, item]: [string, any]) => {
        updatedMenu[d] = {
          ...item,
          paid_upfront: true,
        };
      });

      const { doc, updateDoc } = require('firebase/firestore');
      const { firestore } = require('../firebaseConfig');
      await updateDoc(doc(firestore, 'subscriptions', customizingSub.id), {
        daily_menu: updatedMenu,
        updated_at: new Date().toISOString(),
      });

      Alert.alert(
        'Menu Saved 🍱',
        totalIncrementalCharge > 0
          ? `Your custom meal schedule has been saved. ₹${totalIncrementalCharge} was deducted from your wallet for premium upgrades.`
          : 'Your custom daily meal schedule has been saved successfully!'
      );
      setShowMenuCustomizer(false);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  };

  // Days of week (Mon-Sun) helper for weekly progress tracker
  const weekDays = useMemo(() => {
    const curr = dayjs();
    const monday = curr.startOf('week').add(1, 'day'); // Mon
    const days = [];
    const labels = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
    for (let i = 0; i < 7; i++) {
      const d = monday.add(i, 'day');
      days.push({
        label: labels[i],
        dateStr: d.format('YYYY-MM-DD'),
      });
    }
    return days;
  }, []);

  // Current month calendar days generator
  const currentMonthDays = useMemo(() => {
    const startOfMonth = dayjs().startOf('month');
    const totalDays = startOfMonth.daysInMonth();
    const days = [];
    for (let i = 1; i <= totalDays; i++) {
      const d = startOfMonth.date(i);
      days.push({
        dayNum: i,
        dateStr: d.format('YYYY-MM-DD'),
      });
    }
    return days;
  }, []);

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <Text style={[styles.pageTitle, { color: theme.textPrimary }]}>
          Tiffin Subscriptions 🍱
        </Text>

        {/* Top Tabs: Active vs Past */}
        <View style={styles.tabBar}>
          <TouchableOpacity
            style={[
              styles.tabButton,
              activeTab === 'active' && [styles.tabButtonActive, { backgroundColor: theme.primary }],
            ]}
            onPress={() => setActiveTab('active')}
          >
            <Text
              style={[
                styles.tabButtonText,
                { color: activeTab === 'active' ? '#FFFFFF' : theme.textSecondary },
              ]}
            >
              Active ({activeSubs.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.tabButton,
              activeTab === 'past' && [styles.tabButtonActive, { backgroundColor: theme.primary }],
            ]}
            onPress={() => setActiveTab('past')}
          >
            <Text
              style={[
                styles.tabButtonText,
                { color: activeTab === 'past' ? '#FFFFFF' : theme.textSecondary },
              ]}
            >
              Past / Expired ({expiredSubs.length})
            </Text>
          </TouchableOpacity>
        </View>

        {/* TAB 1: ACTIVE SUBSCRIPTIONS */}
        {activeTab === 'active' && (
          <View style={styles.sectionWrap}>
            {activeSubs.length > 0 ? (
              activeSubs.map((sub: any) => {
                const isPaused = sub.is_paused || sub.status === 'PAUSED';
                const pausedDates = sub.paused_dates || [];

                return (
                  <View
                    key={sub.id}
                    style={[
                      styles.activeCard,
                      { backgroundColor: theme.surface, borderColor: theme.surfaceBorder },
                    ]}
                  >
                    {/* Header Row */}
                    <View style={styles.activeHeaderRow}>
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Text style={[styles.activeTitle, { color: theme.textPrimary }]}>
                            {sub.plan_type || sub.plan_title}
                          </Text>
                          <View
                            style={[
                              styles.statusTag,
                              { backgroundColor: isPaused ? '#FEF3C7' : '#DCFCE7' },
                            ]}
                          >
                            <Text
                              style={[
                                styles.statusTagText,
                                { color: isPaused ? '#D97706' : '#15803D' },
                              ]}
                            >
                              {isPaused ? 'PAUSED' : 'ACTIVE'}
                            </Text>
                          </View>
                        </View>
                        <Text style={[styles.activeDate, { color: theme.textSecondary }]}>
                          Valid until {dayjs(sub.end_date).format('MMM DD, YYYY')}
                        </Text>
                      </View>

                      <View style={[styles.mealsBadge, { backgroundColor: theme.primary }]}>
                        <Text style={styles.mealsBadgeCount}>{sub.meals_remaining ?? 0}</Text>
                        <Text style={styles.mealsBadgeLabel}>Meals Left</Text>
                      </View>
                    </View>

                    {/* Weekly Progress Tracker (M T W T F S S) */}
                    <View style={styles.weekTrackerRow}>
                      {weekDays.map(wd => {
                        const isSkipped = pausedDates.includes(wd.dateStr) || isPaused;
                        return (
                          <View key={wd.dateStr} style={styles.weekDayCol}>
                            <View
                              style={[
                                styles.weekDayDot,
                                {
                                  backgroundColor: isSkipped
                                    ? '#F59E0B'
                                    : isDark
                                    ? '#15803D'
                                    : '#22C55E',
                                },
                              ]}
                            >
                              <Text style={styles.weekDayDotText}>{isSkipped ? '⏸' : '✓'}</Text>
                            </View>
                            <Text style={[styles.weekDayLabel, { color: theme.textMuted }]}>
                              {wd.label}
                            </Text>
                          </View>
                        );
                      })}
                    </View>

                    {/* Action Buttons: Pause Plan & Manage */}
                    <View style={styles.activeActionsRow}>
                      <TouchableOpacity
                        style={[
                          styles.actionBtnOutline,
                          {
                            borderColor: isPaused ? '#10B981' : '#F59E0B',
                            backgroundColor: isPaused ? '#ECFDF5' : '#FFFBEB',
                          },
                        ]}
                        onPress={() => handleTogglePause(sub)}
                      >
                        <Text
                          style={[
                            styles.actionBtnOutlineText,
                            { color: isPaused ? '#059669' : '#D97706' },
                          ]}
                        >
                          {isPaused ? 'Resume Plan ▶️' : 'Pause Plan ⏸️'}
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[styles.actionBtnPrimary, { backgroundColor: theme.primary }]}
                        onPress={() => setManagingSub(sub)}
                      >
                        <Text style={[styles.actionBtnPrimaryText, { color: theme.buttonText }]}>
                          Manage Plan ⚙️
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })
            ) : (
              <View
                style={[
                  styles.emptyCard,
                  { backgroundColor: theme.surface, borderColor: theme.surfaceBorder },
                ]}
              >
                <Text style={{ fontSize: 32, marginBottom: 8 }}>🍱</Text>
                <Text style={[styles.emptyTitle, { color: theme.textPrimary }]}>
                  No Active Subscriptions
                </Text>
                <Text style={[styles.emptySub, { color: theme.textSecondary }]}>
                  Choose a weekly or monthly tiffin pack below to enjoy fresh, auto-dispatched meals daily!
                </Text>
              </View>
            )}
          </View>
        )}

        {/* TAB 2: PAST / EXPIRED SUBSCRIPTIONS */}
        {activeTab === 'past' && (
          <View style={styles.sectionWrap}>
            {expiredSubs.length > 0 ? (
              expiredSubs.map((sub: any) => (
                <View
                  key={sub.id}
                  style={[
                    styles.expiredCard,
                    { backgroundColor: theme.surface, borderColor: theme.surfaceBorder },
                  ]}
                >
                  <View style={styles.activeHeaderRow}>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={[styles.activeTitle, { color: theme.textSecondary }]}>
                          {sub.plan_type || sub.plan_title}
                        </Text>
                        <View style={styles.expiredTag}>
                          <Text style={styles.expiredTagText}>EXPIRED</Text>
                        </View>
                      </View>
                      <Text style={[styles.activeDate, { color: theme.textMuted }]}>
                        Expired on {dayjs(sub.end_date).format('MMM DD, YYYY')}
                      </Text>
                    </View>

                    <View style={styles.expiredMealsBadge}>
                      <Text style={styles.expiredMealsCount}>{sub.meals_remaining ?? 0}</Text>
                      <Text style={styles.expiredMealsLabel}>Meals Left</Text>
                    </View>
                  </View>

                  <View style={[styles.divider, { backgroundColor: theme.surfaceBorder }]} />

                  <View style={styles.expiredFooterRow}>
                    <Text style={[styles.expiredDisabledNote, { color: theme.textMuted }]}>
                      🔒 This subscription plan has expired and can no longer be used.
                    </Text>
                    <TouchableOpacity
                      style={[styles.resubscribeBtn, { backgroundColor: theme.primary }]}
                      onPress={() => {
                        setActiveTab('active');
                        Alert.alert('Re-subscribe', 'Select a plan below to renew your daily tiffins!');
                      }}
                    >
                      <Text style={[styles.resubscribeBtnText, { color: theme.buttonText }]}>
                        Re-Subscribe ↺
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            ) : (
              <View
                style={[
                  styles.emptyCard,
                  { backgroundColor: theme.surface, borderColor: theme.surfaceBorder },
                ]}
              >
                <Text style={{ fontSize: 32, marginBottom: 8 }}>✨</Text>
                <Text style={[styles.emptyTitle, { color: theme.textPrimary }]}>
                  No Expired Subscriptions
                </Text>
                <Text style={[styles.emptySub, { color: theme.textSecondary }]}>
                  All your active and past subscriptions will appear here cleanly.
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Buy New Meal Pack Section */}
        <Text style={[styles.sectionTitle, { color: theme.textPrimary, marginTop: 24 }]}>
          Buy New Meal Pack
        </Text>
        <Text style={[styles.sectionSub, { color: theme.textSecondary }]}>
          ℹ️ Select a meal plan and customize your day-wise schedule before checkout.
        </Text>

        {availablePlans.map((plan: any) => {
          const isSelected = selectedPlan?.id === plan.id;
          return (
            <TouchableOpacity
              key={plan.id}
              style={[
                styles.planCard,
                {
                  backgroundColor: theme.surface,
                  borderColor: isSelected ? theme.primary : theme.surfaceBorder,
                  borderWidth: isSelected ? 2 : 1,
                },
              ]}
              onPress={() => setSelectedPlan(plan)}
              activeOpacity={0.8}
            >
              <View style={styles.planHeaderRow}>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={[styles.planTitle, { color: theme.textPrimary }]}>{plan.title}</Text>
                    {plan.tag ? (
                      <View style={[styles.tagBadge, { backgroundColor: theme.primary + '18' }]}>
                        <Text style={[styles.tagBadgeText, { color: theme.primary }]}>{plan.tag}</Text>
                      </View>
                    ) : null}
                  </View>
                  <Text style={[styles.planDesc, { color: theme.textSecondary }]}>{plan.desc}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={[styles.planPrice, { color: theme.textPrimary }]}>₹{plan.price}</Text>
                  <Text style={[styles.planDuration, { color: theme.textSecondary }]}>
                    /{plan.duration}
                  </Text>
                </View>
              </View>

              {/* Wallet Bonus Callout */}
              <View style={[styles.bonusBar, { backgroundColor: isDark ? '#1E293B' : '#FFF7ED' }]}>
                <Text style={[styles.bonusBarText, { color: isDark ? '#F97316' : '#C2410C' }]}>
                  🎁 Wallet Credit Included: ₹
                  {(
                    plan.wallet_credit ||
                    PLAN_WALLET_CREDITS[plan.id] ||
                    plan.price
                  ).toLocaleString('en-IN')}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}

        {/* Subscribe Action Button */}
        <TouchableOpacity
          style={[styles.subscribeBtn, { backgroundColor: theme.primary }]}
          onPress={handleSubscribe}
          disabled={loading}
        >
          <Text style={[styles.subscribeBtnText, { color: theme.buttonText }]}>
            {loading ? 'Processing...' : `Subscribe to ${selectedPlan?.title || 'Plan'} ➔`}
          </Text>
        </TouchableOpacity>
      </ScrollView>

      {/* MODAL 1: MANAGE PLAN (Step 2 in Reference Flow) */}
      {managingSub ? (
        <Modal
          visible={true}
          animationType="slide"
          transparent={false}
          onRequestClose={handleCloseManageModal}
        >
          <SafeAreaView style={[styles.modalSafeArea, { backgroundColor: theme.background }]}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={handleCloseManageModal} style={styles.modalBackBtn}>
                <Text style={[styles.modalBackText, { color: theme.textPrimary }]}>← Back</Text>
              </TouchableOpacity>
              <Text style={[styles.modalTitle, { color: theme.textPrimary }]}>
                Manage {managingSub.plan_type}
              </Text>
              <View style={{ width: 40 }} />
            </View>

            <ScrollView contentContainerStyle={styles.modalScroll}>
              {/* Plan Summary Card */}
              <View
                style={[
                  styles.manageHeroCard,
                  { backgroundColor: theme.surface, borderColor: theme.surfaceBorder },
                ]}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <Image
                    source={require('../../assets/icon_tiffin_box.jpg')}
                    style={styles.heroThumbnail}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.heroPlanTitle, { color: theme.textPrimary }]}>
                      {managingSub.plan_type}
                    </Text>
                    <Text style={[styles.heroPlanPrice, { color: theme.primary }]}>
                      ₹{managingSub.price || 899}/week
                    </Text>
                    <Text style={[styles.heroPlanValid, { color: theme.textSecondary }]}>
                      Valid till {dayjs(managingSub.end_date).format('DD MMM YYYY')}
                    </Text>
                  </View>
                </View>

                {/* 3 Metric Stats (Meals Left, Days Passed, Cost Per Meal) */}
                <View style={styles.statsRow}>
                  <View style={styles.statCol}>
                    <Text style={[styles.statValue, { color: theme.primary }]}>
                      {managingSub.meals_remaining ?? 0}
                    </Text>
                    <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Meals Left</Text>
                  </View>
                  <View style={styles.statDivider} />
                  <View style={styles.statCol}>
                    <Text style={[styles.statValue, { color: theme.textPrimary }]}>
                      {managingSub.created_at
                        ? Math.max(0, dayjs().diff(dayjs(managingSub.created_at), 'day'))
                        : 0}
                    </Text>
                    <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Days Passed</Text>
                  </View>
                  <View style={styles.statDivider} />
                  <View style={styles.statCol}>
                    <Text style={[styles.statValue, { color: theme.textPrimary }]}>
                      ₹{Math.round((managingSub.price || 899) / (managingSub.meals_total || 7))}
                    </Text>
                    <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Per Meal</Text>
                  </View>
                </View>
              </View>

              {/* Quick Actions List */}
              <Text style={[styles.actionSectionHeader, { color: theme.textPrimary }]}>
                Quick Actions
              </Text>

              {/* Pause / Resume */}
              <TouchableOpacity
                style={[
                  styles.quickActionItem,
                  { backgroundColor: theme.surface, borderColor: theme.surfaceBorder },
                ]}
                onPress={() => handleTogglePause(managingSub)}
              >
                <Text style={styles.quickActionIcon}>
                  {managingSub.is_paused || managingSub.status === 'PAUSED' ? '▶️' : '⏸️'}
                </Text>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.quickActionTitle, { color: theme.textPrimary }]}>
                    {managingSub.is_paused || managingSub.status === 'PAUSED'
                      ? 'Resume Plan'
                      : 'Pause Plan'}
                  </Text>
                  <Text style={[styles.quickActionSub, { color: theme.textSecondary }]}>
                    {managingSub.is_paused || managingSub.status === 'PAUSED'
                      ? 'Restart your deliveries anytime'
                      : 'Temporarily stop deliveries'}
                  </Text>
                </View>
                <Text style={[styles.quickActionArrow, { color: theme.textMuted }]}>›</Text>
              </TouchableOpacity>

              {/* Skip Specific Dates */}
              <TouchableOpacity
                style={[
                  styles.quickActionItem,
                  { backgroundColor: theme.surface, borderColor: theme.surfaceBorder },
                ]}
                onPress={() => openSkipModalForSub(managingSub)}
              >
                <Text style={styles.quickActionIcon}>📅</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.quickActionTitle, { color: theme.textPrimary }]}>
                    Skip Specific Dates
                  </Text>
                  <Text style={[styles.quickActionSub, { color: theme.textSecondary }]}>
                    Skip single or multiple delivery days easily
                  </Text>
                </View>
                <Text style={[styles.quickActionArrow, { color: theme.textMuted }]}>›</Text>
              </TouchableOpacity>

              {/* Customize Day-Wise Menu */}
              <TouchableOpacity
                style={[
                  styles.quickActionItem,
                  { backgroundColor: theme.surface, borderColor: theme.surfaceBorder },
                ]}
                onPress={() => openMenuCustomizer(managingSub)}
              >
                <Text style={styles.quickActionIcon}>🍲</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.quickActionTitle, { color: theme.textPrimary }]}>
                    Customize Day-Wise Menu
                  </Text>
                  <Text style={[styles.quickActionSub, { color: theme.textSecondary }]}>
                    Select dishes from menu with your wallet credit
                  </Text>
                </View>
                <Text style={[styles.quickActionArrow, { color: theme.textMuted }]}>›</Text>
              </TouchableOpacity>

              {/* Delivery Calendar (Step 5 in mockup) */}
              <Text style={[styles.actionSectionHeader, { color: theme.textPrimary, marginTop: 20 }]}>
                Delivery Calendar — {dayjs().format('MMMM YYYY')}
              </Text>
              <View
                style={[
                  styles.calendarCard,
                  { backgroundColor: theme.surface, borderColor: theme.surfaceBorder },
                ]}
              >
                <View style={styles.calendarLegendRow}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <View style={[styles.legendDot, { backgroundColor: '#22C55E' }]} />
                    <Text style={[styles.legendText, { color: theme.textSecondary }]}>Scheduled</Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <View style={[styles.legendDot, { backgroundColor: '#F97316' }]} />
                    <Text style={[styles.legendText, { color: theme.textSecondary }]}>Skipped</Text>
                  </View>
                </View>

                {/* Days Grid */}
                <View style={styles.calendarGrid}>
                  {currentMonthDays.map(item => {
                    const isSkipped = (managingSub.paused_dates || []).includes(item.dateStr);
                    const isWithin =
                      (!managingSub.start_date || item.dateStr >= managingSub.start_date.split('T')[0]) &&
                      (!managingSub.end_date || item.dateStr <= managingSub.end_date.split('T')[0]);

                    return (
                      <View
                        key={item.dateStr}
                        style={[
                          styles.calDayBox,
                          isSkipped && styles.calDayBoxSkipped,
                          isWithin && !isSkipped && styles.calDayBoxScheduled,
                        ]}
                      >
                        <Text
                          style={[
                            styles.calDayNum,
                            {
                              color: isSkipped
                                ? '#FFFFFF'
                                : isWithin
                                ? '#FFFFFF'
                                : theme.textMuted,
                            },
                          ]}
                        >
                          {item.dayNum}
                        </Text>
                      </View>
                    );
                  })}
                </View>

                {/* Skipped Dates Pills */}
                {managingSub.paused_dates && managingSub.paused_dates.length > 0 ? (
                  <View style={styles.skippedSummaryBanner}>
                    <Text style={styles.skippedSummaryText}>
                      ⏸️ {managingSub.paused_dates.length} meal(s) skipped •{' '}
                      {managingSub.paused_dates.slice(0, 3).join(', ')}
                    </Text>
                  </View>
                ) : null}
              </View>
            </ScrollView>
          </SafeAreaView>
        </Modal>
      ) : null}

      {/* MODAL 2: SKIP SPECIFIC DAYS (Step 3 & Step 4 Confirmation) */}
      {showSkipModal ? (
        <Modal
          visible={true}
          animationType="slide"
          transparent={false}
          onRequestClose={() => {
            if (skipStep === 'confirm') setSkipStep('picker');
            else setShowSkipModal(false);
          }}
        >
          <SafeAreaView style={[styles.modalSafeArea, { backgroundColor: theme.background }]}>
            <View style={styles.modalHeader}>
              <TouchableOpacity
                onPress={() => {
                  if (skipStep === 'confirm') setSkipStep('picker');
                  else setShowSkipModal(false);
                }}
                style={styles.modalBackBtn}
              >
                <Text style={[styles.modalBackText, { color: theme.textPrimary }]}>← Back</Text>
              </TouchableOpacity>
              <Text style={[styles.modalTitle, { color: theme.textPrimary }]}>
                {skipStep === 'confirm' ? 'Confirm Skip' : 'Skip Specific Days'}
              </Text>
              <View style={{ width: 40 }} />
            </View>

            <ScrollView contentContainerStyle={styles.modalScroll}>
              {skipStep === 'picker' ? (
                <>
                  {/* Quick Chips */}
                  <View style={styles.chipsRow}>
                    <TouchableOpacity
                      style={styles.chipBtn}
                      onPress={() => {
                        const tomorrow = dayjs().add(1, 'day').format('YYYY-MM-DD');
                        setSelectedSkipDates([tomorrow]);
                      }}
                    >
                      <Text style={styles.chipBtnText}>Tomorrow</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.chipBtn}
                      onPress={() => {
                        const next3 = [
                          dayjs().add(1, 'day').format('YYYY-MM-DD'),
                          dayjs().add(2, 'day').format('YYYY-MM-DD'),
                          dayjs().add(3, 'day').format('YYYY-MM-DD'),
                        ];
                        setSelectedSkipDates(next3);
                      }}
                    >
                      <Text style={styles.chipBtnText}>Next 3 Days</Text>
                    </TouchableOpacity>
                  </View>

                  {/* Multi-date Calendar Grid */}
                  <View
                    style={[
                      styles.calendarCard,
                      { backgroundColor: theme.surface, borderColor: theme.surfaceBorder },
                    ]}
                  >
                    <Text style={[styles.actionSectionHeader, { color: theme.textPrimary, marginBottom: 8 }]}>
                      Tap dates to skip:
                    </Text>
                    <View style={styles.calendarGrid}>
                      {currentMonthDays.map(item => {
                        const isSelected = selectedSkipDates.includes(item.dateStr);
                        return (
                          <TouchableOpacity
                            key={item.dateStr}
                            style={[
                              styles.calDayBoxInteractive,
                              isSelected && styles.calDayBoxSelected,
                            ]}
                            onPress={() => {
                              if (isSelected) {
                                setSelectedSkipDates(selectedSkipDates.filter(d => d !== item.dateStr));
                              } else {
                                setSelectedSkipDates([...selectedSkipDates, item.dateStr].sort());
                              }
                            }}
                          >
                            <Text
                              style={[
                                styles.calDayNum,
                                { color: isSelected ? '#FFFFFF' : theme.textPrimary },
                              ]}
                            >
                              {item.dayNum}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>

                  {/* Reason Input */}
                  <Text style={[styles.actionSectionHeader, { color: theme.textPrimary, marginTop: 16 }]}>
                    Reason (Optional)
                  </Text>
                  <TextInput
                    style={[
                      styles.reasonInput,
                      {
                        backgroundColor: theme.inputBg,
                        borderColor: theme.inputBorder,
                        color: theme.inputText,
                      },
                    ]}
                    value={skipReason}
                    onChangeText={setSkipReason}
                    placeholder="e.g. Not at home, Travelling, Fasting"
                    placeholderTextColor={theme.textMuted}
                  />

                  {/* Bottom Action Button */}
                  <TouchableOpacity
                    style={[
                      styles.subscribeBtn,
                      {
                        backgroundColor:
                          selectedSkipDates.length > 0 ? theme.primary : theme.surfaceBorder,
                        marginTop: 24,
                      },
                    ]}
                    disabled={selectedSkipDates.length === 0}
                    onPress={() => setSkipStep('confirm')}
                  >
                    <Text style={[styles.subscribeBtnText, { color: theme.buttonText }]}>
                      Skip {selectedSkipDates.length} Days ➔
                    </Text>
                  </TouchableOpacity>
                </>
              ) : (
                /* Step 4: Confirmation Screen */
                <>
                  <View style={styles.confirmCallout}>
                    <Text style={styles.confirmCalloutTitle}>
                      ⚠️ You are about to skip {selectedSkipDates.length} meal(s)
                    </Text>
                    <Text style={styles.confirmCalloutText}>
                      These dates will not be included in your delivery and will be safely preserved
                      in your meal count balance.
                    </Text>
                  </View>

                  <View
                    style={[
                      styles.confirmBox,
                      { backgroundColor: theme.surface, borderColor: theme.surfaceBorder },
                    ]}
                  >
                    <Text style={[styles.confirmSectionTitle, { color: theme.textPrimary }]}>
                      Selected Dates:
                    </Text>
                    <Text style={[styles.confirmDatesList, { color: theme.primary }]}>
                      {selectedSkipDates.join(', ')}
                    </Text>

                    <View style={[styles.divider, { backgroundColor: theme.surfaceBorder }]} />

                    <View style={styles.confirmRow}>
                      <Text style={[styles.confirmLabel, { color: theme.textSecondary }]}>
                        Current Meals Left:
                      </Text>
                      <Text style={[styles.confirmVal, { color: theme.textPrimary }]}>
                        {managingSub.meals_remaining ?? 0}
                      </Text>
                    </View>

                    <View style={styles.confirmRow}>
                      <Text style={[styles.confirmLabel, { color: theme.textSecondary }]}>
                        Meals to be Skipped:
                      </Text>
                      <Text style={[styles.confirmVal, { color: '#F97316' }]}>
                        {selectedSkipDates.length}
                      </Text>
                    </View>

                    <View style={styles.confirmRow}>
                      <Text style={[styles.confirmLabel, { color: theme.textSecondary }]}>
                        Preserved Balance:
                      </Text>
                      <Text style={[styles.confirmVal, { color: '#10B981' }]}>
                        {managingSub.meals_remaining ?? 0} meals saved
                      </Text>
                    </View>

                    <View style={[styles.divider, { backgroundColor: theme.surfaceBorder }]} />

                    <View style={styles.confirmRow}>
                      <Text style={[styles.confirmLabel, { color: theme.textSecondary }]}>Reason:</Text>
                      <Text style={[styles.confirmVal, { color: theme.textPrimary }]}>
                        {skipReason}
                      </Text>
                    </View>
                  </View>

                  <TouchableOpacity
                    style={[styles.subscribeBtn, { backgroundColor: theme.primary, marginTop: 24 }]}
                    onPress={handleConfirmSkipDates}
                  >
                    <Text style={[styles.subscribeBtnText, { color: theme.buttonText }]}>
                      Confirm Skip
                    </Text>
                  </TouchableOpacity>
                </>
              )}
            </ScrollView>
          </SafeAreaView>
        </Modal>
      ) : null}

      {/* MODAL 3: DAY-WISE MENU CUSTOMIZATION WITH WALLET BUDGET CHECK */}
      {showMenuCustomizer ? (
        <Modal
          visible={true}
          animationType="slide"
          transparent={false}
          onRequestClose={() => setShowMenuCustomizer(false)}
        >
          <SafeAreaView style={[styles.modalSafeArea, { backgroundColor: theme.background }]}>
            <View style={styles.modalHeader}>
              <TouchableOpacity
                onPress={() => setShowMenuCustomizer(false)}
                style={styles.modalBackBtn}
              >
                <Text style={[styles.modalBackText, { color: theme.textPrimary }]}>← Back</Text>
              </TouchableOpacity>
              <Text style={[styles.modalTitle, { color: theme.textPrimary }]}>
                {customizingSub ? 'Customize Plan Menu' : `Select Meals (${selectedPlan?.title || 'Plan'})`}
              </Text>
              <View style={{ width: 40 }} />
            </View>

            <ScrollView contentContainerStyle={styles.modalScroll}>
              {/* Wallet Info Badge */}
              <View
                style={[
                  styles.walletAllowanceCard,
                  { backgroundColor: theme.surface, borderColor: theme.surfaceBorder },
                ]}
              >
                <Text style={[styles.walletAllowanceTitle, { color: theme.textPrimary }]}>
                  👛 AFoodoo Wallet Balance: ₹{user?.wallet_balance ?? 0}
                </Text>
                <Text style={[styles.walletAllowanceSub, { color: theme.textSecondary }]}>
                  Standard daily dishes (up to ₹128) are 100% included in your plan. Any premium dishes
                  will deduct only the small difference from your wallet.
                </Text>
              </View>

              <Text style={[styles.actionSectionHeader, { color: theme.textPrimary, marginTop: 16 }]}>
                Select Dish for Each Day ({menuScheduleDays.length} Days)
              </Text>

              {/* Days List */}
              {menuScheduleDays.map(wd => {
                const dayDish = selectedDailyMenu[wd.dateStr];
                return (
                  <View
                    key={wd.dateStr}
                    style={[
                      styles.dayMenuRow,
                      { backgroundColor: theme.surface, borderColor: theme.surfaceBorder },
                    ]}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.dayMenuDate, { color: theme.primary }]}>
                        {wd.label} {wd.isToday ? '• TODAY' : ''}
                      </Text>
                      <Text style={[styles.dayMenuDish, { color: theme.textPrimary }]}>
                        {dayDish?.name || "Standard Chef's Special Thali"}
                      </Text>
                      {dayDish?.extraCharge > 0 ? (
                        <Text style={styles.extraChargeText}>
                          +₹{dayDish.extraCharge} {customizingSub ? 'extra from wallet' : 'meal upgrade'}
                        </Text>
                      ) : (
                        <Text style={{ fontSize: 10, color: '#10B981', fontWeight: 'bold', marginTop: 2 }}>
                          ✓ Included in Plan
                        </Text>
                      )}
                    </View>

                    <TouchableOpacity
                      style={[styles.selectDishBtn, { backgroundColor: theme.primary + '20' }]}
                      onPress={() => setSelectingForDateKey(wd.dateStr)}
                    >
                      <Text style={[styles.selectDishBtnText, { color: theme.primary }]}>
                        {dayDish ? 'Change' : 'Select'} Dish
                      </Text>
                    </TouchableOpacity>
                  </View>
                );
              })}
              {/* Cost Summary Breakdown for Initial Purchase */}
              {!customizingSub && (
                <View
                  style={[
                    styles.confirmBox,
                    {
                      backgroundColor: theme.surface,
                      borderColor: theme.surfaceBorder,
                      marginTop: 18,
                      marginBottom: 10,
                    },
                  ]}
                >
                  <Text style={[styles.confirmSectionTitle, { color: theme.textPrimary }]}>
                    Payment Summary
                  </Text>
                  <View style={styles.confirmRow}>
                    <Text style={[styles.confirmLabel, { color: theme.textSecondary }]}>
                      {selectedPlan?.title || 'Base Plan'}
                    </Text>
                    <Text style={[styles.confirmVal, { color: theme.textPrimary }]}>
                      ₹{selectedPlan?.price || 0}
                    </Text>
                  </View>
                  {upfrontUpgradesTotal > 0 ? (
                    <View style={styles.confirmRow}>
                      <Text style={[styles.confirmLabel, { color: '#F97316' }]}>
                        Premium Meal Upgrades ({menuScheduleDays.filter(wd => selectedDailyMenu[wd.dateStr]?.extraCharge > 0).length} days)
                      </Text>
                      <Text style={[styles.confirmVal, { color: '#F97316' }]}>
                        +₹{upfrontUpgradesTotal}
                      </Text>
                    </View>
                  ) : null}
                  <View style={[styles.divider, { backgroundColor: theme.surfaceBorder }]} />
                  <View style={styles.confirmRow}>
                    <Text style={[styles.confirmLabel, { color: theme.textPrimary, fontWeight: '800' }]}>
                      Total Payable via Direct UPI
                    </Text>
                    <Text style={[styles.confirmVal, { color: theme.primary, fontSize: 16 }]}>
                      ₹{finalPurchasePrice}
                    </Text>
                  </View>
                </View>
              )}

              {/* Action Button */}
              {customizingSub ? (
                <TouchableOpacity
                  style={[styles.subscribeBtn, { backgroundColor: theme.primary, marginTop: 24 }]}
                  onPress={handleSaveDailyMenuToFirestore}
                >
                  <Text style={[styles.subscribeBtnText, { color: theme.buttonText }]}>
                    Save Menu Schedule 💾
                  </Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={[styles.subscribeBtn, { backgroundColor: theme.primary, marginTop: 14 }]}
                  onPress={handleConfirmMenuAndProceedToPay}
                >
                  <Text style={[styles.subscribeBtnText, { color: theme.buttonText }]}>
                    Confirm Meals & Pay ₹{finalPurchasePrice} via UPI ➔
                  </Text>
                </TouchableOpacity>
              )}
            </ScrollView>

            {/* Sub-modal: Pick Dish from live menu */}
            {selectingForDateKey ? (
              <Modal
                visible={true}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setSelectingForDateKey(null)}
              >
                <View style={styles.dishPickerOverlay}>
                  <View
                    style={[
                      styles.dishPickerCard,
                      { backgroundColor: theme.background, borderColor: theme.surfaceBorder },
                    ]}
                  >
                    <View style={styles.modalHeader}>
                      <Text style={[styles.modalTitle, { color: theme.textPrimary }]}>
                        Choose Dish for {dayjs(selectingForDateKey).format('MMM DD')}
                      </Text>
                      <TouchableOpacity onPress={() => setSelectingForDateKey(null)}>
                        <Text style={{ fontSize: 18, color: theme.textMuted }}>✕</Text>
                      </TouchableOpacity>
                    </View>

                    <ScrollView style={{ maxHeight: 400 }}>
                      {menuItems.map(item => (
                        <TouchableOpacity
                          key={item.id}
                          style={[
                            styles.dishOptionRow,
                            { borderColor: theme.surfaceBorder, backgroundColor: theme.surface },
                          ]}
                          onPress={() => handleSelectMenuItemForDay(item, selectingForDateKey)}
                        >
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.dishOptionName, { color: theme.textPrimary }]}>
                              {item.name || item.title}
                            </Text>
                            <Text style={[styles.dishOptionDesc, { color: theme.textSecondary }]}>
                              {item.description || 'Fresh daily tiffin item'}
                            </Text>
                          </View>
                          <View style={{ alignItems: 'flex-end' }}>
                            <Text style={[styles.dishOptionPrice, { color: theme.primary }]}>
                              ₹{item.price || 120}
                            </Text>
                            {item.price > 128 ? (
                              <Text style={{ fontSize: 10, color: '#F97316' }}>
                                +₹{item.price - 128} wallet
                              </Text>
                            ) : (
                              <Text style={{ fontSize: 10, color: '#10B981' }}>Included</Text>
                            )}
                          </View>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                </View>
              </Modal>
            ) : null}
          </SafeAreaView>
        </Modal>
      ) : null}

      {/* UPI Payment Modal */}
      <UpiPaymentModal
        visible={showUpiModal}
        amount={finalPurchasePrice}
        onClose={() => setShowUpiModal(false)}
        onConfirmPaid={handleConfirmSubscription}
        onConfirm={handleConfirmSubscription}
        submitting={loading}
        note={`Subscription - ${selectedPlan?.title || 'Tiffin'}`}
        upiId={upiId}
        merchantName={merchantName}
        customQrUrl={customQrUrl}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  container: { padding: 18, paddingBottom: 40 },
  pageTitle: { fontSize: 22, fontWeight: '900', marginBottom: 16 },

  // Top Tabs
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#00000010',
    borderRadius: 14,
    padding: 4,
    marginBottom: 20,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 10,
  },
  tabButtonActive: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
  tabButtonText: {
    fontSize: 13,
    fontWeight: '800',
  },

  sectionWrap: { marginBottom: 16 },
  sectionTitle: { fontSize: 18, fontWeight: '800', marginBottom: 4 },
  sectionSub: { fontSize: 12, marginBottom: 14 },

  // Active Plan Card
  activeCard: {
    borderRadius: 20,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1.2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
  },
  activeHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  activeTitle: { fontSize: 18, fontWeight: '900' },
  activeDate: { fontSize: 12, marginTop: 4, fontWeight: '500' },
  statusTag: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  statusTagText: { fontSize: 10, fontWeight: '900' },

  mealsBadge: {
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
    minWidth: 70,
  },
  mealsBadgeCount: { fontSize: 20, fontWeight: '900', color: '#FFF' },
  mealsBadgeLabel: { fontSize: 9, fontWeight: '800', color: '#FFF', textTransform: 'uppercase' },

  // Weekly Dot Matrix (M T W T F S S)
  weekTrackerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#0000000A',
    borderBottomWidth: 1,
    borderBottomColor: '#0000000A',
    marginBottom: 14,
  },
  weekDayCol: { alignItems: 'center' },
  weekDayDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  weekDayDotText: { color: '#FFF', fontSize: 12, fontWeight: 'bold' },
  weekDayLabel: { fontSize: 10, fontWeight: '700' },

  activeActionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  actionBtnOutline: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1.2,
    alignItems: 'center',
  },
  actionBtnOutlineText: { fontSize: 12, fontWeight: '800' },
  actionBtnPrimary: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
  },
  actionBtnPrimaryText: { fontSize: 12, fontWeight: '800' },

  // Expired Card
  expiredCard: {
    borderRadius: 20,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    opacity: 0.75,
  },
  expiredTag: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: '#64748B',
  },
  expiredTagText: { fontSize: 10, fontWeight: '900', color: '#FFF' },
  expiredMealsBadge: {
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
    backgroundColor: '#64748B20',
  },
  expiredMealsCount: { fontSize: 20, fontWeight: '900', color: '#64748B' },
  expiredMealsLabel: { fontSize: 9, fontWeight: '800', color: '#64748B' },
  expiredFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 6,
  },
  expiredDisabledNote: { fontSize: 11, flex: 1, marginRight: 10 },
  resubscribeBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10 },
  resubscribeBtnText: { fontSize: 11, fontWeight: '800' },

  // Empty state
  emptyCard: {
    borderRadius: 20,
    padding: 28,
    alignItems: 'center',
    borderWidth: 1,
    borderStyle: 'dashed',
    marginBottom: 16,
  },
  emptyTitle: { fontSize: 16, fontWeight: '800', marginBottom: 4 },
  emptySub: { fontSize: 12, textAlign: 'center', lineHeight: 18 },

  // Plan Card
  planCard: {
    borderRadius: 18,
    padding: 16,
    marginBottom: 14,
  },
  planHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  planTitle: { fontSize: 16, fontWeight: '800' },
  tagBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  tagBadgeText: { fontSize: 10, fontWeight: '800' },
  planDesc: { fontSize: 12, marginTop: 4 },
  planPrice: { fontSize: 18, fontWeight: '900' },
  planDuration: { fontSize: 11 },
  bonusBar: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    marginTop: 6,
  },
  bonusBarText: { fontSize: 11, fontWeight: '800' },

  subscribeBtn: {
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 3,
  },
  subscribeBtnText: { fontSize: 14, fontWeight: '800' },
  divider: { height: 1, marginVertical: 12 },

  // Modals Styling
  modalSafeArea: { flex: 1 },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#00000010',
  },
  modalBackBtn: { paddingVertical: 4 },
  modalBackText: { fontSize: 14, fontWeight: '800' },
  modalTitle: { fontSize: 16, fontWeight: '900' },
  modalScroll: { padding: 18, paddingBottom: 40 },

  // Manage Plan Hero
  manageHeroCard: {
    borderRadius: 20,
    padding: 18,
    borderWidth: 1.2,
    marginBottom: 20,
  },
  heroThumbnail: { width: 56, height: 56, borderRadius: 14 },
  heroPlanTitle: { fontSize: 18, fontWeight: '900' },
  heroPlanPrice: { fontSize: 15, fontWeight: '800', marginTop: 2 },
  heroPlanValid: { fontSize: 11, marginTop: 2 },

  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 18,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#0000000A',
  },
  statCol: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 18, fontWeight: '900' },
  statLabel: { fontSize: 11, marginTop: 2, fontWeight: '600' },
  statDivider: { width: 1, height: 26, backgroundColor: '#0000001A' },

  actionSectionHeader: { fontSize: 14, fontWeight: '800', marginBottom: 10 },
  quickActionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 16,
    borderWidth: 1.2,
    marginBottom: 10,
    gap: 12,
  },
  quickActionIcon: { fontSize: 20 },
  quickActionTitle: { fontSize: 14, fontWeight: '800' },
  quickActionSub: { fontSize: 11, marginTop: 2 },
  quickActionArrow: { fontSize: 18, fontWeight: '700' },

  // Calendar
  calendarCard: {
    borderRadius: 20,
    padding: 16,
    borderWidth: 1.2,
    marginBottom: 16,
  },
  calendarLegendRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 14,
    marginBottom: 12,
  },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 11, fontWeight: '600' },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    justifyContent: 'space-between',
  },
  calDayBox: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#00000008',
  },
  calDayBoxScheduled: { backgroundColor: '#22C55E' },
  calDayBoxSkipped: { backgroundColor: '#F97316' },
  calDayBoxInteractive: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#0000001A',
  },
  calDayBoxSelected: {
    backgroundColor: '#F97316',
    borderColor: '#EA580C',
  },
  calDayNum: { fontSize: 12, fontWeight: 'bold' },
  skippedSummaryBanner: {
    marginTop: 14,
    padding: 10,
    borderRadius: 12,
    backgroundColor: '#FFF7ED',
  },
  skippedSummaryText: { fontSize: 11, color: '#C2410C', fontWeight: '700' },

  // Skip Flow
  chipsRow: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  chipBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: '#0000000E',
  },
  chipBtnText: { fontSize: 12, fontWeight: '700' },
  reasonInput: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 13,
  },

  // Confirmation
  confirmCallout: {
    backgroundColor: '#FEF3C7',
    padding: 16,
    borderRadius: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  confirmCalloutTitle: { fontSize: 14, fontWeight: '900', color: '#92400E', marginBottom: 4 },
  confirmCalloutText: { fontSize: 12, color: '#B45309', lineHeight: 18 },
  confirmBox: { borderRadius: 18, padding: 18, borderWidth: 1.2 },
  confirmSectionTitle: { fontSize: 13, fontWeight: '800', marginBottom: 4 },
  confirmDatesList: { fontSize: 14, fontWeight: '800', marginBottom: 12 },
  confirmRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  confirmLabel: { fontSize: 12 },
  confirmVal: { fontSize: 13, fontWeight: '800' },

  // Day-Wise Customization
  walletAllowanceCard: {
    borderRadius: 16,
    padding: 14,
    borderWidth: 1.2,
    marginBottom: 10,
  },
  walletAllowanceTitle: { fontSize: 14, fontWeight: '900', marginBottom: 4 },
  walletAllowanceSub: { fontSize: 11, lineHeight: 16 },
  dayMenuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1.2,
    marginBottom: 8,
  },
  dayMenuDate: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase' },
  dayMenuDish: { fontSize: 13, fontWeight: '800', marginTop: 2 },
  extraChargeText: { fontSize: 10, color: '#F97316', fontWeight: 'bold', marginTop: 2 },
  selectDishBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },
  selectDishBtnText: { fontSize: 11, fontWeight: '800' },

  dishPickerOverlay: {
    flex: 1,
    backgroundColor: '#00000080',
    justifyContent: 'flex-end',
  },
  dishPickerCard: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 18,
    borderWidth: 1,
  },
  dishOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
  },
  dishOptionName: { fontSize: 13, fontWeight: '800' },
  dishOptionDesc: { fontSize: 11, marginTop: 2 },
  dishOptionPrice: { fontSize: 14, fontWeight: '900' },
});
