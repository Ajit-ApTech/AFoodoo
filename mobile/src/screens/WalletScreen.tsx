import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  Alert,
} from 'react-native';
import { useAppStore } from '../store/appStore';

const INITIAL_TRANSACTIONS = [
  { id: 't1', type: 'debit', title: 'North Indian Thali Booking', amount: -12.99, time: 'Today, 9:15 AM' },
  { id: 't2', type: 'topup', title: 'Wallet Top-Up via UPI', amount: 50.00, time: 'Yesterday, 6:30 PM' },
  { id: 't3', type: 'refund', title: 'Cancelled Slot Refund', amount: 14.99, time: 'Aug 10, 11:05 AM' },
  { id: 't4', type: 'topup', title: 'Initial Welcome Bonus', amount: 500.00, time: 'Aug 01, 10:00 AM' },
];

export default function WalletScreen() {
  const user = useAppStore(state => state.user);
  const setUser = useAppStore(state => state.setUser);
  const [transactions, setTransactions] = useState(INITIAL_TRANSACTIONS);

  const currentBalance = user?.wallet_balance ?? 500.0;

  const handleTopUp = (amount: number) => {
    if (!user) return;
    const newBalance = currentBalance + amount;
    setUser({ ...user, wallet_balance: newBalance });

    const newTx = {
      id: `tx_${Date.now()}`,
      type: 'topup',
      title: `Wallet Top-Up (+$${amount})`,
      amount: amount,
      time: 'Just now',
    };
    setTransactions([newTx, ...transactions]);

    Alert.alert('Top-Up Successful 💳', `$${amount} added to your AFoodoo Wallet. New balance: $${newBalance.toFixed(2)}.`);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.pageTitle}>AFoodoo Wallet 👛</Text>

        {/* Balance Card */}
        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>AVAILABLE WALLET BALANCE</Text>
          <Text style={styles.balanceValue}>${currentBalance.toFixed(2)}</Text>
          <Text style={styles.balanceSub}>Use wallet for instant 1-tap booking without OTPs</Text>
        </View>

        {/* Quick Top Up Actions */}
        <Text style={styles.sectionTitle}>Quick Top-Up</Text>
        <View style={styles.topUpRow}>
          {[20, 50, 100].map(amount => (
            <TouchableOpacity
              key={amount}
              style={styles.topUpChip}
              onPress={() => handleTopUp(amount)}
            >
              <Text style={styles.topUpChipText}>+${amount}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Transaction History */}
        <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Recent Transactions</Text>
        <View style={styles.txCard}>
          {transactions.map((tx, idx) => (
            <View key={tx.id}>
              <View style={styles.txRow}>
                <View style={styles.txIconBadge}>
                  <Text style={styles.txIcon}>
                    {tx.type === 'topup' ? '🟢' : tx.type === 'debit' ? '🔴' : '🔵'}
                  </Text>
                </View>
                <View style={styles.txInfo}>
                  <Text style={styles.txTitle}>{tx.title}</Text>
                  <Text style={styles.txTime}>{tx.time}</Text>
                </View>
                <Text
                  style={[
                    styles.txAmount,
                    tx.amount > 0 ? styles.txAmountPositive : styles.txAmountNegative,
                  ]}
                >
                  {tx.amount > 0 ? `+$${tx.amount.toFixed(2)}` : `-$${Math.abs(tx.amount).toFixed(2)}`}
                </Text>
              </View>
              {idx < transactions.length - 1 && <View style={styles.divider} />}
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FAF7F2' },
  container: { padding: 20 },
  pageTitle: { fontSize: 22, fontWeight: '800', color: '#2C2C2C', marginBottom: 16 },
  balanceCard: {
    backgroundColor: '#D84315',
    borderRadius: 20,
    padding: 24,
    marginBottom: 20,
    shadowColor: '#D84315',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 4,
  },
  balanceLabel: { fontSize: 11, fontWeight: '800', color: '#FFE0B2', letterSpacing: 0.5 },
  balanceValue: { fontSize: 36, fontWeight: '800', color: '#FFFFFF', marginVertical: 8 },
  balanceSub: { fontSize: 12, color: '#FFCCBC' },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#2C2C2C', marginBottom: 12 },
  topUpRow: { flexDirection: 'row', justifyContent: 'space-between' },
  topUpChip: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#FFE0B2',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    marginHorizontal: 4,
  },
  topUpChipText: { fontSize: 16, fontWeight: '800', color: '#E65100' },
  txCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#EEEEEE',
  },
  txRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
  txIconBadge: { marginRight: 12 },
  txIcon: { fontSize: 18 },
  txInfo: { flex: 1 },
  txTitle: { fontSize: 14, fontWeight: '700', color: '#2C2C2C' },
  txTime: { fontSize: 11, color: '#757575', marginTop: 2 },
  txAmount: { fontSize: 15, fontWeight: '800' },
  txAmountPositive: { color: '#2E7D32' },
  txAmountNegative: { color: '#C62828' },
  divider: { height: 1, backgroundColor: '#F5F5F5', marginVertical: 4 },
});
