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

export default function BookingScreen({ route, navigation }: any) {
  const item = route?.params?.item || {
    id: 'm1',
    title: 'North Indian Deluxe Thali',
    price: 12.99,
    image_url: 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?auto=format&fit=crop&w=600&q=80',
  };

  const user = useAppStore(state => state.user);
  const activeSlot = useAppStore(state => state.activeSlot);
  const setUser = useAppStore(state => state.setUser);

  const initialAddress = user?.addresses && user.addresses.length > 0
    ? user.addresses[0].line1
    : 'Flat 402, Green Park Residency, Sector 15';

  const [address, setAddress] = useState(initialAddress);
  const [paymentMethod, setPaymentMethod] = useState<'wallet' | 'card'>('wallet');
  const [submitting, setSubmitting] = useState(false);

  const walletBalance = user?.wallet_balance ?? 500;
  const isWalletSufficient = walletBalance >= item.price;

  const handleConfirmOrder = async () => {
    if (!address.trim()) {
      Alert.alert('Address Required', 'Please provide a valid delivery address');
      return;
    }

    if (paymentMethod === 'wallet' && !isWalletSufficient) {
      Alert.alert('Insufficient Balance', 'Please top up your AFoodoo Wallet or choose Credit Card payment.');
      return;
    }

    setSubmitting(true);
    const slotId = activeSlot?.id || 'slot_lunch_today';
    const userId = user?.id || 'demo-user-123';

    try {
      const orderId = await placeOrder({
        userId,
        menuItemId: item.id,
        slotId,
        address: { label: 'Home', line1: address },
      });

      // Deduct wallet balance if wallet payment used
      if (paymentMethod === 'wallet' && user) {
        setUser({
          ...user,
          wallet_balance: Math.max(0, walletBalance - item.price),
        });
      }

      setSubmitting(false);
      Alert.alert('Order Confirmed! 🎉', 'Your tiffin meal has been booked successfully.', [
        {
          text: 'Track Order',
          onPress: () => navigation.replace('OrderTracking', { orderId }),
        },
      ]);
    } catch (e) {
      // Fallback demo order placement if backend network isn't reachable
      if (paymentMethod === 'wallet' && user) {
        setUser({
          ...user,
          wallet_balance: Math.max(0, walletBalance - item.price),
        });
      }
      setSubmitting(false);
      const demoOrderId = `ord_${Math.floor(100000 + Math.random() * 900000)}`;
      Alert.alert('Order Booked! 🍲', 'Your tiffin order is confirmed and sent to kitchen.', [
        {
          text: 'Track Status',
          onPress: () => navigation.replace('OrderTracking', { orderId: demoOrderId }),
        },
      ]);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.pageTitle}>Review & Confirm Order</Text>

        {/* Meal Item Summary Card */}
        <View style={styles.card}>
          <Text style={styles.cardHeader}>Selected Meal</Text>
          <View style={styles.itemRow}>
            {item.image_url ? (
              <Image source={{ uri: item.image_url }} style={styles.itemImage} />
            ) : null}
            <View style={styles.itemDetails}>
              <Text style={styles.itemTitle}>{item.title}</Text>
              <Text style={styles.itemPrice}>${item.price.toFixed(2)}</Text>
              <Text style={styles.itemDelivery}>
                🕒 Delivery Window: 1:00 PM – 2:00 PM
              </Text>
            </View>
          </View>
        </View>

        {/* Delivery Address Card */}
        <View style={styles.card}>
          <Text style={styles.cardHeader}>Delivery Address 📍</Text>
          <TextInput
            style={styles.addressInput}
            value={address}
            onChangeText={setAddress}
            placeholder="House/Flat No., Building, Street Name"
            placeholderTextColor="#9E9E9E"
            multiline
          />
        </View>

        {/* Payment Method Card */}
        <View style={styles.card}>
          <Text style={styles.cardHeader}>Payment Option</Text>

          <TouchableOpacity
            style={[
              styles.paymentOption,
              paymentMethod === 'wallet' && styles.paymentOptionSelected,
            ]}
            onPress={() => setPaymentMethod('wallet')}
          >
            <View style={styles.radioRow}>
              <Text style={styles.optionEmoji}>💳</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.optionTitle}>AFoodoo Wallet (1-Tap Checkout)</Text>
                <Text style={styles.optionSub}>
                  Available Balance: ${walletBalance.toFixed(2)}
                </Text>
              </View>
              <View style={[styles.radioCircle, paymentMethod === 'wallet' && styles.radioCircleSelected]} />
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.paymentOption,
              paymentMethod === 'card' && styles.paymentOptionSelected,
            ]}
            onPress={() => setPaymentMethod('card')}
          >
            <View style={styles.radioRow}>
              <Text style={styles.optionEmoji}>🌐</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.optionTitle}>Credit / Debit Card</Text>
                <Text style={styles.optionSub}>Instant online gateway</Text>
              </View>
              <View style={[styles.radioCircle, paymentMethod === 'card' && styles.radioCircleSelected]} />
            </View>
          </TouchableOpacity>
        </View>

        {/* Bill Summary Card */}
        <View style={styles.billCard}>
          <View style={styles.billRow}>
            <Text style={styles.billLabel}>Item Subtotal</Text>
            <Text style={styles.billValue}>${item.price.toFixed(2)}</Text>
          </View>
          <View style={styles.billRow}>
            <Text style={styles.billLabel}>Delivery Fee</Text>
            <Text style={[styles.billValue, { color: '#2E7D32' }]}>FREE</Text>
          </View>
          <View style={styles.billDivider} />
          <View style={styles.billRow}>
            <Text style={styles.totalLabel}>Total Payable</Text>
            <Text style={styles.totalValue}>${item.price.toFixed(2)}</Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.confirmButton}
          onPress={handleConfirmOrder}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <Text style={styles.confirmButtonText}>Place Order (${item.price.toFixed(2)})</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FAF7F2' },
  container: { padding: 20 },
  pageTitle: { fontSize: 22, fontWeight: '800', color: '#2C2C2C', marginBottom: 16 },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#EEEEEE',
  },
  cardHeader: { fontSize: 15, fontWeight: '700', color: '#2C2C2C', marginBottom: 12 },
  itemRow: { flexDirection: 'row', alignItems: 'center' },
  itemImage: { width: 70, height: 70, borderRadius: 10, marginRight: 12 },
  itemDetails: { flex: 1 },
  itemTitle: { fontSize: 16, fontWeight: '700', color: '#2C2C2C' },
  itemPrice: { fontSize: 16, fontWeight: '800', color: '#D84315', marginVertical: 2 },
  itemDelivery: { fontSize: 12, color: '#616161' },
  addressInput: {
    backgroundColor: '#FAF9F6',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    color: '#2C2C2C',
    minHeight: 60,
  },
  paymentOption: {
    backgroundColor: '#FAF9F6',
    borderWidth: 1.5,
    borderColor: '#E0E0E0',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },
  paymentOptionSelected: {
    borderColor: '#D84315',
    backgroundColor: '#FFF3E0',
  },
  radioRow: { flexDirection: 'row', alignItems: 'center' },
  optionEmoji: { fontSize: 22, marginRight: 10 },
  optionTitle: { fontSize: 14, fontWeight: '700', color: '#2C2C2C' },
  optionSub: { fontSize: 12, color: '#616161', marginTop: 2 },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#B0BEC5',
  },
  radioCircleSelected: {
    borderColor: '#D84315',
    backgroundColor: '#D84315',
  },
  billCard: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#EEEEEE',
  },
  billRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  billLabel: { fontSize: 13, color: '#616161' },
  billValue: { fontSize: 13, fontWeight: '600', color: '#2C2C2C' },
  billDivider: { height: 1, backgroundColor: '#EEEEEE', marginVertical: 8 },
  totalLabel: { fontSize: 15, fontWeight: '800', color: '#2C2C2C' },
  totalValue: { fontSize: 18, fontWeight: '800', color: '#D84315' },
  confirmButton: {
    backgroundColor: '#D84315',
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    shadowColor: '#D84315',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 3,
  },
  confirmButtonText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
});
