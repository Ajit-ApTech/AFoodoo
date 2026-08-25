import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { submitUtrNumber } from '../api/payments';

interface UtrModalProps {
  visible: boolean;
  paymentRequestId: string | null;
  amount?: number;
  reason?: string;
  onClose: () => void;
  onSuccess: () => void;
}

export const UtrModal: React.FC<UtrModalProps> = ({
  visible,
  paymentRequestId,
  amount,
  reason,
  onClose,
  onSuccess,
}) => {
  const { theme } = useTheme();
  const [utr, setUtr] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    const cleanUtr = utr.replace(/\D/g, '');
    if (cleanUtr.length !== 12) {
      Alert.alert(
        'Invalid UTR Number',
        'Please enter the full 12-digit UPI Reference / UTR Number found in your GPay, PhonePe, or Paytm transaction details.'
      );
      return;
    }

    if (!paymentRequestId) return;

    setSubmitting(true);
    try {
      await submitUtrNumber(paymentRequestId, cleanUtr);
      Alert.alert(
        'UTR Submitted ✅',
        'Your 12-digit UPI UTR number has been submitted for admin re-verification. We will notify you once approved!'
      );
      setUtr('');
      onSuccess();
      onClose();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not submit UTR. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder }]}>
          <Text style={[styles.title, { color: theme.textPrimary }]}>
            Verify UPI Payment 🔍
          </Text>

          {amount ? (
            <Text style={[styles.amountText, { color: theme.primary }]}>
              Amount: ₹{amount}
            </Text>
          ) : null}

          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
            {reason
              ? `Note from Admin: "${reason}"\n\nPlease enter the 12-digit UPI UTR reference number from your payment app receipt:`
              : 'Please enter the 12-digit UPI Reference / UTR number from your payment receipt to complete verification:'}
          </Text>

          <TextInput
            placeholder="12-digit UTR (e.g. 423589123456)"
            placeholderTextColor={theme.textMuted}
            keyboardType="number-pad"
            maxLength={12}
            value={utr}
            onChangeText={setUtr}
            style={[
              styles.input,
              {
                backgroundColor: theme.inputBg,
                borderColor: theme.inputBorder,
                color: theme.inputText,
              },
            ]}
          />

          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={[styles.cancelBtn, { borderColor: theme.surfaceBorder }]}
              onPress={onClose}
              disabled={submitting}
            >
              <Text style={[styles.cancelBtnText, { color: theme.textSecondary }]}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.submitBtn, { backgroundColor: theme.primary }]}
              onPress={handleSubmit}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={styles.submitBtnText}>Submit UTR →</Text>
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
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 8,
    textAlign: 'center',
  },
  amountText: {
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 16,
    textAlign: 'center',
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    letterSpacing: 2,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 20,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: '600',
  },
  submitBtn: {
    flex: 1.5,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitBtnText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
