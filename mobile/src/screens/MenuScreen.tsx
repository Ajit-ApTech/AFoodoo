import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  Image,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  Platform,
  StatusBar,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppStore } from '../store/appStore';
import { firestore } from '../firebaseConfig';
import { collection, onSnapshot, DocumentData } from 'firebase/firestore';
import dayjs from 'dayjs';
import { useTheme } from '../theme/ThemeContext';
import { fetchMenuItemsFromRest, fetchMealSlotsFromRest } from '../api/firestoreApi';

const DEFAULT_SAMPLE_ITEMS = [
  {
    id: 'sample_biryani_1',
    title: 'Chicken Biryani',
    description: 'Special fragrant dum biryani with tender chicken pieces, raita & boiled egg.',
    price: 299,
    veg_flag: false,
    max_quantity: 40,
    quantity_booked: 5,
    is_available: true,
    image_url: 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&w=600&q=80',
  },
  {
    id: 'sample_thali_2',
    title: 'Veg Thali',
    description: 'Homely North Indian thali with dal fry, seasonal subzi, 4 phulkas, jeera rice & gulab jamun.',
    price: 199,
    veg_flag: true,
    max_quantity: 50,
    quantity_booked: 12,
    is_available: true,
    image_url: 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?auto=format&fit=crop&w=600&q=80',
  },
  {
    id: 'sample_curry_3',
    title: 'Paneer Butter Masala (Curry)',
    description: 'Rich tomato cashew gravy with fresh cottage cheese cubes cooked in slow butter.',
    price: 149,
    veg_flag: true,
    max_quantity: 35,
    quantity_booked: 8,
    is_available: true,
    image_url: 'https://images.unsplash.com/photo-1631452180519-c014fe946bc7?auto=format&fit=crop&w=600&q=80',
  },
  {
    id: 'sample_roti_4',
    title: 'Tawa Butter Roti (Set of 4)',
    description: 'Hot wheat rotis brushed with fresh dairy butter.',
    price: 40,
    veg_flag: true,
    max_quantity: 100,
    quantity_booked: 24,
    is_available: true,
    image_url: 'https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?auto=format&fit=crop&w=600&q=80',
  },
];

