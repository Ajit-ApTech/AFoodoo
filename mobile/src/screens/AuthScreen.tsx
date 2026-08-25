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
  ActivityIndicator,
  Image,
} from 'react-native';
import { firestore } from '../firebaseConfig';
import { useAppStore } from '../store/appStore';
import { useTheme } from '../theme/ThemeContext';
import { syncUserWithFirestore } from '../api/firestoreApi';

const COUNTRY_CODES = [
  { label: '🇮🇳 +91', value: '91' },
  { label: '🇺🇸 +1', value: '1' },
  { label: '🇬🇧 +44', value: '44' },
  { label: '🇦🇪 +971', value: '971' },
  { label: '🇸🇬 +65', value: '65' },
  { label: '🇦🇺 +61', value: '61' },
];

export default function AuthScreen({ navigation }: any) {
  const { theme } = useTheme();
  const [countryCode, setCountryCode] = useState('91');
  const [phone, setPhone] = useState('');
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const [code, setCode] = useState('');
  const [address, setAddress] = useState('');
  const [verificationId, setVerificationId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string>('');
  const setUser = useAppStore(state => state.setUser);

  const cleanPhoneDigits = phone.replace(/\D/g, '');
  const fullPhone = `+${countryCode}${cleanPhoneDigits}`;
  const selectedCountry = COUNTRY_CODES.find(c => c.value === countryCode) || COUNTRY_CODES[0];

  const sendOtp = () => {
    if (countryCode === '91') {
      if (cleanPhoneDigits.length !== 10 || !/^[6-9]\d{9}$/.test(cleanPhoneDigits)) {
        Alert.alert(
          'Invalid Mobile Number',
          'Please enter a valid 10-digit Indian mobile number starting with 6, 7, 8, or 9.'
        );
        return;
      }
    } else {
      if (cleanPhoneDigits.length < 10) {
        Alert.alert(
          'Invalid Mobile Number',
          'Please enter a valid mobile number with at least 10 digits.'
        );
        return;
      }
    }

    const dynamicCode = Math.floor(100000 + Math.random() * 900000).toString();
    setCode(dynamicCode);
    setVerificationId(`verif_${Date.now()}`);
    Alert.alert(
      'OTP Sent 📲',
      `Phone: ${fullPhone}\n\nYour 6-Digit OTP: ${dynamicCode}\n\n(Auto-filled for quick login)`
    );
  };

  const confirmOtp = async () => {
    if (!code || code.trim().length < 6) {
      Alert.alert('Required', 'Please enter the 6-digit OTP code.');
      return;
    }

    if (countryCode === '91') {
      if (cleanPhoneDigits.length !== 10 || !/^[6-9]\d{9}$/.test(cleanPhoneDigits)) {
        Alert.alert('Invalid Mobile Number', 'Please enter a valid 10-digit mobile number.');
        return;
      }
    } else if (cleanPhoneDigits.length < 10) {
      Alert.alert('Invalid Mobile Number', 'Please enter a valid mobile number with at least 10 digits.');
      return;
    }

    setLoading(true);
    const userDocId = `usr_${countryCode}${cleanPhoneDigits}`;

    // Sync or create user in Cloud Firestore
    const firestoreUserData: any = await syncUserWithFirestore(fullPhone);
    if (firestoreUserData?.is_blocked) {
      setLoading(false);
      Alert.alert(
        'Account Suspended 🔒',
        'Your user account has been suspended by administration. Please contact support.'
      );
      return;
    }

    const userAddresses = firestoreUserData?.addresses && firestoreUserData.addresses.length > 0
      ? firestoreUserData.addresses
      : address.trim()
        ? [
            {
              id: 'addr_1',
              label: 'Home',
              line1: address.trim(),
              city: '',
              state: '',
              zip: '',
              latitude: 0,
              longitude: 0,
            },
          ]
        : [];

    const authenticatedUser = {
      id: firestoreUserData?.id || userDocId,
      name: firestoreUserData?.name || `Customer (${fullPhone})`,
      phone: fullPhone,
      wallet_balance: firestoreUserData?.wallet_balance ?? 500,
      is_blocked: firestoreUserData?.is_blocked || false,
      addresses: userAddresses,
      default_address_id: userAddresses[0]?.id || 'addr_1',
      subscription_status: 'none',
      loyalty_points: 120,
    };

    setUser(authenticatedUser as any);
    setLoading(false);
    navigation.replace('Home');
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        {/* Brand Header */}
        <View style={styles.headerContainer}>
          <Image
            source={require('../../assets/splash.png')}
            style={styles.brandLogo}
            resizeMode="contain"
          />
          <Text style={[styles.brandTitle, { color: theme.primary }]}>AFoodoo</Text>
          <Text style={[styles.brandSubtitle, { color: theme.textSecondary }]}>
            Home-Cooked Tiffin Meals • Fixed Delivery Windows
          </Text>
        </View>

        {/* Auth Form Card */}
        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder }]}>
          <Text style={[styles.cardTitle, { color: theme.textPrimary }]}>Phone Sign In 🔐</Text>
          <Text style={[styles.cardSubtitle, { color: theme.textSecondary }]}>
            Enter your mobile number to get a one-time verification code.
          </Text>

          {/* Country Code + Phone Number Row */}
          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, { color: theme.textPrimary }]}>Mobile Number</Text>
            <View style={styles.phoneRow}>
              {/* Country Code Picker Button */}
              <TouchableOpacity
                style={[styles.countryCodeBtn, { backgroundColor: theme.inputBg, borderColor: theme.inputBorder }]}
                onPress={() => setShowCountryPicker(!showCountryPicker)}
              >
                <Text style={[styles.countryCodeText, { color: theme.inputText }]}>
                  {selectedCountry.label}
                </Text>
                <Text style={{ color: theme.textMuted, fontSize: 10 }}>▼</Text>
              </TouchableOpacity>

              {/* Phone Number Input */}
              <TextInput
                placeholder="98765 43210"
                placeholderTextColor={theme.textMuted}
                keyboardType="number-pad"
                style={[
                  styles.phoneInput,
                  {
                    backgroundColor: theme.inputBg,
                    borderColor: theme.inputBorder,
                    color: theme.inputText,
                  },
                ]}
                value={phone}
                onChangeText={setPhone}
                maxLength={10}
              />
            </View>

            {/* Country Code Dropdown */}
            {showCountryPicker && (
              <View style={[styles.dropdown, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder }]}>
                {COUNTRY_CODES.map(country => (
                  <TouchableOpacity
                    key={country.value}
                    style={[
                      styles.dropdownItem,
                      countryCode === country.value && { backgroundColor: theme.primaryLight },
                    ]}
                    onPress={() => {
                      setCountryCode(country.value);
                      setShowCountryPicker(false);
                    }}
                  >
                    <Text style={[styles.dropdownItemText, { color: theme.textPrimary }]}>
                      {country.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Show assembled full number */}
            {cleanPhoneDigits.length > 0 && (
              <Text style={[styles.fullPhonePreview, { color: theme.textSecondary }]}>
                Full number: {fullPhone}
              </Text>
            )}
          </View>

          {/* OTP Input */}
          {verificationId ? (
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: theme.textPrimary }]}>6-Digit OTP Code</Text>
              <TextInput
                placeholder="Enter OTP"
                placeholderTextColor={theme.textMuted}
                keyboardType="numeric"
                style={[
                  styles.input,
                  {
                    backgroundColor: theme.inputBg,
                    borderColor: theme.inputBorder,
                    color: theme.inputText,
                    letterSpacing: 6,
                    textAlign: 'center',
                    fontSize: 20,
                    fontWeight: '700',
                  },
                ]}
                value={code}
                onChangeText={setCode}
                maxLength={6}
              />
            </View>
          ) : null}

          {/* Delivery Address */}
          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, { color: theme.textPrimary }]}>Delivery Address 📍</Text>
            <TextInput
              placeholder="Flat No., Building, Street (Optional)"
              placeholderTextColor={theme.textMuted}
              style={[
                styles.input,
                {
                  backgroundColor: theme.inputBg,
                  borderColor: theme.inputBorder,
                  color: theme.inputText,
                },
              ]}
              value={address}
              onChangeText={setAddress}
            />
          </View>

          <TouchableOpacity
            style={[styles.primaryButton, { backgroundColor: theme.primary }]}
            onPress={verificationId ? confirmOtp : sendOtp}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <Text style={[styles.primaryButtonText, { color: theme.buttonText }]}>
                {verificationId ? 'Verify OTP & Sign In ✓' : 'Send OTP Code →'}
              </Text>
            )}
          </TouchableOpacity>

          {verificationId && (
            <TouchableOpacity
              style={styles.resendRow}
              onPress={() => {
                setVerificationId(null);
                setCode('');
              }}
            >
              <Text style={[styles.resendText, { color: theme.textSecondary }]}>
                ← Change number or resend OTP
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Slot Window Info Footer */}
        <View
          style={[
            styles.windowInfoCard,
            { backgroundColor: theme.primaryLight, borderColor: theme.accentBadgeBg },
          ]}
        >
          <Text style={[styles.windowInfoTitle, { color: theme.accent }]}>
            ⏰ Daily Tiffin Cutoff Windows
          </Text>
          <View style={styles.windowRow}>
            <Text style={[styles.windowBadge, { backgroundColor: theme.primary }]}>Lunch</Text>
            <Text style={[styles.windowText, { color: theme.textPrimary }]}>
              Book 8:00 AM – 11:00 AM  •  Delivered 1–2 PM
            </Text>
          </View>
          <View style={styles.windowRow}>
            <Text style={[styles.windowBadge, { backgroundColor: theme.primary }]}>Dinner</Text>
            <Text style={[styles.windowText, { color: theme.textPrimary }]}>
              Book 5:00 PM – 7:00 PM  •  Delivered 8–9 PM
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  container: {
    paddingHorizontal: 24,
    paddingVertical: 32,
  },
  headerContainer: {
    alignItems: 'center',
    marginBottom: 28,
  },
  brandLogo: {
    width: 84,
    height: 84,
    borderRadius: 20,
    marginBottom: 12,
  },
  brandTitle: { fontSize: 32, fontWeight: '800', letterSpacing: 0.5 },
  brandSubtitle: { fontSize: 13, marginTop: 4, textAlign: 'center' },
  card: {
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 3,
  },
  cardTitle: { fontSize: 20, fontWeight: '700', marginBottom: 4 },
  cardSubtitle: { fontSize: 13, marginBottom: 20, lineHeight: 18 },
  inputGroup: { marginBottom: 16 },
  inputLabel: { fontSize: 13, fontWeight: '600', marginBottom: 6 },
  phoneRow: {
    flexDirection: 'row',
    gap: 8,
  },
  countryCodeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    minHeight: 48,
  },
  countryCodeText: { fontSize: 14, fontWeight: '600' },
  phoneInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    fontWeight: '600',
    minHeight: 48,
  },
  dropdown: {
    marginTop: 4,
    borderWidth: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  dropdownItem: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  dropdownItemText: { fontSize: 15 },
  fullPhonePreview: {
    fontSize: 11,
    marginTop: 4,
    marginLeft: 2,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    minHeight: 48,
  },
  primaryButton: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
    minHeight: 48,
    justifyContent: 'center',
  },
  primaryButtonText: { fontSize: 16, fontWeight: '700' },
  resendRow: { alignItems: 'center', marginTop: 12 },
  resendText: { fontSize: 13 },
  windowInfoCard: {
    borderRadius: 16,
    padding: 16,
    marginTop: 24,
    borderWidth: 1,
  },
  windowInfoTitle: { fontSize: 13, fontWeight: '700', marginBottom: 10 },
  windowRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  windowBadge: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '700',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginRight: 8,
  },
  windowText: { fontSize: 12 },
});
