import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, FlatList, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useNotifications } from '../hooks/useChat';
import type { RootStackParamList } from '../navigationTypes';
import { colors } from '../styles/sharedStyles';
import NotificationItem from '../components/NotificationItem';
import InlineBackButton from '../components/InlineBackButton';
import type { ChatNotification } from '@shared/types';
import { db } from '@shared/firebaseConfig';
import { collection, getDocs, writeBatch } from 'firebase/firestore';

export default function NotificationsScreen() {
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  const { user } = useAuth();
  const { showToast } = useToast();
  const userId = user?.uid ?? null;

  const { notifications, unreadCount, loading, markAsRead, markAllAsRead } = useNotifications(userId);
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

  const handlePressNotification = async (n: ChatNotification) => {
    try {
      if (!n.read) {
        setBusyIds((prev) => ({ ...prev, [n.id]: true }));
        await markAsRead(n.id);
      }

      if (n.conversationId) {
        navigation.navigate('Messages', { conversationId: n.conversationId });
      } else if (n.auctionId) {
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

  const handleClearAll = async () => {
    if (!userId) return;
    const confirmed = await new Promise<boolean>((resolve) => {
      Alert.alert(
        'Șterge toate notificările?',
        'Această acțiune nu poate fi anulată.',
        [
          { text: 'Renunță', style: 'cancel', onPress: () => resolve(false) },
          { text: 'Șterge', style: 'destructive', onPress: () => resolve(true) },
        ]
      );
    });

    if (!confirmed) return;

    try {
      setBulkBusy(true);
      const notifRef = collection(db, 'users', userId, 'notifications');
      const auctionRef = collection(db, 'users', userId, 'auctionNotifications');
      const [notifSnapshot, auctionSnapshot] = await Promise.all([
        getDocs(notifRef),
        getDocs(auctionRef),
      ]);
      const batch = writeBatch(db);
      notifSnapshot.docs.forEach((docSnap) => batch.delete(docSnap.ref));
      auctionSnapshot.docs.forEach((docSnap) => batch.delete(docSnap.ref));
      await batch.commit();
    } catch (error) {
      console.error('[NotificationsScreen] Failed to clear notifications:', error);
      showToast({ type: 'error', title: 'Eroare', message: 'Nu am putut șterge notificările.' });
    } finally {
      setBulkBusy(false);
    }
  };

  if (!userId) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Notificări</Text>
          <Text style={styles.subtitle}>Trebuie să fie autentificat.</Text>
        </View>
        <View style={styles.center}>
          <Text style={styles.emptyText}>Conectați-vă pentru a vedea notificările.</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <InlineBackButton />
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Notificări</Text>
          <Text style={styles.subtitle}>{headerSubtitle}</Text>
        </View>

        <View style={styles.headerActions}>
          <TouchableOpacity
            onPress={() => navigation.navigate('Settings')}
            style={styles.headerActionButton}
            accessibilityRole="button"
            accessibilityLabel="Setări notificări"
          >
            <Ionicons name="settings-outline" size={20} color={colors.primary} />
          </TouchableOpacity>
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
          <TouchableOpacity
            onPress={handleClearAll}
            disabled={bulkBusy || loading || notifications.length === 0}
            style={[styles.headerActionButton, (bulkBusy || loading || notifications.length === 0) && styles.headerActionButtonDisabled]}
            accessibilityRole="button"
            accessibilityLabel="Șterge notificările"
          >
            <Ionicons name="trash-outline" size={20} color={colors.primary} />
          </TouchableOpacity>
        </View>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Se încarcă notificările...</Text>
        </View>
      ) : notifications.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="notifications-off-outline" size={28} color={colors.textSecondary} />
          <Text style={styles.emptyText}>Nu există notificări încă.</Text>
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
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
});


