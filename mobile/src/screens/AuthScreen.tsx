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
import { fetchSubscriptions } from '../api/subscriptions';

export default function AuthScreen({ navigation }: any) {
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [address, setAddress] = useState('Flat 402, Green Park Residency, Sector 15');
  const [verificationId, setVerificationId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const setUser = useAppStore(state => state.setUser);

  const sendOtp = async () => {
    if (!phone || phone.length < 8) {
      Alert.alert('Invalid Number', 'Please enter a valid phone number with country code');
      return;
    }
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setVerificationId('demo-verification-id');
      Alert.alert('OTP Sent', 'Demo verification code: 123456');
    }, 600);
  };

  const confirmOtp = async () => {
    if (!code) {
      Alert.alert('Required', 'Please enter the 6-digit OTP code');
      return;
    }
    setLoading(true);
    const demoUser = {
      id: `usr_${Date.now()}`,
      name: 'Gourmet Customer',
      phone: phone || '+91 9876543210',
      addresses: [
        {
          label: 'Home',
          line1: address,
          city: 'Mumbai',
          state: 'Maharashtra',
          zip: '400001',
          latitude: 19.076,
          longitude: 72.877,
        },
      ],
      wallet_balance: 500,
      subscription_ids: [],
      created_at: new Date().toISOString(),
    };

    try {
      setUser(demoUser);
      const subs = await fetchSubscriptions(demoUser.id);
      useAppStore.getState().setSubscriptions(subs);
    } catch (e) {
      console.log('Using initial subscriptions state');
    } finally {
      setLoading(false);
      navigation.replace('Home');
    }
  };

  const handleGuestLogin = async () => {
    setLoading(true);
    const guestUser = {
      id: 'guest-user-456',
      name: 'Guest Diner',
      phone: '+91 9900000000',
      addresses: [
        {
          label: 'Current Location',
          line1: address,
          city: 'Mumbai',
          state: 'Maharashtra',
          zip: '400001',
          latitude: 19.076,
          longitude: 72.877,
        },
      ],
      wallet_balance: 350,
      subscription_ids: ['sub-demo-1'],
      created_at: new Date().toISOString(),
    };

    try {
      setUser(guestUser);
      const subs = await fetchSubscriptions(guestUser.id);
      useAppStore.getState().setSubscriptions(subs);
    } catch (e) {
      console.log('Subscriptions fallback for guest login');
    } finally {
      setLoading(false);
      navigation.replace('Home');
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        {/* Brand Header */}
        <View style={styles.headerContainer}>
          <View style={styles.logoBadge}>
            <Text style={styles.logoEmoji}>🍲</Text>
          </View>
          <Text style={styles.brandTitle}>AFoodoo</Text>
          <Text style={styles.brandSubtitle}>Home-Cooked Tiffin Meals • Fixed Delivery Windows</Text>
        </View>

        {/* Auth Form Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Phone Number Login</Text>
          <Text style={styles.cardSubtitle}>
            Enter your mobile number to receive a 1-time verification passcode.
          </Text>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Mobile Number</Text>
            <TextInput
              placeholder="+91 98765 43210"
              placeholderTextColor="#9E9E9E"
              keyboardType="phone-pad"
              style={styles.input}
              value={phone}
              onChangeText={setPhone}
            />
          </View>

          {verificationId ? (
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Enter OTP Code</Text>
              <TextInput
                placeholder="123456 (Demo Code)"
                placeholderTextColor="#9E9E9E"
                keyboardType="numeric"
                style={styles.input}
                value={code}
                onChangeText={setCode}
                maxLength={6}
              />
            </View>
          ) : null}

          {/* Delivery Address Pin Drop Capture */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Delivery Location 📍</Text>
            <TextInput
              placeholder="Delivery Address"
              placeholderTextColor="#9E9E9E"
              style={styles.input}
              value={address}
              onChangeText={setAddress}
            />
          </View>

          <TouchableOpacity
            style={styles.primaryButton}
            onPress={verificationId ? confirmOtp : sendOtp}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <Text style={styles.primaryButtonText}>
                {verificationId ? 'Verify & Continue' : 'Send OTP Code'}
              </Text>
            )}
          </TouchableOpacity>

          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or</Text>
            <View style={styles.dividerLine} />
          </View>

          <TouchableOpacity
            style={styles.guestButton}
            onPress={handleGuestLogin}
            disabled={loading}
          >
            <Text style={styles.guestButtonText}>Explore Demo Mode as Guest</Text>
          </TouchableOpacity>
        </View>

        {/* Slot Window Info Footer */}
        <View style={styles.windowInfoCard}>
          <Text style={styles.windowInfoTitle}>⏰ Daily Tiffin Cutoff Windows</Text>
          <View style={styles.windowRow}>
            <Text style={styles.windowBadge}>Lunch</Text>
            <Text style={styles.windowText}>Book 8:00 AM – 11:00 AM  •  Delivered 1–2 PM</Text>
          </View>
          <View style={styles.windowRow}>
            <Text style={styles.windowBadge}>Dinner</Text>
            <Text style={styles.windowText}>Book 5:00 PM – 7:00 PM  •  Delivered 8–9 PM</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FAF7F2',
  },
  container: {
    paddingHorizontal: 24,
    paddingVertical: 32,
    justifyContent: 'center',
  },
  headerContainer: {
    alignItems: 'center',
    marginBottom: 28,
  },
  logoBadge: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#FFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    shadowColor: '#D84315',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 4,
  },
  logoEmoji: {
    fontSize: 38,
    marginTop: 12,
  },
  brandTitle: {
    fontSize: 32,
    fontWeight: '800',
    color: '#D84315',
    letterSpacing: 0.5,
  },
  brandSubtitle: {
    fontSize: 13,
    color: '#666',
    marginTop: 4,
    textAlign: 'center',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#2C2C2C',
    marginBottom: 4,
  },
  cardSubtitle: {
    fontSize: 13,
    color: '#757575',
    marginBottom: 20,
    lineHeight: 18,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#424242',
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#FAF9F6',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#2C2C2C',
  },
  primaryButton: {
    backgroundColor: '#D84315',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
    shadowColor: '#D84315',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 3,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 18,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#EEEEEE',
  },
  dividerText: {
    marginHorizontal: 12,
    color: '#9E9E9E',
    fontSize: 12,
  },
  guestButton: {
    backgroundColor: '#FAF7F2',
    borderWidth: 1,
    borderColor: '#FFE0B2',
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
  },
  guestButtonText: {
    color: '#D84315',
    fontSize: 15,
    fontWeight: '600',
  },
  windowInfoCard: {
    backgroundColor: '#FFF3E0',
    borderRadius: 16,
    padding: 16,
    marginTop: 24,
    borderWidth: 1,
    borderColor: '#FFE0B2',
  },
  windowInfoTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#E65100',
    marginBottom: 10,
  },
  windowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  windowBadge: {
    backgroundColor: '#D84315',
    color: '#FFF',
    fontSize: 10,
    fontWeight: '700',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginRight: 8,
  },
  windowText: {
    fontSize: 12,
    color: '#4E342E',
  },
});
