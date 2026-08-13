import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  Alert,
} from 'react-native';
import { firestore } from '../firebaseConfig';
import { doc, onSnapshot } from '@firebase/firestore';

export default function OrderTrackingScreen({ route, navigation }: any) {
  const orderId = route?.params?.orderId || 'ord_849201';
  const [order, setOrder] = useState<any>({
    id: orderId,
    status: 'preparing',
    payment_status: 'paid',
    otp_code: '8492',
    delivery_start: '1:00 PM',
    delivery_end: '2:00 PM',
    rating: 0,
  });

  const [currentStep, setCurrentStep] = useState(1); // 0: Booked, 1: Preparing, 2: Out for Delivery, 3: Delivered

  useEffect(() => {
    try {
      const orderRef = doc(firestore, 'orders', orderId);
      const unsub = onSnapshot(
        orderRef,
        snap => {
          if (snap.exists()) {
            const data = snap.data();
            setOrder(data);
            mapStatusToStep(data.status);
          }
        },
        () => {}
      );
      return unsub;
    } catch (e) {
      console.log('Using local tracking simulation');
    }
  }, [orderId]);

  const mapStatusToStep = (status: string) => {
    switch (status) {
      case 'booked':
        setCurrentStep(0);
        break;
      case 'preparing':
        setCurrentStep(1);
        break;
      case 'out_for_delivery':
        setCurrentStep(2);
        break;
      case 'delivered':
        setCurrentStep(3);
        break;
      default:
        setCurrentStep(1);
    }
  };

  const steps = [
    { title: 'Order Booked', desc: 'Received & validated before cutoff' },
    { title: 'Kitchen Preparing', desc: 'Fresh ingredients being cooked' },
    { title: 'Out for Delivery', desc: 'Hot tiffin packed in thermal box' },
    { title: 'Meal Delivered', desc: 'Enjoy your hot meal!' },
  ];

  const handleSimulateNextStep = () => {
    const next = (currentStep + 1) % 4;
    setCurrentStep(next);
  };

  const handleRateMeal = (stars: number) => {
    setOrder({ ...order, rating: stars });
    Alert.alert('Thank You!', `You rated this meal ${stars} Stars ⭐. Your feedback improves our kitchen!`);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.pageTitle}>Track Tiffin Order 🚴</Text>

        {/* Order ID & OTP Card */}
        <View style={styles.card}>
          <View style={styles.headerRow}>
            <View>
              <Text style={styles.orderIdLabel}>ORDER ID</Text>
              <Text style={styles.orderIdValue}>#{orderId}</Text>
            </View>
            <View style={styles.otpBox}>
              <Text style={styles.otpLabel}>Delivery OTP</Text>
              <Text style={styles.otpCode}>{order.otp_code || '8492'}</Text>
            </View>
          </View>
          <Text style={styles.otpNotice}>
            🔒 Share this 4-digit code with your rider upon delivery.
          </Text>
        </View>

        {/* Status Stepper Card */}
        <View style={styles.card}>
          <Text style={styles.cardHeader}>Delivery Progress</Text>
          <View style={styles.stepperContainer}>
            {steps.map((step, index) => {
              const isCompleted = index <= currentStep;
              const isCurrent = index === currentStep;

              return (
                <View key={index} style={styles.stepRow}>
                  <View style={styles.stepIndicatorColumn}>
                    <View
                      style={[
                        styles.stepDot,
                        isCompleted && styles.stepDotCompleted,
                        isCurrent && styles.stepDotCurrent,
                      ]}
                    >
                      <Text style={styles.stepDotText}>{isCompleted ? '✓' : index + 1}</Text>
                    </View>
                    {index < steps.length - 1 && (
                      <View
                        style={[
                          styles.stepLine,
                          index < currentStep && styles.stepLineCompleted,
                        ]}
                      />
                    )}
                  </View>

                  <View style={styles.stepContent}>
                    <Text
                      style={[
                        styles.stepTitle,
                        isCurrent && styles.stepTitleCurrent,
                      ]}
                    >
                      {step.title}
                    </Text>
                    <Text style={styles.stepDesc}>{step.desc}</Text>
                  </View>
                </View>
              );
            })}
          </View>
        </View>

        {/* Estimated Arrival Card */}
        <View style={styles.etaCard}>
          <Text style={styles.etaTitle}>⏰ Estimated Delivery Window</Text>
          <Text style={styles.etaTime}>1:15 PM – 1:45 PM (Lunch Slot)</Text>
          <Text style={styles.etaSub}>Thermal insulated packaging keeps your food hot.</Text>
        </View>

        {/* Post-Delivery Rating (shown when delivered or for demo) */}
        {currentStep === 3 ? (
          <View style={styles.ratingCard}>
            <Text style={styles.ratingTitle}>How was your meal today?</Text>
            <Text style={styles.ratingSub}>Post-delivery rating feeds into admin kitchen quality analytics.</Text>
            <View style={styles.starsRow}>
              {[1, 2, 3, 4, 5].map(star => (
                <TouchableOpacity key={star} onPress={() => handleRateMeal(star)}>
                  <Text style={styles.starIcon}>{order.rating >= star ? '⭐' : '☆'}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ) : null}

        {/* Demo Stepper Simulator */}
        <TouchableOpacity style={styles.simButton} onPress={handleSimulateNextStep}>
          <Text style={styles.simButtonText}>Simulate Next Delivery Status 🔄</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.homeButton} onPress={() => navigation.navigate('Home')}>
          <Text style={styles.homeButtonText}>Return to Home</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FAF7F2' },
  container: { padding: 20 },
  pageTitle: { fontSize: 22, fontWeight: '800', color: '#2C2C2C', marginBottom: 16 },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#EEEEEE',
  },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  orderIdLabel: { fontSize: 11, fontWeight: '700', color: '#757575' },
  orderIdValue: { fontSize: 18, fontWeight: '800', color: '#2C2C2C', marginTop: 2 },
  otpBox: { backgroundColor: '#FFF3E0', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, alignItems: 'center' },
  otpLabel: { fontSize: 10, fontWeight: '700', color: '#E65100' },
  otpCode: { fontSize: 18, fontWeight: '800', color: '#D84315' },
  otpNotice: { fontSize: 12, color: '#616161', marginTop: 12 },
  cardHeader: { fontSize: 16, fontWeight: '700', color: '#2C2C2C', marginBottom: 16 },
  stepperContainer: { paddingLeft: 4 },
  stepRow: { flexDirection: 'row', marginBottom: 20 },
  stepIndicatorColumn: { alignItems: 'center', marginRight: 14, width: 28 },
  stepDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#E0E0E0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepDotCompleted: { backgroundColor: '#2E7D32' },
  stepDotCurrent: { backgroundColor: '#D84315' },
  stepDotText: { color: '#FFF', fontSize: 12, fontWeight: '800' },
  stepLine: { width: 2, flex: 1, backgroundColor: '#E0E0E0', marginTop: 4, marginBottom: -16 },
  stepLineCompleted: { backgroundColor: '#2E7D32' },
  stepContent: { flex: 1, justifyContent: 'center' },
  stepTitle: { fontSize: 15, fontWeight: '600', color: '#757575' },
  stepTitleCurrent: { color: '#2C2C2C', fontWeight: '800' },
  stepDesc: { fontSize: 12, color: '#9E9E9E', marginTop: 2 },
  etaCard: { backgroundColor: '#E8F5E9', borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#C8E6C9' },
  etaTitle: { fontSize: 13, fontWeight: '700', color: '#2E7D32', marginBottom: 4 },
  etaTime: { fontSize: 18, fontWeight: '800', color: '#1B5E20' },
  etaSub: { fontSize: 12, color: '#388E3C', marginTop: 4 },
  ratingCard: { backgroundColor: '#FFF', borderRadius: 16, padding: 18, marginBottom: 16, alignItems: 'center', borderWidth: 1, borderColor: '#FFE0B2' },
  ratingTitle: { fontSize: 16, fontWeight: '700', color: '#2C2C2C' },
  ratingSub: { fontSize: 12, color: '#757575', textAlign: 'center', marginTop: 2, marginBottom: 12 },
  starsRow: { flexDirection: 'row', justifyContent: 'center' },
  starIcon: { fontSize: 32, marginHorizontal: 6 },
  simButton: { backgroundColor: '#FAF7F2', borderWidth: 1, borderColor: '#FFE0B2', paddingVertical: 12, borderRadius: 12, alignItems: 'center', marginBottom: 12 },
  simButtonText: { color: '#D84315', fontSize: 14, fontWeight: '600' },
  homeButton: { backgroundColor: '#2C2C2C', paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  homeButtonText: { color: '#FFF', fontSize: 15, fontWeight: '700' },
});
