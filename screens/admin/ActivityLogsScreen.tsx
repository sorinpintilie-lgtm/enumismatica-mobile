import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, TextInput } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { useAuth } from '../../context/AuthContext';
import { RootStackParamList } from '../../navigationTypes';
import { isAdmin, isSuperAdmin } from '@shared/adminService';
import {
  getActivityLogs,
  subscribeToActivityLogs,
  searchActivityLogs,
  ActivityLog,
  ActivityEventType,
  ActivityLogFilter,
} from '@shared/activityLogService';
import { formatDistanceToNow } from 'date-fns';
import { ro } from 'date-fns/locale';
import InlineBackButton from '../../components/InlineBackButton';

const EVENT_TYPE_LABELS: Record<ActivityEventType, string> = {
  // Authentication
  user_login: '[AUTH] Autentificare',
  user_logout: '[AUTH] Deconectare',
  user_register: '[AUTH] Înregistrare',
  password_reset_request: '[AUTH] Cerere resetare parolă',
  password_reset_complete: '[AUTH] Parolă resetată',
  email_verification: '[AUTH] Verificare email',
  // Navigation
  page_view: '[NAV] Vizualizare pagină',
  page_leave: '[NAV] Părăsire pagină',
  // Products
  product_view: '[PROD] Vizualizare piesă',
  product_search: '[PROD] Căutare piese',
  product_filter: '[PROD] Filtrare piese',
  product_create: '[PROD] Creare piesă',
  product_update: '[PROD] Actualizare piesă',
  product_delete: '[PROD] Ștergere piesă',
  product_buy: '[PROD] Cumpărare piesă',
  // Auctions
  auction_view: '[AUCT] Vizualizare licitație',
  auction_create: '[AUCT] Creare licitație',
  auction_bid: '[AUCT] Licitare',
  auction_auto_bid_set: '[AUCT] Setare licitare automată',
  auction_auto_bid_cancel: '[AUCT] Anulare licitare automată',
  auction_end: '[AUCT] Închidere licitație',
  auction_win: '[AUCT] Câștig licitație',
  // Collection
  collection_add: '[COLL] Adăugare în colecție',
  collection_remove: '[COLL] Eliminare din colecție',
  collection_view: '[COLL] Vizualizare colecție',
  // Chat
  message_send: '[CHAT] Trimitere mesaj',
  message_read: '[CHAT] Citire mesaj',
  conversation_start: '[CHAT] Început conversație',
  // Admin
  admin_user_view: '[ADMIN] Vizualizare utilizator',
  admin_user_edit: '[ADMIN] Editare utilizator',
  admin_user_delete: '[ADMIN] Ștergere utilizator',
  admin_user_ban: '[ADMIN] Blocare utilizator',
  admin_user_unban: '[ADMIN] Deblocare utilizator',
  admin_password_reset: '[ADMIN] Resetare parolă',
  admin_role_change: '[ADMIN] Schimbare rol',
  admin_auction_edit: '[ADMIN] Editare licitație',
  admin_auction_cancel: '[ADMIN] Anulare licitație',
  admin_product_edit: '[ADMIN] Editare piesă',
  admin_product_delete: '[ADMIN] Ștergere piesă',
  admin_logs_view: '[ADMIN] Vizualizare loguri',
  admin_analytics_access: '[ADMIN] Acces panou analitice',
  // Errors
  error_occurred: '[ERROR] Eroare',
  api_error: '[ERROR] Eroare API',
  payment_error: '[ERROR] Eroare plată',
  security_error: '[SECURITY] Eroare de securitate',
  // Security
  suspicious_activity: '[SECURITY] Activitate suspectă',
  rate_limit_exceeded: '[SECURITY] Limită de rate depășită',
  unauthorized_access_attempt: '[SECURITY] Tentativă acces neautorizat',
};

