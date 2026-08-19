import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MealSlot, MenuItem, User, Subscription, NotificationSettings } from '../types';

export interface OrderItem {
  id: string;
  status: 'booked' | 'preparing' | 'out_for_delivery' | 'delivered' | 'cancelled' | string;
  payment_status: string;
  otp_code: string;
  delivery_start?: string;
  delivery_end?: string;
  rating?: number;
  items?: any[];
  total_amount?: number;
  [key: string]: any;
}

export interface WalletTransaction {
  id: string;
  type: 'topup' | 'debit' | 'refund' | 'plan_credit';
  title: string;
  amount: number; // positive = credit, negative = debit
  time: string;
}

interface AppState {
  user: User | null;
  setUser: (user: User | null) => void;
  notificationSettings: NotificationSettings;
  setNotificationSettings: (settings: Partial<NotificationSettings>) => void;
  activeSlot: MealSlot | null;
  setActiveSlot: (slot: MealSlot | null) => void;
  menuItems: MenuItem[];
  setMenuItems: (items: MenuItem[]) => void;
  subscriptions: Subscription[];
  setSubscriptions: (subs: Subscription[]) => void;
  orders: OrderItem[];
  setOrders: (orders: OrderItem[]) => void;
  updateOrderStatus: (orderId: string, status: string) => void;
  walletTransactions: WalletTransaction[];
  addWalletTransaction: (tx: WalletTransaction) => void;
  deductWalletBalance: (amount: number, title: string) => void;
  creditWalletBalance: (amount: number, title: string, type?: WalletTransaction['type']) => void;
}

export const useAppStore = create<AppState>()(
  devtools(
    persist(
      (set, get) => ({
        user: null,
        setUser: user => set({ user }),
        notificationSettings: {
          cutoff_alerts: true,
          order_updates: true,
          promo_alerts: true,
          in_app_popups: true,
        },
        setNotificationSettings: settings =>
          set(state => ({
            notificationSettings: { ...state.notificationSettings, ...settings },
          })),
        activeSlot: null,
        setActiveSlot: slot => set({ activeSlot: slot }),
        menuItems: [],
        setMenuItems: items => set({ menuItems: items }),
        subscriptions: [],
        setSubscriptions: subs => set({ subscriptions: subs }),
        orders: [
          {
            id: 'ord_849201',
            status: 'preparing',
            payment_status: 'paid',
            otp_code: '8492',
            delivery_start: '1:00 PM',
            delivery_end: '2:00 PM',
            rating: 0,
          },
        ],
        setOrders: orders => set({ orders }),
        updateOrderStatus: (orderId, status) => {
          const currentOrders = get().orders;
          const updated = currentOrders.map(o =>
            o.id === orderId ? { ...o, status: status.toLowerCase() } : o
          );
          set({ orders: updated });
        },

        // Wallet Transactions — shared across WalletScreen & SubscriptionScreen
        walletTransactions: [
          { id: 'tx_seed_1', type: 'topup', title: 'Initial Welcome Bonus', amount: 500, time: 'Aug 01, 10:00 AM' },
        ],
        addWalletTransaction: (tx) => {
          const existing = get().walletTransactions;
          set({ walletTransactions: [tx, ...existing] });
        },

        // Deduct wallet balance and log a debit transaction to Firestore & local state
        deductWalletBalance: async (amount, title) => {
          const currentUser = get().user;
          if (!currentUser) return;
          const newBalance = Math.max(0, (currentUser.wallet_balance ?? 500) - amount);
          set({ user: { ...currentUser, wallet_balance: newBalance } });

          try {
            const { doc, updateDoc, increment, addDoc, collection } = require('firebase/firestore');
            const { firestore } = require('../firebaseConfig');
            const cleanPhone = currentUser.phone ? currentUser.phone.trim() : '';
            const userDocId = currentUser.id || `usr_${cleanPhone.replace(/\D/g, '')}`;

            await updateDoc(doc(firestore, 'users', userDocId), {
              wallet_balance: increment(-amount),
            });

            await addDoc(collection(firestore, 'wallet_transactions'), {
              user_id: userDocId,
              user_phone: cleanPhone,
              title,
              amount: -amount,
              type: 'DEBIT',
              timestamp: new Date().toISOString(),
            });
          } catch (e) {
            console.log('Notice syncing wallet deduction with Firestore:', e);
          }

          const tx: WalletTransaction = {
            id: `tx_${Date.now()}`,
            type: 'debit',
            title,
            amount: -amount,
            time: 'Just now',
          };
          const existing = get().walletTransactions;
          set({ walletTransactions: [tx, ...existing] });
        },

        // Credit wallet balance and log a credit transaction to Firestore & local state
        creditWalletBalance: async (amount, title, type = 'topup') => {
          const currentUser = get().user;
          if (!currentUser) return;
          const newBalance = (currentUser.wallet_balance ?? 0) + amount;
          set({ user: { ...currentUser, wallet_balance: newBalance } });

          try {
            const { doc, updateDoc, increment, addDoc, collection } = require('firebase/firestore');
            const { firestore } = require('../firebaseConfig');
            const cleanPhone = currentUser.phone ? currentUser.phone.trim() : '';
            const userDocId = currentUser.id || `usr_${cleanPhone.replace(/\D/g, '')}`;

            await updateDoc(doc(firestore, 'users', userDocId), {
              wallet_balance: increment(amount),
            });

            await addDoc(collection(firestore, 'wallet_transactions'), {
              user_id: userDocId,
              user_phone: cleanPhone,
              title,
              amount,
              type: 'CREDIT',
              timestamp: new Date().toISOString(),
            });
          } catch (e) {
            console.log('Notice syncing wallet credit with Firestore:', e);
          }

          const tx: WalletTransaction = {
            id: `tx_${Date.now()}`,
            type,
            title,
            amount,
            time: 'Just now',
          };
          const existing = get().walletTransactions;
          set({ walletTransactions: [tx, ...existing] });
        },
      }),
      {
        name: 'appStore',
        getStorage: () => AsyncStorage,
        partialize: state => ({
          user: state.user,
          subscriptions: state.subscriptions,
          activeSlot: state.activeSlot,
          orders: state.orders,
          walletTransactions: state.walletTransactions,
        }),
      }
    )
  )
);
