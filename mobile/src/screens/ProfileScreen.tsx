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

export default function ProfileScreen({ navigation }: any) {
  const user = useAppStore(state => state.user);
  const setUser = useAppStore(state => state.setUser);

  const [cutoffAlerts, setCutoffAlerts] = useState(true);
  const [orderUpdates, setOrderUpdates] = useState(true);
  const [promoAlerts, setPromoAlerts] = useState(false);

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
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.pageTitle}>Account & Profile 👤</Text>

        {/* User Card */}
        <View style={styles.userCard}>
          <View style={styles.avatarBadge}>
            <Text style={styles.avatarText}>
              {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
            </Text>
          </View>
          <View style={styles.userInfo}>
            <Text style={styles.userName}>{user?.name || 'AFoodoo Diner'}</Text>
            <Text style={styles.userPhone}>{user?.phone || '+91 98765 43210'}</Text>
            <Text style={styles.userJoined}>Member since August 2026</Text>
          </View>
        </View>

        {/* Saved Addresses */}
        <Text style={styles.sectionTitle}>Saved Delivery Addresses 📍</Text>
        <View style={styles.card}>
          {addresses.map((addr, i) => (
            <View key={i} style={styles.addressRow}>
              <Text style={styles.addrLabel}>{addr.label}</Text>
              <Text style={styles.addrLine}>{addr.line1}, {addr.city}</Text>
            </View>
          ))}
          <TouchableOpacity
            style={styles.addAddrButton}
            onPress={() => Alert.alert('Add Address', 'Map pin drop modal to select GPS location.')}
          >
            <Text style={styles.addAddrText}>+ Add New Delivery Address</Text>
          </TouchableOpacity>
        </View>

        {/* Notification Preferences */}
        <Text style={styles.sectionTitle}>Notification Preferences 🔔</Text>
        <View style={styles.card}>
          <View style={styles.switchRow}>
            <Text style={styles.switchText}>15-min Cutoff Warning Alerts</Text>
            <Switch
              value={cutoffAlerts}
              onValueChange={setCutoffAlerts}
              trackColor={{ false: '#E0E0E0', true: '#FFAB91' }}
              thumbColor={cutoffAlerts ? '#D84315' : '#F5F5F5'}
            />
          </View>

          <View style={styles.divider} />

          <View style={styles.switchRow}>
            <Text style={styles.switchText}>Live Order Tracking Push Notifications</Text>
            <Switch
              value={orderUpdates}
              onValueChange={setOrderUpdates}
              trackColor={{ false: '#E0E0E0', true: '#FFAB91' }}
              thumbColor={orderUpdates ? '#D84315' : '#F5F5F5'}
            />
          </View>

          <View style={styles.divider} />

          <View style={styles.switchRow}>
            <Text style={styles.switchText}>Daily Menu & Special Offers</Text>
            <Switch
              value={promoAlerts}
              onValueChange={setPromoAlerts}
              trackColor={{ false: '#E0E0E0', true: '#FFAB91' }}
              thumbColor={promoAlerts ? '#D84315' : '#F5F5F5'}
            />
          </View>
        </View>

        {/* Sign Out Button */}
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.logoutText}>Sign Out of AFoodoo</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FAF7F2' },
  container: { padding: 20 },
  pageTitle: { fontSize: 22, fontWeight: '800', color: '#2C2C2C', marginBottom: 16 },
  userCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#EEEEEE',
  },
  avatarBadge: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#D84315',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  avatarText: { fontSize: 24, fontWeight: '800', color: '#FFF' },
  userInfo: { flex: 1 },
  userName: { fontSize: 18, fontWeight: '800', color: '#2C2C2C' },
  userPhone: { fontSize: 13, color: '#616161', marginTop: 2 },
  userJoined: { fontSize: 11, color: '#9E9E9E', marginTop: 2 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#2C2C2C', marginBottom: 12 },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#EEEEEE',
  },
  addressRow: { marginBottom: 10 },
  addrLabel: { fontSize: 13, fontWeight: '700', color: '#E65100' },
  addrLine: { fontSize: 13, color: '#424242', marginTop: 2 },
  addAddrButton: { marginTop: 8, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#F5F5F5', alignItems: 'center' },
  addAddrText: { fontSize: 13, fontWeight: '700', color: '#D84315' },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4 },
  switchText: { fontSize: 13, color: '#424242', flex: 1, marginRight: 12 },
  divider: { height: 1, backgroundColor: '#F5F5F5', marginVertical: 8 },
  logoutButton: {
    backgroundColor: '#FFEBEE',
    borderWidth: 1,
    borderColor: '#FFCDD2',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  logoutText: { fontSize: 15, fontWeight: '700', color: '#C62828' },
});