const EVENT_CATEGORIES = {
  'Toate': [],
  'Autentificare': ['user_login', 'user_logout', 'user_register', 'password_reset_request', 'password_reset_complete', 'email_verification'],
  'Navigare': ['page_view', 'page_leave'],
  'Piese': ['product_view', 'product_search', 'product_filter', 'product_create', 'product_update', 'product_delete', 'product_buy'],
  'Licitații': ['auction_view', 'auction_create', 'auction_bid', 'auction_auto_bid_set', 'auction_auto_bid_cancel', 'auction_end', 'auction_win'],
  'Colecție': ['collection_add', 'collection_remove', 'collection_view'],
  'Chat': ['message_send', 'message_read', 'conversation_start'],
  'Admin': ['admin_user_view', 'admin_user_edit', 'admin_user_delete', 'admin_user_ban', 'admin_user_unban', 'admin_password_reset', 'admin_role_change', 'admin_auction_edit', 'admin_auction_cancel', 'admin_product_edit', 'admin_product_delete', 'admin_logs_view'],
  'Erori': ['error_occurred', 'api_error', 'payment_error'],
  'Securitate': ['suspicious_activity', 'rate_limit_exceeded', 'unauthorized_access_attempt'],
};

type ActivityLogsScreenNavigationProp = StackNavigationProp<RootStackParamList>;

