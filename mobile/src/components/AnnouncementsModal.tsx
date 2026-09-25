import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
} from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { firestore } from '../firebaseConfig';
import { collection, query, limit, onSnapshot } from 'firebase/firestore';
import { useAppStore } from '../store/appStore';

export interface AnnouncementItem {
  id: string;
  title: string;
  body: string;
  time: string;
  type?: 'promo' | 'update' | 'alert';
  timestamp?: string;
}

/**
 * Checks if a given ISO timestamp string occurred on today's calendar day.
 * Once the time crosses 12:00 AM midnight, this automatically returns false
 * for all notifications from previous days.
 */
function isToday(isoString?: string): boolean {
  if (!isoString) return false;
  const itemDate = new Date(isoString);
  if (isNaN(itemDate.getTime())) return false;

  const now = new Date();
  return (
    itemDate.getFullYear() === now.getFullYear() &&
    itemDate.getMonth() === now.getMonth() &&
    itemDate.getDate() === now.getDate()
  );
}

function formatRelativeTime(isoString?: string): string {
  if (!isoString) return 'Just now';
  const diffSec = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000);
  if (diffSec < 60) return 'Just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}h ago`;
  const diffDay = Math.floor(diffHour / 24);
  return `${diffDay}d ago`;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  onUnreadCountChange?: (count: number) => void;
}

