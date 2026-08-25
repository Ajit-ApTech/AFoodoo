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
import { collection, doc, onSnapshot, query, where } from 'firebase/firestore';
import { firestore } from '../firebaseConfig';
import { generateUpiUrl } from '../utils/upi';
import { submitPaymentRequest } from '../api/payments';
import { UtrModal } from '../components/UtrModal';

export default function WalletScreen() {
  const { theme } = useTheme();
  const user = useAppStore(state => state.user);
  const creditWalletBalance = useAppStore(state => state.creditWalletBalance);

  const [topUpLoading, setTopUpLoading] = useState<number | null>(null);
  const [realTransactions, setRealTransactions] = useState<any[]>([]);
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);

  // UTR Modal State
  const [utrModalVisible, setUtrModalVisible] = useState(false);
  const [selectedReqForUtr, setSelectedReqForUtr] = useState<any>(null);

  const currentBalance = user?.wallet_balance ?? 500;

  // Real-time Cloud Firestore subscription for user's wallet transactions
  useEffect(() => {
    if (!user?.phone && !user?.id) return;
    const cleanPhone = user.phone ? user.phone.trim() : '';
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

  // Real-time subscription to user's payment_requests
  useEffect(() => {
    if (!user?.id && !user?.phone) return;
    const cleanPhone = user.phone ? user.phone.trim() : '';
    const userDocId = user.id || `usr_${cleanPhone.replace(/\D/g, '')}`;

    try {
      const q = query(
        collection(firestore, 'payment_requests'),
        where('user_id', '==', userDocId)
      );
      const unsub = onSnapshot(q, snap => {
        const list = snap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .filter((d: any) => d.type === 'wallet_topup' && ['pending', 'utr_submitted', 'rejected'].includes(d.status))
          .sort((a: any, b: any) => (b.created_at || '').localeCompare(a.created_at || ''));
        setPendingRequests(list);
      });
      return unsub;
    } catch (e) {}
  }, [user?.id, user?.phone]);

  // Read live UPI ID from Cloud Firestore settings/delivery_config
  const [upiId, setUpiId] = useState('afoodoo@upi');
  const [merchantName, setMerchantName] = useState('AFoodoo Kitchen');

  useEffect(() => {
    try {
      const unsub = onSnapshot(doc(firestore, 'settings', 'delivery_config'), snap => {
        if (snap.exists()) {
          const d = snap.data();
          if (d.upi_id) setUpiId(d.upi_id);
          if (d.merchant_name) setMerchantName(d.merchant_name);
        }
      });
      return unsub;
    } catch (e) {}
  }, []);

  const handleTopUp = async (amount: number) => {
    if (!user) {
      Alert.alert('Authentication Required', 'Please sign in to top up your wallet.');
      return;
    }

    const { Linking } = require('react-native');
    const upiUrl = generateUpiUrl({
      upiId: upiId || 'afoodoo@upi',
      merchantName: merchantName || 'AFoodoo Kitchen',
      amount: amount,
      note: `AFoodoo Wallet Topup ₹${amount}`,
    });

    // Open UPI app
    Linking.openURL(upiUrl).catch(() => {
      Alert.alert(
        'UPI Payment',
        `Please complete the payment of ₹${amount} directly to UPI ID: ${upiId}\n\nOpen Google Pay, PhonePe, Paytm, or BHIM and pay to this ID manually.`
      );
    });

    setTopUpLoading(amount);
    try {
      const cleanPhone = user.phone ? user.phone.trim() : '';
      const userDocId = user.id || `usr_${cleanPhone.replace(/\D/g, '')}`;

      await submitPaymentRequest({
        type: 'wallet_topup',
        userId: userDocId,
        userName: user.name || 'AFoodoo Customer',
        userPhone: cleanPhone,
        amount: amount,
        walletPayload: {
          amount: amount,
          description: `Wallet Top-Up (+₹${amount})`,
        },
      });

      Alert.alert(
        'Top-Up Request Sent ⏳',
        `Your top-up request for ₹${amount.toLocaleString('en-IN')} has been submitted for admin verification.\n\nYour wallet balance will be credited automatically as soon as the admin verifies your payment!`
      );
    } catch (err: any) {
      Alert.alert('Request Notice', err.message || 'Could not submit top-up request.');
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
        <Text style={[styles.pageTitle, { color: theme.textPrimary }]}>AFoodoo Wallet 💳</Text>

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

        {/* Pending Payment Verification Requests */}
        {pendingRequests.length > 0 && (
          <View style={{ marginBottom: 20 }}>
            <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>
              ⏳ Pending Verification Requests
            </Text>
            {pendingRequests.map(req => (
              <View
                key={req.id}
                style={[
                  styles.pendingCard,
                  {
                    backgroundColor: theme.surface,
                    borderColor: req.status === 'rejected' ? theme.statusErrorText : theme.accent,
                  },
                ]}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={[styles.pendingTitle, { color: theme.textPrimary }]}>
                    Top-Up of ₹{req.amount}
                  </Text>
                  <Text
                    style={[
                      styles.pendingBadge,
                      {
                        backgroundColor:
                          req.status === 'rejected'
                            ? '#FFEBEE'
                            : req.status === 'utr_submitted'
                            ? '#FFF9C4'
                            : theme.primaryLight,
                        color:
                          req.status === 'rejected'
                            ? '#C62828'
                            : req.status === 'utr_submitted'
                            ? '#F57F17'
                            : theme.primary,
                      },
                    ]}
                  >
                    {req.status === 'rejected'
                      ? 'Action Required ⚠️'
                      : req.status === 'utr_submitted'
                      ? 'UTR Submitted 🔍'
                      : 'Verifying ⏳'}
                  </Text>
                </View>

                {req.status === 'rejected' && (
                  <View style={{ marginTop: 8 }}>
                    <Text style={{ fontSize: 12, color: theme.statusErrorText, marginBottom: 8 }}>
                      Note: {req.reject_reason || 'Payment could not be verified in UPI statement.'}
                    </Text>
                    <TouchableOpacity
                      style={[styles.utrActionBtn, { backgroundColor: theme.primary }]}
                      onPress={() => {
                        setSelectedReqForUtr(req);
                        setUtrModalVisible(true);
                      }}
                    >
                      <Text style={{ color: '#FFF', fontSize: 12, fontWeight: '700' }}>
                        Enter 12-Digit UTR Number →
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}

                {req.status === 'pending' && (
                  <Text style={{ fontSize: 11, color: theme.textSecondary, marginTop: 4 }}>
                    Admin will verify UPI credits and add balance to your wallet shortly.
                  </Text>
                )}

                {req.status === 'utr_submitted' && (
                  <Text style={{ fontSize: 11, color: theme.textSecondary, marginTop: 4 }}>
                    UTR: {req.utr_number} • Under re-verification by admin.
                  </Text>
                )}
              </View>
            ))}
          </View>
        )}

        {/* Transaction History */}
        <Text style={[styles.sectionTitle, { color: theme.textPrimary, marginTop: 12 }]}>
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

      {/* UTR Re-Verification Modal */}
      <UtrModal
        visible={utrModalVisible}
        paymentRequestId={selectedReqForUtr?.id || null}
        amount={selectedReqForUtr?.amount}
        reason={selectedReqForUtr?.reject_reason}
        onClose={() => {
          setUtrModalVisible(false);
          setSelectedReqForUtr(null);
        }}
        onSuccess={() => {
          setUtrModalVisible(false);
          setSelectedReqForUtr(null);
        }}
      />
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
  pendingCard: {
    borderRadius: 14,
    padding: 14,
    borderWidth: 1.5,
    marginBottom: 10,
  },
  pendingTitle: { fontSize: 14, fontWeight: '700' },
  pendingBadge: {
    fontSize: 11,
    fontWeight: '700',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    overflow: 'hidden',
  },
  utrActionBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
