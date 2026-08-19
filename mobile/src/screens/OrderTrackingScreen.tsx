import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  Alert,
  Animated,
  ActivityIndicator,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import { firestore } from '../firebaseConfig';
import { doc, onSnapshot, collection } from 'firebase/firestore';
import { useAppStore } from '../store/appStore';
import { useTheme } from '../theme/ThemeContext';
import { fetchOrdersFromRest } from '../api/firestoreApi';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function OrderTrackingScreen({ route, navigation }: any) {
  const { theme } = useTheme();
  const user = useAppStore(state => state.user);
  const routeOrderId = route?.params?.orderId;

  const [ordersList, setOrdersList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedOrderIds, setExpandedOrderIds] = useState<Record<string, boolean>>({});

  const steps = [
    { title: 'Order Booked', desc: 'Received & validated in kitchen queue' },
    { title: 'Kitchen Preparing', desc: 'Fresh ingredients being cooked' },
    { title: 'Out for Delivery', desc: 'Hot tiffin packed & assigned to rider' },
    { title: 'Meal Delivered', desc: 'Enjoy your hot meal!' },
  ];

  const mapStatusToStep = (status?: string) => {
    if (!status) return 0;
    const statusLower = status.toLowerCase();
    switch (statusLower) {
      case 'booked':
      case 'placed':
        return 0;
      case 'preparing':
      case 'confirmed':
        return 1;
      case 'out_for_delivery':
      case 'out for delivery':
        return 2;
      case 'delivered':
        return 3;
      default:
        return 0;
    }
  };

  const getStatusBadge = (status?: string) => {
    const statusLower = (status || 'booked').toLowerCase();
    switch (statusLower) {
      case 'booked':
      case 'placed':
        return { label: 'Booked', bg: '#E3F2FD', text: '#1565C0', border: '#BBDEFB' };
      case 'preparing':
      case 'confirmed':
        return { label: 'Preparing', bg: '#FFF8E1', text: '#F57F17', border: '#FFE082' };
      case 'out_for_delivery':
      case 'out for delivery':
        return { label: 'Out for Delivery', bg: '#F3E5F5', text: '#7B1FA2', border: '#E1BEE7' };
      case 'delivered':
        return { label: 'Delivered', bg: '#E8F5E9', text: '#2E7D32', border: '#C8E6C9' };
      case 'cancelled':
        return { label: 'Cancelled', bg: '#FFEBEE', text: '#C62828', border: '#FFCDD2' };
      default:
        return { label: 'Booked', bg: '#E3F2FD', text: '#1565C0', border: '#BBDEFB' };
    }
  };

  const toggleExpand = (id: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedOrderIds(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // Real-time Cloud Firestore subscription for all customer orders
  useEffect(() => {
    let unsub: any;
    let isMounted = true;

    const userDigits = (user?.phone || '').replace(/\D/g, '');
    const userDocId = user?.id || (userDigits ? `usr_${userDigits}` : '');

    // 1. Immediate HTTPS REST fetch fallback to guarantee instant data on refresh
    fetchOrdersFromRest(user?.phone, user?.id).then(restOrders => {
      if (isMounted && restOrders.length > 0 && ordersList.length === 0) {
        const sorted = sortOrders(restOrders);
        setOrdersList(sorted);
        if (sorted.length > 0) {
          setExpandedOrderIds({ [sorted[0].id]: true });
        }
        setLoading(false);
      }
    });

    // 2. Real-time Cloud Firestore subscription
    try {
      unsub = onSnapshot(
        collection(firestore, 'orders'),
        snap => {
          if (!snap.empty) {
            const userOrders = snap.docs
              .map((d: any) => ({ id: d.id, ...d.data() }))
              .filter((o: any) => {
                if (routeOrderId && o.id === routeOrderId) return true;
                if (!userDigits && !userDocId) return true;
                const oDigits = (o.user_phone || '').replace(/\D/g, '');
                const isPhoneMatch =
                  userDigits &&
                  oDigits &&
                  (oDigits.endsWith(userDigits) || userDigits.endsWith(oDigits));
                const isIdMatch = userDocId && (o.user_id === userDocId || o.user_id === user?.id);
                return isPhoneMatch || isIdMatch;
              });

            const sorted = sortOrders(userOrders);
            setOrdersList(sorted);

            // Auto-expand specified routeOrderId or first active order on initial load
            setExpandedOrderIds(prev => {
              if (Object.keys(prev).length === 0 && sorted.length > 0) {
                const targetId = routeOrderId || sorted[0].id;
                return { [targetId]: true };
              }
              return prev;
            });
          } else {
            setOrdersList([]);
          }
          setLoading(false);
        },
        () => setLoading(false)
      );
    } catch (e) {
      setLoading(false);
    }

    return () => {
      isMounted = false;
      if (unsub) unsub();
    };
  }, [routeOrderId, user?.phone, user?.id]);

  const sortOrders = (list: any[]) => {
    return [...list].sort((a, b) => {
      const aIsActive = a.status !== 'delivered' && a.status !== 'cancelled';
      const bIsActive = b.status !== 'delivered' && b.status !== 'cancelled';
      if (aIsActive && !bIsActive) return -1;
      if (!aIsActive && bIsActive) return 1;
      return (b.created_at || '').localeCompare(a.created_at || '');
    });
  };

  const handleRateMeal = (orderId: string, stars: number) => {
    setOrdersList(prev =>
      prev.map(o => (o.id === orderId ? { ...o, rating: stars } : o))
    );
    Alert.alert('Thank You! ⭐', `You rated this meal ${stars} Stars. Your feedback improves our kitchen!`);
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={[styles.pageTitle, { color: theme.textPrimary }]}>Track Tiffin Orders 🚴</Text>

        {loading ? (
          <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder, alignItems: 'center', paddingVertical: 40 }]}>
            <ActivityIndicator size="large" color={theme.primary} />
            <Text style={[styles.loadingText, { color: theme.textSecondary }]}>
              Fetching live order tracking status...
            </Text>
          </View>
        ) : ordersList.length === 0 ? (
          <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder, alignItems: 'center', paddingVertical: 30 }]}>
            <Text style={[styles.noOrderTitle, { color: theme.textPrimary }]}>No Active Orders Found</Text>
            <Text style={[styles.noOrderSub, { color: theme.textSecondary }]}>
              Book a delicious tiffin meal from the Menu screen to track live preparation and delivery!
            </Text>
            <TouchableOpacity
              style={[styles.bookBtn, { backgroundColor: theme.primary }]}
              onPress={() => navigation.navigate('Home')}
            >
              <Text style={[styles.bookBtnText, { color: theme.buttonText }]}>Browse Today's Menu 🍲</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.ordersListContainer}>
            {ordersList.map((ord: any) => {
              const isExpanded = !!expandedOrderIds[ord.id];
              const currentStep = mapStatusToStep(ord.status);
              const badge = getStatusBadge(ord.status);

              return (
                <View
                  key={ord.id}
                  style={[
                    styles.accordionCard,
                    { backgroundColor: theme.surface, borderColor: isExpanded ? theme.primary : theme.surfaceBorder },
                  ]}
                >
                  {/* Accordion Header (Clickable) */}
                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={() => toggleExpand(ord.id)}
                    style={styles.accordionHeader}
                  >
                    <View style={styles.headerMainInfo}>
                      <View style={styles.orderTitleRow}>
                        <Text style={[styles.orderIdText, { color: theme.textPrimary }]}>
                          #{ord.id.slice(-8)}
                        </Text>
                        <View
                          style={[
                            styles.statusBadge,
                            { backgroundColor: badge.bg, borderColor: badge.border },
                          ]}
                        >
                          <Text style={[styles.statusBadgeText, { color: badge.text }]}>
                            {badge.label}
                          </Text>
                        </View>
                      </View>

                      <Text style={[styles.mealTitleText, { color: theme.primary }]}>
                        {ord.menu_title || 'Tiffin Meal'}
                      </Text>
                      <Text style={[styles.slotText, { color: theme.textSecondary }]}>
                        Slot: {ord.slot_name || 'Scheduled Slot'}
                      </Text>
                    </View>

                    <View style={styles.headerRightBox}>
                      {ord.otp_code ? (
                        <View style={[styles.otpBox, { backgroundColor: theme.primaryLight }]}>
                          <Text style={[styles.otpLabel, { color: theme.accent }]}>OTP</Text>
                          <Text style={[styles.otpCode, { color: theme.primary }]}>
                            {ord.otp_code}
                          </Text>
                        </View>
                      ) : null}
                      <Text style={[styles.chevron, { color: theme.textMuted }]}>
                        {isExpanded ? '▲' : '▼'}
                      </Text>
                    </View>
                  </TouchableOpacity>

                  {/* Expanded Content Drawer */}
                  {isExpanded ? (
                    <View style={styles.expandedContent}>
                      {ord.otp_code ? (
                        <Text style={[styles.otpNotice, { color: theme.textSecondary }]}>
                          🔒 Share OTP <Text style={{ fontWeight: '800', color: theme.primary }}>{ord.otp_code}</Text> with delivery rider upon receiving your meal.
                        </Text>
                      ) : null}

                      {/* Live Delivery Stepper */}
                      <View style={styles.stepperSection}>
                        <View style={styles.stepperHeader}>
                          <Text style={[styles.cardHeader, { color: theme.textPrimary }]}>
                            Live Delivery Progress
                          </Text>
                          <View style={styles.liveBadge}>
                            <View style={styles.livePulse} />
                            <Text style={styles.liveText}>REALTIME SYNC</Text>
                          </View>
                        </View>

                        <View style={styles.stepperContainer}>
                          {steps.map((step, index) => {
                            const isCompleted = index <= currentStep;
                            const isCurrent = index === currentStep;

                            return (
                              <View key={index} style={styles.stepRow}>
                                <View style={styles.stepIndicatorColumn}>
                                  <View
                                    style={[
                                      styles.stepDot,
                                      {
                                        backgroundColor: isCompleted
                                          ? theme.statusSuccessText
                                          : isCurrent
                                          ? theme.primary
                                          : theme.inputBorder,
                                      },
                                    ]}
                                  >
                                    <Text style={styles.stepDotText}>
                                      {isCompleted ? '✓' : index + 1}
                                    </Text>
                                  </View>
                                  {index < steps.length - 1 && (
                                    <View
                                      style={[
                                        styles.stepLine,
                                        {
                                          backgroundColor:
                                            index < currentStep
                                              ? theme.statusSuccessText
                                              : theme.inputBorder,
                                        },
                                      ]}
                                    />
                                  )}
                                </View>

                                <View style={styles.stepContent}>
                                  <Text
                                    style={[
                                      styles.stepTitle,
                                      {
                                        color: isCurrent ? theme.textPrimary : theme.textMuted,
                                        fontWeight: isCurrent ? '800' : '600',
                                      },
                                    ]}
                                  >
                                    {step.title}
                                  </Text>
                                  <Text style={[styles.stepDesc, { color: theme.textSecondary }]}>
                                    {step.desc}
                                  </Text>
                                </View>
                              </View>
                            );
                          })}
                        </View>
                      </View>

                      {/* Delivery Window Card */}
                      <View
                        style={[
                          styles.etaCard,
                          { backgroundColor: theme.statusSuccessBg, borderColor: theme.statusSuccessText },
                        ]}
                      >
                        <Text style={[styles.etaTitle, { color: theme.statusSuccessText }]}>
                          ⏰ Estimated Delivery Window
                        </Text>
                        <Text style={[styles.etaTime, { color: theme.statusSuccessText }]}>
                          {ord.delivery_window ||
                            (ord.delivery_start && ord.delivery_end
                              ? `${ord.delivery_start} – ${ord.delivery_end}`
                              : ord.slot_name?.toLowerCase().includes('dinner')
                              ? '7:30 PM – 8:30 PM (Dinner Slot)'
                              : '1:00 PM – 2:00 PM (Lunch Slot)')}
                        </Text>
                        {ord.delivery_address?.line1 ? (
                          <Text style={[styles.etaSub, { color: theme.statusSuccessText }]}>
                            📍 Delivering to: {ord.delivery_address.line1}
                          </Text>
                        ) : (
                          <Text style={[styles.etaSub, { color: theme.statusSuccessText }]}>
                            Thermal insulated tiffin box keeps your food hot and fresh.
                          </Text>
                        )}
                      </View>

                      {/* Post-Delivery Rating */}
                      {currentStep === 3 ? (
                        <View
                          style={[
                            styles.ratingCard,
                            { backgroundColor: theme.surface, borderColor: theme.accentBadgeBg },
                          ]}
                        >
                          <Text style={[styles.ratingTitle, { color: theme.textPrimary }]}>
                            How was your meal today?
                          </Text>
                          <Text style={[styles.ratingSub, { color: theme.textSecondary }]}>
                            Your rating feeds into our kitchen quality controls.
                          </Text>
                          <View style={styles.starsRow}>
                            {[1, 2, 3, 4, 5].map(star => (
                              <TouchableOpacity
                                key={star}
                                onPress={() => handleRateMeal(ord.id, star)}
                                style={styles.starTouch}
                              >
                                <Text style={styles.starIcon}>{ord.rating >= star ? '⭐' : '☆'}</Text>
                              </TouchableOpacity>
                            ))}
                          </View>
                        </View>
                      ) : null}
                    </View>
                  ) : null}
                </View>
              );
            })}
          </View>
        )}

        <TouchableOpacity
          style={[styles.homeButton, { backgroundColor: theme.textPrimary }]}
          onPress={() => navigation.navigate('Home')}
        >
          <Text style={[styles.homeButtonText, { color: theme.surface }]}>Return to Home</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  container: { padding: 20 },
  pageTitle: { fontSize: 22, fontWeight: '800', marginBottom: 16 },
  card: { borderRadius: 16, padding: 18, marginBottom: 16, borderWidth: 1 },
  ordersListContainer: { marginBottom: 16 },
  accordionCard: { borderRadius: 16, marginBottom: 14, borderWidth: 1, overflow: 'hidden' },
  accordionHeader: {
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerMainInfo: { flex: 1, marginRight: 12 },
  orderTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  orderIdText: { fontSize: 16, fontWeight: '800' },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, borderWidth: 1 },
  statusBadgeText: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase' },
  mealTitleText: { fontSize: 13, fontWeight: '700', marginBottom: 2 },
  slotText: { fontSize: 11, fontWeight: '600' },
  headerRightBox: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  otpBox: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, alignItems: 'center' },
  otpLabel: { fontSize: 9, fontWeight: '800' },
  otpCode: { fontSize: 15, fontWeight: '800' },
  chevron: { fontSize: 12, fontWeight: '800', paddingHorizontal: 4 },
  expandedContent: { paddingHorizontal: 16, paddingBottom: 16, borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.06)', paddingTop: 12 },
  otpNotice: { fontSize: 11, marginBottom: 14, lineHeight: 16 },
  stepperSection: { marginBottom: 14 },
  stepperHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  cardHeader: { fontSize: 14, fontWeight: '700' },
  liveBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#E8F5E9', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  livePulse: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#2E7D32', marginRight: 4 },
  liveText: { fontSize: 9, fontWeight: '800', color: '#2E7D32' },
  stepperContainer: { paddingLeft: 4 },
  stepRow: { flexDirection: 'row', marginBottom: 16 },
  stepIndicatorColumn: { alignItems: 'center', marginRight: 12, width: 26 },
  stepDot: { width: 26, height: 26, borderRadius: 13, justifyContent: 'center', alignItems: 'center' },
  stepDotText: { color: '#FFF', fontSize: 11, fontWeight: '800' },
  stepLine: { width: 2, flex: 1, marginTop: 4, marginBottom: -12 },
  stepContent: { flex: 1, justifyContent: 'center' },
  stepTitle: { fontSize: 13 },
  stepDesc: { fontSize: 11, marginTop: 1 },
  etaCard: { borderRadius: 14, padding: 14, marginBottom: 14, borderWidth: 1 },
  etaTitle: { fontSize: 12, fontWeight: '700', marginBottom: 3 },
  etaTime: { fontSize: 15, fontWeight: '800' },
  etaSub: { fontSize: 11, marginTop: 4 },
  ratingCard: { borderRadius: 14, padding: 16, marginTop: 6, alignItems: 'center', borderWidth: 1 },
  ratingTitle: { fontSize: 14, fontWeight: '700' },
  ratingSub: { fontSize: 11, textAlign: 'center', marginTop: 2, marginBottom: 10 },
  starsRow: { flexDirection: 'row', justifyContent: 'center' },
  starTouch: { padding: 4, minWidth: 40, minHeight: 40, justifyContent: 'center', alignItems: 'center' },
  starIcon: { fontSize: 24 },
  homeButton: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    minHeight: 48,
    justifyContent: 'center',
  },
  homeButtonText: { fontSize: 15, fontWeight: '700' },
  loadingText: { fontSize: 12, marginTop: 12 },
  noOrderTitle: { fontSize: 16, fontWeight: '800', marginBottom: 6 },
  noOrderSub: { fontSize: 12, textAlign: 'center', lineHeight: 18, marginBottom: 16 },
  bookBtn: { paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12 },
  bookBtnText: { fontSize: 13, fontWeight: '800' },
});
