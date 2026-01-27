import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert, Image, TextInput } from 'react-native';
import { useNavigation, useRoute, NavigationProp, RouteProp } from '@react-navigation/native';
import { useAuth } from '../../context/AuthContext';
import { getUserDetails, updateUserStatus, getUserActivity, isAdmin } from '../../../shared/adminService';
import { formatDistanceToNow, format } from 'date-fns';
import { ro } from 'date-fns/locale';
import { RootStackParamList } from '../../navigationTypes';

type UserDetailScreenNavigationProp = NavigationProp<RootStackParamList, 'AdminUserDetail'>;
type UserDetailScreenRouteProp = RouteProp<RootStackParamList, 'AdminUserDetail'>;

export default function UserDetailScreen() {
  const { user: currentUser, loading: authLoading } = useAuth();
  const navigation = useNavigation<UserDetailScreenNavigationProp>();
  const route = useRoute<UserDetailScreenRouteProp>();
  const { userId } = route.params;
  
  const [isAdminUser, setIsAdminUser] = useState(false);
  const [loading, setLoading] = useState(true);
  const [userDetails, setUserDetails] = useState<any>(null);
  const [userActivity, setUserActivity] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'details' | 'activity'>('details');
  const [showActionModal, setShowActionModal] = useState(false);
  const [actionType, setActionType] = useState<'suspend' | 'ban' | 'verify'>('suspend');
  const [actionReason, setActionReason] = useState('');

  useEffect(() => {
    const checkAdminAndLoad = async () => {
      if (!currentUser) {
        navigation.navigate('Login');
        return;
      }

      const adminStatus = await isAdmin(currentUser.uid);
      if (!adminStatus) {
        navigation.navigate('MainTabs', { screen: 'Dashboard' });
        return;
      }

      setIsAdminUser(true);
      await loadUserData();
      setLoading(false);
    };

    if (!authLoading) {
      checkAdminAndLoad();
    }
  }, [currentUser, authLoading, userId]);

  const loadUserData = async () => {
    try {
      // Load user details
      const details = await getUserDetails(userId);
      setUserDetails(details);

      // Load user activity
      const activity = await getUserActivity(userId);
      setUserActivity(activity);
    } catch (error) {
      console.error('Error loading user data:', error);
      Alert.alert('Error', 'Failed to load user data');
    }
  };

  const handleAction = async () => {
    if (!currentUser) return;
    if (!actionReason.trim()) {
      Alert.alert('Error', 'Te rog introdu un motiv pentru această acțiune');
      return;
    }

    try {
      await updateUserStatus(
        userId,
        actionType,
        currentUser.uid,
        currentUser.email || '',
        actionReason
      );
      
      const actionNames = {
        suspend: 'suspendat',
        ban: 'interzis',
        verify: 'verificat'
      };
      
      Alert.alert('Success', `Utilizator ${actionNames[actionType]} cu succes!`);
      setShowActionModal(false);
      setActionReason('');
      await loadUserData();
    } catch (error) {
      Alert.alert('Error', `Eroare: ${error}`);
    }
  };

  if (authLoading || loading || !isAdminUser || !userDetails) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#F5B800" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView style={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Text style={styles.backButtonText}>← Înapoi</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Detalii Utilizator</Text>
          <Text style={styles.subtitle}>Gestionare și monitorizare utilizator</Text>
        </View>

        {/* User Profile Card */}
        <View style={styles.userProfileCard}>
          <View style={styles.userProfileHeader}>
            <View style={styles.userAvatar}>
              {userDetails.profileImage ? (
                <Image source={{ uri: userDetails.profileImage }} style={styles.avatarImage} />
              ) : (
                <Text style={styles.avatarText}>{userDetails.name.charAt(0)}</Text>
              )}
            </View>
            <View style={styles.userInfo}>
              <Text style={styles.userName}>{userDetails.name}</Text>
              <Text style={styles.userEmail}>{userDetails.email}</Text>
              <View style={[styles.userStatusBadge, {
                backgroundColor: userDetails.status === 'active' ? 'rgba(16, 185, 129, 0.2)' :
                                userDetails.status === 'suspended' ? 'rgba(245, 184, 0, 0.2)' :
                                userDetails.status === 'banned' ? 'rgba(239, 68, 68, 0.2)' :
                                'rgba(59, 130, 246, 0.2)',
                borderColor: userDetails.status === 'active' ? 'rgba(16, 185, 129, 0.3)' :
                            userDetails.status === 'suspended' ? 'rgba(245, 184, 0, 0.3)' :
                            userDetails.status === 'banned' ? 'rgba(239, 68, 68, 0.3)' :
                            'rgba(59, 130, 246, 0.3)'
              }]}>
                <Text style={[styles.userStatusText, {
                  color: userDetails.status === 'active' ? '#10b981' :
                         userDetails.status === 'suspended' ? '#fbbf24' :
                         userDetails.status === 'banned' ? '#ef4444' :
                         '#3b82f6'
                }]}>
                  {userDetails.status === 'active' && 'Activ'}
                  {userDetails.status === 'suspended' && 'Suspendat'}
                  {userDetails.status === 'banned' && 'Interzis'}
                  {userDetails.status === 'pending' && 'În Așteptare'}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.userStats}>
            <View style={styles.userStatItem}>
              <Text style={styles.userStatLabel}>ID Utilizator</Text>
              <Text style={styles.userStatValue}>{userDetails.userId}</Text>
            </View>
            <View style={styles.userStatItem}>
              <Text style={styles.userStatLabel}>Data Înregistrării</Text>
              <Text style={styles.userStatValue}>
                {format(userDetails.createdAt.toDate(), 'dd MMM yyyy', { locale: ro })}
              </Text>
            </View>
            <View style={styles.userStatItem}>
              <Text style={styles.userStatLabel}>Ultima Activitate</Text>
              <Text style={styles.userStatValue}>
                {userDetails.lastActive ? formatDistanceToNow(userDetails.lastActive.toDate(), { addSuffix: true, locale: ro }) : 'N/A'}
              </Text>
            </View>
          </View>

          <View style={styles.userActions}>
            <TouchableOpacity
              onPress={() => {
                setActionType('suspend');
                setShowActionModal(true);
              }}
              disabled={userDetails.status === 'suspended' || userDetails.status === 'banned'}
              style={[styles.actionButton, styles.suspendButton]}
            >
              <Text style={styles.actionButtonText}>Suspendă</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                setActionType('ban');
                setShowActionModal(true);
              }}
              disabled={userDetails.status === 'banned'}
              style={[styles.actionButton, styles.banButton]}
            >
              <Text style={styles.actionButtonText}>Interzice</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                setActionType('verify');
                setShowActionModal(true);
              }}
              disabled={userDetails.verified}
              style={[styles.actionButton, styles.verifyButton]}
            >
              <Text style={styles.actionButtonText}>Verifică</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Tabs */}
        <View style={styles.tabsContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {['details', 'activity'].map((tab) => (
              <TouchableOpacity
                key={tab}
                onPress={() => setActiveTab(tab as any)}
                style={[styles.tabButton, activeTab === tab && styles.activeTab]}
              >
                <Text style={[styles.tabText, activeTab === tab && styles.activeTabText]}>
                  {tab === 'details' && 'Detalii'}
                  {tab === 'activity' && 'Activitate'}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Tab Content */}
        {activeTab === 'details' && (
          <View style={styles.tabContent}>
            <View style={styles.detailsCard}>
              <Text style={styles.cardTitle}>Informații Personale</Text>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Nume complet:</Text>
                <Text style={styles.detailValue}>{userDetails.fullName || 'N/A'}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Număr de telefon:</Text>
                <Text style={styles.detailValue}>{userDetails.phoneNumber || 'N/A'}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Adresă:</Text>
                <Text style={styles.detailValue}>{userDetails.address || 'N/A'}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Oraș:</Text>
                <Text style={styles.detailValue}>{userDetails.city || 'N/A'}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Țară:</Text>
                <Text style={styles.detailValue}>{userDetails.country || 'N/A'}</Text>
              </View>
            </View>

            <View style={styles.detailsCard}>
              <Text style={styles.cardTitle}>Informații Cont</Text>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Email verificat:</Text>
                <Text style={styles.detailValue}>{userDetails.emailVerified ? 'Da' : 'Nu'}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Cont verificat:</Text>
                <Text style={styles.detailValue}>{userDetails.verified ? 'Da' : 'Nu'}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Rol:</Text>
                <Text style={styles.detailValue}>{userDetails.role || 'Utilizator'}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Metodă autentificare:</Text>
                <Text style={styles.detailValue}>{userDetails.authMethod || 'Email/Parolă'}</Text>
              </View>
            </View>

            <View style={styles.detailsCard}>
              <Text style={styles.cardTitle}>Statistici Utilizator</Text>
              <View style={styles.statsGrid}>
                <View style={styles.statItem}>
                  <Text style={styles.statLabel}>Produse create</Text>
                  <Text style={styles.statValue}>{userDetails.productCount || 0}</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={styles.statLabel}>Oferte făcute</Text>
                  <Text style={styles.statValue}>{userDetails.bidCount || 0}</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={styles.statLabel}>Mesaje trimise</Text>
                  <Text style={styles.statValue}>{userDetails.messageCount || 0}</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={styles.statLabel}>Tranzacții</Text>
                  <Text style={styles.statValue}>{userDetails.transactionCount || 0}</Text>
                </View>
              </View>
            </View>
          </View>
        )}

        {activeTab === 'activity' && (
          <View style={styles.tabContent}>
            {userActivity.length === 0 ? (
              <Text style={styles.noDataText}>Nicio activitate înregistrată</Text>
            ) : (
              <View style={styles.activityList}>
                {userActivity.map((activity, index) => (
                  <View key={index} style={styles.activityItem}>
                    <View style={styles.activityHeader}>
                      <Text style={styles.activityType}>{activity.type}</Text>
                      <Text style={styles.activityTime}>
                        {formatDistanceToNow(activity.timestamp.toDate(), { addSuffix: true, locale: ro })}
                      </Text>
                    </View>
                    <Text style={styles.activityDescription}>{activity.description}</Text>
                    {activity.details && (
                      <Text style={styles.activityDetails}>{activity.details}</Text>
                    )}
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        {/* Action Modal */}
        {showActionModal && (
          <View style={styles.modalOverlay}>
            <View style={styles.modalContainer}>
              <Text style={styles.modalTitle}>
                {actionType === 'suspend' && 'Suspendă Utilizator'}
                {actionType === 'ban' && 'Interzice Utilizator'}
                {actionType === 'verify' && 'Verifică Utilizator'}
              </Text>

              <View style={styles.modalUserInfo}>
                <Text style={styles.modalUserName}>{userDetails.name}</Text>
                <Text style={styles.modalUserEmail}>{userDetails.email}</Text>
              </View>

              <View style={styles.modalInputGroup}>
                <Text style={styles.modalLabel}>Motiv (obligatoriu)</Text>
                <TextInput
                  value={actionReason}
                  onChangeText={setActionReason}
                  multiline
                  numberOfLines={4}
                  style={[styles.modalInput, styles.modalTextArea]}
                  placeholder="Introdu motivul pentru această acțiune..."
                />
              </View>

              <View style={styles.modalButtons}>
                <TouchableOpacity
                  onPress={() => {
                    setShowActionModal(false);
                    setActionReason('');
                  }}
                  style={[styles.modalButton, styles.cancelButton]}
                >
                  <Text style={styles.modalButtonText}>Anulează</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleAction}
                  style={[styles.modalButton, styles.confirmButton]}
                >
                  <Text style={styles.modalButtonText}>Confirmă</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0f172a',
  },
  header: {
    marginBottom: 20,
  },
  backButton: {
    marginBottom: 10,
  },
  backButtonText: {
    color: '#F5B800',
    fontSize: 16,
  },
  title: {
    color: 'white',
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  subtitle: {
    color: '#94a3b8',
    fontSize: 16,
  },
  userProfileCard: {
    backgroundColor: 'rgba(30, 41, 59, 0.5)',
    borderWidth: 1,
    borderColor: 'rgba(245, 184, 0, 0.2)',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
  },
  userProfileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 16,
  },
  userAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(245, 184, 0, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(245, 184, 0, 0.3)',
  },
  avatarImage: {
    width: 76,
    height: 76,
    borderRadius: 38,
  },
  avatarText: {
    color: '#F5B800',
    fontSize: 32,
    fontWeight: 'bold',
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  userEmail: {
    color: '#94a3b8',
    fontSize: 14,
    marginBottom: 8,
  },
  userStatusBadge: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    alignSelf: 'flex-start',
  },
  userStatusText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  userStats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 16,
  },
  userStatItem: {
    flex: 1,
    minWidth: '45%',
  },
  userStatLabel: {
    color: '#94a3b8',
    fontSize: 12,
    marginBottom: 4,
  },
  userStatValue: {
    color: 'white',
    fontSize: 14,
    fontWeight: '500',
  },
  userActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  actionButton: {
    flex: 1,
    padding: 10,
    borderRadius: 6,
    alignItems: 'center',
  },
  actionButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 12,
  },
  suspendButton: {
    backgroundColor: 'rgba(245, 184, 0, 0.8)',
  },
  banButton: {
    backgroundColor: 'rgba(239, 68, 68, 0.8)',
  },
  verifyButton: {
    backgroundColor: 'rgba(16, 185, 129, 0.8)',
  },
  tabsContainer: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(245, 184, 0, 0.2)',
    marginBottom: 15,
  },
  tabButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: '#F5B800',
  },
  tabText: {
    color: '#94a3b8',
    fontWeight: '500',
  },
  activeTabText: {
    color: '#F5B800',
  },
  tabContent: {
    marginBottom: 20,
  },
  detailsCard: {
    backgroundColor: 'rgba(30, 41, 59, 0.5)',
    borderWidth: 1,
    borderColor: 'rgba(245, 184, 0, 0.2)',
    borderRadius: 8,
    padding: 16,
    marginBottom: 15,
  },
  cardTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(245, 184, 0, 0.1)',
  },
  detailLabel: {
    color: '#94a3b8',
    fontSize: 14,
  },
  detailValue: {
    color: 'white',
    fontSize: 14,
    fontWeight: '500',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
  },
  statItem: {
    width: '45%',
    backgroundColor: 'rgba(30, 41, 59, 0.7)',
    borderWidth: 1,
    borderColor: 'rgba(245, 184, 0, 0.2)',
    borderRadius: 8,
    padding: 12,
  },
  statLabel: {
    color: '#94a3b8',
    fontSize: 12,
    marginBottom: 4,
  },
  statValue: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
  },
  activityList: {
    gap: 12,
  },
  activityItem: {
    backgroundColor: 'rgba(30, 41, 59, 0.5)',
    borderWidth: 1,
    borderColor: 'rgba(245, 184, 0, 0.2)',
    borderRadius: 8,
    padding: 16,
  },
  activityHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  activityType: {
    color: '#F5B800',
    fontWeight: 'bold',
    fontSize: 14,
  },
  activityTime: {
    color: '#94a3b8',
    fontSize: 12,
  },
  activityDescription: {
    color: 'white',
    fontSize: 14,
    marginBottom: 4,
  },
  activityDetails: {
    color: '#94a3b8',
    fontSize: 12,
  },
  noDataText: {
    color: '#94a3b8',
    textAlign: 'center',
    padding: 20,
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  modalContainer: {
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: 'rgba(245, 184, 0, 0.3)',
    borderRadius: 12,
    padding: 20,
    width: '90%',
    maxWidth: 400,
  },
  modalTitle: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  modalUserInfo: {
    backgroundColor: 'rgba(30, 41, 59, 0.7)',
    borderWidth: 1,
    borderColor: 'rgba(245, 184, 0, 0.2)',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  modalUserName: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
    marginBottom: 4,
  },
  modalUserEmail: {
    color: '#94a3b8',
    fontSize: 12,
  },
  modalInputGroup: {
    marginBottom: 16,
  },
  modalLabel: {
    color: '#94a3b8',
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
  },
  modalInput: {
    backgroundColor: 'rgba(30, 41, 59, 0.7)',
    borderWidth: 1,
    borderColor: 'rgba(245, 184, 0, 0.3)',
    borderRadius: 8,
    padding: 12,
    color: 'white',
  },
  modalTextArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  modalButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalButtonText: {
    color: 'white',
    fontWeight: '500',
  },
  cancelButton: {
    backgroundColor: 'rgba(30, 41, 59, 0.7)',
  },
  confirmButton: {
    backgroundColor: '#F5B800',
  },
});