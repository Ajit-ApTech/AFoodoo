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
  buttonText: string;
  disabledBg: string;
  disabledText: string;
}

export const lightTheme: ThemeColors = {
  mode: 'light',
  background: '#FAF7F2',
  surface: '#FFFFFF',
  surfaceBorder: '#EEEEEE',
  textPrimary: '#2C2C2C',
  textSecondary: '#616161',
  textMuted: '#9E9E9E',
  primary: '#D84315',
  primaryLight: '#FFF3E0',
  primaryDark: '#BF360C',
  accent: '#E65100',
  accentBadgeBg: '#FFE0B2',
  cardBg: '#FFFFFF',
  cardBorder: '#EEEEEE',
  inputBg: '#FAF9F6',
  inputBorder: '#E0E0E0',
  inputText: '#2C2C2C',
  statusSuccessBg: '#E8F5E9',
  statusSuccessText: '#2E7D32',
  statusErrorBg: '#FFEBEE',
  statusErrorText: '#C62828',
  bottomNavBg: '#FFFFFF',
  bottomNavBorder: '#EEEEEE',
  buttonText: '#FFFFFF',
  disabledBg: '#E0E0E0',
  disabledText: '#9E9E9E',
};

export const darkTheme: ThemeColors = {
  mode: 'dark',
  background: '#121212',
  surface: '#1E1E1E',
  surfaceBorder: '#2C2C2C',
  textPrimary: '#F5F5F5',
  textSecondary: '#B0BEC5',
  textMuted: '#78909C',
  primary: '#FF7043',
  primaryLight: '#2C1B17',
  primaryDark: '#D84315',
  accent: '#FF9800',
  accentBadgeBg: '#3E2723',
  cardBg: '#1E1E1E',
  cardBorder: '#2C2C2C',
  inputBg: '#262626',
  inputBorder: '#3C3C3C',
  inputText: '#F5F5F5',
  statusSuccessBg: '#1B382B',
  statusSuccessText: '#81C784',
  statusErrorBg: '#3E1A1A',
  statusErrorText: '#E57373',
  bottomNavBg: '#1E1E1E',
  bottomNavBorder: '#2C2C2C',
  buttonText: '#FFFFFF',
  disabledBg: '#37474F',
  disabledText: '#78909C',
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
