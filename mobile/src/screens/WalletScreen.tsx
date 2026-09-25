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
  TextInput,
} from 'react-native';
import { useAppStore } from '../store/appStore';
import { useTheme } from '../theme/ThemeContext';
import { collection, doc, onSnapshot, query, where } from 'firebase/firestore';
import { firestore } from '../firebaseConfig';
import { generateUpiUrl } from '../utils/upi';
import { submitPaymentRequest } from '../api/payments';
import { UtrModal } from '../components/UtrModal';
import { UpiPaymentModal } from '../components/UpiPaymentModal';
import { BottomNavBar, BottomTabType } from '../components/BottomNavBar';

export default function WalletScreen({ navigation }: any) {
  const { theme } = useTheme();
  const user = useAppStore(state => state.user);
  const setUser = useAppStore(state => state.setUser);
  const creditWalletBalance = useAppStore(state => state.creditWalletBalance);

  const [topUpLoading, setTopUpLoading] = useState<number | null>(null);
  const [realTransactions, setRealTransactions] = useState<any[]>([]);
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);

  // UTR Modal State
  const [utrModalVisible, setUtrModalVisible] = useState(false);
  const [selectedReqForUtr, setSelectedReqForUtr] = useState<any>(null);

  // UPI QR Modal State
  const [showUpiModal, setShowUpiModal] = useState(false);
  const [activeTopUpAmount, setActiveTopUpAmount] = useState<number | null>(null);
  const [customQrUrl, setCustomQrUrl] = useState('');
  const [customAmountText, setCustomAmountText] = useState('');

  const currentBalance = user?.wallet_balance ?? 500;

  // Real-time Cloud Firestore subscription for user's profile and live wallet balance
  useEffect(() => {
    if (!user?.phone && !user?.id) return;
    const cleanPhone = user.phone ? user.phone.trim() : '';
    const userDocId = user.id || `usr_${cleanPhone.replace(/\D/g, '')}`;

    try {
      const unsub = onSnapshot(doc(firestore, 'users', userDocId), (docSnap: any) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.wallet_balance !== undefined) {
            setUser({ ...user, ...data });
          }
        }
      });
      return unsub;
    } catch (e) {}
  }, [user?.phone, user?.id]);

  // Real-time Cloud Firestore subscription for user's wallet transactions
  useEffect(() => {
    if (!user?.phone && !user?.id) return;
    const userDigits = (user.phone || '').replace(/\D/g, '');
    const userDocId = user.id || (userDigits ? `usr_${userDigits}` : '');

    try {
      const unsub = onSnapshot(collection(firestore, 'wallet_transactions'), snap => {
        if (!snap.empty) {
          const list = snap.docs
            .map(d => ({ id: d.id, ...d.data() }))
            .filter((d: any) => {
              const dDigits = (d.user_phone || '').replace(/\D/g, '');
              const isPhoneMatch =
                userDigits &&
                dDigits &&
                (dDigits.endsWith(userDigits) || userDigits.endsWith(dDigits));
              const isIdMatch =
                (d.user_id && (d.user_id === userDocId || d.user_id === user?.id)) ||
                (userDocId && d.user_id === userDocId);
              return isPhoneMatch || isIdMatch;
            })
            .sort((a: any, b: any) => {
              const timeA = a.timestamp || a.created_at || '';
              const timeB = b.timestamp || b.created_at || '';
              return timeB.localeCompare(timeA);
            });
          setRealTransactions(list);
        } else {
          setRealTransactions([]);
        }
      });
      return unsub;
    } catch (e) {}
  }, [user?.phone, user?.id]);

  // Real-time subscription to user's payment_requests
  useEffect(() => {
    if (!user?.id && !user?.phone) return;
    const userDigits = (user.phone || '').replace(/\D/g, '');
    const userDocId = user.id || (userDigits ? `usr_${userDigits}` : '');

    try {
      const unsub = onSnapshot(collection(firestore, 'payment_requests'), snap => {
        const list = snap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .filter((d: any) => {
            if (d.type !== 'wallet_topup' || !['pending', 'utr_submitted', 'rejected'].includes(d.status)) {
              return false;
            }
            const dDigits = (d.user_phone || '').replace(/\D/g, '');
            const isPhoneMatch =
              userDigits && dDigits && (dDigits.endsWith(userDigits) || userDigits.endsWith(dDigits));
            const isIdMatch = d.user_id === userDocId || d.user_id === user?.id;
            return isPhoneMatch || isIdMatch;
          })
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
          if (d.upi_qr_image_url) setCustomQrUrl(d.upi_qr_image_url);
        }
      });
      return unsub;
    } catch (e) {}
  }, []);

  const handleTopUp = (amount: number) => {
    if (!user) {
      Alert.alert('Authentication Required', 'Please sign in to top up your wallet.');
      return;
    }
    setActiveTopUpAmount(amount);
    setShowUpiModal(true);
  };

  const handleCustomTopUp = () => {
    if (!user) {
      Alert.alert('Authentication Required', 'Please sign in to top up your wallet.');
      return;
    }
    const cleanAmt = customAmountText.replace(/[^0-9]/g, '');
    const parsed = parseInt(cleanAmt, 10);
    if (!parsed || isNaN(parsed) || parsed < 10) {
      Alert.alert('Invalid Amount', 'Please enter a top-up amount of at least ₹10.');
      return;
    }
    if (parsed > 50000) {
      Alert.alert('Limit Exceeded', 'Maximum single wallet top-up is ₹50,000.');
      return;
    }
    handleTopUp(parsed);
  };

  const handleConfirmTopUp = async (utrNumber?: string) => {
    if (!user || !activeTopUpAmount) return;
    setTopUpLoading(activeTopUpAmount);
    try {
      const cleanPhone = user.phone ? user.phone.trim() : '';
      const userDocId = user.id || `usr_${cleanPhone.replace(/\D/g, '')}`;

      await submitPaymentRequest({
        type: 'wallet_topup',
        userId: userDocId,
        userName: user.name || 'AFoodoo Customer',
        userPhone: cleanPhone,
        amount: activeTopUpAmount,
        utrNumber,
        walletPayload: {
          amount: activeTopUpAmount,
          description: `Wallet Top-Up (+₹${activeTopUpAmount})`,
        },
      });

      setShowUpiModal(false);
      Alert.alert(
        'Top-Up Request Sent ⏳',
        `Your top-up request for ₹${activeTopUpAmount.toLocaleString('en-IN')} has been submitted for admin verification.\n\nYour wallet balance will be credited automatically as soon as the admin verifies your payment!`
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

        {/* Top Up Actions */}
        <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>Top-Up AFoodoo Wallet</Text>

        {/* Quick Amount Chips */}
        <View style={styles.topUpRow}>
          {[100, 250, 500, 1000].map(amount => (
            <TouchableOpacity
              key={amount}
              style={[
                styles.topUpChip,
                { backgroundColor: theme.surface, borderColor: theme.accentBadgeBg },
              ]}
              onPress={() => {
                setCustomAmountText(amount.toString());
                handleTopUp(amount);
              }}
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

        {/* Custom Manual Amount Box */}
        <View style={[styles.customAmountCard, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder }]}>
          <Text style={[styles.customAmountLabel, { color: theme.textSecondary }]}>
            Or Enter Any Custom Amount
          </Text>
          <View style={styles.customAmountInputRow}>
            <View style={[styles.currencyPrefix, { backgroundColor: theme.inputBg, borderColor: theme.inputBorder }]}>
              <Text style={[styles.currencyPrefixText, { color: theme.primary }]}>₹</Text>
            </View>
            <TextInput
              style={[
                styles.customAmountInput,
                {
                  backgroundColor: theme.inputBg,
                  borderColor: theme.inputBorder,
                  color: theme.inputText || theme.textPrimary,
                },
              ]}
              placeholder="e.g. 350"
              placeholderTextColor={theme.textMuted}
              keyboardType="number-pad"
              maxLength={6}
              value={customAmountText}
              onChangeText={setCustomAmountText}
            />
            <TouchableOpacity
              style={[styles.customTopUpBtn, { backgroundColor: theme.primary }]}
              onPress={handleCustomTopUp}
              disabled={topUpLoading !== null}
            >
              <Text style={styles.customTopUpBtnText}>
                Top Up →
              </Text>
            </TouchableOpacity>
          </View>
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
              const typeStr = (tx.type || '').toLowerCase();
              const isCredit =
                typeStr === 'credit' ||
                typeStr === 'topup' ||
                typeStr === 'plan_credit' ||
                (typeof tx.amount === 'number' && tx.amount > 0);
              const displayAmt = Math.abs(tx.amount || 0);
              const txTimeStr = tx.timestamp
                ? new Date(tx.timestamp).toLocaleString('en-IN', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' })
                : tx.created_at
                ? new Date(tx.created_at).toLocaleString('en-IN', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' })
                : 'Recently';
              const txTitle = tx.title || tx.description || tx.reason || 'Wallet Activity';

              return (
                <View key={tx.id || `tx_${idx}`}>
                  <View style={styles.txRow}>
                    <View style={styles.txIconBadge}>
                      <Text style={styles.txIcon}>{isCredit ? '🟢' : '🔴'}</Text>
                    </View>
                    <View style={styles.txInfo}>
                      <Text style={[styles.txTitle, { color: theme.textPrimary }]}>{txTitle}</Text>
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

      {/* Zero-fee Direct UPI & QR Code Modal */}
      <UpiPaymentModal
        visible={showUpiModal}
        amount={activeTopUpAmount || 0}
        upiId={upiId}
        merchantName={merchantName}
        customQrUrl={customQrUrl}
        note={`AFoodoo Wallet Top-Up ₹${activeTopUpAmount || 0}`}
        submitting={topUpLoading != null}
        onClose={() => {
          setShowUpiModal(false);
          setActiveTopUpAmount(null);
        }}
        onConfirmPaid={handleConfirmTopUp}
      />

      <BottomNavBar
        currentTab="Wallet"
        onSelectTab={(tab: BottomTabType) => {
          if (tab === 'Wallet') return;
          if (tab === 'Home') navigation.navigate('Home');
          else if (tab === 'Orders') navigation.navigate('OrderTracking');
          else if (tab === 'Account') navigation.navigate('Profile');
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
  customAmountCard: {
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    marginTop: 12,
  },
  customAmountLabel: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 8,
  },
  customAmountInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  currencyPrefix: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    minHeight: 46,
    justifyContent: 'center',
    alignItems: 'center',
  },
  currencyPrefixText: {
    fontSize: 16,
    fontWeight: '800',
  },
  customAmountInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    fontWeight: '700',
    minHeight: 46,
  },
  customTopUpBtn: {
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 10,
    minHeight: 46,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
  customTopUpBtnText: {
    color: '#FFFFFF',
    fontSize: 13.5,
    fontWeight: '800',
  },
});
