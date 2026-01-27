import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, FlatList } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useAuctionNotifications } from '../hooks/useAuctionNotifications';
import type { RootStackParamList } from '../navigationTypes';
import { colors } from '../styles/sharedStyles';
import NotificationItem from '../components/NotificationItem';
import type { AuctionNotification } from '@shared/types';

export default function NotificationsScreen() {
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  const { user } = useAuth();
  const { showToast } = useToast();
  const userId = user?.uid ?? null;

  const { notifications, unreadCount, loading, markAsRead, markAllAsRead } = useAuctionNotifications(userId);
  const [busyIds, setBusyIds] = useState<Record<string, boolean>>({});
  const [bulkBusy, setBulkBusy] = useState(false);

  const headerSubtitle = useMemo(() => {
    if (loading) return 'Se încarcă...';
    if (!notifications.length) return 'Nicio notificare';
    if (!unreadCount) return `${notifications.length} notificări`;
    return `${unreadCount} necitite · ${notifications.length} total`;
  }, [loading, notifications.length, unreadCount]);

  const clearBusy = (id: string) => {
    setBusyIds((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const handlePressNotification = async (n: AuctionNotification) => {
    try {
      if (!n.read) {
        setBusyIds((prev) => ({ ...prev, [n.id]: true }));
        await markAsRead(n.id);
      }

      if (n.auctionId) {
        navigation.navigate('AuctionDetails', { auctionId: n.auctionId });
      } else {
        showToast({ type: 'info', title: 'Notificare', message: 'Această notificare nu are o țintă de navigare.' });
      }
    } catch (error) {
      console.error('[NotificationsScreen] Failed to open notification:', error);
      showToast({ type: 'error', title: 'Eroare', message: 'Nu am putut deschide notificarea.' });
    } finally {
      clearBusy(n.id);
    }
  };

  const handleMarkAsRead = async (notificationId: string) => {
    try {
      setBusyIds((prev) => ({ ...prev, [notificationId]: true }));
      await markAsRead(notificationId);
    } catch (error) {
      console.error('[NotificationsScreen] Failed to mark as read:', error);
      showToast({ type: 'error', title: 'Eroare', message: 'Nu am putut marca notificarea ca citită.' });
    } finally {
      clearBusy(notificationId);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      setBulkBusy(true);
      await markAllAsRead();
    } catch (error) {
      console.error('[NotificationsScreen] Failed to mark all as read:', error);
      showToast({ type: 'error', title: 'Eroare', message: 'Nu am putut marca toate notificările ca citite.' });
    } finally {
      setBulkBusy(false);
    }
  };

  if (!userId) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Notificări</Text>
          <Text style={styles.subtitle}>Trebuie să fii autentificat.</Text>
        </View>
        <View style={styles.center}>
          <Text style={styles.emptyText}>Conectează-te pentru a vedea notificările.</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.headerIconButton}
          accessibilityRole="button"
          accessibilityLabel="Înapoi"
        >
          <Ionicons name="arrow-back" size={20} color={colors.textPrimary} />
        </TouchableOpacity>

        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Notificări</Text>
          <Text style={styles.subtitle}>{headerSubtitle}</Text>
        </View>

        <TouchableOpacity
          onPress={handleMarkAllAsRead}
          disabled={bulkBusy || unreadCount === 0 || loading}
          style={[styles.headerActionButton, (bulkBusy || unreadCount === 0 || loading) && styles.headerActionButtonDisabled]}
          accessibilityRole="button"
          accessibilityLabel="Marchează toate ca citite"
        >
          {bulkBusy ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <Ionicons name="checkmark-done" size={20} color={colors.primary} />
          )}
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Se încarcă notificările...</Text>
        </View>
      ) : notifications.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="notifications-off-outline" size={28} color={colors.textSecondary} />
          <Text style={styles.emptyText}>Nu ai notificări încă.</Text>
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <NotificationItem
              notification={item}
              disabled={!!busyIds[item.id]}
              onPress={() => handlePressNotification(item)}
              onMarkAsRead={() => handleMarkAsRead(item.id)}
            />
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: 16,
  },
  header: {
    marginBottom: 16,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  headerIconButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.borderColor,
    backgroundColor: colors.inputBackground,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerActionButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.borderColor,
    backgroundColor: 'rgba(231, 183, 60, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerActionButtonDisabled: {
    opacity: 0.5,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  subtitle: {
    marginTop: 4,
    fontSize: 12,
    color: colors.textSecondary,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  loadingText: {
    marginTop: 12,
    color: colors.textSecondary,
    fontSize: 13,
  },
  emptyText: {
    marginTop: 12,
    color: colors.textSecondary,
    fontSize: 14,
    textAlign: 'center',
  },
  listContent: {
    paddingBottom: 96,
  },
});


