import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { useAuth } from '../../context/AuthContext';
import { RootStackParamList } from '../../navigationTypes';
import { isAdmin } from '@shared/adminService';
import { getAdminActions, UserControlAction } from '@shared/adminControlService';
import { formatDistanceToNow } from 'date-fns';
import { ro } from 'date-fns/locale';

type AuditTrailNavigationProp = StackNavigationProp<RootStackParamList>;

export default function AuditTrailScreen() {
  const { user, loading: authLoading } = useAuth();
  const navigation = useNavigation<AuditTrailNavigationProp>();
  const [isAdminUser, setIsAdminUser] = useState(false);
  const [actions, setActions] = useState<UserControlAction[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedAction, setExpandedAction] = useState<string | null>(null);

  useEffect(() => {
    const checkAdmin = async () => {
      if (!user) {
        navigation.navigate('Login' as never);
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
    if (isAdminUser) {
      loadAuditTrail();
    }
  }, [isAdminUser]);

  const loadAuditTrail = async () => {
    try {
      setLoading(true);
      const adminActions = await getAdminActions(200);
      // Sort by timestamp descending
      adminActions.sort((a: UserControlAction, b: UserControlAction) => b.timestamp.getTime() - a.timestamp.getTime());
      setActions(adminActions);
    } catch (error) {
      console.error('Failed to load audit trail:', error);
    } finally {
      setLoading(false);
    }
  };

  const getActionColor = (action: string): string => {
    switch (action) {
      case 'ban':
      case 'delete':
        return '#f87171';
      case 'unban':
        return '#4ade80';
      case 'role_change':
        return '#a855f7';
      case 'password_reset':
        return '#60a5fa';
      case 'update_credits':
        return '#fbbf24';
      default:
        return '#94a3b8';
    }
  };

  const getActionLabel = (action: string): string => {
    const labels: Record<string, string> = {
      ban: 'Blocare Utilizator',
      unban: 'Deblocare Utilizator',
      delete: 'Ștergere Cont',
      role_change: 'Schimbare Rol',
      password_reset: 'Resetare Parolă',
      update_credits: 'Actualizare Credite',
    };
    return labels[action] || action;
  };

  if (authLoading || !isAdminUser) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#e7b73c" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>Audit Trail Admin</Text>
          <Text style={styles.subtitle}>Istoric complet al acțiunilor administrative</Text>
        </View>

        {/* Stats */}
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Total Acțiuni</Text>
            <Text style={styles.statValue}>{actions.length}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Blocări</Text>
            <Text style={[styles.statValue, styles.statValueRed]}>{actions.filter((a) => a.action === 'ban').length}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Resetări Parolă</Text>
            <Text style={[styles.statValue, styles.statValueBlue]}>{actions.filter((a) => a.action === 'password_reset').length}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Schimbări Rol</Text>
            <Text style={[styles.statValue, styles.statValuePurple]}>{actions.filter((a) => a.action === 'role_change').length}</Text>
          </View>
        </View>

        {/* Actions List */}
        <View style={styles.actionsList}>
          <Text style={styles.actionsListTitle}>Istoric Acțiuni</Text>

          {loading ? (
            <View style={styles.loadingIndicator}>
              <ActivityIndicator size="large" color="#e7b73c" />
              <Text style={styles.loadingText}>Se încarcă...</Text>
            </View>
          ) : actions.length === 0 ? (
            <Text style={styles.emptyText}>Nicio acțiune administrativă înregistrată</Text>
          ) : (
            <View style={styles.actionsListContent}>
              {actions.map((action, index) => (
                <View key={`${action.userId}-${action.timestamp.getTime()}-${index}`} style={styles.actionItem}>
                  <TouchableOpacity
                    style={styles.actionItemContent}
                    onPress={() => setExpandedAction(expandedAction === `${index}` ? null : `${index}`)}
                  >
                    <View style={styles.actionItemHeader}>
                      <View style={styles.actionItemInfo}>
                        <View style={styles.actionItemTypeRow}>
                          <Text style={[styles.actionType, { backgroundColor: getActionColor(action.action) }]}>
                            {getActionLabel(action.action)}
                          </Text>
                          <Text style={styles.actionTimestamp}>
                            {formatDistanceToNow(action.timestamp, { addSuffix: true, locale: ro })}
                          </Text>
                        </View>

                        <View style={styles.actionItemDetails}>
                          <Text style={styles.actionDetail}>
                            Admin: <Text style={styles.actionAdmin}>{action.performedByEmail}</Text>
                          </Text>
                          <Text style={styles.actionDetail}>
                            Utilizator Țintă: <Text style={styles.actionTarget}>{action.metadata?.targetUserEmail || action.userId}</Text>
                          </Text>
                          {action.reason && (
                            <Text style={styles.actionDetail}>
                              Motiv: <Text style={styles.actionReason}>{action.reason}</Text>
                            </Text>
                          )}
                        </View>
                      </View>
                      <Text style={styles.actionExpandIcon}>{expandedAction === `${index}` ? '▼' : '▶'}</Text>
                    </View>

                    {/* Expanded Details */}
                    {expandedAction === `${index}` && (
                      <View style={styles.actionExpanded}>
                        <Text style={styles.actionExpandedTitle}>Detalii Complete:</Text>
                        <Text style={styles.actionExpandedContent}>
                          {JSON.stringify(
                            {
                              ...action,
                              timestamp: action.timestamp.toISOString(),
                            },
                            null,
                            2
                          )}
                        </Text>
                      </View>
                    )}
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}
        </View>
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
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    minWidth: '48%',
    backgroundColor: 'rgba(30, 41, 59, 0.5)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(231, 183, 60, 0.2)',
    padding: 12,
  },
  statLabel: {
    fontSize: 12,
    color: '#94a3b8',
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  statValueRed: {
    color: '#f87171',
  },
  statValueBlue: {
    color: '#60a5fa',
  },
  statValuePurple: {
    color: '#a855f7',
  },
  actionsList: {
    backgroundColor: 'rgba(30, 41, 59, 0.5)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(231, 183, 60, 0.2)',
    padding: 16,
  },
  actionsListTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 16,
  },
  actionsListContent: {
    gap: 8,
  },
  actionItem: {
    backgroundColor: 'rgba(30, 41, 59, 0.5)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(231, 183, 60, 0.1)',
  },
  actionItemContent: {
    padding: 12,
  },
  actionItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  actionItemInfo: {
    flex: 1,
  },
  actionItemTypeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
    flexWrap: 'wrap',
  },
  actionType: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    fontSize: 12,
    fontWeight: 'bold',
    borderWidth: 1,
    borderColor: 'rgba(231, 183, 60, 0.3)',
  },
  actionTimestamp: {
    fontSize: 10,
    color: '#94a3b8',
  },
  actionItemDetails: {
    gap: 4,
  },
  actionDetail: {
    fontSize: 12,
    color: '#94a3b8',
  },
  actionAdmin: {
    color: '#e7b73c',
    fontWeight: 'bold',
  },
  actionTarget: {
    color: '#fff',
    fontWeight: 'bold',
  },
  actionReason: {
    color: '#94a3b8',
  },
  actionExpandIcon: {
    color: '#94a3b8',
    fontSize: 16,
    marginLeft: 8,
  },
  actionExpanded: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(231, 183, 60, 0.2)',
  },
  actionExpandedTitle: {
    color: '#e7b73c',
    fontWeight: 'bold',
    marginBottom: 8,
  },
  actionExpandedContent: {
    fontSize: 10,
    color: '#94a3b8',
    backgroundColor: 'rgba(30, 41, 59, 0.5)',
    borderRadius: 8,
    padding: 8,
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
