import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
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

export default function App() {
  return (
    <NavigationContainer>
      <StatusBar style="dark" />
      <Stack.Navigator
        initialRouteName="Auth"
        screenOptions={{
          headerStyle: { backgroundColor: '#FAF7F2' },
          headerTintColor: '#D84315',
          headerTitleStyle: { fontWeight: '700', color: '#2C2C2C' },
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
        <Stack.Screen name="Profile" component={ProfileScreen} options={{ title: 'Account Settings' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
