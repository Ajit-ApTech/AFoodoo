import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '../theme/ThemeContext';

export type BottomTabType = 'Home' | 'Orders' | 'Wallet' | 'Account';

interface Props {
  currentTab: BottomTabType;
  onSelectTab: (tab: BottomTabType) => void;
  orderBadge?: number;
}

export function BottomNavBar({ currentTab, onSelectTab, orderBadge }: Props) {
  const { theme, isDark } = useTheme();

  const tabs: { key: BottomTabType; label: string; icon: string }[] = [
    { key: 'Home', label: 'Home', icon: '🏠' },
    { key: 'Orders', label: 'Orders', icon: '🧾' },
    { key: 'Wallet', label: 'Wallet', icon: '💳' },
    { key: 'Account', label: 'Account', icon: '👤' },
  ];

  return (
    <View
      style={[
        styles.navContainer,
        {
          backgroundColor: theme.bottomNavBg,
          borderTopColor: theme.bottomNavBorder,
        },
      ]}
    >
      {tabs.map(tab => {
        const isActive = currentTab === tab.key;
        return (
          <TouchableOpacity
            key={tab.key}
            onPress={() => onSelectTab(tab.key)}
            style={styles.tabButton}
            activeOpacity={0.7}
          >
            <View style={styles.iconWrap}>
              <Text
                style={[
                  styles.tabIcon,
                  {
                    opacity: isActive ? 1 : 0.6,
                    transform: [{ scale: isActive ? 1.08 : 1 }],
                  },
                ]}
              >
                {tab.icon}
              </Text>
              {tab.key === 'Orders' && Boolean(orderBadge && orderBadge > 0) && (
                <View style={[styles.badgeDot, { backgroundColor: theme.primary }]} />
              )}
            </View>
            <Text
              style={[
                styles.tabLabel,
                {
                  color: isActive ? theme.primary : theme.bottomNavInactive,
                  fontWeight: isActive ? '800' : '600',
                },
              ]}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  navContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    height: 62,
    borderTopWidth: 1,
    paddingHorizontal: 8,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
  },
  iconWrap: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabIcon: {
    fontSize: 20,
    marginBottom: 2,
  },
  tabLabel: {
    fontSize: 11,
    letterSpacing: 0.2,
  },
  badgeDot: {
    position: 'absolute',
    top: -2,
    right: -4,
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
});
