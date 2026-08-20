import React, { useEffect } from 'react';
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

  useEffect(() => {
    // Register device for push notifications and sync token to Cloud Firestore
    const userDocId = user?.id || (user?.phone ? `usr_${user.phone.replace(/\D/g, '')}` : undefined);
    registerForPushNotificationsAsync(userDocId);
    // Initialize real-time push notification listeners
    const unsubscribePush = initNotificationListeners();
    return () => {
      if (unsubscribePush) unsubscribePush();
    };
  }, [user?.phone]);

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
        <Stack.Screen name="Home" component={HomeScreen} options={{ title: 'AFoodoo Home' }} />
        <Stack.Screen name="Menu" component={MenuScreen} options={{ title: "Today's Tiffin Menu" }} />
        <Stack.Screen name="Booking" component={BookingScreen} options={{ title: 'Confirm Booking' }} />
        <Stack.Screen name="OrderTracking" component={OrderTrackingScreen} options={{ title: 'Order Tracking' }} />
        <Stack.Screen name="Subscription" component={SubscriptionScreen} options={{ title: 'Meal Subscriptions' }} />
        <Stack.Screen name="Wallet" component={WalletScreen} options={{ title: 'AFoodoo Wallet' }} />
        <Stack.Screen name="Profile" component={ProfileScreen} options={{ title: 'Account & Settings' }} />
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
