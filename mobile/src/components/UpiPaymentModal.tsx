import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Image,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Alert,
  Linking,
} from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { generateUpiQrCodeUrl, generateUpiUrl } from '../utils/upi';

interface UpiPaymentModalProps {
  visible: boolean;
  amount: number;
  upiId?: string;
  merchantName?: string;
  customQrUrl?: string;
  note?: string;
  submitting?: boolean;
  onClose: () => void;
  onConfirmPaid: (utrNumber?: string) => Promise<void> | void;
}

export const UpiPaymentModal: React.FC<UpiPaymentModalProps> = ({
  visible,
  amount,
  upiId = 'afoodoo@upi',
  merchantName = 'AFoodoo Kitchen',
  customQrUrl,
  note = 'AFoodoo Payment',
  submitting = false,
  onClose,
  onConfirmPaid,
}) => {
  const { theme } = useTheme();
  const [utr, setUtr] = useState('');
  const [imgLoading, setImgLoading] = useState(true);
  const [imgError, setImgError] = useState(false);

  const cleanUpiId = (upiId || 'afoodoo@upi').trim();
  const cleanMerchant = (merchantName || 'AFoodoo Kitchen').trim();

  // Dynamic QR Code generated with payee, merchant name, and exact order amount
  const dynamicQrUrl = generateUpiQrCodeUrl({
    upiId: cleanUpiId,
    merchantName: cleanMerchant,
    amount,
    note,
  });

  const activeQrUrl = customQrUrl?.trim() || dynamicQrUrl;

  const handleOpenUpiApp = () => {
    const upiUrl = generateUpiUrl({
      upiId: cleanUpiId,
      merchantName: cleanMerchant,
      amount,
      note,
    });
    Linking.openURL(upiUrl).catch(() => {
      Alert.alert(
        'UPI App Notice 📱',
        `Could not open UPI app directly. Please scan the QR code above or pay directly to UPI ID: ${cleanUpiId}`
      );
    });
  };

  const handleConfirm = () => {
    const cleanUtr = utr.trim();
    if (cleanUtr && cleanUtr.replace(/\D/g, '').length !== 12) {
      Alert.alert(
        'Invalid UTR Number',
        'If entering a UTR, please provide the full 12-digit UPI Reference Number from your payment receipt, or leave it blank to submit now.'
      );
      return;
    }
    onConfirmPaid(cleanUtr || undefined);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={[styles.modalCard, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder }]}>
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={[styles.title, { color: theme.textPrimary }]}>Pay via Direct UPI 📱</Text>
              <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
                Scan QR or pay directly · 0% fee
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Text style={[styles.closeBtnText, { color: theme.textMuted }]}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
            {/* Amount Badge */}
            <View style={[styles.amountBadge, { backgroundColor: theme.primaryLight || '#FFF3E0', borderColor: theme.primary }]}>
              <Text style={[styles.amountLabel, { color: theme.accent || '#E65100' }]}>Total Amount to Pay</Text>
              <Text style={[styles.amountValue, { color: theme.primary }]}>₹{amount.toFixed(2)}</Text>
            </View>

            {/* QR Code Container */}
            <View style={styles.qrCard}>
              <View style={styles.qrWhiteBox}>
                {imgLoading && (
                  <View style={styles.qrLoader}>
                    <ActivityIndicator size="small" color="#FF7A00" />
                  </View>
                )}
                {imgError ? (
                  <View style={styles.qrErrorBox}>
                    <Text style={styles.qrErrorText}>Could not load QR preview</Text>
                    <Text style={styles.qrErrorSubText}>Please pay directly to UPI ID below</Text>
                  </View>
                ) : (
                  <Image
                    source={{ uri: activeQrUrl }}
                    style={styles.qrImage}
                    resizeMode="contain"
                    onLoadStart={() => setImgLoading(true)}
                    onLoadEnd={() => setImgLoading(false)}
                    onError={() => {
                      setImgLoading(false);
                      setImgError(true);
                    }}
                  />
                )}
              </View>

              <Text style={styles.qrScanHint}>
                Scan with any UPI App: GPay, PhonePe, Paytm, BHIM, CRED
              </Text>
            </View>

            {/* Payee Info / UPI ID Box */}
            <View style={[styles.infoBox, { backgroundColor: theme.inputBg || '#F5F5F5', borderColor: theme.inputBorder }]}>
              <View style={styles.infoRow}>
                <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>Payee Name:</Text>
                <Text style={[styles.infoValue, { color: theme.textPrimary }]} numberOfLines={1}>
                  {cleanMerchant}
                </Text>
              </View>
              <View style={[styles.divider, { backgroundColor: theme.surfaceBorder }]} />
              <View style={styles.infoRow}>
                <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>UPI VPA ID:</Text>
                <Text
                  selectable={true}
                  style={[styles.upiIdText, { color: theme.primary }]}
                >
                  {cleanUpiId}
                </Text>
              </View>
              <Text style={[styles.copyTip, { color: theme.textMuted }]}>
                💡 Long-press UPI ID above to copy into your UPI app
              </Text>
            </View>

            {/* Optional Open UPI App Button */}
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={handleOpenUpiApp}
              style={[styles.openUpiBtn, { borderColor: theme.primary }]}
            >
              <Text style={[styles.openUpiBtnText, { color: theme.primary }]}>
                🚀 Try Opening in UPI App
              </Text>
            </TouchableOpacity>

            {/* Optional UTR Input */}
            <View style={styles.utrSection}>
              <Text style={[styles.utrLabel, { color: theme.textPrimary }]}>
                12-Digit UPI Reference / UTR (Optional)
              </Text>
              <Text style={[styles.utrHelper, { color: theme.textSecondary }]}>
                Enter now for faster approval, or submit later from tracking:
              </Text>
              <TextInput
                placeholder="e.g. 423589123456"
                placeholderTextColor={theme.textMuted}
                keyboardType="number-pad"
                maxLength={12}
                value={utr}
                onChangeText={setUtr}
                style={[
                  styles.utrInput,
                  {
                    backgroundColor: theme.inputBg,
                    borderColor: theme.inputBorder,
                    color: theme.inputText || theme.textPrimary,
                  },
                ]}
              />
            </View>
          </ScrollView>

          {/* Action Buttons */}
          <View style={[styles.footer, { borderTopColor: theme.surfaceBorder }]}>
            <TouchableOpacity
              onPress={onClose}
              disabled={submitting}
              style={[styles.cancelBtn, { borderColor: theme.surfaceBorder }]}
            >
              <Text style={[styles.cancelBtnText, { color: theme.textSecondary }]}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleConfirm}
              disabled={submitting}
              style={[styles.confirmBtn, { backgroundColor: theme.primary }]}
            >
              {submitting ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <Text style={styles.confirmBtnText}>I Have Paid ✓</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 18,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    maxHeight: '90%',
    borderRadius: 24,
    borderWidth: 1,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  closeBtn: {
    padding: 4,
  },
  closeBtnText: {
    fontSize: 18,
    fontWeight: '700',
  },
  scrollContent: {
    paddingBottom: 10,
  },
  amountBadge: {
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: 'center',
    marginBottom: 14,
  },
  amountLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  amountValue: {
    fontSize: 26,
    fontWeight: '900',
    marginTop: 2,
  },
  qrCard: {
    alignItems: 'center',
    marginBottom: 14,
  },
  qrWhiteBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
    width: 220,
    height: 220,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  qrImage: {
    width: 196,
    height: 196,
  },
  qrLoader: {
    position: 'absolute',
    zIndex: 1,
  },
  qrErrorBox: {
    alignItems: 'center',
    padding: 10,
  },
  qrErrorText: {
    color: '#D32F2F',
    fontWeight: '700',
    fontSize: 12,
  },
  qrErrorSubText: {
    color: '#777',
    fontSize: 11,
    marginTop: 4,
    textAlign: 'center',
  },
  qrScanHint: {
    fontSize: 11,
    color: '#888',
    marginTop: 8,
    textAlign: 'center',
    fontWeight: '600',
  },
  infoBox: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  infoLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  infoValue: {
    fontSize: 12,
    fontWeight: '700',
  },
  upiIdText: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  divider: {
    height: 1,
    marginVertical: 4,
  },
  copyTip: {
    fontSize: 10.5,
    fontStyle: 'italic',
    marginTop: 4,
    textAlign: 'center',
  },
  openUpiBtn: {
    borderWidth: 1.5,
    borderRadius: 12,
    paddingVertical: 9,
    alignItems: 'center',
    marginBottom: 14,
  },
  openUpiBtnText: {
    fontSize: 12.5,
    fontWeight: '700',
  },
  utrSection: {
    marginBottom: 10,
  },
  utrLabel: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 2,
  },
  utrHelper: {
    fontSize: 11,
    marginBottom: 6,
  },
  utrInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 13,
    fontWeight: '600',
  },
  footer: {
    flexDirection: 'row',
    gap: 10,
    borderTopWidth: 1,
    paddingTop: 12,
    marginTop: 4,
  },
  cancelBtn: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
  confirmBtn: {
    flex: 2,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#FF7A00',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
  },
  confirmBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
});
