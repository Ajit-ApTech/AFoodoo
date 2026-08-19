import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useAppStore } from '../store/appStore';
import { useTheme } from '../theme/ThemeContext';
import { collection, onSnapshot } from 'firebase/firestore';
import { firestore } from '../firebaseConfig';

export default function WalletScreen() {
  const { theme } = useTheme();
  const user = useAppStore(state => state.user);
  const creditWalletBalance = useAppStore(state => state.creditWalletBalance);

  const [topUpLoading, setTopUpLoading] = useState<number | null>(null);
  const [realTransactions, setRealTransactions] = useState<any[]>([]);

  const currentBalance = user?.wallet_balance ?? 500;

  // Real-time Cloud Firestore subscription for user's wallet transactions
  useEffect(() => {
    if (!user?.phone) return;
    const cleanPhone = user.phone.trim();
    const userDocId = user.id || `usr_${cleanPhone.replace(/\D/g, '')}`;

    try {
      const unsub = onSnapshot(collection(firestore, 'wallet_transactions'), snap => {
        if (!snap.empty) {
          const list = snap.docs
            .map(d => ({ id: d.id, ...d.data() }))
            .filter((d: any) => d.user_phone === cleanPhone || d.user_id === userDocId)
            .sort((a: any, b: any) => (b.timestamp || '').localeCompare(a.timestamp || ''));
          setRealTransactions(list);
        }
      });
      return unsub;
    } catch (e) {}
  }, [user?.phone, user?.id]);

  const handleTopUp = async (amount: number) => {
    if (!user) {
      Alert.alert('Authentication Required', 'Please sign in to top up your wallet.');
      return;
    }

    setTopUpLoading(amount);
    // Simulate payment gateway processing
    await new Promise(resolve => setTimeout(resolve, 800));

    try {
      creditWalletBalance(amount, `Wallet Top-Up via UPI (+₹${amount}) 💳`, 'topup');
      Alert.alert(
        'Top-Up Successful 💳',
        `₹${amount.toLocaleString('en-IN')} added to your AFoodoo Wallet.\nNew balance: ₹${(currentBalance + amount).toLocaleString('en-IN')}.`
      );
    } finally {
      setTopUpLoading(null);
    }
  };

  const typeIcon: Record<string, string> = {
    topup: '🟢',
    plan_credit: '🟠',
    debit: '🔴',
    refund: '🔵',
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={[styles.pageTitle, { color: theme.textPrimary }]}>AFoodoo Wallet 👛</Text>

        {/* Balance Card */}
        <View style={[styles.balanceCard, { backgroundColor: theme.primary }]}>
          <Text style={styles.balanceLabel}>AVAILABLE WALLET BALANCE</Text>
          <Text style={styles.balanceValue}>₹{currentBalance.toLocaleString('en-IN')}</Text>
          <Text style={styles.balanceSub}>Use wallet for instant 1-tap tiffin booking without OTPs</Text>
        </View>

        {/* Credit Legend */}
        <View
          style={[
            styles.legendRow,
            { backgroundColor: theme.surface, borderColor: theme.surfaceBorder },
          ]}
        >
          <Text style={[styles.legendItem, { color: theme.textPrimary }]}>🟢 Top-Up</Text>
          <Text style={[styles.legendItem, { color: theme.textPrimary }]}>🟠 Plan Credit</Text>
          <Text style={[styles.legendItem, { color: theme.textPrimary }]}>🔴 Debit</Text>
          <Text style={[styles.legendItem, { color: theme.textPrimary }]}>🔵 Refund</Text>
        </View>

        {/* Quick Top Up Actions */}
        <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>Quick Top-Up (Stripe / UPI Stub)</Text>
        <View style={styles.topUpRow}>
          {[100, 250, 500].map(amount => (
            <TouchableOpacity
              key={amount}
              style={[
                styles.topUpChip,
                { backgroundColor: theme.surface, borderColor: theme.accentBadgeBg },
              ]}
              onPress={() => handleTopUp(amount)}
              disabled={topUpLoading !== null}
            >
              {topUpLoading === amount ? (
                <ActivityIndicator color={theme.primary} />
              ) : (
                <Text style={[styles.topUpChipText, { color: theme.accent }]}>+₹{amount}</Text>
              )}
            </TouchableOpacity>
          ))}
        </View>

        {/* Transaction History */}
        <Text style={[styles.sectionTitle, { color: theme.textPrimary, marginTop: 24 }]}>
          Transaction History
        </Text>
        <View
          style={[
            styles.txCard,
            { backgroundColor: theme.surface, borderColor: theme.surfaceBorder },
          ]}
        >
          {realTransactions.length === 0 ? (
            <Text style={[styles.emptyTx, { color: theme.textMuted }]}>
              No transactions recorded in Firebase yet.
            </Text>
          ) : (
            realTransactions.map((tx, idx) => {
              const isCredit = tx.type === 'CREDIT' || tx.type === 'topup' || tx.type === 'plan_credit' || (tx.amount && tx.amount > 0);
              const displayAmt = Math.abs(tx.amount || 0);
              const txTimeStr = tx.timestamp ? new Date(tx.timestamp).toLocaleString('en-IN', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' }) : 'Recently';

              return (
                <View key={tx.id || `tx_${idx}`}>
                  <View style={styles.txRow}>
                    <View style={styles.txIconBadge}>
                      <Text style={styles.txIcon}>{isCredit ? '🟢' : '🔴'}</Text>
                    </View>
                    <View style={styles.txInfo}>
                      <Text style={[styles.txTitle, { color: theme.textPrimary }]}>{tx.title || tx.reason || 'Wallet Activity'}</Text>
                      <Text style={[styles.txTime, { color: theme.textSecondary }]}>
                        {txTimeStr}
                      </Text>
                    </View>
                    <Text
                      style={[
                        styles.txAmount,
                        {
                          color: isCredit ? theme.statusSuccessText : theme.statusErrorText,
                        },
                      ]}
                    >
                      {isCredit ? `+₹${displayAmt}` : `-₹${displayAmt}`}
                    </Text>
                  </View>
                  {idx < realTransactions.length - 1 && (
                    <View style={[styles.divider, { backgroundColor: theme.surfaceBorder }]} />
                  )}
                </View>
              );
            })
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  container: { padding: 20 },
  pageTitle: { fontSize: 22, fontWeight: '800', marginBottom: 16 },
  balanceCard: {
    borderRadius: 20,
    padding: 24,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 4,
  },
  balanceLabel: { fontSize: 11, fontWeight: '800', color: '#FFE0B2', letterSpacing: 0.5 },
  balanceValue: { fontSize: 36, fontWeight: '800', color: '#FFFFFF', marginVertical: 8 },
  balanceSub: { fontSize: 12, color: '#FFCCBC' },
  legendRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    borderRadius: 12,
    padding: 10,
    marginBottom: 20,
    borderWidth: 1,
  },
  legendItem: { fontSize: 11, fontWeight: '600' },
  sectionTitle: { fontSize: 16, fontWeight: '700', marginBottom: 12 },
  topUpRow: { flexDirection: 'row', justifyContent: 'space-between' },
  topUpChip: {
    flex: 1,
    borderWidth: 1.5,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    marginHorizontal: 4,
    minHeight: 48,
    justifyContent: 'center',
  },
  topUpChipText: { fontSize: 16, fontWeight: '800' },
  txCard: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
  },
  emptyTx: { fontSize: 13, textAlign: 'center', paddingVertical: 20 },
  txRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
  txIconBadge: { marginRight: 12 },
  txIcon: { fontSize: 18 },
  txInfo: { flex: 1 },
  txTitle: { fontSize: 14, fontWeight: '700' },
  txTime: { fontSize: 11, marginTop: 2 },
  txAmount: { fontSize: 15, fontWeight: '800' },
  divider: { height: 1, marginVertical: 4 },
});
