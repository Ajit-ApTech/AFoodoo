import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MealSlot, MenuItem, User, Subscription } from '../types';

interface AppState {
  user: User | null;
  setUser: (user: User | null) => void;
  activeSlot: MealSlot | null;
  setActiveSlot: (slot: MealSlot | null) => void;
  menuItems: MenuItem[];
  setMenuItems: (items: MenuItem[]) => void;
  subscriptions: Subscription[];
  setSubscriptions: (subs: Subscription[]) => void;
}

export const useAppStore = create<AppState>()(
  devtools(
    persist(
      (set, get) => ({
        user: null,
        setUser: user => set({ user }),
        activeSlot: null,
        setActiveSlot: slot => set({ activeSlot: slot }),
        menuItems: [],
        setMenuItems: items => set({ menuItems: items }),
        subscriptions: [],
        setSubscriptions: subs => set({ subscriptions: subs }),
      }),
      {
        name: 'appStore', // storage key
        getStorage: () => AsyncStorage,
        // whitelist what we persist (user & subscriptions & activeSlot)
        partialize: (state) => ({
          user: state.user,
          subscriptions: state.subscriptions,
          activeSlot: state.activeSlot,
        }),
      }
    )
  )
);
