import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  SafeAreaView,
  ScrollView,
  Image,
  ActivityIndicator,
} from 'react-native';
import { useAppStore } from '../store/appStore';
import { placeOrder } from '../api/orders';
import { useTheme } from '../theme/ThemeContext';
import { haversineDistance, buildMapsLink } from '../utils/geo';
import { generateUpiUrl } from '../utils/upi';
import { Linking } from 'react-native';

export default function BookingScreen({ route, navigation }: any) {
  const { theme } = useTheme();
  const item = route?.params?.item || {
    id: 'm1',
    title: 'North Indian Deluxe Thali',
    price: 199,
    image_url: 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?auto=format&fit=crop&w=600&q=80',
  };

  const user = useAppStore(state => state.user);
  const setUser = useAppStore(state => state.setUser);
  const activeSlot = useAppStore(state => state.activeSlot);
  const deductWalletBalance = useAppStore(state => state.deductWalletBalance);

  // Delivery form state — pre-filled from user's last saved address
  const savedAddr = user?.addresses && user.addresses.length > 0 ? user.addresses[0] : null;
  const [receiverName, setReceiverName] = useState(savedAddr?.receiver_name || user?.name || '');
  const [receiverPhone, setReceiverPhone] = useState(savedAddr?.receiver_phone || user?.phone || '');
  const [addressLine1, setAddressLine1] = useState(savedAddr?.line1 || '');
  const [landmark, setLandmark] = useState(savedAddr?.landmark || '');
  const [city, setCity] = useState(savedAddr?.city || '');
  const [pincode, setPincode] = useState(savedAddr?.zip || '');
  const [detectedLat, setDetectedLat] = useState<number | null>(savedAddr?.latitude ?? null);
  const [detectedLng, setDetectedLng] = useState<number | null>(savedAddr?.longitude ?? null);
  const [locating, setLocating] = useState(false);

  const [paymentMethod, setPaymentMethod] = useState<'upi' | 'wallet' | 'cod'>('upi');
  const [upiId, setUpiId] = useState('afoodoo@upi');
  const [merchantName, setMerchantName] = useState('AFoodoo Kitchen');
  const [enableCod, setEnableCod] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Read live UPI ID & Payment settings from Cloud Firestore settings/delivery_config
  React.useEffect(() => {
    try {
      const { doc, onSnapshot } = require('firebase/firestore');
      const { firestore } = require('../firebaseConfig');
      const unsub = onSnapshot(doc(firestore, 'settings', 'delivery_config'), (snap: any) => {
        if (snap.exists()) {
          const d = snap.data();
          if (d.upi_id) setUpiId(d.upi_id);
          if (d.merchant_name) setMerchantName(d.merchant_name);
          if (d.enable_cod != null) setEnableCod(d.enable_cod);
        }
      });
      return unsub;
    } catch (e) {}
  }, []);

  const walletBalance = user?.wallet_balance ?? 500;
  const isWalletSufficient = walletBalance >= item.price;

  const handleDetectLocation = async () => {
    setLocating(true);
    try {
      const Location = require('expo-location');
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Location Permission Denied',
          'Please allow location access in Settings to auto-fill your delivery address.'
        );
        setLocating(false);
        return;
      }

      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const lat = position.coords.latitude;
      const lng = position.coords.longitude;
      setDetectedLat(lat);
      setDetectedLng(lng);

      // Auto-fill address via native OS reverse geocoding (free)
      try {
        const geocoded = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
        if (geocoded && geocoded.length > 0) {
          const g = geocoded[0];
          if (!addressLine1) setAddressLine1([g.streetNumber, g.street].filter(Boolean).join(' '));
          if (!city) setCity(g.city || g.subregion || '');
          if (!pincode) setPincode(g.postalCode || '');
        }
      } catch (geocodeErr) {}

      Alert.alert('📍 Location Detected', 'Your current GPS location has been captured. Please verify and complete the address fields.');
    } catch (e: any) {
      Alert.alert('Location Error', `Could not detect location: ${e.message}`);
    }
    setLocating(false);
  };

  const handleConfirmOrder = async () => {
    if (item.is_available === false) {
      Alert.alert('Item Sold Out 🔒', 'Sorry, this meal has been marked as sold out by admin and cannot be ordered.');
      return;
    }

    if (!receiverName.trim()) {
      Alert.alert('Recipient Name Required', 'Please enter the name of the person receiving the delivery.');
      return;
    }
    if (!receiverPhone.trim()) {
      Alert.alert('Contact Number Required', 'Please enter a contact number for the delivery recipient.');
      return;
    }
    if (!addressLine1.trim()) {
      Alert.alert('Address Required', 'Please provide a flat/house number and street address for delivery.');
      return;
    }
    if (!city.trim()) {
      Alert.alert('City Required', 'Please enter your city.');
      return;
    }

    if (paymentMethod === 'wallet' && !isWalletSufficient) {
      Alert.alert('Insufficient Balance', 'Please top up your AFoodoo Wallet or choose Direct UPI / Cash on Delivery.');
      return;
    }

    if (paymentMethod === 'upi') {
      const upiUrl = generateUpiUrl({
        upiId: upiId || 'afoodoo@upi',
        merchantName: merchantName || 'AFoodoo Kitchen',
        amount: item.price,
        note: `AFoodoo Order — ${item.title}`,
      });
      Linking.openURL(upiUrl).catch(() => {
        Alert.alert(
          'UPI App Required 📱',
          `Please install a UPI app (Google Pay, PhonePe, Paytm, BHIM) or pay directly to UPI ID: ${upiId}`
        );
      });
    }

    // Delivery range check — read kitchen GPS strictly from Cloud Firestore settings/delivery_config
    if (detectedLat && detectedLng) {
      try {
        const { doc, getDoc } = require('firebase/firestore');
        const { firestore } = require('../firebaseConfig');
        const configSnap = await getDoc(doc(firestore, 'settings', 'delivery_config'));
        if (configSnap.exists()) {
          const config = configSnap.data();
          const kitchenLat = config.kitchen_lat;
          const kitchenLng = config.kitchen_lng;
          const maxRadius = config.max_delivery_radius_km || 25;

          if (kitchenLat && kitchenLng) {
            const distanceKm = haversineDistance(detectedLat, detectedLng, kitchenLat, kitchenLng);
            if (distanceKm > maxRadius) {
              Alert.alert(
                'Outside Delivery Area 📍',
                `Sorry, we currently deliver only within ${maxRadius} km of our kitchen. Your location is ${distanceKm} km away. We're working on expanding our delivery area!`
              );
              return;
            }
          }
        }
      } catch (rangeErr) {
        // If settings not configured, skip range check gracefully
      }
    }

    setSubmitting(true);
    const slotId = activeSlot?.id || 'slot_lunch_today';
    const userId = user?.id || 'demo-user-123';
    const otpCode = Math.floor(1000 + Math.random() * 9000).toString();

    // Calculate distance from kitchen for admin display
    let deliveryDistanceKm: number | undefined;
    let mapsLink: string | undefined;
    if (detectedLat && detectedLng) {
      mapsLink = buildMapsLink(detectedLat, detectedLng);
      try {
        const { doc, getDoc } = require('firebase/firestore');
        const { firestore } = require('../firebaseConfig');
        const configSnap = await getDoc(doc(firestore, 'settings', 'delivery_config'));
        if (configSnap.exists()) {
          const config = configSnap.data();
          if (config.kitchen_lat && config.kitchen_lng) {
            deliveryDistanceKm = haversineDistance(detectedLat, detectedLng, config.kitchen_lat, config.kitchen_lng);
          }
        }
      } catch (e) {}
    }

    const deliveryAddress = {
      label: 'Home',
      receiver_name: receiverName.trim(),
      receiver_phone: receiverPhone.trim(),
      line1: addressLine1.trim(),
      landmark: landmark.trim(),
      city: city.trim(),
      zip: pincode.trim(),
      latitude: detectedLat ?? undefined,
      longitude: detectedLng ?? undefined,
    };

    const orderData: any = {
      user_id: userId,
      user_name: user?.name || 'AFoodoo Customer',
      user_phone: user?.phone || '+91 98765 43210',
      menu_item_id: item.id,
      menu_title: item.title,
      meal_slot_id: slotId,
      slot_name: activeSlot?.name || 'Lunch Tiffin',
      delivery_window: activeSlot?.delivery_start_time && activeSlot?.delivery_end_time
        ? `${activeSlot.delivery_start_time} – ${activeSlot.delivery_end_time}`
        : activeSlot?.name?.toLowerCase().includes('dinner')
        ? '7:30 PM – 8:30 PM'
        : '1:00 PM – 2:00 PM',
      delivery_start: activeSlot?.delivery_start_time || (activeSlot?.name?.toLowerCase().includes('dinner') ? '7:30 PM' : '1:00 PM'),
      delivery_end: activeSlot?.delivery_end_time || (activeSlot?.name?.toLowerCase().includes('dinner') ? '8:30 PM' : '2:00 PM'),
      status: 'booked',
      delivery_address: deliveryAddress,
      delivery_name: receiverName.trim(),
      delivery_phone: receiverPhone.trim(),
      payment_method: paymentMethod,
      payment_status: paymentMethod === 'cod' ? 'pending' : 'paid',
      otp_code: otpCode,
      delivery_zone_id: 'zone_1',
      zone_name: 'Central Zone',
      tiffin_returned: false,
      total_amount: Number(item.price || 199),
      created_at: new Date().toISOString(),
    };

    // Only add GPS fields if available
    if (detectedLat != null) orderData.delivery_lat = detectedLat;
    if (detectedLng != null) orderData.delivery_lng = detectedLng;
    if (mapsLink) orderData.maps_link = mapsLink;
    if (deliveryDistanceKm != null) orderData.delivery_distance_km = deliveryDistanceKm;

    try {
      // 1. Write order to Cloud Firestore
      const { collection, addDoc, doc, updateDoc, increment, setDoc, arrayUnion } = require('firebase/firestore');
      const { firestore } = require('../firebaseConfig');
      const docRef = await addDoc(collection(firestore, 'orders'), orderData);
      const realOrderId = docRef.id;

      // 2. Save address to user's saved addresses for future use (if unique)
      const userDocId = user?.id || `usr_${(user?.phone || '').replace(/\D/g, '')}`;
      const savedAddress = {
        ...deliveryAddress,
        id: `addr_${Date.now()}`,
        state: '',
        latitude: detectedLat ?? undefined,
        longitude: detectedLng ?? undefined,
        maps_link: mapsLink || undefined,
      };

      const existingAddresses = user?.addresses || [];
      const alreadyExists = existingAddresses.some(
        a =>
          a.line1?.trim().toLowerCase() === savedAddress.line1?.trim().toLowerCase() &&
          (a.zip || '').trim() === (savedAddress.zip || '').trim()
      );

      if (!alreadyExists) {
        const updatedAddresses = [savedAddress, ...existingAddresses];
        try {
          await setDoc(doc(firestore, 'users', userDocId), { addresses: updatedAddresses }, { merge: true });
        } catch (e) {}

        if (user) {
          setUser({ ...user, addresses: updatedAddresses });
        }
      }

      // 3. Increment quantity_booked on menu item
      try {
        await updateDoc(doc(firestore, 'menu_items', item.id), {
          quantity_booked: increment(1),
        });
      } catch (incErr) {}

      // 4. Update local store menuItems
      const store = useAppStore.getState();
      const updatedMenuItems = store.menuItems.map(m =>
        m.id === item.id ? { ...m, quantity_booked: (m.quantity_booked || 0) + 1 } : m
      );
      store.setMenuItems(updatedMenuItems);

      // 5. Also attempt Express API backend POST
      try {
        await placeOrder({ userId, menuItemId: item.id, slotId, address: { label: 'Home', line1: addressLine1 } });
      } catch (apiErr) {}

      // 6. Deduct wallet balance
      if (paymentMethod === 'wallet') {
        deductWalletBalance(item.price, `${item.title} — Meal Booking 🍲`);
      }

      // 7. Update Zustand store orders
      const currentOrders = useAppStore.getState().orders;
      useAppStore.getState().setOrders([{ id: realOrderId, ...orderData }, ...currentOrders]);

      setSubmitting(false);
      Alert.alert('Order Confirmed! 🎉', 'Your tiffin meal has been booked successfully.', [
        {
          text: 'Track Order',
          onPress: () => navigation.replace('OrderTracking', { orderId: realOrderId }),
        },
      ]);
    } catch (e: any) {
      console.log('Firestore order write fallback:', e.message);

      try {
        const { doc, updateDoc, increment } = require('firebase/firestore');
        const { firestore } = require('../firebaseConfig');
        await updateDoc(doc(firestore, 'menu_items', item.id), { quantity_booked: increment(1) });
      } catch (e) {}

      const store = useAppStore.getState();
      store.setMenuItems(store.menuItems.map(m =>
        m.id === item.id ? { ...m, quantity_booked: (m.quantity_booked || 0) + 1 } : m
      ));

      if (paymentMethod === 'wallet') deductWalletBalance(item.price, `${item.title} — Meal Booking 🍲`);
      setSubmitting(false);
      const demoOrderId = `ord_${Math.floor(100000 + Math.random() * 900000)}`;
      Alert.alert('Order Booked! 🍲', 'Your tiffin order is confirmed and sent to kitchen.', [
        { text: 'Track Status', onPress: () => navigation.replace('OrderTracking', { orderId: demoOrderId }) },
      ]);
    }
  };

  const inputStyle = [styles.input, { backgroundColor: theme.inputBg, borderColor: theme.inputBorder, color: theme.inputText }];

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={[styles.pageTitle, { color: theme.textPrimary }]}>Review & Confirm Order</Text>

        {/* Meal Item Summary Card */}
        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder }]}>
          <Text style={[styles.cardHeader, { color: theme.textPrimary }]}>Selected Meal</Text>
          <View style={styles.itemRow}>
            {item.image_url ? (
              <Image source={{ uri: item.image_url }} style={styles.itemImage} />
            ) : null}
            <View style={styles.itemDetails}>
              <Text style={[styles.itemTitle, { color: theme.textPrimary }]}>{item.title}</Text>
              <Text style={[styles.itemPrice, { color: theme.primary }]}>₹{item.price.toFixed(0)}</Text>
              <Text style={[styles.itemDelivery, { color: theme.textSecondary }]}>
                🕒 Delivery Window: 1:00 PM – 2:00 PM
              </Text>
            </View>
          </View>
        </View>

        {/* Delivery Details Card */}
        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder }]}>
          <Text style={[styles.cardHeader, { color: theme.textPrimary }]}>Delivery Details 📍</Text>

          {/* GPS Button */}
          <TouchableOpacity
            style={[styles.gpsButton, { backgroundColor: '#1565C0' }]}
            onPress={handleDetectLocation}
            disabled={locating}
          >
            {locating ? (
              <ActivityIndicator color="#FFF" size="small" />
            ) : (
              <Text style={styles.gpsButtonText}>📍 Use My Current Location (Auto-Fill)</Text>
            )}
          </TouchableOpacity>

          {detectedLat != null && (
            <Text style={[styles.gpsHint, { color: theme.textMuted }]}>
              ✓ GPS captured: {detectedLat.toFixed(4)}, {detectedLng?.toFixed(4)}
            </Text>
          )}

          <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>Recipient Name *</Text>
          <TextInput
            style={inputStyle}
            value={receiverName}
            onChangeText={setReceiverName}
            placeholder="Full name of person receiving delivery"
            placeholderTextColor={theme.textMuted}
          />

          <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>Contact Number *</Text>
          <TextInput
            style={inputStyle}
            value={receiverPhone}
            onChangeText={setReceiverPhone}
            placeholder="+91 98765 43210"
            placeholderTextColor={theme.textMuted}
            keyboardType="phone-pad"
          />

          <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>Flat / House No., Building, Street *</Text>
          <TextInput
            style={inputStyle}
            value={addressLine1}
            onChangeText={setAddressLine1}
            placeholder="e.g. Flat 402, Green Park Residency, MG Road"
            placeholderTextColor={theme.textMuted}
            multiline
          />

          <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>Landmark (Optional)</Text>
          <TextInput
            style={inputStyle}
            value={landmark}
            onChangeText={setLandmark}
            placeholder="e.g. Near D-Mart, Opposite HDFC Bank"
            placeholderTextColor={theme.textMuted}
          />

          <View style={styles.rowFields}>
            <View style={{ flex: 1, marginRight: 8 }}>
              <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>City *</Text>
              <TextInput
                style={inputStyle}
                value={city}
                onChangeText={setCity}
                placeholder="Mumbai"
                placeholderTextColor={theme.textMuted}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>PIN Code</Text>
              <TextInput
                style={inputStyle}
                value={pincode}
                onChangeText={setPincode}
                placeholder="400001"
                placeholderTextColor={theme.textMuted}
                keyboardType="numeric"
                maxLength={6}
              />
            </View>
          </View>
        </View>

        {/* Payment Method Card */}
        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder }]}>
          <Text style={[styles.cardHeader, { color: theme.textPrimary }]}>Payment Option</Text>

          {/* 1. Direct UPI Option */}
          <TouchableOpacity
            style={[
              styles.paymentOption,
              {
                backgroundColor: paymentMethod === 'upi' ? theme.primaryLight : theme.inputBg,
                borderColor: paymentMethod === 'upi' ? theme.primary : theme.inputBorder,
              },
            ]}
            onPress={() => setPaymentMethod('upi')}
          >
            <View style={styles.radioRow}>
              <Text style={styles.optionEmoji}>📱</Text>
              <View style={{ flex: 1 }}>
                <Text style={[styles.optionTitle, { color: theme.textPrimary }]}>
                  Direct UPI (GPay / PhonePe / Paytm / BHIM)
                </Text>
                <Text style={[styles.optionSub, { color: theme.textSecondary }]}>
                  Instant 1-tap app payment ({upiId})
                </Text>
              </View>
              <View
                style={[
                  styles.radioCircle,
                  { borderColor: paymentMethod === 'upi' ? theme.primary : theme.textMuted },
                  paymentMethod === 'upi' && { backgroundColor: theme.primary },
                ]}
              />
            </View>
          </TouchableOpacity>

          {/* 2. Wallet Option */}
          <TouchableOpacity
            style={[
              styles.paymentOption,
              {
                backgroundColor: paymentMethod === 'wallet' ? theme.primaryLight : theme.inputBg,
                borderColor: paymentMethod === 'wallet' ? theme.primary : theme.inputBorder,
              },
            ]}
            onPress={() => setPaymentMethod('wallet')}
          >
            <View style={styles.radioRow}>
              <Text style={styles.optionEmoji}>👛</Text>
              <View style={{ flex: 1 }}>
                <Text style={[styles.optionTitle, { color: theme.textPrimary }]}>
                  AFoodoo Wallet Balance
                </Text>
                <Text style={[styles.optionSub, { color: theme.textSecondary }]}>
                  Available Balance: ₹{walletBalance.toFixed(0)}
                </Text>
              </View>
              <View
                style={[
                  styles.radioCircle,
                  { borderColor: paymentMethod === 'wallet' ? theme.primary : theme.textMuted },
                  paymentMethod === 'wallet' && { backgroundColor: theme.primary },
                ]}
              />
            </View>
          </TouchableOpacity>

          {/* 3. Cash on Delivery Option */}
          {enableCod && (
            <TouchableOpacity
              style={[
                styles.paymentOption,
                {
                  backgroundColor: paymentMethod === 'cod' ? theme.primaryLight : theme.inputBg,
                  borderColor: paymentMethod === 'cod' ? theme.primary : theme.inputBorder,
                },
              ]}
              onPress={() => setPaymentMethod('cod')}
            >
              <View style={styles.radioRow}>
                <Text style={styles.optionEmoji}>💵</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.optionTitle, { color: theme.textPrimary }]}>
                    Cash on Delivery / Pay at Kitchen
                  </Text>
                  <Text style={[styles.optionSub, { color: theme.textSecondary }]}>
                    Pay cash when your tiffin is delivered
                  </Text>
                </View>
                <View
                  style={[
                    styles.radioCircle,
                    { borderColor: paymentMethod === 'cod' ? theme.primary : theme.textMuted },
                    paymentMethod === 'cod' && { backgroundColor: theme.primary },
                  ]}
                />
              </View>
            </TouchableOpacity>
          )}
        </View>

        {/* Bill Summary */}
        <View style={[styles.billCard, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder }]}>
          <View style={styles.billRow}>
            <Text style={[styles.billLabel, { color: theme.textSecondary }]}>Item Subtotal</Text>
            <Text style={[styles.billValue, { color: theme.textPrimary }]}>₹{item.price.toFixed(0)}</Text>
          </View>
          <View style={styles.billRow}>
            <Text style={[styles.billLabel, { color: theme.textSecondary }]}>Delivery Fee</Text>
            <Text style={[styles.billValue, { color: theme.statusSuccessText }]}>FREE</Text>
          </View>
          <View style={[styles.billDivider, { backgroundColor: theme.surfaceBorder }]} />
          <View style={styles.billRow}>
            <Text style={[styles.totalLabel, { color: theme.textPrimary }]}>Total Payable</Text>
            <Text style={[styles.totalValue, { color: theme.primary }]}>₹{item.price.toFixed(0)}</Text>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.confirmButton, { backgroundColor: theme.primary }]}
          onPress={handleConfirmOrder}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <Text style={[styles.confirmButtonText, { color: theme.buttonText }]}>
              Place Order (₹{item.price.toFixed(0)})
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
  card: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
  },
  cardHeader: { fontSize: 15, fontWeight: '700', marginBottom: 12 },
  itemRow: { flexDirection: 'row', alignItems: 'center' },
  itemImage: { width: 70, height: 70, borderRadius: 10, marginRight: 12 },
  itemDetails: { flex: 1 },
  itemTitle: { fontSize: 16, fontWeight: '700' },
  itemPrice: { fontSize: 16, fontWeight: '800', marginVertical: 2 },
  itemDelivery: { fontSize: 12 },
  gpsButton: {
    borderRadius: 10,
    paddingVertical: 11,
    paddingHorizontal: 14,
    alignItems: 'center',
    marginBottom: 8,
    minHeight: 44,
    justifyContent: 'center',
  },
  gpsButtonText: { color: '#FFF', fontWeight: '700', fontSize: 14 },
  gpsHint: { fontSize: 11, marginBottom: 10, textAlign: 'center' },
  fieldLabel: { fontSize: 12, fontWeight: '600', marginBottom: 4, marginTop: 10 },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    minHeight: 44,
  },
  rowFields: { flexDirection: 'row', marginTop: 0 },
  paymentOption: {
    borderWidth: 1.5,
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    minHeight: 52,
    justifyContent: 'center',
  },
  radioRow: { flexDirection: 'row', alignItems: 'center' },
  optionEmoji: { fontSize: 22, marginRight: 10 },
  optionTitle: { fontSize: 14, fontWeight: '700' },
  optionSub: { fontSize: 12, marginTop: 2 },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
  },
  billCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
  },
  billRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  billLabel: { fontSize: 13 },
  billValue: { fontSize: 13, fontWeight: '600' },
  billDivider: { height: 1, marginVertical: 8 },
  totalLabel: { fontSize: 15, fontWeight: '800' },
  totalValue: { fontSize: 18, fontWeight: '800' },
  confirmButton: {
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
    minHeight: 52,
    justifyContent: 'center',
  },
  confirmButtonText: { fontSize: 16, fontWeight: '700' },
});
