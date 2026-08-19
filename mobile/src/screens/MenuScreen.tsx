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
  SafeAreaView,
  RefreshControl,
  ScrollView,
} from 'react-native';
import { useAppStore } from '../store/appStore';
import { firestore } from '../firebaseConfig';
import { collection, onSnapshot, DocumentData, query, where } from 'firebase/firestore';
import dayjs from 'dayjs';
import { useTheme } from '../theme/ThemeContext';

import { fetchMenuItemsFromRest, fetchMealSlotsFromRest } from '../api/firestoreApi';

export default function MenuScreen({ navigation }: any) {
  const { theme } = useTheme();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [availableSlots, setAvailableSlots] = useState<any[]>([]);

  const activeSlot = useAppStore(state => state.activeSlot);
  const setActiveSlot = useAppStore(state => state.setActiveSlot);
  const setMenuItems = useAppStore(state => state.setMenuItems);
  const menuItems = useAppStore(state => state.menuItems);

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

  // Subscribe to menu_items + REST API fetcher for 100% real Firebase data
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

  // Determine cutoff validity for selected active slot
  const cutoffDayjs = parseTimeToDayjs(activeSlot?.booking_cutoff_time);
  const now = dayjs();
  const isBeforeCutoff = cutoffDayjs ? now.isBefore(cutoffDayjs) : true;

  // Filter items specifically by activeSlot.id or activeSlot.name
  const rawList = menuItems;
  const filteredItems = rawList.filter((item: any) => {
    if (!activeSlot) return true;
    return (
      item.meal_slot_id === activeSlot.id ||
      item.meal_slot_id === activeSlot.name ||
      !item.meal_slot_id
    );
  });

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
    navigation.navigate('Booking', { item });
  };

  const renderItem = ({ item }: any) => {
    const isExpanded = expandedId === item.id;
    const remaining = (item.max_quantity || 50) - (item.quantity_booked || 0);
    const isSoldOut = item.is_available === false || remaining <= 0;

    return (
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={() => setExpandedId(isExpanded ? null : item.id)}
        style={[
          styles.card,
          { backgroundColor: theme.surface, borderColor: theme.surfaceBorder },
        ]}
      >
        <View style={styles.imageContainer}>
          <Image source={{ uri: item.image_url }} style={styles.image} />
          <View style={[styles.vegBadge, item.veg_flag ? styles.vegBadgeGreen : styles.vegBadgeRed]}>
            <Text style={styles.vegBadgeText}>{item.veg_flag ? '🌱 VEG' : '🍖 NON-VEG'}</Text>
          </View>
        </View>

        <View style={styles.cardContent}>
          <View style={styles.titleRow}>
            <Text style={[styles.title, { color: theme.textPrimary }]}>{item.title}</Text>
            <Text style={[styles.price, { color: theme.primary }]}>₹{item.price.toFixed(0)}</Text>
          </View>

          <Text style={[styles.description, { color: theme.textSecondary }]} numberOfLines={isExpanded ? undefined : 2}>
            {item.description}
          </Text>

          <View style={styles.metaRow}>
            <Text style={[styles.remainingText, { color: theme.accent }]}>
              {isSoldOut ? '❌ Sold Out' : `🔥 ${remaining} portions remaining`}
            </Text>
            <Text style={[styles.expandText, { color: theme.textMuted }]}>
              {isExpanded ? 'Show less ▲' : 'Tap for details ▼'}
            </Text>
          </View>

          <TouchableOpacity
            style={[
              styles.bookButton,
              { backgroundColor: !isBeforeCutoff || isSoldOut ? theme.disabledBg : theme.primary },
            ]}
            onPress={() => handleBook(item)}
          >
            <Text
              style={[
                styles.bookButtonText,
                { color: !isBeforeCutoff || isSoldOut ? theme.disabledText : theme.buttonText },
              ]}
            >
              {!isBeforeCutoff
                ? 'Cutoff Passed 🔒'
                : isSoldOut
                ? 'Sold Out'
                : 'Book Meal Now'}
            </Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
      {/* Header Bar */}
      <View style={[styles.headerBar, { backgroundColor: theme.surface, borderBottomColor: theme.surfaceBorder }]}>
        <View style={styles.headerTitleCol}>
          <Text style={[styles.headerTitle, { color: theme.textPrimary }]}>
            {activeSlot?.name || "Today's Tiffin"} Menu
          </Text>
          <Text style={[styles.headerSubtitle, { color: theme.textSecondary }]}>
            Book {activeSlot?.booking_open_time || '08:00 AM'} – {activeSlot?.booking_cutoff_time || '11:00 AM'}
          </Text>
        </View>
        <View
          style={[
            styles.cutoffPill,
            { backgroundColor: isBeforeCutoff ? '#E8F5E9' : '#FFEBEE' },
          ]}
        >
          <Text
            style={[
              styles.cutoffPillText,
              { color: isBeforeCutoff ? '#2E7D32' : '#C62828' },
            ]}
          >
            {isBeforeCutoff ? 'WINDOW OPEN' : 'CLOSED'}
          </Text>
        </View>
      </View>

      {/* Slot Selector Tab Bar */}
      {availableSlots.length > 0 && (
        <View style={[styles.slotTabBar, { backgroundColor: theme.surface, borderBottomColor: theme.surfaceBorder }]}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.slotTabScroll}>
            {availableSlots.map(s => {
              const isSelected = activeSlot?.id === s.id;
              return (
                <TouchableOpacity
                  key={s.id}
                  onPress={() => setActiveSlot(s)}
                  style={[
                    styles.slotTabItem,
                    {
                      backgroundColor: isSelected ? theme.primary : theme.background,
                      borderColor: isSelected ? theme.primary : theme.surfaceBorder,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.slotTabText,
                      { color: isSelected ? theme.buttonText : theme.textSecondary },
                    ]}
                  >
                    {s.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* Post-Cutoff Notice Banner */}
      {!isBeforeCutoff && (
        <View style={[styles.noticeBanner, { backgroundColor: '#FFF3E0', borderColor: '#FFE0B2' }]}>
          <Text style={styles.noticeText}>
            🔒 Booking window closed for {activeSlot?.name || 'this slot'}. You can browse dishes below.
          </Text>
        </View>
      )}

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={[styles.loadingText, { color: theme.textSecondary }]}>Fetching live menu…</Text>
        </View>
      ) : filteredItems.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyEmoji}>🍱</Text>
          <Text style={[styles.emptyTitle, { color: theme.textPrimary }]}>No Dishes for {activeSlot?.name || 'this slot'}</Text>
          <Text style={[styles.emptySub, { color: theme.textSecondary }]}>
            Dishes assigned to this slot by admin will appear here live.
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredItems}
          renderItem={renderItem}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContainer}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                setTimeout(() => setRefreshing(false), 500);
              }}
              tintColor={theme.primary}
            />
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  headerBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  headerTitleCol: { flex: 1, marginRight: 10 },
  headerTitle: { fontSize: 18, fontWeight: '800' },
  headerSubtitle: { fontSize: 12, marginTop: 2 },
  cutoffPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  cutoffPillText: { fontSize: 10, fontWeight: '800' },
  slotTabBar: { paddingVertical: 8, borderBottomWidth: 1 },
  slotTabScroll: { paddingHorizontal: 16, gap: 8 },
  slotTabItem: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
  },
  slotTabText: { fontSize: 12, fontWeight: '700' },
  noticeBanner: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    alignItems: 'center',
  },
  noticeText: { fontSize: 12, fontWeight: '700', color: '#E65100', textAlign: 'center' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 12, fontSize: 14 },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 },
  emptyEmoji: { fontSize: 44, marginBottom: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '800', textAlign: 'center', marginBottom: 6 },
  emptySub: { fontSize: 13, textAlign: 'center', lineHeight: 18 },
  listContainer: { paddingHorizontal: 20, paddingVertical: 16, gap: 16 },
  card: { borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
  imageContainer: { height: 160, width: '100%', position: 'relative' },
  image: { width: '100%', height: '100%' },
  vegBadge: { position: 'absolute', top: 12, left: 12, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  vegBadgeGreen: { backgroundColor: 'rgba(46, 125, 50, 0.9)' },
  vegBadgeRed: { backgroundColor: 'rgba(198, 40, 40, 0.9)' },
  vegBadgeText: { color: '#FFF', fontSize: 10, fontWeight: '800' },
  cardContent: { padding: 16 },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  title: { fontSize: 16, fontWeight: '800', flex: 1, marginRight: 8 },
  price: { fontSize: 18, fontWeight: '900' },
  description: { fontSize: 13, lineHeight: 18, marginBottom: 12 },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  remainingText: { fontSize: 12, fontWeight: '700' },
  expandText: { fontSize: 11, fontWeight: '600' },
  bookButton: { paddingVertical: 12, borderRadius: 10, alignItems: 'center', minHeight: 44, justifyContent: 'center' },
  bookButtonText: { fontSize: 14, fontWeight: '800' },
});