export default function MenuScreen({ navigation }: any) {
  const { theme, isDark } = useTheme();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [availableSlots, setAvailableSlots] = useState<any[]>([]);

  const activeSlot = useAppStore(state => state.activeSlot);
  const setActiveSlot = useAppStore(state => state.setActiveSlot);
  const setMenuItems = useAppStore(state => state.setMenuItems);
  const menuItems = useAppStore(state => state.menuItems);

  const cart = useAppStore(state => state.cart);
  const addToCart = useAppStore(state => state.addToCart);
  const removeFromCart = useAppStore(state => state.removeFromCart);
  const cartTotalCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const cartSubtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

  // Subscribe to all active meal_slots + REST API fetcher
  useEffect(() => {
    let isMounted = true;
    fetchMealSlotsFromRest().then(slots => {
      if (isMounted && slots.length > 0) setAvailableSlots(slots);
    });

    try {
      const q = collection(firestore, 'meal_slots');
      const unsub = onSnapshot(
        q,
        snap => {
          if (isMounted && !snap.empty) {
            const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setAvailableSlots(list);
          }
        },
        _err => {}
      );
      return () => {
        isMounted = false;
        unsub();
      };
    } catch (e) {}
  }, []);

  // Subscribe to menu_items + REST API fetcher for real Firebase data
  useEffect(() => {
    let isMounted = true;

    fetchMenuItemsFromRest().then(items => {
      if (isMounted && items.length > 0) {
        setMenuItems(items as any);
        setLoading(false);
      }
    });

    try {
      const q = collection(firestore, 'menu_items');
      const unsub = onSnapshot(
        q,
        snap => {
          if (isMounted) {
            const items = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as DocumentData));
            setMenuItems(items as any);
            setLoading(false);
          }
        },
        _err => {
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

  // Helper to parse cutoff time string like "10:30 PM" or Date/Timestamp
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

  const cutoffDayjs = parseTimeToDayjs(activeSlot?.booking_cutoff_time);
  const now = dayjs();
  const isBeforeCutoff = cutoffDayjs ? now.isBefore(cutoffDayjs) : true;

  // Filter items specifically by activeSlot.id or activeSlot.name
  const rawList = menuItems && menuItems.length > 0 ? menuItems : DEFAULT_SAMPLE_ITEMS;
  const filteredItems = rawList.filter((item: any) => {
    if (!activeSlot) return true;
    return (
      item.meal_slot_id === activeSlot.id ||
      item.meal_slot_id === activeSlot.name ||
      !item.meal_slot_id
    );
  });

  const displayList = filteredItems.length > 0 ? filteredItems : DEFAULT_SAMPLE_ITEMS;

  const handleBook = (item: any) => {
    if (!isBeforeCutoff) {
      Alert.alert(
        'Cutoff Passed 🔒',
        'The booking cutoff time has passed for this slot. You can browse dishes for reference, but new bookings are closed.'
      );
      return;
    }
    const remaining = (item.max_quantity || 50) - (item.quantity_booked || 0);
    const isSoldOut = item.is_available === false || remaining <= 0;
    if (isSoldOut) {
      Alert.alert('Sold Out 🔒', 'Sorry, this meal has been marked as sold out by admin!');
      return;
    }

    const inCart = cart.find(c => c.id === item.id);
    if (!inCart) {
      addToCart(item, activeSlot);
    }
    navigation.navigate('Booking', { item });
  };

  const renderItem = ({ item }: any) => {
    const isExpanded = expandedId === item.id;
    const remaining = Math.max(1, (item.max_quantity || 50) - (item.quantity_booked || 0));
    const isSoldOut = item.is_available === false || remaining <= 0;

    const cartItem = cart.find(c => c.id === item.id);
    const qtyInCart = cartItem ? cartItem.quantity : 0;

    return (
      <View
        style={[
          styles.card,
          {
            backgroundColor: isDark ? '#1C1512' : '#FFFFFF',
            borderColor: isDark ? 'rgba(255, 107, 0, 0.18)' : '#F3E8E2',
          },
        ]}
      >
        {/* Dish Banner Image with Veg / Non-Veg pill (Heart icon omitted as requested) */}
        <View style={styles.imageContainer}>
          <Image
            source={{
              uri:
                item.image_url ||
                'https://images.unsplash.com/photo-1546833999-b9f581a1996d?auto=format&fit=crop&w=600&q=80',
            }}
            style={styles.image}
            resizeMode="cover"
          />

          <View
            style={[
              styles.vegBadge,
              item.veg_flag ? styles.vegBadgeGreen : styles.vegBadgeRed,
            ]}
          >
            <Text style={styles.vegBadgeText}>
              {item.veg_flag ? '🌱 VEG' : '🍗 NON-VEG'}
            </Text>
          </View>
        </View>

        {/* Content Details */}
        <View style={styles.cardContent}>
          <View style={styles.titleRow}>
            <Text style={[styles.title, { color: theme.textPrimary }]}>{item.title}</Text>
            <Text style={[styles.price, { color: theme.primary }]}>₹{item.price.toFixed(0)}</Text>
          </View>

          <Text
            style={[styles.description, { color: theme.textSecondary }]}
            numberOfLines={isExpanded ? undefined : 2}
          >
            {item.description || 'Prepared fresh with high quality ingredients and traditional spices.'}
          </Text>

          <View style={styles.metaRow}>
            <Text style={[styles.remainingText, { color: isSoldOut ? '#EF4444' : '#10B981' }]}>
              {isSoldOut ? '❌ Sold Out' : `🔥 ${remaining} portions remaining`}
            </Text>

            <TouchableOpacity onPress={() => setExpandedId(isExpanded ? null : item.id)}>
              <Text style={[styles.expandText, { color: theme.textMuted }]}>
                {isExpanded ? 'Show less ▲' : 'Tap for details ▾'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Stepper & Book Meal / Add to Cart Row */}
          <View style={styles.actionRow}>
            {/* Stepper: [ - ]  quantity  [ + ] */}
            <View
              style={[
                styles.stepperContainer,
                {
                  backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : '#FFF3ED',
                  borderColor: isDark ? 'rgba(255, 255, 255, 0.12)' : '#FFD9C6',
                },
              ]}
            >
              <TouchableOpacity
                onPress={() => {
                  if (qtyInCart > 0) removeFromCart(item.id);
                }}
                disabled={qtyInCart === 0}
                style={[styles.stepperBtn, qtyInCart === 0 && { opacity: 0.3 }]}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={[styles.stepperBtnText, { color: theme.primary }]}>−</Text>
              </TouchableOpacity>

              <Text style={[styles.stepperValue, { color: theme.textPrimary }]}>
                {qtyInCart > 0 ? qtyInCart : 1}
              </Text>

              <TouchableOpacity
                onPress={() => addToCart(item, activeSlot)}
                style={styles.stepperBtn}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={[styles.stepperBtnText, { color: theme.primary }]}>+</Text>
              </TouchableOpacity>
            </View>

            {/* Book Meal / Add to Cart CTA */}
            <TouchableOpacity
              style={[
                styles.bookButton,
                {
                  backgroundColor:
                    !isBeforeCutoff || isSoldOut ? theme.disabledBg : theme.primary,
                },
              ]}
              onPress={() => handleBook(item)}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.bookButtonText,
                  {
                    color:
                      !isBeforeCutoff || isSoldOut ? theme.disabledText : '#FFFFFF',
                  },
                ]}
              >
                {!isBeforeCutoff
                  ? 'Cutoff Passed 🔒'
                  : isSoldOut
                  ? 'Sold Out'
                  : '🛒 Book Meal Now'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  const insets = useSafeAreaInsets();
  const topInset = Math.max(insets.top, Platform.OS === 'android' ? (StatusBar.currentHeight || 38) : 0);

  return (
    <SafeAreaView edges={['left', 'right', 'bottom']} style={[styles.safeArea, { backgroundColor: theme.background, paddingTop: topInset }]}>
      {/* Top Header Bar with Back button, Title, and Cart inside Safe Area */}
      <View style={[styles.menuHeaderBar, { backgroundColor: theme.background, borderBottomColor: theme.surfaceBorder }]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={[styles.backBtnCircle, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder }]}
          activeOpacity={0.7}
        >
          <Text style={{ fontSize: 16, color: theme.textPrimary, fontWeight: '800' }}>←</Text>
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={[styles.menuHeaderTitle, { color: theme.textPrimary }]} numberOfLines={1}>
            Today's Tiffin Menu 🍱
          </Text>
          <Text style={[styles.menuHeaderSub, { color: theme.textSecondary }]} numberOfLines={1}>
            {activeSlot?.name || 'Fresh daily home-cooked meals'}
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => navigation.navigate('Booking', {})}
          style={[styles.cartBtnCircle, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder }]}
          activeOpacity={0.7}
        >
          <Text style={{ fontSize: 16 }}>🛒</Text>
          {cartTotalCount > 0 && (
            <View style={styles.cartBadgeDot}>
              <Text style={styles.cartBadgeText}>{cartTotalCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Top Slot Pill Bar */}
      {availableSlots.length > 0 && (
        <View
          style={[
            styles.slotTabBar,
            {
              backgroundColor: theme.surface,
              borderBottomColor: theme.surfaceBorder,
            },
          ]}
        >
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.slotTabScroll}
          >
            {availableSlots.map(s => {
              const isSelected = activeSlot?.id === s.id;
              return (
                <TouchableOpacity
                  key={s.id}
                  style={[
                    styles.slotTab,
                    {
                      backgroundColor: isSelected ? theme.primary : isDark ? '#261D1A' : '#F4F4F5',
                      borderColor: isSelected ? theme.primary : theme.surfaceBorder,
                    },
                  ]}
                  onPress={() => setActiveSlot(s)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.slotTabText,
                      { color: isSelected ? '#FFFFFF' : theme.textSecondary },
                    ]}
                  >
                    {s.name?.toLowerCase().includes('lunch') ? '☀️ ' : s.name?.toLowerCase().includes('dinner') ? '🌙 ' : '🍲 '}
                    {s.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* Active Slot Window Card Banner */}
      <View style={styles.slotBannerContainer}>
        <View
          style={[
            styles.slotBannerCard,
            {
              backgroundColor: isDark ? '#221915' : '#FFF9F5',
              borderColor: isDark ? 'rgba(255, 107, 0, 0.2)' : '#FEDCC7',
            },
          ]}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 8 }}>
              <Text style={{ fontSize: 20, marginRight: 8 }}>🍱</Text>
              <View>
                <Text style={[styles.slotBannerTitle, { color: theme.textPrimary }]} numberOfLines={1}>
                  {activeSlot?.name || 'Lunch special Meal booking'}
                </Text>
                <Text style={[styles.slotBannerSub, { color: theme.textSecondary }]}>
                  Book {activeSlot?.booking_open_time || '10:30 PM'} – {activeSlot?.booking_cutoff_time || '11:59 PM'}
                </Text>
              </View>
            </View>

            <View
              style={[
                styles.windowOpenPill,
                { backgroundColor: isBeforeCutoff ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)' },
              ]}
            >
              <Text
                style={[
                  styles.windowOpenText,
                  { color: isBeforeCutoff ? '#10B981' : '#EF4444' },
                ]}
              >
                {isBeforeCutoff ? 'WINDOW OPEN' : 'CLOSED'}
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* Menu Dishes List */}
      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={[styles.loadingText, { color: theme.textSecondary }]}>
            Loading today's fresh menu...
          </Text>
        </View>
      ) : (
        <FlatList
          data={displayList}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          contentContainerStyle={[styles.listContent, cartTotalCount > 0 && { paddingBottom: 100 }]}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => setRefreshing(false)}
              tintColor={theme.primary}
            />
          }
        />
      )}

      {/* Floating Bottom Cart Bar when cart has items */}
      {cartTotalCount > 0 && (
        <View
          style={[
            styles.floatingCartBar,
            {
              backgroundColor: isDark ? '#231713' : '#FFFFFF',
              borderColor: isDark ? 'rgba(255, 107, 0, 0.3)' : '#FEDCC7',
              shadowColor: '#000000',
            },
          ]}
        >
          <View>
            <Text style={[styles.floatingCartCount, { color: theme.primary }]}>
              🛒 {cartTotalCount} {cartTotalCount === 1 ? 'Item' : 'Items'} in Cart
            </Text>
            <Text style={[styles.floatingCartSubtotal, { color: theme.textPrimary }]}>
              ₹{cartSubtotal.toFixed(0)} + Fees
            </Text>
          </View>

          <TouchableOpacity
            style={[styles.floatingCartBtn, { backgroundColor: theme.primary }]}
            onPress={() => navigation.navigate('Booking', {})}
            activeOpacity={0.85}
          >
            <Text style={styles.floatingCartBtnText}>View Cart & Checkout →</Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  menuHeaderBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  backBtnCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuHeaderTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  menuHeaderSub: {
    fontSize: 11,
    fontWeight: '500',
    marginTop: 1,
  },
  cartBtnCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
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
  slotTabBar: {
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  slotTabScroll: {
    paddingHorizontal: 16,
    gap: 8,
  },
  slotTab: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
  },
  slotTabText: {
    fontSize: 12,
    fontWeight: '700',
  },
  slotBannerContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
  },
  slotBannerCard: {
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
  },
  slotBannerTitle: {
    fontSize: 14,
    fontWeight: '800',
  },
  slotBannerSub: {
    fontSize: 11,
    marginTop: 2,
    fontWeight: '500',
  },
  windowOpenPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  windowOpenText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
  },
  listContent: {
    padding: 16,
    paddingBottom: 40,
  },
  card: {
    borderRadius: 20,
    marginBottom: 18,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
  },
  imageContainer: {
    position: 'relative',
    width: '100%',
    height: 190,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  vegBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  vegBadgeGreen: {
    backgroundColor: '#059669',
  },
  vegBadgeRed: {
    backgroundColor: '#DC2626',
  },
  vegBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  cardContent: {
    padding: 16,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 6,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    flex: 1,
    marginRight: 10,
  },
  price: {
    fontSize: 22,
    fontWeight: '900',
  },
  description: {
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 8,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  remainingText: {
    fontSize: 12,
    fontWeight: '700',
  },
  expandText: {
    fontSize: 12,
    fontWeight: '600',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  stepperContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 6,
    minWidth: 100,
    justifyContent: 'space-between',
  },
  stepperBtn: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperBtnText: {
    fontSize: 18,
    fontWeight: '900',
    lineHeight: 20,
  },
  stepperValue: {
    fontSize: 15,
    fontWeight: '800',
    paddingHorizontal: 6,
  },
  bookButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#FF6B00',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  bookButtonText: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  floatingCartBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 8,
  },
  floatingCartCount: {
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  floatingCartSubtotal: {
    fontSize: 16,
    fontWeight: '900',
    marginTop: 2,
  },
  floatingCartBtn: {
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  floatingCartBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
});
