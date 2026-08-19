import React from 'react';
import { View, Text, ActivityIndicator, StyleSheet, TouchableOpacity } from 'react-native';
import { useTheme } from '../theme/ThemeContext';

interface LoadingProps {
  message?: string;
}

export function LoadingSpinner({ message = 'Loading...' }: LoadingProps) {
  const { theme } = useTheme();
  return (
    <View style={styles.centerContainer}>
      <ActivityIndicator size="large" color={theme.primary} />
      <Text style={[styles.loadingText, { color: theme.primary }]}>{message}</Text>
    </View>
  );
}

interface SkeletonProps {
  count?: number;
}

export function SkeletonCard({ count = 2 }: SkeletonProps) {
  const { theme } = useTheme();
  return (
    <View style={styles.skeletonContainer}>
      {Array.from({ length: count }).map((_, idx) => (
        <View
          key={idx}
          style={[
            styles.skeletonBox,
            { backgroundColor: theme.surface, borderColor: theme.surfaceBorder },
          ]}
        >
          <View style={[styles.skeletonLineShort, { backgroundColor: theme.inputBorder }]} />
          <View style={[styles.skeletonLineLong, { backgroundColor: theme.surfaceBorder }]} />
          <View style={[styles.skeletonLineMedium, { backgroundColor: theme.surfaceBorder }]} />
        </View>
      ))}
    </View>
  );
}

interface ErrorBannerProps {
  title?: string;
  message: string;
  onRetry?: () => void;
}

export function ErrorBanner({ title = 'Network Notice', message, onRetry }: ErrorBannerProps) {
  const { theme } = useTheme();
  return (
    <View
      style={[
        styles.errorCard,
        { backgroundColor: theme.primaryLight, borderColor: theme.accentBadgeBg },
      ]}
    >
      <Text style={[styles.errorTitle, { color: theme.accent }]}>⚠️ {title}</Text>
      <Text style={[styles.errorMessage, { color: theme.textPrimary }]}>{message}</Text>
      {onRetry ? (
        <TouchableOpacity
          style={[styles.retryButton, { backgroundColor: theme.primary }]}
          onPress={onRetry}
        >
          <Text style={[styles.retryText, { color: theme.buttonText }]}>Retry Connection 🔄</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  centerContainer: {
    paddingVertical: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    fontWeight: '600',
  },
  skeletonContainer: {
    paddingVertical: 10,
  },
  skeletonBox: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
  },
  skeletonLineShort: {
    width: '40%',
    height: 14,
    borderRadius: 6,
    marginBottom: 10,
  },
  skeletonLineLong: {
    width: '90%',
    height: 12,
    borderRadius: 6,
    marginBottom: 6,
  },
  skeletonLineMedium: {
    width: '65%',
    height: 12,
    borderRadius: 6,
  },
  errorCard: {
    borderRadius: 16,
    padding: 16,
    marginVertical: 12,
    borderWidth: 1,
  },
  errorTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
  },
  errorMessage: {
    fontSize: 13,
    lineHeight: 18,
  },
  retryButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    alignSelf: 'flex-start',
    marginTop: 12,
    minHeight: 44,
    justifyContent: 'center',
  },
  retryText: {
    fontSize: 13,
    fontWeight: '700',
  },
});
