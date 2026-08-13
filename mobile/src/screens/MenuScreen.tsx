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
} from 'react-native';
import { useAppStore } from '../store/appStore';
import { firestore } from '../firebaseConfig';
import { collection, query, where, onSnapshot, DocumentData } from '@firebase/firestore';
import dayjs from 'dayjs';

const DEMO_MENU_ITEMS = [
  {
    id: 'm1',
    title: 'North Indian Deluxe Thali',
    description: 'Paneer Butter Masala, Dal Makhani, 3 Phulkas, Steamed Basmati Rice, Gulab Jamun & Raita.',
    price: 12.99,
    veg_flag: true,
    image_url: 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?auto=format&fit=crop&w=600&q=80',
    is_available: true,
    max_quantity: 50,
    quantity_booked: 18,
  },
  {
    id: 'm2',
    title: 'Special Butter Chicken Meal Box',
    description: 'Tender Smokey Chicken Tikka Gravy, Jeera Rice, Garlic Naan, Salad & Dessert.',
    price: 14.99,
    veg_flag: false,
    image_url: 'https://images.unsplash.com/photo-1588166524941-3bf61a9c41db?auto=format&fit=crop&w=600&q=80',
    is_available: true,
    max_quantity: 40,
    quantity_booked: 24,
  },
  {
    id: 'm3',
    title: 'Homestyle Rajma Chawal Pack',
    description: 'Slow-cooked Punjabi Rajma, Fragrant Basmati Rice, Green Chutney, Onion Salad & Roasted Papad.',
    price: 9.99,
    veg_flag: true,
    image_url: 'https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?auto=format&fit=crop&w=600&q=80',
    is_available: true,
    max_quantity: 60,
    quantity_booked: 42,
  },
  {
    id: 'm4',
    title: 'Egg Curry & Chapati Combo',
    description: '2 Spiced Egg Curry, 4 Whole Wheat Chapatis, Pickle & Cucumber Salad.',
    price: 11.49,
    veg_flag: false,
    image_url: 'https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?auto=format&fit=crop&w=600&q=80',
    is_available: true,
    max_quantity: 35,
    quantity_booked: 12,
  },
];

