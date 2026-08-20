import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  Switch,
  Alert,
  Modal,
  TextInput,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { useAppStore } from '../store/appStore';
import { useTheme, ThemeMode } from '../theme/ThemeContext';
import { DeliveryAddress } from '../types';

export default function ProfileScreen({ navigation }: any) {
  const user = useAppStore(state => state.user);
  const setUser = useAppStore(state => state.setUser);
  const notificationSettings = useAppStore(state => state.notificationSettings);
  const setNotificationSettings = useAppStore(state => state.setNotificationSettings);
  const { theme, themeMode, setThemeMode } = useTheme();

  // Edit Name Modal state
  const [showEditNameModal, setShowEditNameModal] = useState(false);
  const [nameInput, setNameInput] = useState(user?.name || '');
  const [savingName, setSavingName] = useState(false);

  // Admin Support details from Firestore
  const [supportPhone, setSupportPhone] = useState('+91 98765 43210');
  const [supportEmail, setSupportEmail] = useState('support@afoodoo.com');
  const [supportHours, setSupportHours] = useState('8:00 AM - 10:00 PM Daily');

  // Add Address Modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [label, setLabel] = useState<'Home' | 'Work' | 'Other'>('Home');
  const [receiverName, setReceiverName] = useState(user?.name || '');
  const [receiverPhone, setReceiverPhone] = useState(user?.phone || '');
  const [line1, setLine1] = useState('');
  const [landmark, setLandmark] = useState('');
  const [city, setCity] = useState('');
  const [zip, setZip] = useState('');
  const [detectedLat, setDetectedLat] = useState<number | null>(null);
  const [detectedLng, setDetectedLng] = useState<number | null>(null);
  const [locating, setLocating] = useState(false);
  const [savingAddress, setSavingAddress] = useState(false);

  // Real-Time Cloud Firestore listener on User Document
  useEffect(() => {
    if (!user?.phone) return;
    const cleanPhone = user.phone.trim();
    const userDocId = user.id || `usr_${cleanPhone.replace(/\D/g, '')}`;

    try {
      const { doc, onSnapshot } = require('firebase/firestore');
      const { firestore } = require('../firebaseConfig');

      const unsub = onSnapshot(doc(firestore, 'users', userDocId), (docSnap: any) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.addresses && Array.isArray(data.addresses)) {
            setUser({
              ...user,
              addresses: data.addresses,
              wallet_balance: data.wallet_balance ?? user.wallet_balance,
              name: data.name || user.name,
              phone: data.phone || user.phone,
            });
          }
        }
      });
      return unsub;
    } catch (e) {
      console.log('User document listener notice');
    }
  }, [user?.phone]);

  // Load real-time Admin Support details from Firestore settings/delivery_config
  useEffect(() => {
    try {
      const { doc, onSnapshot } = require('firebase/firestore');
      const { firestore } = require('../firebaseConfig');
      const unsub = onSnapshot(doc(firestore, 'settings', 'delivery_config'), (snap: any) => {
        if (snap.exists()) {
          const d = snap.data();
          if (d.support_phone) setSupportPhone(d.support_phone);
          if (d.support_email) setSupportEmail(d.support_email);
          if (d.support_hours) setSupportHours(d.support_hours);
        }
      });
      return unsub;
    } catch (e) {}
  }, []);

  const handleSaveName = async () => {
    if (!nameInput.trim()) {
      Alert.alert('Required', 'Please enter your name.');
      return;
    }
    setSavingName(true);
    const newName = nameInput.trim();

    if (user?.phone) {
      const cleanPhone = user.phone.trim();
      const userDocId = user.id || `usr_${cleanPhone.replace(/\D/g, '')}`;
      try {
        const { doc, setDoc } = require('firebase/firestore');
        const { firestore } = require('../firebaseConfig');
        await setDoc(doc(firestore, 'users', userDocId), { name: newName }, { merge: true });
      } catch (e) {}
    }

    if (user) {
      setUser({ ...user, name: newName });
    }

    setSavingName(false);
    setShowEditNameModal(false);
    Alert.alert('Profile Updated 🎉', 'Your profile name has been saved.');
  };

  const handleCallSupport = () => {
    const cleanPhone = supportPhone.replace(/[^0-9+]/g, '');
    Linking.openURL(`tel:${cleanPhone}`).catch(() => {
      Alert.alert('Call Support', `Phone number: ${supportPhone}`);
    });
  };

  const handleWhatsAppSupport = () => {
    const cleanDigits = supportPhone.replace(/\D/g, '');
    Linking.openURL(`https://wa.me/${cleanDigits}?text=Hi%20AFoodoo%20Support,%20I%20need%20help%20with%20my%20order.`).catch(() => {
      Alert.alert('WhatsApp Support', `WhatsApp Number: ${supportPhone}`);
    });
  };

  const handleEmailSupport = () => {
    Linking.openURL(`mailto:${supportEmail}?subject=AFoodoo%20Support%20Request`).catch(() => {
      Alert.alert('Email Support', `Email us at: ${supportEmail}`);
    });
  };

  const handleToggleSetting = (key: string, value: boolean) => {
    const updated = { ...notificationSettings, [key]: value };
    setNotificationSettings({ [key]: value });

    if (user?.phone) {
      const cleanPhone = user.phone.trim();
      const userDocId = user.id || `usr_${cleanPhone.replace(/\D/g, '')}`;
      try {
        const { doc, updateDoc } = require('firebase/firestore');
        const { firestore } = require('../firebaseConfig');
        updateDoc(doc(firestore, 'users', userDocId), {
          notification_settings: updated,
        }).catch(() => {});
      } catch (e) {}
    }
  };

  const handleLogout = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out of AFoodoo?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: () => {
          setUser(null);
          navigation.replace('Auth');
        },
      },
    ]);
  };

  const handleDetectLocation = async () => {
    setLocating(true);
    try {
      const Location = require('expo-location');
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Please allow location permission in your device settings.');
        setLocating(false);
        return;
      }
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const lat = position.coords.latitude;
      const lng = position.coords.longitude;
      setDetectedLat(lat);
      setDetectedLng(lng);

      try {
        const geocoded = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
        if (geocoded && geocoded.length > 0) {
          const g = geocoded[0];
          if (!line1) setLine1([g.streetNumber, g.street].filter(Boolean).join(' '));
          if (!city) setCity(g.city || g.subregion || '');
          if (!zip) setZip(g.postalCode || '');
        }
      } catch (e) {}

      Alert.alert('📍 Location Captured', 'Your GPS location was captured and address fields auto-filled!');
    } catch (e: any) {
      Alert.alert('GPS Error', e.message);
    }
    setLocating(false);
  };

  const handleSaveAddress = async () => {
    if (!receiverName.trim()) {
      Alert.alert('Required', 'Please enter recipient name.');
      return;
    }
    if (!receiverPhone.trim()) {
      Alert.alert('Required', 'Please enter contact number.');
      return;
    }
    if (!line1.trim()) {
      Alert.alert('Required', 'Please enter street address.');
      return;
    }
    if (!city.trim()) {
      Alert.alert('Required', 'Please enter city.');
      return;
    }

    setSavingAddress(true);

    const newAddress: DeliveryAddress = {
      id: `addr_${Date.now()}`,
      label,
      receiver_name: receiverName.trim(),
      receiver_phone: receiverPhone.trim(),
      line1: line1.trim(),
      landmark: landmark.trim(),
      city: city.trim(),
      state: '',
      zip: zip.trim(),
      latitude: detectedLat ?? undefined,
      longitude: detectedLng ?? undefined,
    };

    const currentAddresses = user?.addresses || [];
    const updatedAddresses = [newAddress, ...currentAddresses];

    // Write to Cloud Firestore
    const userDocId = user?.id || `usr_${(user?.phone || '').replace(/\D/g, '')}`;
    try {
      const { doc, updateDoc, setDoc } = require('firebase/firestore');
      const { firestore } = require('../firebaseConfig');
      await setDoc(
        doc(firestore, 'users', userDocId),
        { addresses: updatedAddresses },
        { merge: true }
      );
    } catch (e) {}

    // Update local Zustand state
    if (user) {
      setUser({ ...user, addresses: updatedAddresses });
    }

    setSavingAddress(false);
    setShowAddModal(false);
    setLine1('');
    setLandmark('');
    setCity('');
    setZip('');
    setDetectedLat(null);
    setDetectedLng(null);
    Alert.alert('Address Saved 🎉', 'New delivery address has been saved to your account.');
  };

  const handleDeleteAddress = (index: number) => {
    Alert.alert('Delete Address', 'Are you sure you want to remove this saved address?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const currentAddresses = user?.addresses || [];
          const updated = currentAddresses.filter((_, idx) => idx !== index);
          const userDocId = user?.id || `usr_${(user?.phone || '').replace(/\D/g, '')}`;
          try {
            const { doc, setDoc } = require('firebase/firestore');
            const { firestore } = require('../firebaseConfig');
            await setDoc(doc(firestore, 'users', userDocId), { addresses: updated }, { merge: true });
          } catch (e) {}

          if (user) {
            setUser({ ...user, addresses: updated });
          }
        },
      },
    ]);
  };

  const rawAddresses = user?.addresses || [];
  const savedAddresses = rawAddresses.filter(
    (addr, index, self) =>
      index ===
      self.findIndex(
        a =>
          a.line1?.trim().toLowerCase() === addr.line1?.trim().toLowerCase() &&
          (a.zip || '').trim() === (addr.zip || '').trim()
      )
  );

  const inputStyle = [styles.modalInput, { backgroundColor: theme.inputBg, borderColor: theme.inputBorder, color: theme.inputText }];

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={[styles.pageTitle, { color: theme.textPrimary }]}>Account & Settings ⚙️</Text>

        {/* User Card */}
        <View style={[styles.userCard, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder }]}>
          <View style={[styles.avatarBadge, { backgroundColor: theme.primary }]}>
            <Text style={styles.avatarText}>
              {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
            </Text>
          </View>
          <View style={styles.userInfo}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={[styles.userName, { color: theme.textPrimary, flex: 1 }]}>
                {user?.name || 'AFoodoo Customer'}
              </Text>
              <TouchableOpacity
                onPress={() => {
                  setNameInput(user?.name || '');
                  setShowEditNameModal(true);
                }}
                style={[styles.editNameBadge, { backgroundColor: theme.primaryLight }]}
              >
                <Text style={[styles.editNameBadgeText, { color: theme.primary }]}>Edit Name ✏️</Text>
              </TouchableOpacity>
            </View>
            <Text style={[styles.userPhone, { color: theme.textSecondary }]}>
              {user?.phone || 'No phone registered'}
            </Text>
            <Text style={[styles.userJoined, { color: theme.textMuted }]}>
              Member since August 2026
            </Text>
          </View>
        </View>

        {/* Theme Settings */}
        <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>App Appearance 🎨</Text>
        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder }]}>
          <Text style={[styles.themeLabel, { color: theme.textSecondary }]}>Theme Preference</Text>
          <View style={styles.themeRow}>
            {(['system', 'light', 'dark'] as ThemeMode[]).map(mode => {
              const isSelected = themeMode === mode;
              const labels: Record<ThemeMode, string> = {
                system: 'System 🌗',
                light: 'Light ☀️',
                dark: 'Dark 🌙',
              };
              return (
                <TouchableOpacity
                  key={mode}
                  style={[
                    styles.themeChip,
                    {
                      backgroundColor: isSelected ? theme.primary : theme.inputBg,
                      borderColor: isSelected ? theme.primary : theme.inputBorder,
                    },
                  ]}
                  onPress={() => setThemeMode(mode)}
                >
                  <Text style={[styles.themeChipText, { color: isSelected ? '#FFF' : theme.textPrimary }]}>
                    {labels[mode]}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Saved Delivery Addresses */}
        <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>
          Saved Delivery Addresses 📍
        </Text>
        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder }]}>
          {savedAddresses.length === 0 ? (
            <View style={styles.emptyAddressContainer}>
              <Text style={[styles.emptyAddressText, { color: theme.textMuted }]}>
                No saved delivery addresses yet. Add one below or save during checkout.
              </Text>
            </View>
          ) : (
            savedAddresses.map((addr, i) => (
              <View key={addr.id || i} style={[styles.addressCard, { borderColor: theme.surfaceBorder }]}>
                <View style={styles.addressHeaderRow}>
                  <View style={[styles.labelBadge, { backgroundColor: theme.primaryLight }]}>
                    <Text style={[styles.labelBadgeText, { color: theme.primary }]}>{addr.label || 'Home'}</Text>
                  </View>
                  <TouchableOpacity onPress={() => handleDeleteAddress(i)} style={styles.deleteButton}>
                    <Text style={styles.deleteButtonText}>🗑️ Delete</Text>
                  </TouchableOpacity>
                </View>
                <Text style={[styles.addrName, { color: theme.textPrimary }]}>
                  👤 {addr.receiver_name || user?.name || 'Customer'} ({addr.receiver_phone || user?.phone || 'N/A'})
                </Text>
                <Text style={[styles.addrLine, { color: theme.textSecondary }]}>
                  {addr.line1}, {addr.city} {addr.zip ? `- ${addr.zip}` : ''}
                </Text>
                {addr.landmark ? (
                  <Text style={[styles.addrLandmark, { color: theme.textMuted }]}>📍 Landmark: {addr.landmark}</Text>
                ) : null}
                {addr.latitude != null ? (
                  <Text style={[styles.addrGps, { color: theme.statusSuccessText }]}>✓ GPS Pin Saved</Text>
                ) : null}
              </View>
            ))
          )}

          <TouchableOpacity
            style={[styles.addAddrButton, { borderTopColor: theme.surfaceBorder }]}
            onPress={() => {
              setReceiverName(user?.name || '');
              setReceiverPhone(user?.phone || '');
              setShowAddModal(true);
            }}
          >
            <Text style={[styles.addAddrText, { color: theme.primary }]}>
              + Add New Delivery Address
            </Text>
          </TouchableOpacity>
        </View>

        {/* Notification Preferences */}
        <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>
          Notification Preferences 🔔
        </Text>
        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder }]}>
          <View style={styles.switchRow}>
            <Text style={[styles.switchText, { color: theme.textPrimary }]}>
              15-min Cutoff Warning Alerts
            </Text>
            <Switch
              value={notificationSettings.cutoff_alerts ?? true}
              onValueChange={v => handleToggleSetting('cutoff_alerts', v)}
              trackColor={{ false: theme.inputBorder, true: '#FFAB91' }}
              thumbColor={notificationSettings.cutoff_alerts ? theme.primary : theme.inputBg}
            />
          </View>
          <View style={[styles.divider, { backgroundColor: theme.surfaceBorder }]} />
          <View style={styles.switchRow}>
            <Text style={[styles.switchText, { color: theme.textPrimary }]}>
              Live Order Tracking Push Notifications
            </Text>
            <Switch
              value={notificationSettings.order_updates ?? true}
              onValueChange={v => handleToggleSetting('order_updates', v)}
              trackColor={{ false: theme.inputBorder, true: '#FFAB91' }}
              thumbColor={notificationSettings.order_updates ? theme.primary : theme.inputBg}
            />
          </View>
          <View style={[styles.divider, { backgroundColor: theme.surfaceBorder }]} />
          <View style={styles.switchRow}>
            <Text style={[styles.switchText, { color: theme.textPrimary }]}>
              Daily Menu & Special Offers
            </Text>
            <Switch
              value={notificationSettings.promo_alerts ?? false}
              onValueChange={v => handleToggleSetting('promo_alerts', v)}
              trackColor={{ false: theme.inputBorder, true: '#FFAB91' }}
              thumbColor={notificationSettings.promo_alerts ? theme.primary : theme.inputBg}
            />
          </View>
          <View style={[styles.divider, { backgroundColor: theme.surfaceBorder }]} />
          <View style={styles.switchRow}>
            <Text style={[styles.switchText, { color: theme.textPrimary }]}>
              In-App Screen Popup Alerts
            </Text>
            <Switch
              value={notificationSettings.in_app_popups ?? true}
              onValueChange={v => handleToggleSetting('in_app_popups', v)}
              trackColor={{ false: theme.inputBorder, true: '#FFAB91' }}
              thumbColor={notificationSettings.in_app_popups ? theme.primary : theme.inputBg}
            />
          </View>
        </View>

        {/* Help Center & Customer Support */}
        <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>
          Help Center & Support 💬
        </Text>
        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder }]}>
          <Text style={[styles.supportHoursText, { color: theme.textMuted }]}>
            🕒 Operating Hours: {supportHours}
          </Text>

          <View style={styles.supportButtonsRow}>
            <TouchableOpacity
              onPress={handleCallSupport}
              style={[styles.supportActionBtn, { backgroundColor: '#E3F2FD', borderColor: '#90CAF9' }]}
            >
              <Text style={{ fontSize: 18 }}>📞</Text>
              <Text style={[styles.supportActionText, { color: '#1565C0' }]}>Call Us</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleWhatsAppSupport}
              style={[styles.supportActionBtn, { backgroundColor: '#E8F5E9', borderColor: '#A5D6A7' }]}
            >
              <Text style={{ fontSize: 18 }}>💬</Text>
              <Text style={[styles.supportActionText, { color: '#2E7D32' }]}>WhatsApp</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleEmailSupport}
              style={[styles.supportActionBtn, { backgroundColor: '#FFF3E0', borderColor: '#FFCC80' }]}
            >
              <Text style={{ fontSize: 18 }}>✉️</Text>
              <Text style={[styles.supportActionText, { color: '#E65100' }]}>Email Us</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Sign Out Button */}
        <TouchableOpacity
          style={[styles.logoutButton, { backgroundColor: theme.statusErrorBg, borderColor: theme.statusErrorText }]}
          onPress={handleLogout}
        >
          <Text style={[styles.logoutText, { color: theme.statusErrorText }]}>
            Sign Out of AFoodoo
          </Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Edit Profile Name Modal */}
      <Modal visible={showEditNameModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.textPrimary }]}>Edit Profile Name ✏️</Text>
              <TouchableOpacity onPress={() => setShowEditNameModal(false)}>
                <Text style={[styles.closeModalText, { color: theme.textMuted }]}>✕</Text>
              </TouchableOpacity>
            </View>

            <View style={{ marginVertical: 12 }}>
              <Text style={[styles.modalLabel, { color: theme.textSecondary }]}>Full Name</Text>
              <TextInput
                style={inputStyle}
                placeholder="Enter your full name"
                placeholderTextColor={theme.textMuted}
                value={nameInput}
                onChangeText={setNameInput}
              />
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.cancelBtn, { borderColor: theme.surfaceBorder }]}
                onPress={() => setShowEditNameModal(false)}
              >
                <Text style={{ color: theme.textSecondary, fontWeight: 'bold' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveAddrBtn, { backgroundColor: theme.primary }]}
                onPress={handleSaveName}
                disabled={savingName}
              >
                {savingName ? (
                  <ActivityIndicator color="#FFF" size="small" />
                ) : (
                  <Text style={styles.saveAddrBtnText}>Save Profile Name</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Add New Address Modal */}
      <Modal visible={showAddModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.textPrimary }]}>Add New Delivery Address 📍</Text>
              <TouchableOpacity onPress={() => setShowAddModal(false)}>
                <Text style={[styles.closeModalText, { color: theme.textMuted }]}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 420 }}>
              {/* GPS Auto-Fill Button */}
              <TouchableOpacity
                style={[styles.gpsButton, { backgroundColor: '#1565C0' }]}
                onPress={handleDetectLocation}
                disabled={locating}
              >
                {locating ? (
                  <ActivityIndicator color="#FFF" size="small" />
                ) : (
                  <Text style={styles.gpsButtonText}>📍 Detect My Location (GPS Auto-Fill)</Text>
                )}
              </TouchableOpacity>

              {detectedLat != null && (
                <Text style={[styles.gpsHint, { color: theme.textMuted }]}>
                  ✓ GPS captured: {detectedLat.toFixed(4)}, {detectedLng?.toFixed(4)}
                </Text>
              )}

              {/* Address Tag Selection */}
              <Text style={[styles.modalLabel, { color: theme.textSecondary }]}>Address Tag</Text>
              <View style={styles.tagRow}>
                {(['Home', 'Work', 'Other'] as const).map(tag => (
                  <TouchableOpacity
                    key={tag}
                    style={[
                      styles.tagChip,
                      {
                        backgroundColor: label === tag ? theme.primary : theme.inputBg,
                        borderColor: label === tag ? theme.primary : theme.inputBorder,
                      },
                    ]}
                    onPress={() => setLabel(tag)}
                  >
                    <Text style={{ color: label === tag ? '#FFF' : theme.textPrimary, fontWeight: '700', fontSize: 13 }}>
                      {tag}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={[styles.modalLabel, { color: theme.textSecondary }]}>Recipient Name *</Text>
              <TextInput
                style={inputStyle}
                value={receiverName}
                onChangeText={setReceiverName}
                placeholder="Full Name"
                placeholderTextColor={theme.textMuted}
              />

              <Text style={[styles.modalLabel, { color: theme.textSecondary }]}>Contact Number *</Text>
              <TextInput
                style={inputStyle}
                value={receiverPhone}
                onChangeText={setReceiverPhone}
                placeholder="+91 98765 43210"
                placeholderTextColor={theme.textMuted}
                keyboardType="phone-pad"
              />

              <Text style={[styles.modalLabel, { color: theme.textSecondary }]}>Flat / House No., Building, Street *</Text>
              <TextInput
                style={inputStyle}
                value={line1}
                onChangeText={setLine1}
                placeholder="Flat 402, Green Park Residency, Sector 15"
                placeholderTextColor={theme.textMuted}
                multiline
              />

              <Text style={[styles.modalLabel, { color: theme.textSecondary }]}>Landmark (Optional)</Text>
              <TextInput
                style={inputStyle}
                value={landmark}
                onChangeText={setLandmark}
                placeholder="Near D-Mart"
                placeholderTextColor={theme.textMuted}
              />

              <View style={{ flexDirection: 'row' }}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={[styles.modalLabel, { color: theme.textSecondary }]}>City *</Text>
                  <TextInput
                    style={inputStyle}
                    value={city}
                    onChangeText={setCity}
                    placeholder="Mumbai"
                    placeholderTextColor={theme.textMuted}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.modalLabel, { color: theme.textSecondary }]}>PIN Code</Text>
                  <TextInput
                    style={inputStyle}
                    value={zip}
                    onChangeText={setZip}
                    placeholder="400001"
                    placeholderTextColor={theme.textMuted}
                    keyboardType="numeric"
                    maxLength={6}
                  />
                </View>
              </View>
            </ScrollView>

            <TouchableOpacity
              style={[styles.saveModalButton, { backgroundColor: theme.primary }]}
              onPress={handleSaveAddress}
              disabled={savingAddress}
            >
              {savingAddress ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={styles.saveModalButtonText}>Save Address to Profile</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  container: { padding: 20 },
  pageTitle: { fontSize: 22, fontWeight: '800', marginBottom: 16 },
  userCard: {
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 1,
  },
  avatarBadge: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  avatarText: { fontSize: 24, fontWeight: '800', color: '#FFF' },
  userInfo: { flex: 1 },
  userName: { fontSize: 18, fontWeight: '800' },
  userPhone: { fontSize: 13, marginTop: 2 },
  userJoined: { fontSize: 11, marginTop: 2 },
  sectionTitle: { fontSize: 16, fontWeight: '700', marginBottom: 12 },
  card: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
  },
  themeLabel: { fontSize: 12, fontWeight: '600', marginBottom: 10 },
  themeRow: { flexDirection: 'row', justifyContent: 'space-between' },
  themeChip: {
    flex: 1,
    paddingVertical: 12,
    marginHorizontal: 4,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    minHeight: 44,
    justifyContent: 'center',
  },
  themeChipText: { fontSize: 13, fontWeight: '700' },
  emptyAddressContainer: { paddingVertical: 12, alignItems: 'center' },
  emptyAddressText: { fontSize: 13, textAlign: 'center', leadingHeight: 18 } as any,
  addressCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  addressHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  labelBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 6 },
  labelBadgeText: { fontSize: 11, fontWeight: '800' },
  deleteButton: { padding: 4 },
  deleteButtonText: { fontSize: 11, fontWeight: '700', color: '#E53935' },
  addrName: { fontSize: 13, fontWeight: '700', marginBottom: 2 },
  addrLine: { fontSize: 13, leadingHeight: 18 } as any,
  addrLandmark: { fontSize: 11, marginTop: 2 },
  addrGps: { fontSize: 11, fontWeight: '700', marginTop: 4 },
  addAddrButton: {
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    alignItems: 'center',
    minHeight: 44,
    justifyContent: 'center',
  },
  addAddrText: { fontSize: 13, fontWeight: '700' },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    minHeight: 44,
  },
  switchText: { fontSize: 13, flex: 1, marginRight: 12 },
  divider: { height: 1, marginVertical: 8 },
  logoutButton: {
    borderWidth: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
    minHeight: 48,
    justifyContent: 'center',
  },
  logoutText: { fontSize: 15, fontWeight: '700' },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    borderRadius: 20,
    padding: 20,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: { fontSize: 17, fontWeight: '800' },
  closeModalText: { fontSize: 20, fontWeight: '800' },
  gpsButton: {
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: 'center',
    marginBottom: 10,
    minHeight: 44,
    justifyContent: 'center',
  },
  gpsButtonText: { color: '#FFF', fontWeight: '700', fontSize: 13 },
  gpsHint: { fontSize: 11, marginBottom: 10, textAlign: 'center' },
  modalLabel: { fontSize: 12, fontWeight: '600', marginBottom: 4, marginTop: 8 },
  modalInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    minHeight: 44,
  },
  tagRow: { flexDirection: 'row', marginBottom: 4 },
  tagChip: {
    flex: 1,
    paddingVertical: 8,
    marginRight: 6,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
  },
  saveModalButton: {
    marginTop: 16,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  saveModalButtonText: { color: '#FFF', fontSize: 15, fontWeight: '700' },
  editNameBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  editNameBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  supportHoursText: {
    fontSize: 12,
    marginBottom: 12,
  },
  supportButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  supportActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  supportActionText: {
    fontSize: 12,
    fontWeight: '700',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 16,
  },
  cancelBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1,
  },
  saveAddrBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
  },
  saveAddrBtnText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 13,
  },
});
