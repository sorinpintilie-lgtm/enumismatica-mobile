import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, TextInput, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { useAuth } from '../../context/AuthContext';
import { RootStackParamList } from '../../navigationTypes';
import { getUsersWithPendingVerification, updateUserVerificationStatus, isAdmin } from '@shared/adminService';
import { formatDistanceToNow } from 'date-fns';
import { ro } from 'date-fns/locale';

type VerificationScreenNavigationProp = StackNavigationProp<RootStackParamList>;

export default function VerificationScreen() {
  const { user: currentUser, loading: authLoading } = useAuth();
  const navigation = useNavigation<VerificationScreenNavigationProp>();
  const [isAdminUser, setIsAdminUser] = useState(false);
  const [loading, setLoading] = useState(true);
  const [pendingVerifications, setPendingVerifications] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [selectedVerification, setSelectedVerification] = useState<any>(null);
  const [actionReason, setActionReason] = useState('');
  const [showModal, setShowModal] = useState<'approve' | 'reject' | false>(false);
  const [activeTab, setActiveTab] = useState<'pending' | 'stats'>('pending');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending');

  useEffect(() => {
    const checkAdminAndLoad = async () => {
      if (!currentUser) {
        navigation.navigate('Login' as never);
        return;
      }

      const adminStatus = await isAdmin(currentUser.uid);
      if (!adminStatus) {
        navigation.navigate('Dashboard' as never);
        return;
      }

      setIsAdminUser(true);
      await loadData();
      setLoading(false);
    };

    if (!authLoading) {
      checkAdminAndLoad();
    }
  }, [currentUser, authLoading]);

  const loadData = async () => {
    try {
      // Load pending verifications
      const verifications = await getUsersWithPendingVerification();
      setPendingVerifications(verifications);

      // Load stats (placeholder for now)
      const statsData = {
        totalVerifications: verifications.length,
        pendingCount: verifications.length,
        approvedCount: 0,
        rejectedCount: 0,
        approvalRate: 0,
        rejectionRate: 0,
        avgProcessingTime: 'N/A'
      };
      setStats(statsData);
    } catch (error) {
      console.error('Error loading verification data:', error);
    }
  };

  const handleApprove = async (verificationId: string) => {
    if (!currentUser) return;
    if (!actionReason.trim()) {
      Alert.alert('Error', 'Te rog introdu un motiv pentru aprobare');
      return;
    }

    try {
      await updateUserVerificationStatus(
        verificationId,
        'verified',
        currentUser.uid
      );
      Alert.alert('Success', 'Verificare aprobată cu succes!');
      setShowModal(false);
      setActionReason('');
      await loadData();
    } catch (error) {
      Alert.alert('Error', `Eroare: ${error}`);
    }
  };

  const handleReject = async (verificationId: string) => {
    if (!currentUser) return;
    if (!actionReason.trim()) {
      Alert.alert('Error', 'Te rog introdu un motiv pentru respingere');
      return;
    }

    try {
      await updateUserVerificationStatus(
        verificationId,
        'rejected',
        currentUser.uid
      );
      Alert.alert('Success', 'Verificare respinsă cu succes!');
      setShowModal(false);
      setActionReason('');
      await loadData();
    } catch (error) {
      Alert.alert('Error', `Eroare: ${error}`);
    }
  };

  const filteredVerifications = pendingVerifications.filter((verification) => {
    const matchesSearch = 
      verification.userName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      verification.userEmail.toLowerCase().includes(searchQuery.toLowerCase()) ||
      verification.documentNumber.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = filterStatus === 'all' || verification.status === filterStatus;

    return matchesSearch && matchesStatus;
  });

  if (authLoading || loading || !isAdminUser) {
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
          <Text style={styles.title}>Verificare Utilizatori</Text>
          <Text style={styles.subtitle}>Gestionare documente de identitate și verificări</Text>
        </View>

        {/* Stats Overview */}
        {stats && (
          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>Total Verificări</Text>
              <Text style={styles.statValue}>{stats.totalVerifications}</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>În Așteptare</Text>
              <Text style={[styles.statValue, styles.yellowText]}>{stats.pendingCount}</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>Aprobate</Text>
              <Text style={[styles.statValue, styles.greenText]}>{stats.approvedCount}</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>Respinse</Text>
              <Text style={[styles.statValue, styles.redText]}>{stats.rejectedCount}</Text>
            </View>
          </View>
        )}

        {/* Tabs */}
        <View style={styles.tabsContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {['pending', 'stats'].map((tab) => (
              <TouchableOpacity
                key={tab}
                onPress={() => setActiveTab(tab as any)}
                style={[styles.tabButton, activeTab === tab && styles.activeTab]}
              >
                <Text style={[styles.tabText, activeTab === tab && styles.activeTabText]}>
                  {tab === 'pending' && `În Așteptare (${pendingVerifications.length})`}
                  {tab === 'stats' && 'Statistici'}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Tab Content */}
        {activeTab === 'pending' && (
          <View style={styles.tabContent}>
            {/* Filters */}
            <View style={styles.filters}>
              <TextInput
                style={styles.searchInput}
                placeholder="Caută utilizatori sau documente..."
                placeholderTextColor="#64748b"
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
              <View style={styles.filterButtons}>
                {['all', 'pending', 'approved', 'rejected'].map((status) => (
                  <TouchableOpacity
                    key={status}
                    onPress={() => setFilterStatus(status as any)}
                    style={[styles.filterButton, filterStatus === status && styles.activeFilterButton]}
                  >
                    <Text style={[styles.filterButtonText, filterStatus === status && styles.activeFilterButtonText]}>
                      {status === 'all' && 'Toate'}
                      {status === 'pending' && 'În Așteptare'}
                      {status === 'approved' && 'Aprobate'}
                      {status === 'rejected' && 'Respinse'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Verification List */}
            {filteredVerifications.length === 0 ? (
              <Text style={styles.noDataText}>Nicio verificare în așteptare</Text>
            ) : (
              <View style={styles.verificationList}>
                {filteredVerifications.map((verification) => (
                  <View key={verification.id} style={styles.verificationItem}>
                    <View style={styles.verificationHeader}>
                      <View>
                        <Text style={styles.verificationUserName}>{verification.userName}</Text>
                        <Text style={styles.verificationUserEmail}>{verification.userEmail}</Text>
                      </View>
                      <View style={styles.verificationStatusBadge}>
                        <Text style={styles.verificationStatusText}>
                          {verification.status === 'pending' && 'În Așteptare'}
                          {verification.status === 'approved' && 'Aprobat'}
                          {verification.status === 'rejected' && 'Respins'}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.verificationDetails}>
                      <Text style={styles.verificationDetailText}>
                        Tip document: <Text style={styles.goldText}>{verification.documentType}</Text>
                      </Text>
                      <Text style={styles.verificationDetailText}>
                        Serie: <Text style={styles.goldText}>{verification.documentSeries || 'N/A'}</Text>
                      </Text>
                      <Text style={styles.verificationDetailText}>
                        Număr: <Text style={styles.goldText}>{verification.documentNumber}</Text>
                      </Text>
                      <Text style={styles.verificationDetailText}>
                        Data înregistrării: <Text style={styles.goldText}>
                          {formatDistanceToNow(verification.createdAt.toDate(), { addSuffix: true, locale: ro })}
                        </Text>
                      </Text>
                    </View>

                    <View style={styles.verificationActions}>
                      <TouchableOpacity
                        onPress={() => {
                          setSelectedVerification(verification);
                          setShowModal('approve');
                        }}
                        disabled={verification.status !== 'pending'}
                        style={[styles.actionButton, styles.approveButton]}
                      >
                        <Text style={styles.actionButtonText}>Aprobă</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => {
                          setSelectedVerification(verification);
                          setShowModal('reject');
                        }}
                        disabled={verification.status !== 'pending'}
                        style={[styles.actionButton, styles.rejectButton]}
                      >
                        <Text style={styles.actionButtonText}>Respinge</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        {activeTab === 'stats' && (
          <View style={styles.tabContent}>
            <View style={styles.statsCard}>
              <Text style={styles.cardTitle}>Statistici Detaliate</Text>
              <View style={styles.statsDetails}>
                <View style={styles.statDetailRow}>
                  <Text style={styles.statDetailLabel}>Rată de aprobare:</Text>
                  <Text style={[styles.statDetailValue, styles.greenText]}>
                    {stats.approvalRate}%
                  </Text>
                </View>
                <View style={styles.statDetailRow}>
                  <Text style={styles.statDetailLabel}>Rată de respingere:</Text>
                  <Text style={[styles.statDetailValue, styles.redText]}>
                    {stats.rejectionRate}%
                  </Text>
                </View>
                <View style={styles.statDetailRow}>
                  <Text style={styles.statDetailLabel}>Timp mediu de procesare:</Text>
                  <Text style={styles.statDetailValue}>
                    {stats.avgProcessingTime || 'N/A'}
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.statsCard}>
              <Text style={styles.cardTitle}>Verificări Recent</Text>
              <Text style={styles.noDataText}>Funcționalitate disponibilă în viitor</Text>
            </View>
          </View>
        )}

        {/* Action Modal */}
        {showModal && selectedVerification && (
          <View style={styles.modalOverlay}>
            <View style={styles.modalContainer}>
              <Text style={styles.modalTitle}>
                {showModal === 'approve' && 'Aprobă Verificare'}
                {showModal === 'reject' && 'Respinge Verificare'}
              </Text>

              <View style={styles.modalUserInfo}>
                <Text style={styles.modalUserName}>{selectedVerification.userName}</Text>
                <Text style={styles.modalUserEmail}>{selectedVerification.userEmail}</Text>
                <Text style={styles.modalDocumentInfo}>
                  {selectedVerification.documentType} • {selectedVerification.documentNumber}
                </Text>
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
                    setShowModal(false);
                    setActionReason('');
                  }}
                  style={[styles.modalButton, styles.cancelButton]}
                >
                  <Text style={styles.modalButtonText}>Anulează</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => {
                    if (showModal === 'approve') handleApprove(selectedVerification.id);
                    else if (showModal === 'reject') handleReject(selectedVerification.id);
                  }}
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
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  statCard: {
    width: '45%',
    backgroundColor: 'rgba(30, 41, 59, 0.5)',
    borderWidth: 1,
    borderColor: 'rgba(245, 184, 0, 0.2)',
    borderRadius: 8,
    padding: 16,
    marginBottom: 10,
  },
  statLabel: {
    color: '#94a3b8',
    fontSize: 12,
    marginBottom: 4,
  },
  statValue: {
    color: 'white',
    fontSize: 24,
    fontWeight: 'bold',
  },
  yellowText: {
    color: '#fbbf24',
  },
  greenText: {
    color: '#10b981',
  },
  redText: {
    color: '#ef4444',
  },
  goldText: {
    color: '#F5B800',
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
  filters: {
    marginBottom: 16,
    gap: 12,
  },
  searchInput: {
    backgroundColor: 'rgba(30, 41, 59, 0.7)',
    borderWidth: 1,
    borderColor: 'rgba(245, 184, 0, 0.3)',
    borderRadius: 8,
    padding: 12,
    color: 'white',
    fontSize: 14,
  },
  filterButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(245, 184, 0, 0.3)',
  },
  filterButtonText: {
    color: '#94a3b8',
    fontSize: 12,
  },
  activeFilterButton: {
    backgroundColor: 'rgba(245, 184, 0, 0.2)',
    borderColor: 'rgba(245, 184, 0, 0.4)',
  },
  activeFilterButtonText: {
    color: '#F5B800',
    fontWeight: 'bold',
  },
  verificationList: {
    gap: 12,
  },
  verificationItem: {
    backgroundColor: 'rgba(30, 41, 59, 0.5)',
    borderWidth: 1,
    borderColor: 'rgba(245, 184, 0, 0.2)',
    borderRadius: 8,
    padding: 16,
  },
  verificationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  verificationUserName: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  verificationUserEmail: {
    color: '#94a3b8',
    fontSize: 12,
  },
  verificationStatusBadge: {
    backgroundColor: 'rgba(245, 184, 0, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(245, 184, 0, 0.3)',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    justifyContent: 'center',
  },
  verificationStatusText: {
    color: '#F5B800',
    fontSize: 12,
    fontWeight: 'bold',
  },
  verificationDetails: {
    gap: 8,
    marginBottom: 12,
  },
  verificationDetailText: {
    color: '#94a3b8',
    fontSize: 14,
  },
  verificationActions: {
    flexDirection: 'row',
    gap: 8,
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
  approveButton: {
    backgroundColor: 'rgba(16, 185, 129, 0.8)',
  },
  rejectButton: {
    backgroundColor: 'rgba(239, 68, 68, 0.8)',
  },
  noDataText: {
    color: '#94a3b8',
    textAlign: 'center',
    padding: 20,
  },
  statsCard: {
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
  statsDetails: {
    gap: 12,
  },
  statDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statDetailLabel: {
    color: '#94a3b8',
    fontSize: 14,
  },
  statDetailValue: {
    fontWeight: '500',
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
    marginBottom: 4,
  },
  modalDocumentInfo: {
    color: '#F5B800',
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