export function AnnouncementsModal({ visible, onClose, onUnreadCountChange }: Props) {
  const { theme, isDark } = useTheme();
  const user = useAppStore(state => state.user);
  const setUnreadCountInStore = useAppStore(state => state.setUnreadAnnouncementsCount);
  const [items, setItems] = useState<AnnouncementItem[]>([]);

  const broadcastListRef = useRef<AnnouncementItem[]>([]);
  const orderUpdateListRef = useRef<AnnouncementItem[]>([]);

  // Filters to ONLY keep notifications pushed today (automatically cleared at 12:00 AM midnight)
  const syncAndFilter = useCallback(() => {
    const combined = [...orderUpdateListRef.current, ...broadcastListRef.current];

    // Deduplicate by ID
    const seen = new Set<string>();
    const unique = combined.filter(item => {
      if (seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    });

    // Auto-clear rule: Only keep notifications pushed today (resets at 12:00 AM midnight)
    const todayItems = unique.filter(item => isToday(item.timestamp));

    setItems(todayItems);
    onUnreadCountChange?.(todayItems.length);
    setUnreadCountInStore(todayItems.length);
  }, [onUnreadCountChange, setUnreadCountInStore]);

  useEffect(() => {
    let isMounted = true;

    // 1. Listen to broadcast_notifications in Cloud Firestore
    let unsubBroadcast: (() => void) | undefined;
    try {
      const bq = query(collection(firestore, 'broadcast_notifications'), limit(25));
      unsubBroadcast = onSnapshot(
        bq,
        snap => {
          if (!isMounted) return;
          broadcastListRef.current = snap.docs.map(doc => {
            const data = doc.data();
            return {
              id: `broadcast_${doc.id}`,
              title: `📢 ${data.title || 'Announcement'}`,
              body: data.body || '',
              time: formatRelativeTime(data.timestamp),
              type: 'promo' as const,
              timestamp: data.timestamp,
            };
          });
          syncAndFilter();
        },
        err => {
          console.log('Notice listening to broadcasts:', err.message);
        }
      );
    } catch (e) {}

    // 2. Listen to customer_notifications (live order updates for user)
    let unsubCustomer: (() => void) | undefined;
    try {
      const cleanPhone = (user?.phone || '').replace(/\D/g, '');
      const cq = query(collection(firestore, 'customer_notifications'), limit(25));
      unsubCustomer = onSnapshot(
        cq,
        snap => {
          if (!isMounted) return;
          orderUpdateListRef.current = snap.docs
            .map(doc => {
              const data = doc.data();
              const matchesUser =
                !data.user_phone ||
                data.user_phone === cleanPhone ||
                data.user_id === user?.id;
              if (!matchesUser) return null;

              return {
                id: `cust_notif_${doc.id}`,
                title: data.title || 'Order Update',
                body: data.body || '',
                time: formatRelativeTime(data.timestamp),
                type: 'update' as const,
                timestamp: data.timestamp,
              };
            })
            .filter(Boolean) as AnnouncementItem[];

          syncAndFilter();
        },
        err => {
          console.log('Notice listening to customer notifications:', err.message);
        }
      );
    } catch (e) {}

    // 3. Periodic midnight timer: Checks every 30 seconds to ensure that when time crosses
    // 12:00 AM midnight, all notifications from the previous day are automatically cleared.
    const midnightInterval = setInterval(() => {
      if (isMounted) {
        syncAndFilter();
      }
    }, 30000);

    return () => {
      isMounted = false;
      clearInterval(midnightInterval);
      if (unsubBroadcast) unsubBroadcast();
      if (unsubCustomer) unsubCustomer();
    };
  }, [user?.phone, user?.id, syncAndFilter]);

  // Re-sync when modal opens
  useEffect(() => {
    if (visible) {
      syncAndFilter();
    }
  }, [visible, syncAndFilter]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          activeOpacity={1}
          onPress={onClose}
        />
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: theme.surface,
              borderColor: theme.surfaceBorder,
            },
          ]}
        >
          {/* Header (No user clear button - notifications are controlled by Admin & auto-cleared at 12 AM) */}
          <View style={[styles.headerRow, { borderBottomColor: theme.surfaceBorder }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={{ fontSize: 20, marginRight: 8 }}>🔔</Text>
              <Text style={[styles.title, { color: theme.textPrimary }]}>Recent Announcements</Text>
            </View>

            <View
              style={[
                styles.todayPill,
                { backgroundColor: isDark ? 'rgba(255, 107, 0, 0.15)' : '#FFF0E6' },
              ]}
            >
              <Text style={[styles.todayPillText, { color: theme.primary }]}>Today</Text>
            </View>
          </View>

          {/* List */}
          {items.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={{ fontSize: 40, marginBottom: 12 }}>✨</Text>
              <Text style={[styles.emptyTitle, { color: theme.textPrimary }]}>All Caught Up!</Text>
              <Text style={[styles.emptySubtitle, { color: theme.textMuted }]}>
                No new announcements for today. All notifications auto-reset daily at 12:00 AM midnight.
              </Text>
            </View>
          ) : (
            <FlatList
              data={items}
              keyExtractor={item => item.id}
              contentContainerStyle={{ paddingVertical: 8 }}
              renderItem={({ item }) => (
                <View
                  style={[
                    styles.itemCard,
                    {
                      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.04)' : '#F9FAFB',
                      borderColor: theme.surfaceBorder,
                    },
                  ]}
                >
                  <View style={{ flex: 1 }}>
                    <View style={styles.itemHeader}>
                      <Text style={[styles.itemTitle, { color: theme.textPrimary }]}>{item.title}</Text>
                      <Text style={[styles.itemTime, { color: theme.textMuted }]}>{item.time}</Text>
                    </View>
                    <Text style={[styles.itemBody, { color: theme.textSecondary }]}>{item.body}</Text>
                  </View>
                </View>
              )}
            />
          )}

          {/* Close button */}
          <TouchableOpacity
            onPress={onClose}
            style={[styles.doneBtn, { backgroundColor: theme.primary }]}
            activeOpacity={0.8}
          >
            <Text style={styles.doneBtnText}>Done</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    maxHeight: '80%',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 32,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
  },
  todayPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  todayPillText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  itemCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginVertical: 6,
  },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  itemTitle: {
    fontSize: 14,
    fontWeight: '700',
    flex: 1,
  },
  itemTime: {
    fontSize: 11,
    fontWeight: '600',
    marginLeft: 6,
  },
  itemBody: {
    fontSize: 13,
    lineHeight: 18,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 36,
    paddingHorizontal: 24,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
  doneBtn: {
    marginTop: 14,
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
  },
  doneBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
});
