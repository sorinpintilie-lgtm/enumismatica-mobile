import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Switch } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../../navigationTypes';
import { getAdminNotifications, subscribeToAdminNotifications, markNotificationAsRead, markNotificationActionTaken, AdminNotification, NotificationSeverity } from '@shared/adminNotificationService';
import { isAdmin } from '@shared/adminService';
import { formatDistanceToNow } from 'date-fns';
import { ro } from 'date-fns/locale';
import { Picker } from '@react-native-picker/picker';

export default function NotificationsScreen() {
  const { user, loading: authLoading } = useAuth();
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [realtimeEnabled, setRealtimeEnabled] = useState(true);
  const [filterSeverity, setFilterSeverity] = useState<NotificationSeverity | 'all'>('all');
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);
  const [expandedNotification, setExpandedNotification] = useState<string | null>(null);
  const [isAdminUser, setIsAdminUser] = useState(false);

  useEffect(() => {
    const checkAdmin = async () => {
      if (!user) {
        navigation.navigate('Dashboard' as never);
        return;
      }

      const adminStatus = await isAdmin(user.uid);
      if (!adminStatus) {
        navigation.navigate('Dashboard' as never);
        return;
      }

      setIsAdminUser(true);
    };

    if (!authLoading) {
      checkAdmin();
    }
  }, [user, authLoading, navigation]);

  useEffect(() => {
    if (isAdminUser && !realtimeEnabled) {
      loadNotifications();
    }
  }, [isAdminUser, filterSeverity, showUnreadOnly, realtimeEnabled]);

  useEffect(() => {
    if (!isAdminUser || !realtimeEnabled) return;

    const filters: any = {};
    if (filterSeverity !== 'all') {
      filters.severity = filterSeverity;
    }
    if (showUnreadOnly) {
      filters.unreadOnly = true;
    }

    const unsubscribe = subscribeToAdminNotifications(
      (newNotifications: AdminNotification[]) => {
        setNotifications(newNotifications);
        setLoading(false);
      },
      filters,
      (error: unknown) => {
        console.error('Realtime notifications error:', error);
      }
    );

    return () => unsubscribe();
  }, [isAdminUser, realtimeEnabled, filterSeverity, showUnreadOnly]);

  const loadNotifications = async () => {
    try {
      setLoading(true);
      const filters: any = { limit: 100 };
      if (filterSeverity !== 'all') {
        filters.severity = filterSeverity;
      }
      if (showUnreadOnly) {
        filters.unreadOnly = true;
      }

      const fetchedNotifications = await getAdminNotifications(filters);
      setNotifications(fetchedNotifications);
    } catch (error) {
      console.error('Failed to load notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAsRead = async (notificationId: string) => {
    try {
      await markNotificationAsRead(notificationId);
      if (!realtimeEnabled) {
        await loadNotifications();
      }
    } catch (error) {
      console.error('Failed to mark as read:', error);
    }
  };

  const handleMarkActionTaken = async (notificationId: string) => {
    if (!user) return;
    try {
      await markNotificationActionTaken(notificationId, user.uid);
      if (!realtimeEnabled) {
        await loadNotifications();
      }
    } catch (error) {
      console.error('Failed to mark action taken:', error);
    }
  };

  const getSeverityColor = (severity: NotificationSeverity): { backgroundColor: string; color: string; borderColor: string } => {
    switch (severity) {
      case 'critical':
        return { backgroundColor: 'rgba(239, 68, 68, 0.2)', color: 'rgba(248, 113, 113, 1)', borderColor: 'rgba(239, 68, 68, 0.3)' };
      case 'security':
        return { backgroundColor: 'rgba(249, 115, 22, 0.2)', color: 'rgba(251, 146, 60, 1)', borderColor: 'rgba(249, 115, 22, 0.3)' };
      case 'warning':
        return { backgroundColor: 'rgba(245, 158, 11, 0.2)', color: 'rgba(251, 191, 36, 1)', borderColor: 'rgba(245, 158, 11, 0.3)' };
      case 'info':
        return { backgroundColor: 'rgba(59, 130, 246, 0.2)', color: 'rgba(96, 165, 250, 1)', borderColor: 'rgba(59, 130, 246, 0.3)' };
      default:
        return { backgroundColor: 'rgba(100, 116, 139, 0.2)', color: 'rgba(148, 163, 184, 1)', borderColor: 'rgba(100, 116, 139, 0.3)' };
    }
  };

  const getSeverityIcon = (severity: NotificationSeverity): string => {
    switch (severity) {
      case 'critical':
        return '!!!';
      case 'security':
        return 'SEC';
      case 'warning':
        return 'WARN';
      case 'info':
        return 'INFO';
      default:
        return '?';
    }
  };

  if (authLoading || !isAdminUser) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#D4AF37" />
      </View>
    );
  }

  const unreadCount = notifications.filter((n) => !n.read).length;
  const criticalCount = notifications.filter((n) => n.severity === 'critical' && !n.actionTaken).length;

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Notificări Admin</Text>
        <Text style={styles.subtitle}>Alerte și notificări pentru evenimente critice</Text>
      </View>

      {/* Stats */}
      <View style={styles.statsContainer}>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Total Notificări</Text>
          <Text style={styles.statValue}>{notifications.length}</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Necitite</Text>
          <Text style={[styles.statValue, { color: '#60A5FA' }]}>{unreadCount}</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Critice</Text>
          <Text style={[styles.statValue, { color: '#F87171' }]}>{criticalCount}</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Securitate</Text>
          <Text style={[styles.statValue, { color: '#FB923C' }]}>
            {notifications.filter((n) => n.severity === 'security').length}
          </Text>
        </View>
      </View>

      {/* Filters */}
      <View style={styles.filtersContainer}>
        <View style={styles.filterGroup}>
          <Text style={styles.filterLabel}>Severitate</Text>
          <View style={styles.pickerContainer}>
            <Picker
              selectedValue={filterSeverity}
              onValueChange={(itemValue) => setFilterSeverity(itemValue as any)}
              style={styles.picker}
              dropdownIconColor="#D4AF37"
            >
              <Picker.Item label="Toate" value="all" />
              <Picker.Item label="Critice" value="critical" />
              <Picker.Item label="Securitate" value="security" />
              <Picker.Item label="Avertismente" value="warning" />
              <Picker.Item label="Informații" value="info" />
            </Picker>
          </View>
        </View>

        <View style={styles.filterGroup}>
          <Text style={styles.filterLabel}>Filtru</Text>
          <TouchableOpacity
            onPress={() => setShowUnreadOnly(!showUnreadOnly)}
            style={[styles.filterButton, showUnreadOnly ? styles.activeButton : styles.inactiveButton]}
          >
            <Text style={showUnreadOnly ? styles.activeButtonText : styles.inactiveButtonText}>
              {showUnreadOnly ? 'Doar Necitite' : 'Toate'}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.filterGroup}>
          <Text style={styles.filterLabel}>Actualizare</Text>
          <TouchableOpacity
            onPress={() => setRealtimeEnabled(!realtimeEnabled)}
            style={[styles.filterButton, realtimeEnabled ? styles.liveButton : styles.inactiveButton]}
          >
            <Text style={realtimeEnabled ? styles.liveButtonText : styles.inactiveButtonText}>
              {realtimeEnabled ? 'LIVE' : 'Pauzat'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Notifications List */}
      <View style={styles.notificationsContainer}>
        {loading ? (
          <View style={styles.loadingIndicator}>
            <ActivityIndicator size="large" color="#D4AF37" />
            <Text style={styles.loadingText}>Se încarcă notificările...</Text>
          </View>
        ) : notifications.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>Nu există notificări</Text>
          </View>
        ) : (
          notifications.map((notification) => (
            <View
              key={notification.id}
              style={[styles.notificationCard, {
                borderColor: notification.read ? 'rgba(212, 175, 55, 0.1)' : 'rgba(212, 175, 55, 0.3)',
                opacity: notification.read ? 0.75 : 1
              }]}
            >
              <TouchableOpacity
                onPress={() => {
                  const nextId: string | null =
                    expandedNotification === notification.id ? null : (notification.id ?? null);
                  setExpandedNotification(nextId);
                }}
              >
                <View style={styles.notificationHeader}>
                  <View style={styles.notificationContent}>
                    <View style={styles.notificationTags}>
                      <View style={[styles.severityBadge, getSeverityColor(notification.severity)]}>
                        <Text style={[styles.severityText, { color: getSeverityColor(notification.severity).color }]}>
                          {getSeverityIcon(notification.severity)}
                        </Text>
                      </View>
                      <Text style={styles.notificationTitle}>{notification.title}</Text>
                      {!notification.read && (
                        <View style={styles.newBadge}>
                          <Text style={styles.newBadgeText}>NOU</Text>
                        </View>
                      )}
                      {notification.actionTaken && (
                        <View style={styles.resolvedBadge}>
                          <Text style={styles.resolvedBadgeText}>REZOLVAT</Text>
                        </View>
                      )}
                      <Text style={styles.notificationTime}>
                        {formatDistanceToNow(notification.createdAt.toDate(), { addSuffix: true, locale: ro })}
                      </Text>
                    </View>

                    <Text style={styles.notificationMessage}>{notification.message}</Text>

                    {notification.userEmail && (
                      <View style={styles.userInfo}>
                        <Text style={styles.userLabel}>Utilizator: </Text>
                        <Text style={styles.userEmail}>{notification.userEmail}</Text>
                      </View>
                    )}

                    <View style={styles.notificationActions}>
                      {!notification.read && (
                        <TouchableOpacity
                          onPress={(e) => {
                            e.stopPropagation();
                            handleMarkAsRead(notification.id!);
                          }}
                          style={[styles.actionButton, { borderColor: 'rgba(59, 130, 246, 0.3)', backgroundColor: 'rgba(59, 130, 246, 0.2)' }]}
                        >
                          <Text style={[styles.actionButtonText, { color: 'rgba(96, 165, 250, 1)' }]}>
                            Marchează ca citit
                          </Text>
                        </TouchableOpacity>
                      )}
                      {!notification.actionTaken && (
                        <TouchableOpacity
                          onPress={(e) => {
                            e.stopPropagation();
                            handleMarkActionTaken(notification.id!);
                          }}
                          style={[styles.actionButton, { borderColor: 'rgba(34, 197, 94, 0.3)', backgroundColor: 'rgba(34, 197, 94, 0.2)' }]}
                        >
                          <Text style={[styles.actionButtonText, { color: 'rgba(74, 222, 128, 1)' }]}>
                            Marchează ca rezolvat
                          </Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>

                  <TouchableOpacity
                    onPress={() => {
                      const nextId: string | null =
                        expandedNotification === notification.id ? null : (notification.id ?? null);
                      setExpandedNotification(nextId);
                    }}
                  >
                    <Text style={styles.expandIcon}>
                      {expandedNotification === notification.id ? '▼' : '▶'}
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Expanded Details */}
                {expandedNotification === notification.id && notification.metadata && (
                  <View style={styles.expandedDetails}>
                    <View style={styles.metadataContainer}>
                      <Text style={styles.metadataTitle}>Detalii Metadata:</Text>
                      <Text style={styles.metadataContent}>{JSON.stringify(notification.metadata, null, 2)}</Text>
                    </View>
                  </View>
                )}
              </TouchableOpacity>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A192F',
    padding: 16,
  },
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#94A3B8',
  },
  statsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  statCard: {
    width: '48%',
    backgroundColor: 'rgba(10, 25, 47, 0.5)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.2)',
    padding: 16,
    marginBottom: 12,
  },
  statLabel: {
    fontSize: 14,
    color: '#94A3B8',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  filtersContainer: {
    backgroundColor: 'rgba(10, 25, 47, 0.5)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.2)',
    padding: 16,
    marginBottom: 16,
  },
  filterGroup: {
    marginBottom: 16,
  },
  filterLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#94A3B8',
    marginBottom: 8,
  },
  pickerContainer: {
    backgroundColor: 'rgba(30, 41, 59, 1)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.3)',
    overflow: 'hidden',
  },
  picker: {
    color: '#FFFFFF',
    height: 50,
  },
  filterButton: {
    padding: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeButton: {
    backgroundColor: 'rgba(59, 130, 246, 1)',
  },
  liveButton: {
    backgroundColor: 'rgba(34, 197, 94, 1)',
  },
  inactiveButton: {
    backgroundColor: 'rgba(30, 41, 59, 1)',
  },
  activeButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  liveButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  inactiveButtonText: {
    color: '#94A3B8',
    fontWeight: '600',
  },
  notificationsContainer: {
    marginTop: 8,
  },
  notificationCard: {
    backgroundColor: 'rgba(10, 25, 47, 0.5)',
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
  },
  notificationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  notificationContent: {
    flex: 1,
  },
  notificationTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  severityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  severityText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  notificationTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  newBadge: {
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.3)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  newBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: 'rgba(96, 165, 250, 1)',
  },
  resolvedBadge: {
    backgroundColor: 'rgba(34, 197, 94, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.3)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  resolvedBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: 'rgba(74, 222, 128, 1)',
  },
  notificationTime: {
    fontSize: 12,
    color: '#94A3B8',
  },
  notificationMessage: {
    fontSize: 14,
    color: '#94A3B8',
    marginBottom: 8,
  },
  userInfo: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  userLabel: {
    fontSize: 12,
    color: '#94A3B8',
  },
  userEmail: {
    fontSize: 12,
    color: '#D4AF37',
    fontFamily: 'monospace',
  },
  notificationActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  actionButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
  },
  actionButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  expandIcon: {
    color: '#94A3B8',
    fontSize: 16,
    marginLeft: 8,
  },
  expandedDetails: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(212, 175, 55, 0.2)',
  },
  metadataContainer: {
    backgroundColor: 'rgba(17, 24, 39, 0.5)',
    borderRadius: 10,
    padding: 12,
  },
  metadataTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#D4AF37',
    marginBottom: 8,
  },
  metadataContent: {
    fontSize: 10,
    color: '#94A3B8',
    fontFamily: 'monospace',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0A192F',
  },
  loadingIndicator: {
    alignItems: 'center',
    padding: 24,
  },
  loadingText: {
    color: '#94A3B8',
    marginTop: 12,
    fontSize: 14,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: 'rgba(10, 25, 47, 0.5)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.2)',
  },
  emptyText: {
    color: '#94A3B8',
    fontSize: 16,
  },
});
