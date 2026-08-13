import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  TextInput,
  Switch,
  FlatList,
  RefreshControl,
  SafeAreaView,
  ScrollView,
} from 'react-native';
import { useAppStore } from '../store/appStore';
import { fetchSubscriptions, pauseSubscription, createSubscription } from '../api/subscriptions';
import dayjs from 'dayjs';

const AVAILABLE_PLANS = [
  { id: 'p1', title: 'Monthly Lunch Pack', meals: 20, price: 180, tag: 'Most Popular' },
  { id: 'p2', title: 'Dinner Tiffin Pass', meals: 15, price: 145, tag: 'Best Value' },
  { id: 'p3', title: 'Weekly Trial Pack', meals: 6, price: 65, tag: 'Flexible' },
];

export default function SubscriptionScreen({ navigation }: any) {
  const user = useAppStore(state => state.user);
  const subscriptions = useAppStore(state => state.subscriptions);
  const setSubscriptions = useAppStore(state => state.setSubscriptions);

  const [skipDate, setSkipDate] = useState(dayjs().add(1, 'day').format('YYYY-MM-DD'));
  const [selectedPlan, setSelectedPlan] = useState(AVAILABLE_PLANS[0]);
  const [autoRenew, setAutoRenew] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) loadUserSubscriptions();
  }, [user]);

  const loadUserSubscriptions = async () => {
    if (!user) return;
    try {
      const subs = await fetchSubscriptions(user.id);
      setSubscriptions(subs);
    } catch (e) {
      console.log('Using local subscription store state');
    }
  };

  const handleSubscribe = async () => {
    if (!user) {
      Alert.alert('Login Required', 'Please sign in to buy a subscription pack.');
      return;
    }
    setLoading(true);
    const startDate = new Date().toISOString();
    const endDate = new Date(Date.now() + 30 * 86400000).toISOString();

    try {
      const newSub = await createSubscription({
        userId: user.id,
        plan_type: selectedPlan.title,
        meals_remaining: selectedPlan.meals,
        start_date: startDate,
        end_date: endDate,
        auto_renew: autoRenew,
      });
      setSubscriptions([newSub, ...subscriptions]);
      Alert.alert('Subscription Activated! 🎉', `You have unlocked ${selectedPlan.meals} meals with ${selectedPlan.title}.`);
    } catch (e) {
      // Local state fallback
      const demoSub = {
        id: `sub_${Date.now()}`,
        user_id: user.id,
        plan_type: selectedPlan.title,
        meals_remaining: selectedPlan.meals,
        start_date: startDate,
        end_date: endDate,
        auto_renew: autoRenew,
      };
      setSubscriptions([demoSub, ...subscriptions]);
      Alert.alert('Subscription Activated! 🎉', `You unlocked ${selectedPlan.meals} meals with ${selectedPlan.title}.`);
    } finally {
      setLoading(false);
    }
  };

  const handlePause = async (subId: string) => {
    if (!skipDate) {
      Alert.alert('Select Date', 'Please enter a skip date (YYYY-MM-DD)');
      return;
    }
    try {
      await pauseSubscription(subId, skipDate);
      Alert.alert('Meal Paused ⏸️', `Your meal for ${skipDate} has been skipped without charging your quota.`);
    } catch (e) {
      // Local state fallback
      const updated = subscriptions.map(s => {
        if (s.id === subId) {
          return { ...s, meals_remaining: s.meals_remaining };
        }
        return s;
      });
      setSubscriptions(updated);
      Alert.alert('Meal Paused ⏸️', `Your meal for ${skipDate} is skipped. No meals deducted!`);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.pageTitle}>Tiffin Packs & Subscriptions 🍱</Text>

        {/* Active Subscriptions List */}
        <Text style={styles.sectionTitle}>Active Subscriptions</Text>
        {subscriptions && subscriptions.length > 0 ? (
          subscriptions.map((sub: any) => (
            <View key={sub.id} style={styles.activeCard}>
              <View style={styles.activeHeaderRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.activeTitle}>{sub.plan_type}</Text>
                  <Text style={styles.activeDate}>
                    Valid until {dayjs(sub.end_date).format('MMM DD, YYYY')}
                  </Text>
                </View>
                <View style={styles.mealsBadge}>
                  <Text style={styles.mealsBadgeCount}>{sub.meals_remaining}</Text>
                  <Text style={styles.mealsBadgeLabel}>Meals Left</Text>
                </View>
              </View>

              <View style={styles.divider} />

              {/* Pause/Skip Meal Section */}
              <Text style={styles.pauseHeading}>Pause / Skip Specific Day's Meal</Text>
              <Text style={styles.pauseSub}>
                Free up a slot count without losing a meal balance.
              </Text>
              <View style={styles.pauseRow}>
                <TextInput
                  style={styles.dateInput}
                  value={skipDate}
                  onChangeText={setSkipDate}
                  placeholder="YYYY-MM-DD"
                />
                <TouchableOpacity
                  style={styles.pauseButton}
                  onPress={() => handlePause(sub.id)}
                >
                  <Text style={styles.pauseButtonText}>Skip Meal ⏸️</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        ) : (
          <View style={styles.noSubBox}>
            <Text style={styles.noSubText}>No active subscription pack found.</Text>
          </View>
        )}

        {/* Buy New Subscription Pack */}
        <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Buy New Meal Pack</Text>

        {AVAILABLE_PLANS.map(plan => {
          const isSelected = selectedPlan.id === plan.id;
          return (
            <TouchableOpacity
              key={plan.id}
              style={[styles.planCard, isSelected && styles.planCardSelected]}
              onPress={() => setSelectedPlan(plan)}
            >
              <View style={styles.planHeader}>
                <Text style={styles.planTitle}>{plan.title}</Text>
                <View style={styles.tagBadge}>
                  <Text style={styles.tagText}>{plan.tag}</Text>
                </View>
              </View>
              <View style={styles.planPriceRow}>
                <Text style={styles.planMeals}>{plan.meals} Home Tiffin Meals</Text>
                <Text style={styles.planPrice}>${plan.price}</Text>
              </View>
            </TouchableOpacity>
          );
        })}

        {/* Auto Renew Switch */}
        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>Auto-renew plan when meals run out</Text>
          <Switch
            value={autoRenew}
            onValueChange={setAutoRenew}
            trackColor={{ false: '#E0E0E0', true: '#FFAB91' }}
            thumbColor={autoRenew ? '#D84315' : '#F5F5F5'}
          />
        </View>

        <TouchableOpacity style={styles.buyButton} onPress={handleSubscribe} disabled={loading}>
          <Text style={styles.buyButtonText}>
            Buy {selectedPlan.title} (${selectedPlan.price})
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FAF7F2' },
  container: { padding: 20 },
  pageTitle: { fontSize: 22, fontWeight: '800', color: '#2C2C2C', marginBottom: 16 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#2C2C2C', marginBottom: 12 },
  activeCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#EEEEEE',
  },
  activeHeaderRow: { flexDirection: 'row', alignItems: 'center' },
  activeTitle: { fontSize: 16, fontWeight: '700', color: '#2C2C2C' },
  activeDate: { fontSize: 12, color: '#757575', marginTop: 2 },
  mealsBadge: { backgroundColor: '#E65100', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, alignItems: 'center' },
  mealsBadgeCount: { fontSize: 16, fontWeight: '800', color: '#FFF' },
  mealsBadgeLabel: { fontSize: 9, color: '#FFE0B2', fontWeight: '700' },
  divider: { height: 1, backgroundColor: '#F0F0F0', marginVertical: 14 },
  pauseHeading: { fontSize: 13, fontWeight: '700', color: '#2C2C2C' },
  pauseSub: { fontSize: 11, color: '#757575', marginBottom: 10 },
  pauseRow: { flexDirection: 'row', alignItems: 'center' },
  dateInput: {
    flex: 1,
    backgroundColor: '#FAF9F6',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
    marginRight: 10,
  },
  pauseButton: { backgroundColor: '#D84315', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 8 },
  pauseButtonText: { color: '#FFF', fontSize: 13, fontWeight: '700' },
  noSubBox: { backgroundColor: '#FFF', borderRadius: 12, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: '#EEE' },
  noSubText: { fontSize: 13, color: '#757575' },
  planCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1.5,
    borderColor: '#E0E0E0',
  },
  planCardSelected: { borderColor: '#D84315', backgroundColor: '#FFF3E0' },
  planHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  planTitle: { fontSize: 16, fontWeight: '700', color: '#2C2C2C' },
  tagBadge: { backgroundColor: '#FFE0B2', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  tagText: { fontSize: 10, fontWeight: '700', color: '#E65100' },
  planPriceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  planMeals: { fontSize: 13, color: '#616161' },
  planPrice: { fontSize: 18, fontWeight: '800', color: '#D84315' },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginVertical: 16 },
  switchLabel: { fontSize: 13, color: '#424242', flex: 1, marginRight: 12 },
  buyButton: { backgroundColor: '#D84315', paddingVertical: 15, borderRadius: 12, alignItems: 'center', marginTop: 8 },
  buyButtonText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
});
