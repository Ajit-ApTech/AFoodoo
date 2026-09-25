import React, { createContext, useContext, useEffect, useState } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type ThemeMode = 'system' | 'light' | 'dark';

export interface ThemeColors {
  mode: 'light' | 'dark';
  background: string;
  surface: string;
  surfaceBorder: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  primary: string;
  primaryLight: string;
  primaryDark: string;
  accent: string;
  accentBadgeBg: string;
  cardBg: string;
  cardBorder: string;
  inputBg: string;
  inputBorder: string;
  inputText: string;
  statusSuccessBg: string;
  statusSuccessText: string;
  statusErrorBg: string;
  statusErrorText: string;
  bottomNavBg: string;
  bottomNavBorder: string;
  bottomNavActive: string;
  bottomNavInactive: string;
  buttonText: string;
  disabledBg: string;
  disabledText: string;
  heroGradient: [string, string];
  heroCardBorder: string;
  heroCardGlow: string;
  subCardBg: string;
  subCardBorder: string;
  menuCardBg: string;
  menuCardBorder: string;
  menuCardArrowBg: string;
  orderCardBg: string;
  orderCardBorder: string;
  orderCardArrowBg: string;
  walletCardBg: string;
  walletCardBorder: string;
  walletCardArrowBg: string;
  accountCardBg: string;
  accountCardBorder: string;
  accountCardArrowBg: string;
}

export const lightTheme: ThemeColors = {
  mode: 'light',
  background: '#F8F9FA',
  surface: '#FFFFFF',
  surfaceBorder: '#E5E7EB',
  textPrimary: '#111827',
  textSecondary: '#4B5563',
  textMuted: '#9CA3AF',
  primary: '#FA5A16',
  primaryLight: '#FFF4EC',
  primaryDark: '#D9450C',
  accent: '#16A34A',
  accentBadgeBg: '#DCFCE7',
  cardBg: '#FFFFFF',
  cardBorder: '#E5E7EB',
  inputBg: '#F3F4F6',
  inputBorder: '#E5E7EB',
  inputText: '#111827',
  statusSuccessBg: '#DCFCE7',
  statusSuccessText: '#15803D',
  statusErrorBg: '#FEE2E2',
  statusErrorText: '#B91C1C',
  bottomNavBg: '#FFFFFF',
  bottomNavBorder: '#F3F4F6',
  bottomNavActive: '#FA5A16',
  bottomNavInactive: '#9CA3AF',
  buttonText: '#FFFFFF',
  disabledBg: '#E5E7EB',
  disabledText: '#9CA3AF',
  heroGradient: ['#FFF5EB', '#FFE5D2'],
  heroCardBorder: '#FED7AA',
  heroCardGlow: 'rgba(250, 90, 22, 0.12)',
  subCardBg: '#F0FDF4',
  subCardBorder: '#DCFCE7',
  menuCardBg: '#FFF4EC',
  menuCardBorder: '#FED7AA',
  menuCardArrowBg: '#FFFFFF',
  orderCardBg: '#EFF6FF',
  orderCardBorder: '#BFDBFE',
  orderCardArrowBg: '#FFFFFF',
  walletCardBg: '#FEFCE8',
  walletCardBorder: '#FEF08A',
  walletCardArrowBg: '#FFFFFF',
  accountCardBg: '#F5F3FF',
  accountCardBorder: '#DDD6FE',
  accountCardArrowBg: '#FFFFFF',
};

export const darkTheme: ThemeColors = {
  mode: 'dark',
  background: '#0D1117',
  surface: '#161B22',
  surfaceBorder: 'rgba(255, 255, 255, 0.08)',
  textPrimary: '#F9FAFB',
  textSecondary: '#9CA3AF',
  textMuted: '#6B7280',
  primary: '#FA5A16',
  primaryLight: '#261C19',
  primaryDark: '#E04818',
  accent: '#22C55E',
  accentBadgeBg: '#143525',
  cardBg: '#161B22',
  cardBorder: 'rgba(255, 255, 255, 0.08)',
  inputBg: '#1C2128',
  inputBorder: '#30363D',
  inputText: '#F9FAFB',
  statusSuccessBg: '#143525',
  statusSuccessText: '#4ADE80',
  statusErrorBg: '#3E1A1A',
  statusErrorText: '#F87171',
  bottomNavBg: '#11141A',
  bottomNavBorder: 'rgba(255, 255, 255, 0.08)',
  bottomNavActive: '#FA5A16',
  bottomNavInactive: '#6B7280',
  buttonText: '#FFFFFF',
  disabledBg: '#21262D',
  disabledText: '#6B7280',
  heroGradient: ['#261B18', '#171518'],
  heroCardBorder: 'rgba(250, 90, 22, 0.35)',
  heroCardGlow: 'rgba(250, 90, 22, 0.25)',
  subCardBg: '#0E231B',
  subCardBorder: '#1A4330',
  menuCardBg: '#251B17',
  menuCardBorder: '#3D271F',
  menuCardArrowBg: '#382822',
  orderCardBg: '#14202E',
  orderCardBorder: '#1E3147',
  orderCardArrowBg: '#1F2F44',
  walletCardBg: '#262214',
  walletCardBorder: '#3E371E',
  walletCardArrowBg: '#3B341D',
  accountCardBg: '#201A29',
  accountCardBorder: '#342745',
  accountCardArrowBg: '#2F2340',
};

interface ThemeContextType {
  theme: ThemeColors;
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;
  isDark: boolean;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: lightTheme,
  themeMode: 'system',
  setThemeMode: () => {},
  isDark: false,
});

const THEME_STORAGE_KEY = 'afoodoo_theme_mode';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemColorScheme = useColorScheme();
  const [themeMode, setThemeModeState] = useState<ThemeMode>('system');

  useEffect(() => {
    AsyncStorage.getItem(THEME_STORAGE_KEY).then(stored => {
      if (stored === 'light' || stored === 'dark' || stored === 'system') {
        setThemeModeState(stored);
      }
    });
  }, []);

  const setThemeMode = (mode: ThemeMode) => {
    setThemeModeState(mode);
    AsyncStorage.setItem(THEME_STORAGE_KEY, mode);
  };

  const activeMode = themeMode === 'system' ? (systemColorScheme === 'dark' ? 'dark' : 'light') : themeMode;
  const isDark = activeMode === 'dark';
  const theme = isDark ? darkTheme : lightTheme;

  return (
    <ThemeContext.Provider value={{ theme, themeMode, setThemeMode, isDark }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
