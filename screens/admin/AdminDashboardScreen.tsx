import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { useAuth } from '../../context/AuthContext';
import { RootStackParamList } from '../../navigationTypes';
import { isAdmin, isSuperAdmin } from '@shared/adminService';
import { getRecentActivity, subscribeToActivityLogs, ActivityLog } from '@shared/activityLogService';
import { createOrGetConversation } from '@shared/chatService';
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { db } from '@shared/firebaseConfig';
import { formatDistanceToNow } from 'date-fns';
import { ro } from 'date-fns/locale';
import InlineBackButton from '../../components/InlineBackButton';

interface DashboardStats {
  totalUsers: number;
  activeUsers: number;
  totalProducts: number;
  totalAuctions: number;
  activeAuctions: number;
  totalBids: number;
  recentActivity: ActivityLog[];
  suspiciousActivity: ActivityLog[];
  errorCount: number;
}

type AdminDashboardNavigationProp = StackNavigationProp<RootStackParamList>;

export default function AdminDashboardScreen() {
  const { user, loading: authLoading } = useAuth();
  const navigation = useNavigation<AdminDashboardNavigationProp>();
  const [isAdminUser, setIsAdminUser] = useState(false);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [realtimeActivity, setRealtimeActivity] = useState<ActivityLog[]>([]);
  const [realtimeEnabled, setRealtimeEnabled] = useState(true);
  const [adminTargetUserId, setAdminTargetUserId] = useState('');
  const [startingChat, setStartingChat] = useState(false);

  // Quick listing search (products / auctions)
  const [listingSearchType, setListingSearchType] = useState<'product' | 'auction'>('product');
  const [listingSearchText, setListingSearchText] = useState('');

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

      // Only super-admins get access to the full admin dashboard.
      const superAdminStatus = await isSuperAdmin(user.uid);
      if (!superAdminStatus) {
        navigation.navigate('AdminModerator' as never);
        return;
      }

      setIsAdminUser(true);
      await loadDashboardData();
      setLoading(false);
    };

    if (!authLoading) {
      checkAdminAndLoad();
    }
  }, [user, authLoading, navigation]);

  useEffect(() => {
    if (!isAdminUser || !realtimeEnabled) return;

    const unsubscribe = subscribeToActivityLogs(
      { limit: 50 },
      (logs: ActivityLog[]) => {
        setRealtimeActivity(logs);
      },
      (error: unknown) => {
        console.error('Realtime activity error:', error);
        // Don't show error to user, just disable realtime
        setRealtimeEnabled(false);
      }
    );

    return () => unsubscribe();
  }, [isAdminUser, realtimeEnabled]);

  const handleStartAdminChat = async () => {
    if (!adminTargetUserId.trim() || !user) return;

    setStartingChat(true);
    try {
      const conversationId = await createOrGetConversation(
        user.uid,
        adminTargetUserId.trim(),
        undefined,
        undefined,
        true,
      );
      (navigation as any).navigate('Messages', { conversationId });
      setAdminTargetUserId('');
    } catch (error: any) {
      console.error('Failed to start admin chat:', error);
      const errorMessage = error?.message?.includes('permission-denied')
        ? 'Nu aveți permisiunea să creați conversații de suport'
        : 'Eroare la pornirea conversației de suport';
      alert(errorMessage);
    } finally {
      setStartingChat(false);
    }
  };

  const normalizeListingId = (raw: string): string => {
    const text = raw.trim();
    if (!text) return '';

    // Allow pasting full URLs like https://.../products/<id> or /auctions/<id>
    const m = text.match(/\/(products|auctions)\/([^/?#]+)/i);
    if (m?.[2]) return m[2];

    return text;
  };

  const handleListingSearch = () => {
    const id = normalizeListingId(listingSearchText);
    if (!id) return;

    if (listingSearchType === 'product') {
      (navigation as any).navigate('ProductDetails', { productId: id });
      return;
    }

    (navigation as any).navigate('AuctionDetails', { auctionId: id });
  };

  const loadDashboardData = async () => {
    try {
      // Get total users
      const usersSnapshot = await getDocs(collection(db, 'users'));
      const totalUsers = usersSnapshot.size;

      // Get active users (logged in last 7 days)
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const activeUsersQuery = query(
        collection(db, 'users'),
        where('updatedAt', '>=', sevenDaysAgo)
      );
      const activeUsersSnapshot = await getDocs(activeUsersQuery);
      const activeUsers = activeUsersSnapshot.size;

      // Get total products
      const productsSnapshot = await getDocs(collection(db, 'products'));
      const totalProducts = productsSnapshot.size;

      // Get total auctions
      const auctionsSnapshot = await getDocs(collection(db, 'auctions'));
      const totalAuctions = auctionsSnapshot.size;

      // Get active auctions
      const activeAuctionsQuery = query(
        collection(db, 'auctions'),
        where('status', '==', 'active')
      );
      const activeAuctionsSnapshot = await getDocs(activeAuctionsQuery);
      const activeAuctions = activeAuctionsSnapshot.size;

      // Get total bids (approximate from all auctions)
      let totalBids = 0;
      for (const auctionDoc of auctionsSnapshot.docs) {
        const bidsSnapshot = await getDocs(collection(db, 'auctions', auctionDoc.id, 'bids'));
        totalBids += bidsSnapshot.size;
      }

      // Get recent activity
      const recentActivity = await getRecentActivity(100);

      // Get suspicious activity
      const suspiciousActivity = recentActivity.filter(
        (log) =>
          log.eventType.includes('suspicious') ||
          log.eventType.includes('unauthorized') ||
          log.eventType.includes('rate_limit')
      );

      // Count errors
      const errorCount = recentActivity.filter(
        (log) => log.eventType.includes('error')
      ).length;

      setStats({
        totalUsers,
        activeUsers,
        totalProducts,
        totalAuctions,
        activeAuctions,
        totalBids,
        recentActivity: recentActivity.slice(0, 20),
        suspiciousActivity,
        errorCount,
      });
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    }
  };

  if (authLoading || loading || !isAdminUser) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#e7b73c" />
      </View>
    );
  }

  const activityToDisplay = realtimeEnabled ? realtimeActivity : stats?.recentActivity || [];

  return (
    <ScrollView style={styles.container}>
      <View style={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <InlineBackButton label="Înapoi" onPress={() => navigation.navigate('Dashboard' as never)} />
          <Text style={[styles.title, { marginTop: 10 }]}>Panou Admin</Text>
          <Text style={styles.subtitle}>Monitorizare și control complet al platformei</Text>
        </View>

        {/* Quick Search (Listing) */}
        <View style={styles.searchContainer}>
          <Text style={styles.sectionTitle}>Caută rapid anunț / licitație</Text>
          <Text style={styles.sectionSubtitle}>
            Introduceți ID-ul (sau link-ul) și se va fi dus direct la pagina anunțului.
          </Text>
          <View style={styles.searchRow}>
            <TouchableOpacity
              style={styles.dropdown}
              onPress={() => setListingSearchType(listingSearchType === 'product' ? 'auction' : 'product')}
            >
              <Text style={styles.dropdownText}>{listingSearchType === 'product' ? 'E-shop (produs)' : 'Licitație'}</Text>
            </TouchableOpacity>
            <TextInput
              style={styles.searchInput}
              value={listingSearchText}
              onChangeText={setListingSearchText}
              onKeyPress={(e: any) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleListingSearch();
                }
              }}
              placeholder="ex: 2a9c... sau https://site.ro/auctions/2a9c..."
            />
            <TouchableOpacity
              style={styles.searchButton}
              onPress={handleListingSearch}
              disabled={!listingSearchText.trim()}
            >
              <Text style={styles.searchButtonText}>Caută</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.quickActions}>
          <TouchableOpacity style={styles.actionCard} onPress={() => navigation.navigate('AdminUsers' as never)}>
            <Text style={styles.actionTitle}>Utilizatori</Text>
            <Text style={styles.actionValue}>{stats?.totalUsers || 0}</Text>
            <Text style={styles.actionSubtitle}>{stats?.activeUsers || 0} activi</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionCard} onPress={() => navigation.navigate('ProductCatalog' as never)}>
            <Text style={styles.actionTitle}>Piese</Text>
            <Text style={styles.actionValue}>{stats?.totalProducts || 0}</Text>
            <Text style={styles.actionSubtitle}>Total catalog</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionCard} onPress={() => navigation.navigate('AdminAuctions' as never)}>
            <Text style={styles.actionTitle}>Licitații</Text>
            <Text style={styles.actionValue}>{stats?.activeAuctions || 0}</Text>
            <Text style={styles.actionSubtitle}>{stats?.totalAuctions || 0} total</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionCard} onPress={() => navigation.navigate('AdminActivityLogs' as never)}>
            <Text style={styles.actionTitle}>Loguri</Text>
            <Text style={styles.actionValue}>{activityToDisplay.length}</Text>
            <Text style={styles.actionSubtitle}>Evenimente recente</Text>
          </TouchableOpacity>
        </View>

        {/* Admin Support Chat */}
        <View style={styles.supportChat}>
          <Text style={styles.sectionTitle}>Suport Utilizatori</Text>
          <Text style={styles.sectionSubtitle}>
            Începeți o conversație de suport cu orice utilizator pentru ajutor sau moderare
          </Text>
          <View style={styles.supportChatRow}>
            <TextInput
              style={styles.supportChatInput}
              value={adminTargetUserId}
              onChangeText={setAdminTargetUserId}
              placeholder="Introduceți ID-ul utilizatorului..."
            />
            <TouchableOpacity
              style={styles.supportChatButton}
              onPress={handleStartAdminChat}
              disabled={!adminTargetUserId.trim() || startingChat}
            >
              <Text style={styles.supportChatButtonText}>{startingChat ? 'Se pornește...' : 'Începe Chat'}</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.supportChatHint}>💡 Utilizați ID-ul complet al utilizatorului pentru a începe conversația</Text>
        </View>

        {/* Stats Grid */}
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Total Licitări</Text>
            <Text style={styles.statValue}>{stats?.totalBids || 0}</Text>
          </View>

          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Activitate Suspectă</Text>
            <Text style={[styles.statValue, styles.statValueRed]}>{stats?.suspiciousActivity.length || 0}</Text>
          </View>

          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Erori</Text>
            <Text style={[styles.statValue, styles.statValueOrange]}>{stats?.errorCount || 0}</Text>
          </View>

          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Status Sistem</Text>
            <Text style={[styles.statValue, styles.statValueGreen]}>ONLINE</Text>
          </View>
        </View>

        {/* Real-time Activity Feed */}
        <View style={styles.activityFeed}>
          <View style={styles.activityFeedHeader}>
            <Text style={styles.activityFeedTitle}>Activitate în Timp Real</Text>
            <TouchableOpacity
              style={[styles.activityFeedToggle, realtimeEnabled ? styles.activityFeedToggleActive : styles.activityFeedToggleInactive]}
              onPress={() => setRealtimeEnabled(!realtimeEnabled)}
            >
              <Text style={styles.activityFeedToggleText}>{realtimeEnabled ? 'LIVE' : 'Pauzat'}</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.activityFeedList}>
            {activityToDisplay.length === 0 ? (
              <Text style={styles.activityFeedEmpty}>Nicio activitate recentă</Text>
            ) : (
              activityToDisplay.map((log) => (
                <View key={log.id} style={styles.activityItem}>
                  <View style={styles.activityItemHeader}>
                    <Text style={[styles.activityType, 
                      log.eventType.includes('error') || log.eventType.includes('suspicious')
                        ? styles.activityTypeRed
                        : log.eventType.startsWith('admin_')
                        ? styles.activityTypePurple
                        : log.eventType.includes('login')
                        ? styles.activityTypeGreen
                        : styles.activityTypeBlue
                    ]}>
                      {log.eventType}
                    </Text>
                    {log.isAdmin && (
                      <Text style={styles.activityAdminBadge}>ADMIN</Text>
                    )}
                    <Text style={styles.activityTimestamp}>
                      {formatDistanceToNow(log.timestamp.toDate(), { addSuffix: true, locale: ro })}
                    </Text>
                  </View>
                  <View style={styles.activityItemDetails}>
                    <Text style={styles.activityUser}>
                      Utilizator: <Text style={styles.activityUserId}>{log.userName || log.userEmail || log.userId.slice(0, 8)}</Text>
                    </Text>
                    {log.metadata.page && (
                      <Text style={styles.activityPage}>
                        Pagină: {log.metadata.page}
                      </Text>
                    )}
                    {log.metadata.device && (
                      <Text style={styles.activityDevice}>
                        Dispozitiv: {log.metadata.device}
                      </Text>
                    )}
                  </View>
                </View>
              ))
            )}
          </View>
        </View>

        {/* Suspicious Activity Alert */}
        {stats && stats.suspiciousActivity.length > 0 && (
          <View style={styles.suspiciousActivity}>
            <Text style={[styles.sectionTitle, styles.suspiciousActivityTitle]}>
              Alerte Securitate ({stats.suspiciousActivity.length})
            </Text>
            <View style={styles.suspiciousActivityList}>
              {stats.suspiciousActivity.slice(0, 5).map((log) => (
                <View key={log.id} style={styles.suspiciousActivityItem}>
                  <View style={styles.suspiciousActivityItemHeader}>
                    <Text style={styles.suspiciousActivityType}>{log.eventType}</Text>
                    <Text style={styles.suspiciousActivityTimestamp}>
                      {formatDistanceToNow(log.timestamp.toDate(), { addSuffix: true, locale: ro })}
                    </Text>
                  </View>
                  <Text style={styles.suspiciousActivityUser}>
                    Utilizator: {log.userName || log.userEmail || log.userId}
                  </Text>
                  {log.metadata.ipAddress && (
                    <Text style={styles.suspiciousActivityIp}>IP: {log.metadata.ipAddress}</Text>
                  )}
                </View>
              ))}
            </View>
            <TouchableOpacity onPress={() => navigation.navigate('AdminActivityLogs' as never)}>
              <Text style={styles.suspiciousActivityLink}>Vezi toate alertele →</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Quick Links */}
        <View style={styles.quickLinks}>
          <TouchableOpacity style={styles.quickLink} onPress={() => navigation.navigate('AdminVerification' as never)}>
            <Text style={styles.quickLinkTitle}>Verificare Identitate</Text>
            <Text style={styles.quickLinkSubtitle}>Cereri de verificare documentelor de identitate</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.quickLink} onPress={() => navigation.navigate('AdminUsers' as never)}>
            <Text style={styles.quickLinkTitle}>Gestionare Utilizatori</Text>
            <Text style={styles.quickLinkSubtitle}>Vizualizează, editează și controlează conturile utilizatorilor</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.quickLink} onPress={() => navigation.navigate('AdminTransactions' as never)}>
            <Text style={styles.quickLinkTitle}>Tranzacții</Text>
            <Text style={styles.quickLinkSubtitle}>Comenzi + licitații încheiate, cu chat și detalii</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.quickLink} onPress={() => navigation.navigate('AdminActivityLogs' as never)}>
            <Text style={styles.quickLinkTitle}>Loguri Detaliate</Text>
            <Text style={styles.quickLinkSubtitle}>Monitorizare completă a activității utilizatorilor</Text>
          </TouchableOpacity>
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
  searchContainer: {
    backgroundColor: 'rgba(30, 41, 59, 0.4)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(231, 183, 60, 0.2)',
    padding: 16,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  sectionSubtitle: {
    fontSize: 12,
    color: '#94a3b8',
    marginBottom: 16,
  },
  searchRow: {
    flexDirection: 'row',
    gap: 8,
  },
  dropdown: {
    padding: 12,
    backgroundColor: 'rgba(30, 41, 59, 0.7)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(231, 183, 60, 0.25)',
  },
  dropdownText: {
    color: '#fff',
  },
  searchInput: {
    flex: 1,
    padding: 12,
    backgroundColor: 'rgba(30, 41, 59, 0.7)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(231, 183, 60, 0.25)',
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
  quickActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 24,
  },
  actionCard: {
    flex: 1,
    minWidth: '48%',
    backgroundColor: 'rgba(30, 41, 59, 0.5)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(231, 183, 60, 0.2)',
    padding: 16,
  },
  actionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  actionValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#e7b73c',
  },
  actionSubtitle: {
    fontSize: 10,
    color: '#94a3b8',
    marginTop: 4,
  },
  supportChat: {
    backgroundColor: 'rgba(120, 53, 15, 0.2)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
    padding: 16,
    marginBottom: 24,
  },
  supportChatRow: {
    flexDirection: 'row',
    gap: 8,
  },
  supportChatInput: {
    flex: 1,
    padding: 12,
    backgroundColor: 'rgba(30, 41, 59, 0.7)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.4)',
    color: '#fff',
  },
  supportChatButton: {
    padding: 12,
    backgroundColor: '#f59e0b',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  supportChatButtonText: {
    color: '#000',
    fontWeight: 'bold',
  },
  supportChatHint: {
    fontSize: 10,
    color: '#f59e0b',
    marginTop: 8,
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
  statValueOrange: {
    color: '#fb923c',
  },
  statValueGreen: {
    color: '#4ade80',
  },
  activityFeed: {
    backgroundColor: 'rgba(30, 41, 59, 0.5)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(231, 183, 60, 0.2)',
    padding: 16,
    marginBottom: 24,
  },
  activityFeedHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  activityFeedTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  activityFeedToggle: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    fontWeight: 'bold',
  },
  activityFeedToggleActive: {
    backgroundColor: '#22c55e',
  },
  activityFeedToggleInactive: {
    backgroundColor: 'rgba(30, 41, 59, 0.7)',
  },
  activityFeedToggleText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  activityFeedList: {
    gap: 8,
  },
  activityItem: {
    backgroundColor: 'rgba(30, 41, 59, 0.5)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(231, 183, 60, 0.1)',
    padding: 12,
  },
  activityItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  activityType: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  activityTypeRed: {
    color: '#f87171',
  },
  activityTypePurple: {
    color: '#a855f7',
  },
  activityTypeGreen: {
    color: '#4ade80',
  },
  activityTypeBlue: {
    color: '#60a5fa',
  },
  activityAdminBadge: {
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
  activityTimestamp: {
    fontSize: 10,
    color: '#94a3b8',
  },
  activityItemDetails: {
    gap: 4,
  },
  activityUser: {
    fontSize: 12,
    color: '#94a3b8',
  },
  activityUserId: {
    color: '#e7b73c',
    fontWeight: 'bold',
  },
  activityPage: {
    fontSize: 12,
    color: '#94a3b8',
  },
  activityDevice: {
    fontSize: 12,
    color: '#94a3b8',
  },
  suspiciousActivity: {
    backgroundColor: 'rgba(153, 27, 27, 0.2)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    padding: 16,
    marginBottom: 24,
  },
  suspiciousActivityTitle: {
    color: '#f87171',
  },
  suspiciousActivityList: {
    gap: 8,
    marginVertical: 16,
  },
  suspiciousActivityItem: {
    backgroundColor: 'rgba(153, 27, 27, 0.3)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.2)',
    padding: 12,
  },
  suspiciousActivityItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  suspiciousActivityType: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#f87171',
  },
  suspiciousActivityTimestamp: {
    fontSize: 10,
    color: '#f87171',
  },
  suspiciousActivityUser: {
    fontSize: 12,
    color: '#f87171',
  },
  suspiciousActivityIp: {
    fontSize: 10,
    color: '#f87171',
  },
  suspiciousActivityLink: {
    color: '#f87171',
    fontWeight: 'bold',
  },
  quickLinks: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  quickLink: {
    flex: 1,
    minWidth: '48%',
    backgroundColor: 'rgba(30, 41, 59, 0.5)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(231, 183, 60, 0.2)',
    padding: 16,
  },
  quickLinkTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  quickLinkSubtitle: {
    fontSize: 10,
    color: '#94a3b8',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000940',
  },
  activityFeedEmpty: {
    textAlign: 'center',
    color: '#94a3b8',
    padding: 16,
  },
});
