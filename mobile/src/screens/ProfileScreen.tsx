import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  Switch,
  Alert,
} from 'react-native';
import { useAppStore } from '../store/appStore';
import { useTheme, ThemeMode } from '../theme/ThemeContext';

export default function ProfileScreen({ navigation }: any) {
  const user = useAppStore(state => state.user);
  const setUser = useAppStore(state => state.setUser);
  const notificationSettings = useAppStore(state => state.notificationSettings);
  const setNotificationSettings = useAppStore(state => state.setNotificationSettings);
  const { theme, themeMode, setThemeMode } = useTheme();

  const handleToggleSetting = (key: string, value: boolean) => {
    const updated = { ...notificationSettings, [key]: value };
    setNotificationSettings({ [key]: value });

    // Sync notification_settings to Cloud Firestore user document
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

  const addresses = user?.addresses || [
    {
      label: 'Home',
      line1: 'Flat 402, Green Park Residency, Sector 15',
      city: 'Mumbai',
      state: 'Maharashtra',
      zip: '400001',
    },
  ];

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={[styles.pageTitle, { color: theme.textPrimary }]}>Account Settings</Text>

        {/* User Card */}
        <View
          style={[
            styles.userCard,
            { backgroundColor: theme.surface, borderColor: theme.surfaceBorder },
          ]}
        >
          <View style={[styles.avatarBadge, { backgroundColor: theme.primary }]}>
            <Text style={styles.avatarText}>
              {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
            </Text>
          </View>
          <View style={styles.userInfo}>
            <Text style={[styles.userName, { color: theme.textPrimary }]}>
              {user?.name || 'AFoodoo Diner'}
            </Text>
            <Text style={[styles.userPhone, { color: theme.textSecondary }]}>
              {user?.phone || '+91 98765 43210'}
            </Text>
            <Text style={[styles.userJoined, { color: theme.textMuted }]}>
              Member since August 2026
            </Text>
          </View>
        </View>

        {/* Theme Settings (Dark Mode Support) */}
        <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>App Appearance 🎨</Text>
        <View
          style={[
            styles.card,
            { backgroundColor: theme.surface, borderColor: theme.surfaceBorder },
          ]}
        >
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
                  <Text
                    style={[
                      styles.themeChipText,
                      { color: isSelected ? '#FFF' : theme.textPrimary },
                    ]}
                  >
                    {labels[mode]}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Saved Addresses */}
        <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>
          Saved Delivery Addresses 📍
        </Text>
        <View
          style={[
            styles.card,
            { backgroundColor: theme.surface, borderColor: theme.surfaceBorder },
          ]}
        >
          {addresses.map((addr, i) => (
            <View key={i} style={styles.addressRow}>
              <Text style={[styles.addrLabel, { color: theme.accent }]}>{addr.label}</Text>
              <Text style={[styles.addrLine, { color: theme.textPrimary }]}>
                {addr.line1}, {addr.city}
              </Text>
            </View>
          ))}
          <TouchableOpacity
            style={[styles.addAddrButton, { borderTopColor: theme.surfaceBorder }]}
            onPress={() => Alert.alert('Add Address', 'Map pin drop modal to select GPS location.')}
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
        <View
          style={[
            styles.card,
            { backgroundColor: theme.surface, borderColor: theme.surfaceBorder },
          ]}
        >
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

        {/* Sign Out Button - Accessible Touch Target >=44dp */}
        <TouchableOpacity
          style={[
            styles.logoutButton,
            { backgroundColor: theme.statusErrorBg, borderColor: theme.statusErrorText },
          ]}
          onPress={handleLogout}
        >
          <Text style={[styles.logoutText, { color: theme.statusErrorText }]}>
            Sign Out of AFoodoo
          </Text>
        </TouchableOpacity>
      </ScrollView>
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
    minHeight: 44, // Touch target requirement
    justifyContent: 'center',
  },
  themeChipText: { fontSize: 13, fontWeight: '700' },
  addressRow: { marginBottom: 10 },
  addrLabel: { fontSize: 13, fontWeight: '700' },
  addrLine: { fontSize: 13, marginTop: 2 },
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
});