export default function ActivityLogsScreen() {
  const { user, loading: authLoading } = useAuth();
  const navigation = useNavigation<ActivityLogsScreenNavigationProp>();
  const [isAdminUser, setIsAdminUser] = useState(false);
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('Toate');
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [realTimeEnabled, setRealTimeEnabled] = useState(false);
  const [expandedLog, setExpandedLog] = useState<string | null>(null);

  useEffect(() => {
    const checkAdminAndLoad = async () => {
      if (!user) {
        navigation.navigate('Login' as never);
        return;
      }

      const adminStatus = await isAdmin(user.uid);
      if (!adminStatus) {
        navigation.navigate('Dashboard' as never);
        return;
      }

      // Detailed activity logs are restricted to super-admins.
      const superAdminStatus = await isSuperAdmin(user.uid);
      if (!superAdminStatus) {
        navigation.navigate('AdminModerator' as never);
        return;
      }

      setIsAdminUser(true);
      await loadLogs();
      setLoading(false);
    };

    if (!authLoading) {
      checkAdminAndLoad();
    }
  }, [user, authLoading, navigation]);

  useEffect(() => {
    if (isAdminUser) {
      loadLogs();
    }
  }, [selectedCategory, selectedUserId]);

  useEffect(() => {
    if (!isAdminUser || !realTimeEnabled) return;

    const filter: ActivityLogFilter = {
      limit: 100,
    };

    if (selectedUserId) {
      filter.userId = selectedUserId;
    }

    if (selectedCategory !== 'Toate') {
      filter.eventType = EVENT_CATEGORIES[selectedCategory as keyof typeof EVENT_CATEGORIES] as ActivityEventType[];
    }

    const unsubscribe = subscribeToActivityLogs(
      filter,
      (newLogs: ActivityLog[]) => {
        setLogs(newLogs);
      },
      (error: unknown) => {
        console.error('Real-time logs error:', error);
      }
    );

    return () => unsubscribe();
  }, [user, realTimeEnabled, selectedCategory, selectedUserId]);

  const loadLogs = async () => {
    try {
      setLoading(true);
      const filter: ActivityLogFilter = {
        limit: 100,
      };

      if (selectedUserId) {
        filter.userId = selectedUserId;
      }

      if (selectedCategory !== 'Toate') {
        filter.eventType = EVENT_CATEGORIES[selectedCategory as keyof typeof EVENT_CATEGORIES] as ActivityEventType[];
      }

      const { logs: fetchedLogs } = await getActivityLogs(filter);
      setLogs(fetchedLogs);
    } catch (error) {
      console.error('Failed to load logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!searchTerm.trim()) {
      loadLogs();
      return;
    }

    try {
      setLoading(true);
      const filter: ActivityLogFilter = {};

      if (selectedUserId) {
        filter.userId = selectedUserId;
      }

      const results = await searchActivityLogs(searchTerm, filter);
      setLogs(results);
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const getEventColor = (eventType: ActivityEventType): string => {
    if (eventType.startsWith('admin_')) return '#a855f7';
    if (eventType.includes('error') || eventType.includes('suspicious')) return '#f87171';
    if (eventType.includes('login') || eventType.includes('register')) return '#4ade80';
    if (eventType.includes('bid') || eventType.includes('auction')) return '#fbbf24';
    return '#60a5fa';
  };

  const getEventBadgeColor = (eventType: ActivityEventType): string => {
    if (eventType.startsWith('admin_')) return 'rgba(168, 85, 247, 0.2)';
    if (eventType.includes('error') || eventType.includes('suspicious')) return 'rgba(248, 113, 113, 0.2)';
    if (eventType.includes('login') || eventType.includes('register')) return 'rgba(74, 222, 128, 0.2)';
    if (eventType.includes('bid') || eventType.includes('auction')) return 'rgba(251, 191, 36, 0.2)';
    return 'rgba(96, 165, 250, 0.2)';
  };

  if (authLoading || loading || !isAdminUser) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#e7b73c" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <InlineBackButton label="Înapoi la Admin" onPress={() => navigation.navigate('AdminDashboard' as never)} />
          <Text style={styles.title}>Loguri Activitate</Text>
          <Text style={styles.subtitle}>Monitorizare completă a activității utilizatorilor</Text>
        </View>

        {/* Controls */}
        <View style={styles.controls}>
          <View style={styles.controlRow}>
            {/* Search */}
            <View style={styles.controlItem}>
              <Text style={styles.controlLabel}>Căutare</Text>
              <View style={styles.searchRow}>
                <TextInput
                  style={styles.searchInput}
                  value={searchTerm}
                  onChangeText={setSearchTerm}
                  onSubmitEditing={handleSearch}
                  placeholder="Caută în loguri..."
                />
                <TouchableOpacity style={styles.searchButton} onPress={handleSearch}>
                  <Text style={styles.searchButtonText}>Caută</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Category Filter */}
            <View style={styles.controlItem}>
              <Text style={styles.controlLabel}>Categorie</Text>
              <View style={styles.dropdownContainer}>
                <TextInput
                  style={styles.dropdown}
                  value={selectedCategory}
                  onChangeText={setSelectedCategory}
                />
              </View>
            </View>

            {/* User Filter */}
            <View style={styles.controlItem}>
              <Text style={styles.controlLabel}>Utilizator ID</Text>
              <TextInput
                style={styles.textInput}
                value={selectedUserId}
                onChangeText={setSelectedUserId}
                placeholder="ID utilizator..."
              />
            </View>

            {/* Real-time Toggle */}
            <View style={styles.controlItem}>
              <Text style={styles.controlLabel}>Actualizare</Text>
              <TouchableOpacity
                style={[styles.toggleButton, realTimeEnabled ? styles.toggleButtonActive : styles.toggleButtonInactive]}
                onPress={() => setRealTimeEnabled(!realTimeEnabled)}
              >
                <Text style={styles.toggleButtonText}>{realTimeEnabled ? 'LIVE' : 'Pauzat'}</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Stats */}
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{logs.length}</Text>
              <Text style={styles.statLabel}>Total Evenimente</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{new Set(logs.map((l) => l.userId)).size}</Text>
              <Text style={styles.statLabel}>Utilizatori Unici</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, styles.statValuePurple]}>{logs.filter((l) => l.isAdmin).length}</Text>
              <Text style={styles.statLabel}>Acțiuni Admin</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, styles.statValueRed]}>
                {logs.filter((l) => l.eventType.includes('error') || l.eventType.includes('suspicious')).length}
              </Text>
              <Text style={styles.statLabel}>Erori/Alerte</Text>
            </View>
          </View>
        </View>

        {/* Logs List */}
        <View style={styles.logsList}>
          {loading ? (
            <View style={styles.loadingIndicator}>
              <ActivityIndicator size="large" color="#e7b73c" />
              <Text style={styles.loadingText}>Se încarcă logurile...</Text>
            </View>
          ) : logs.length === 0 ? (
            <Text style={styles.emptyText}>Nu s-au găsit loguri</Text>
          ) : (
            logs.map((log) => (
              <View key={log.id} style={styles.logItem}>
                <TouchableOpacity
                  style={styles.logItemContent}
                  onPress={() => setExpandedLog(expandedLog === log.id ? null : log.id || null)}
                >
                  <View style={styles.logItemHeader}>
                    <View style={styles.logItemInfo}>
                      <View style={styles.logItemTypeRow}>
                        <Text style={[styles.logType, { color: getEventColor(log.eventType) }]}>
                          {EVENT_TYPE_LABELS[log.eventType]}
                        </Text>
                        {log.isAdmin && (
                          <Text style={styles.logAdminBadge}>ADMIN</Text>
                        )}
                        <Text style={[styles.logBadge, { backgroundColor: getEventBadgeColor(log.eventType) }]}>
                          {log.eventType}
                        </Text>
                        <Text style={styles.logTimestamp}>
                          {formatDistanceToNow(log.timestamp.toDate(), { addSuffix: true, locale: ro })}
                        </Text>
                      </View>
                      <View style={styles.logItemDetails}>
                        <Text style={styles.logDetail}>
                          Utilizator: <Text style={styles.logUserId}>{log.userName || log.userEmail || log.userId}</Text>
                        </Text>
                        {log.sessionId && (
                          <Text style={styles.logDetail}>
                            Sesiune: <Text style={styles.logSessionId}>{log.sessionId}</Text>
                          </Text>
                        )}
                        {log.metadata.page && (
                          <Text style={styles.logDetail}>
                            Pagină: <Text style={styles.logPage}>{log.metadata.page}</Text>
                          </Text>
                        )}
                        {log.metadata.device && (
                          <Text style={styles.logDetail}>
                            Dispozitiv: {log.metadata.device} - {log.metadata.browser} ({log.metadata.os})
                          </Text>
                        )}
                        {log.metadata.ipAddress && (
                          <Text style={styles.logDetail}>
                            IP: <Text style={styles.logIp}>{log.metadata.ipAddress}</Text>
                          </Text>
                        )}
                      </View>
                    </View>
                    <Text style={styles.logExpandIcon}>{expandedLog === log.id ? '▼' : '▶'}</Text>
                  </View>

                  {/* Expanded Details */}
                  {expandedLog === log.id && (
                    <View style={styles.logExpanded}>
                      <Text style={styles.logExpandedTitle}>Detalii Complete:</Text>
                      <Text style={styles.logExpandedContent}>
                        {JSON.stringify(
                          {
                            ...log,
                            timestamp: log.timestamp.toDate().toISOString(),
                          },
                          null,
                          2
                        )}
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>
              </View>
            ))
          )}
        </View>

        {/* Load More Button */}
        {!loading && logs.length >= 100 && (
          <View style={styles.loadMoreContainer}>
            <TouchableOpacity style={styles.loadMoreButton} onPress={loadLogs}>
              <Text style={styles.loadMoreButtonText}>Încarcă Mai Multe</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000940',
  },
  content: {
    padding: 16,
  },
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#94a3b8',
  },
  controls: {
    backgroundColor: 'rgba(30, 41, 59, 0.5)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(231, 183, 60, 0.2)',
    padding: 16,
    marginBottom: 16,
  },
  controlRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  controlItem: {
    flex: 1,
    minWidth: '48%',
  },
  controlLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#94a3b8',
    marginBottom: 8,
  },
  searchRow: {
    flexDirection: 'row',
    gap: 8,
  },
  searchInput: {
    flex: 1,
    padding: 12,
    backgroundColor: 'rgba(30, 41, 59, 0.7)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(231, 183, 60, 0.3)',
    color: '#fff',
  },
  searchButton: {
    padding: 12,
    backgroundColor: '#e7b73c',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchButtonText: {
    color: '#000940',
    fontWeight: 'bold',
  },
  dropdownContainer: {
    backgroundColor: 'rgba(30, 41, 59, 0.7)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(231, 183, 60, 0.3)',
  },
  dropdown: {
    padding: 12,
    color: '#fff',
  },
  textInput: {
    padding: 12,
    backgroundColor: 'rgba(30, 41, 59, 0.7)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(231, 183, 60, 0.3)',
    color: '#fff',
  },
  toggleButton: {
    padding: 12,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  toggleButtonActive: {
    backgroundColor: '#22c55e',
  },
  toggleButtonInactive: {
    backgroundColor: 'rgba(30, 41, 59, 0.7)',
  },
  toggleButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(231, 183, 60, 0.2)',
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#e7b73c',
  },
  statValuePurple: {
    color: '#a855f7',
  },
  statValueRed: {
    color: '#f87171',
  },
  statLabel: {
    fontSize: 12,
    color: '#94a3b8',
    textAlign: 'center',
  },
  logsList: {
    gap: 8,
  },
  logItem: {
    backgroundColor: 'rgba(30, 41, 59, 0.5)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(231, 183, 60, 0.2)',
  },
  logItemContent: {
    padding: 12,
  },
  logItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  logItemInfo: {
    flex: 1,
  },
  logItemTypeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
    flexWrap: 'wrap',
  },
  logType: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  logAdminBadge: {
    backgroundColor: 'rgba(168, 85, 247, 0.2)',
    color: '#a855f7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    fontSize: 10,
    fontWeight: 'bold',
    borderWidth: 1,
    borderColor: 'rgba(168, 85, 247, 0.3)',
  },
  logBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    fontSize: 10,
    fontWeight: 'bold',
    borderWidth: 1,
    borderColor: 'rgba(231, 183, 60, 0.3)',
  },
  logTimestamp: {
    fontSize: 10,
    color: '#94a3b8',
  },
  logItemDetails: {
    gap: 4,
  },
  logDetail: {
    fontSize: 12,
    color: '#94a3b8',
  },
  logUserId: {
    color: '#e7b73c',
    fontWeight: 'bold',
  },
  logSessionId: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  logPage: {
    fontWeight: 'bold',
  },
  logIp: {
    fontWeight: 'bold',
  },
  logExpandIcon: {
    color: '#94a3b8',
    fontSize: 16,
    marginLeft: 8,
  },
  logExpanded: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(231, 183, 60, 0.2)',
  },
  logExpandedTitle: {
    color: '#e7b73c',
    fontWeight: 'bold',
    marginBottom: 8,
  },
  logExpandedContent: {
    fontSize: 10,
    color: '#94a3b8',
    backgroundColor: 'rgba(30, 41, 59, 0.5)',
    borderRadius: 8,
    padding: 8,
  },
  loadMoreContainer: {
    marginTop: 16,
    alignItems: 'center',
  },
  loadMoreButton: {
    padding: 12,
    backgroundColor: '#e7b73c',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadMoreButtonText: {
    color: '#000940',
    fontWeight: 'bold',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000940',
  },
  loadingIndicator: {
    alignItems: 'center',
    padding: 16,
  },
  loadingText: {
    color: '#94a3b8',
    marginTop: 8,
  },
  emptyText: {
    textAlign: 'center',
    color: '#94a3b8',
    padding: 16,
  },
});
