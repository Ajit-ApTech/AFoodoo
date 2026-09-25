import React, { useEffect } from 'react';
import { View, Image, TouchableOpacity, Text } from 'react-native';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { navigationRef } from './services/navigationRef';
import { registerForPushNotificationsAsync, initNotificationListeners } from './services/notificationService';
import { ThemeProvider, useTheme } from './theme/ThemeContext';
import { useAppStore } from './store/appStore';
import AuthScreen from './screens/AuthScreen';
import HomeScreen from './screens/HomeScreen';
import MenuScreen from './screens/MenuScreen';
import BookingScreen from './screens/BookingScreen';
import OrderTrackingScreen from './screens/OrderTrackingScreen';
import SubscriptionScreen from './screens/SubscriptionScreen';
import WalletScreen from './screens/WalletScreen';
import ProfileScreen from './screens/ProfileScreen';
import { AnnouncementsModal } from './components/AnnouncementsModal';

export type RootStackParamList = {
  Auth: undefined;
  Home: undefined;
  Menu: undefined;
  Booking: { item: any };
  OrderTracking: { orderId: string };
  Subscription: undefined;
  Wallet: undefined;
  Profile: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

function MainNavigator() {
  const { theme, isDark } = useTheme();
  // Zustand with AsyncStorage persistence keeps the user logged in across restarts
  const user = useAppStore(state => state.user);
  const unreadCount = useAppStore(state => state.unreadAnnouncementsCount);
  const cart = useAppStore(state => state.cart);
  const cartTotalCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  useEffect(() => {
    // Register device for push notifications and sync token to Cloud Firestore
    const userDocId = user?.id || (user?.phone ? `usr_${user.phone.replace(/\D/g, '')}` : undefined);
    registerForPushNotificationsAsync(userDocId);
    // Initialize real-time push notification listeners
    const unsubscribePush = initNotificationListeners();
    return () => {
      if (unsubscribePush) unsubscribePush();
    };
  }, [user?.phone, user?.id]);

  const navTheme = isDark
    ? {
        ...DarkTheme,
        colors: {
          ...DarkTheme.colors,
          background: theme.background,
          card: theme.surface,
          text: theme.textPrimary,
          border: theme.surfaceBorder,
        },
      }
    : {
        ...DefaultTheme,
        colors: {
          ...DefaultTheme.colors,
          background: theme.background,
          card: theme.surface,
          text: theme.textPrimary,
          border: theme.surfaceBorder,
        },
      };

  return (
    <NavigationContainer ref={navigationRef} theme={navTheme}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack.Navigator
        initialRouteName={user ? 'Home' : 'Auth'}
        screenOptions={{
          headerStyle: { backgroundColor: theme.background },
          headerTintColor: theme.primary,
          headerTitleStyle: { fontWeight: '700', color: theme.textPrimary },
          headerShadowVisible: false,
          headerBackTitleVisible: false,
        }}
      >
        <Stack.Screen name="Auth" component={AuthScreen} options={{ headerShown: false }} />
        <Stack.Screen
          name="Home"
          component={HomeScreen}
          options={({ navigation }) => ({
            headerTitle: () => (
              <View style={{ flexDirection: 'row', alignItems: 'center', height: 44, marginLeft: -4 }}>
                <Image
                  source={
                    isDark
                      ? require('../assets/afoodoo-logo-light.png')
                      : require('../assets/afoodoo-logo-dark.png')
                  }
                  style={{ width: 96, height: 36 }}
                  resizeMode="contain"
                />
              </View>
            ),
            headerTitleAlign: 'left',
            headerRight: () => (
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <TouchableOpacity
                  onPress={() => useAppStore.getState().setAnnouncementsModalOpen(true)}
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 18,
                    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#F3F4F6',
                    justifyContent: 'center',
                    alignItems: 'center',
                    marginRight: 10,
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={{ fontSize: 16 }}>🔔</Text>
                  {unreadCount > 0 && (
                    <View
                      style={{
                        position: 'absolute',
                        top: 5,
                        right: 6,
                        width: 8,
                        height: 8,
                        borderRadius: 4,
                        backgroundColor: theme.primary,
                        borderWidth: 1.5,
                        borderColor: theme.background,
                      }}
                    />
                  )}
                </TouchableOpacity>

                {/* Add to Cart Header Button (Replaces profile (A) button) */}
                <TouchableOpacity
                  onPress={() => navigation.navigate('Booking', {})}
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 18,
                    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#F3F4F6',
                    justifyContent: 'center',
                    alignItems: 'center',
                    marginRight: 4,
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={{ fontSize: 17 }}>🛒</Text>
                  {cartTotalCount > 0 && (
                    <View
                      style={{
                        position: 'absolute',
                        top: -3,
                        right: -3,
                        minWidth: 18,
                        height: 18,
                        borderRadius: 9,
                        backgroundColor: '#FF6B00',
                        justifyContent: 'center',
                        alignItems: 'center',
                        paddingHorizontal: 4,
                        borderWidth: 1.5,
                        borderColor: theme.background,
                      }}
                    >
                      <Text style={{ color: '#FFFFFF', fontSize: 10, fontWeight: '900' }}>
                        {cartTotalCount}
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>
              </View>
            ),
            headerStyle: {
              backgroundColor: theme.background,
            },
            headerShadowVisible: false,
          })}
        />
        <Stack.Screen
          name="Menu"
          component={MenuScreen}
          options={({ navigation }) => ({
            title: "Today's Tiffin Menu",
            headerRight: () => (
              <TouchableOpacity
                onPress={() => navigation.navigate('Booking', {})}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#F3F4F6',
                  justifyContent: 'center',
                  alignItems: 'center',
                  marginRight: 4,
                }}
                activeOpacity={0.7}
              >
                <Text style={{ fontSize: 17 }}>🛒</Text>
                {cartTotalCount > 0 && (
                  <View
                    style={{
                      position: 'absolute',
                      top: -3,
                      right: -3,
                      minWidth: 18,
                      height: 18,
                      borderRadius: 9,
                      backgroundColor: '#FF6B00',
                      justifyContent: 'center',
                      alignItems: 'center',
                      paddingHorizontal: 4,
                      borderWidth: 1.5,
                      borderColor: theme.background,
                    }}
                  >
                    <Text style={{ color: '#FFFFFF', fontSize: 10, fontWeight: '900' }}>
                      {cartTotalCount}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            ),
          })}
        />
        <Stack.Screen name="Booking" component={BookingScreen} options={{ title: 'Confirm Booking' }} />
        <Stack.Screen name="OrderTracking" component={OrderTrackingScreen} options={{ title: 'Order Tracking', headerBackVisible: false }} />
        <Stack.Screen name="Subscription" component={SubscriptionScreen} options={{ title: 'Meal Subscriptions' }} />
        <Stack.Screen name="Wallet" component={WalletScreen} options={{ title: 'AFoodoo Wallet', headerBackVisible: false }} />
        <Stack.Screen name="Profile" component={ProfileScreen} options={{ title: 'Account & Settings', headerBackVisible: false }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <MainNavigator />
    </ThemeProvider>
  );
}