export default function MenuScreen({ navigation }: any) {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const activeSlot = useAppStore(state => state.activeSlot);
  const setMenuItems = useAppStore(state => state.setMenuItems);
  const menuItems = useAppStore(state => state.menuItems);

  useEffect(() => {
    try {
      const q = query(
        collection(firestore, 'menu_items'),
        where('meal_slot_id', '==', activeSlot?.id || 'default')
      );
      const unsub = onSnapshot(
        q,
        snap => {
          const items = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as DocumentData));
          if (items.length > 0) {
            setMenuItems(items as any);
          } else {
            setMenuItems(DEMO_MENU_ITEMS as any);
          }
          setLoading(false);
        },
        _err => {
          setMenuItems(DEMO_MENU_ITEMS as any);
          setLoading(false);
        }
      );
      return unsub;
    } catch (e) {
      setMenuItems(DEMO_MENU_ITEMS as any);
      setLoading(false);
    }
  }, [activeSlot]);

  // Determine cutoff validity
  const now = dayjs();
  const cutoff = activeSlot?.booking_cutoff_time?.toDate
    ? dayjs(activeSlot.booking_cutoff_time.toDate())
    : dayjs().add(42, 'minute');
  const isBeforeCutoff = cutoff ? now.isBefore(cutoff) : true;

  const handleBook = (item: any) => {
    if (!isBeforeCutoff) {
      Alert.alert('Cutoff Passed', 'Booking window has closed for this slot. Server rejects post-cutoff bookings.');
      return;
    }
    const remaining = (item.max_quantity || 50) - (item.quantity_booked || 0);
    if (remaining <= 0) {
      Alert.alert('Sold Out', 'Sorry, all portions for this menu item have been booked!');
      return;
    }
    navigation.navigate('Booking', { item });
  };

  const renderItem = ({ item }: any) => {
    const isExpanded = expandedId === item.id;
    const remaining = (item.max_quantity || 50) - (item.quantity_booked || 0);
    const isSoldOut = remaining <= 0;

    return (
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={() => setExpandedId(isExpanded ? null : item.id)}
        style={styles.card}
      >
        <View style={styles.imageContainer}>
          <Image source={{ uri: item.image_url }} style={styles.image} />
          <View style={[styles.vegBadge, item.veg_flag ? styles.vegBadgeGreen : styles.vegBadgeRed]}>
            <Text style={styles.vegBadgeText}>{item.veg_flag ? '🌱 VEG' : '🍖 NON-VEG'}</Text>
          </View>
        </View>

        <View style={styles.cardContent}>
          <View style={styles.titleRow}>
            <Text style={styles.title}>{item.title}</Text>
            <Text style={styles.price}>${item.price.toFixed(2)}</Text>
          </View>

          <Text style={styles.description} numberOfLines={isExpanded ? undefined : 2}>
            {item.description}
          </Text>

          <View style={styles.metaRow}>
            <Text style={styles.remainingText}>
              {isSoldOut ? '❌ Sold Out' : `🔥 ${remaining} portions remaining`}
            </Text>
            <Text style={styles.expandText}>{isExpanded ? 'Show less ▲' : 'Tap for details ▼'}</Text>
          </View>

          <TouchableOpacity
            style={[
              styles.bookButton,
              (!isBeforeCutoff || isSoldOut) && styles.bookButtonDisabled,
            ]}
            onPress={() => handleBook(item)}
            disabled={!isBeforeCutoff || isSoldOut}
          >
            <Text style={styles.bookButtonText}>
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
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.headerBar}>
        <View>
          <Text style={styles.headerTitle}>Today's Tiffin Menu</Text>
          <Text style={styles.headerSubtitle}>Freshly prepared • Home style recipe</Text>
        </View>
        <View style={[styles.cutoffPill, !isBeforeCutoff && styles.cutoffPillClosed]}>
          <Text style={styles.cutoffPillText}>{isBeforeCutoff ? 'WINDOW OPEN' : 'CLOSED'}</Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#D84315" />
          <Text style={styles.loadingText}>Fetching today's live menu…</Text>
        </View>
      ) : (
        <FlatList
          data={menuItems.length > 0 ? menuItems : DEMO_MENU_ITEMS}
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
              tintColor="#D84315"
            />
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FAF7F2' },
  headerBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
  },
  headerTitle: { fontSize: 20, fontWeight: '800', color: '#2C2C2C' },
  headerSubtitle: { fontSize: 12, color: '#757575', marginTop: 2 },
  cutoffPill: { backgroundColor: '#E8F5E9', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  cutoffPillClosed: { backgroundColor: '#FFEBEE' },
  cutoffPillText: { fontSize: 10, fontWeight: '800', color: '#2E7D32' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 12, fontSize: 14, color: '#757575' },
  listContainer: { padding: 16 },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginBottom: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  imageContainer: { height: 180, position: 'relative' },
  image: { width: '100%', height: '100%' },
  vegBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  vegBadgeGreen: { backgroundColor: '#2E7D32' },
  vegBadgeRed: { backgroundColor: '#C62828' },
  vegBadgeText: { color: '#FFF', fontSize: 10, fontWeight: '800' },
  cardContent: { padding: 16 },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  title: { fontSize: 17, fontWeight: '800', color: '#2C2C2C', flex: 1, marginRight: 8 },
  price: { fontSize: 18, fontWeight: '800', color: '#D84315' },
  description: { fontSize: 13, color: '#616161', lineHeight: 18, marginBottom: 12 },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  remainingText: { fontSize: 12, fontWeight: '600', color: '#E65100' },
  expandText: { fontSize: 11, color: '#9E9E9E' },
  bookButton: {
    backgroundColor: '#D84315',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  bookButtonDisabled: { backgroundColor: '#B0BEC5' },
  bookButtonText: { color: '#FFF', fontSize: 15, fontWeight: '700' },
});
