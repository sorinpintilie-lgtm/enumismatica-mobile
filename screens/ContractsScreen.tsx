import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Modal,
  Share,
  Alert,
  Linking,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { getOrdersForBuyer, getSalesForSeller } from '@shared/orderService';
import type { Order } from '@shared/types';
import {
  createContractFromOrder,
  getContractsForUser,
  acceptContract,
  rejectContract,
  raiseContractDispute,
  cancelContractESign,
  type AppContract,
  type ContractRole,
  type ContractStatus,
  type ContractESignStatus,
  type ContractRejectionReason,
  buildContractNumber,
  startContractESign,
  syncContractESignStatus,
} from '@shared/contractService';
import { colors } from '../styles/sharedStyles';
import InlineBackButton from '../components/InlineBackButton';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// =====================================================
// TYPES
// =====================================================

type SourceOrderItem = {
  order: Order;
  role: ContractRole;
  contractNumber: string;
};

type FilterStatus = 'all' | ContractStatus;

// =====================================================
// CONSTANTS
// =====================================================

const STATUS_LABELS: Record<ContractStatus, string> = {
  'draft': 'Ciornă',
  'pending': 'În așteptare',
  'accepted': 'Acceptat',
  'immutable': 'Finalizat',
  'rejected': 'Refuzat',
  'cancelled': 'Anulat',
};

const STATUS_COLORS: Record<ContractStatus, string> = {
  'draft': '#6b7280',
  'pending': '#f59e0b',
  'accepted': '#3b82f6',
  'immutable': '#22c55e',
  'rejected': '#ef4444',
  'cancelled': '#9333ea',
};

const ESIGN_STATUS_LABELS: Record<ContractESignStatus, string> = {
  'not_started': 'Nesemnat',
  'in_progress': 'În semnare',
  'completed': 'Semnat complet',
  'canceled': 'Anulat la semnare',
  'rejected': 'Respins la semnare',
  'failed': 'Eroare semnare',
};

const ESIGN_STATUS_COLORS: Record<ContractESignStatus, string> = {
  'not_started': '#6b7280',
  'in_progress': '#f59e0b',
  'completed': '#22c55e',
  'canceled': '#9333ea',
  'rejected': '#ef4444',
  'failed': '#ef4444',
};

// =====================================================
// HELPER FUNCTIONS
// =====================================================

const formatStatusLabel = (status: Order['status']): string => {
  switch (status) {
    case 'paid':
      return 'Plătită';
    case 'payment_marked_by_buyer':
      return 'Plată marcată';
    case 'pending':
      return 'În așteptare';
    case 'cancelled':
      return 'Anulată';
    case 'failed':
      return 'Eșuată';
    case 'refunded':
      return 'Rambursată';
    default:
      return status;
  }
};

const statusColor = (status: Order['status']): string => {
  switch (status) {
    case 'paid':
      return '#22c55e';
    case 'payment_marked_by_buyer':
      return '#3b82f6';
    case 'pending':
      return '#f59e0b';
    case 'cancelled':
    case 'failed':
      return '#ef4444';
    case 'refunded':
      return '#9333ea';
    default:
      return colors.textSecondary;
  }
};

const buildSourceContractDocId = (orderId: string, role: ContractRole, userId: string) =>
  `${orderId}_${role}_${userId}`;

// =====================================================
// MAIN COMPONENT
// =====================================================

export default function ContractsScreen() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [transactionId, setTransactionId] = useState('');
  const [statusFilter, setStatusFilter] = useState<FilterStatus>('all');
  const [sourceOrders, setSourceOrders] = useState<SourceOrderItem[]>([]);
  const [contracts, setContracts] = useState<AppContract[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedContract, setSelectedContract] = useState<AppContract | null>(null);
  const [creatingContractKey, setCreatingContractKey] = useState<string | null>(null);
  const [accepting, setAccepting] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [disputing, setDisputing] = useState(false);
  const [eSigningId, setESigningId] = useState<string | null>(null);
  const [eSignSyncingId, setESignSyncingId] = useState<string | null>(null);
  const [eSignCancellingId, setESignCancellingId] = useState<string | null>(null);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showDisputeModal, setShowDisputeModal] = useState(false);
  const [rejectReason, setRejectReason] = useState<ContractRejectionReason | null>(null);
  const [rejectAdditionalReason, setRejectAdditionalReason] = useState('');
  const [disputeReason, setDisputeReason] = useState('');

  const loadContractsData = useCallback(async () => {
    if (!user?.uid) {
      setSourceOrders([]);
      setContracts([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const [buyerOrders, sellerOrders, loadedContracts] = await Promise.all([
        getOrdersForBuyer(user.uid),
        getSalesForSeller(user.uid),
        getContractsForUser(user.uid),
      ]);

      const buyerSources: SourceOrderItem[] = buyerOrders.map((order) => ({
        order,
        role: 'buyer' as ContractRole,
        contractNumber: buildContractNumber(order.id, 'buyer'),
      }));

      const sellerSources: SourceOrderItem[] = sellerOrders.map((order) => ({
        order,
        role: 'seller' as ContractRole,
        contractNumber: buildContractNumber(order.id, 'seller'),
      }));

      const mergedSources = [...buyerSources, ...sellerSources].sort((a, b) => {
        const aTime = a.order.createdAt?.getTime?.() ?? 0;
        const bTime = b.order.createdAt?.getTime?.() ?? 0;
        return bTime - aTime;
      });

      setSourceOrders(mergedSources);
      setContracts(loadedContracts);
    } catch (err: any) {
      console.error('Failed to load contracts:', err);
      setError(err?.message || 'Nu s-au putut încărca contractele.');
    } finally {
      setLoading(false);
    }
  }, [user?.uid]);

  useEffect(() => {
    loadContractsData();
  }, [loadContractsData]);

  const filteredContracts = useMemo(() => {
    let result = contracts;

    // Filter by status
    if (statusFilter !== 'all') {
      result = result.filter((item) => item.status === statusFilter);
    }

    // Filter by search text
    const needle = transactionId.trim().toLowerCase();
    if (needle) {
      result = result.filter((item) => {
        const orderId = item.orderId.toLowerCase();
        const contractNumber = item.contractNumber.toLowerCase();
        const title = String(item.title || '').toLowerCase();
        const productName = item.productName.toLowerCase();
        return (
          orderId.includes(needle) ||
          contractNumber.includes(needle) ||
          title.includes(needle) ||
          productName.includes(needle)
        );
      });
    }

    return result;
  }, [contracts, statusFilter, transactionId]);

  const filteredSourceOrders = useMemo(() => {
    const needle = transactionId.trim().toLowerCase();
    if (!needle) return sourceOrders;

    return sourceOrders.filter((item) => {
      const orderId = item.order.id.toLowerCase();
      const contractNumber = item.contractNumber.toLowerCase();
      return orderId.includes(needle) || contractNumber.includes(needle);
    });
  }, [sourceOrders, transactionId]);

  const contractById = useMemo(() => {
    const map = new Map<string, AppContract>();
    contracts.forEach((c) => map.set(c.id, c));
    return map;
  }, [contracts]);

  const selectedContractText = selectedContract?.body || '';

  const shareContract = async (item: AppContract) => {
    await Share.share({
      title: `Contract ${item.contractNumber}`,
      message: item.body,
    });
  };

  const handleAcceptContract = async () => {
    if (!user?.uid || !selectedContract) return;
    setAccepting(true);
    try {
      const updated = await acceptContract(selectedContract.id, user.uid);
      setSelectedContract(updated);
      const refreshed = await getContractsForUser(user.uid);
      setContracts(refreshed);
    } catch (err: any) {
      Alert.alert('Eroare', err?.message || 'Nu s-a putut înregistra acceptarea contractului.');
    } finally {
      setAccepting(false);
    }
  };

  const handleRejectContract = async () => {
    if (!user?.uid || !selectedContract || !rejectReason) return;
    setRejecting(true);
    try {
      const updated = await rejectContract(selectedContract.id, user.uid, rejectReason, rejectAdditionalReason);
      setSelectedContract(updated);
      const refreshed = await getContractsForUser(user.uid);
      setContracts(refreshed);
      setShowRejectModal(false);
      setRejectReason(null);
      setRejectAdditionalReason('');
    } catch (err: any) {
      Alert.alert('Eroare', err?.message || 'Nu s-a putut respinge contractul.');
    } finally {
      setRejecting(false);
    }
  };

  const handleRaiseDispute = async () => {
    if (!user?.uid || !selectedContract || !disputeReason.trim()) return;
    setDisputing(true);
    try {
      const updated = await raiseContractDispute(selectedContract.id, user.uid, disputeReason);
      setSelectedContract(updated);
      const refreshed = await getContractsForUser(user.uid);
      setContracts(refreshed);
      setShowDisputeModal(false);
      setDisputeReason('');
    } catch (err: any) {
      Alert.alert('Eroare', err?.message || 'Nu s-a putut înregistra disputa.');
    } finally {
      setDisputing(false);
    }
  };

  const handleCreateContract = async (source: SourceOrderItem) => {
    if (!user?.uid) return;

    const sourceKey = buildSourceContractDocId(source.order.id, source.role, user.uid);
    setCreatingContractKey(sourceKey);
    setError(null);

    try {
      const created = await createContractFromOrder(source.order, user.uid, source.role);
      setSelectedContract(created);
      const refreshed = await getContractsForUser(user.uid);
      setContracts(refreshed);
    } catch (err: any) {
      console.error('Failed to create contract:', err);
      Alert.alert('Eroare', err?.message || 'Nu s-a putut crea contractul.');
    } finally {
      setCreatingContractKey(null);
    }
  };

  const handleStartESign = async (contract: AppContract) => {
    setESigningId(contract.id);
    try {
      await startContractESign(contract.id);
      const refreshed = await getContractsForUser(user?.uid || '');
      setContracts(refreshed);
      const updated = refreshed.find((c) => c.id === contract.id) || null;
      if (selectedContract?.id === contract.id) {
        setSelectedContract(updated);
      }
      Alert.alert('Semnare inițiată', 'Contractul a fost trimis către eSemnează. Verifică statusul semnării.');
    } catch (err: any) {
      Alert.alert('Eroare', err?.message || 'Nu s-a putut iniția semnarea electronică.');
    } finally {
      setESigningId(null);
    }
  };

  const handleSyncESign = async (contract: AppContract) => {
    setESignSyncingId(contract.id);
    try {
      await syncContractESignStatus(contract.id);
      const refreshed = await getContractsForUser(user?.uid || '');
      setContracts(refreshed);
      const updated = refreshed.find((c) => c.id === contract.id) || null;
      if (selectedContract?.id === contract.id) {
        setSelectedContract(updated);
      }
    } catch (err: any) {
      Alert.alert('Eroare', err?.message || 'Nu s-a putut sincroniza statusul semnării.');
    } finally {
      setESignSyncingId(null);
    }
  };

  const handleCancelESign = async (contract: AppContract) => {
    setESignCancellingId(contract.id);
    try {
      await cancelContractESign(contract.id);
      const refreshed = await getContractsForUser(user?.uid || '');
      setContracts(refreshed);
      const updated = refreshed.find((c) => c.id === contract.id) || null;
      if (selectedContract?.id === contract.id) {
        setSelectedContract(updated);
      }
      Alert.alert('Semnare anulată', 'Solicitarea de semnare a fost anulată.');
    } catch (err: any) {
      Alert.alert('Eroare', err?.message || 'Nu s-a putut anula semnarea.');
    } finally {
      setESignCancellingId(null);
    }
  };

  const getESignStatus = (contract: AppContract): ContractESignStatus => {
    return contract.eSignStatus || 'not_started';
  };

  // Status filter buttons
  const renderStatusFilters = () => (
    <View style={styles.filterRow}>
      <TouchableOpacity
        style={[styles.filterBtn, statusFilter === 'all' && styles.filterBtnActive]}
        onPress={() => setStatusFilter('all')}
      >
        <Text style={[styles.filterBtnText, statusFilter === 'all' && styles.filterBtnTextActive]}>
          Toate
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.filterBtn, statusFilter === 'draft' && styles.filterBtnActive]}
        onPress={() => setStatusFilter('draft')}
      >
        <Text style={[styles.filterBtnText, statusFilter === 'draft' && styles.filterBtnTextActive]}>
          {STATUS_LABELS.draft}
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.filterBtn, statusFilter === 'pending' && styles.filterBtnActive]}
        onPress={() => setStatusFilter('pending')}
      >
        <Text style={[styles.filterBtnText, statusFilter === 'pending' && styles.filterBtnTextActive]}>
          {STATUS_LABELS.pending}
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.filterBtn, statusFilter === 'immutable' && styles.filterBtnActive]}
        onPress={() => setStatusFilter('immutable')}
      >
        <Text style={[styles.filterBtnText, statusFilter === 'immutable' && styles.filterBtnTextActive]}>
          {STATUS_LABELS.immutable}
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.filterBtn, statusFilter === 'cancelled' && styles.filterBtnActive]}
        onPress={() => setStatusFilter('cancelled')}
      >
        <Text style={[styles.filterBtnText, statusFilter === 'cancelled' && styles.filterBtnTextActive]}>
          {STATUS_LABELS.cancelled}
        </Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[
        styles.content,
        {
          paddingTop: Math.max(insets.top, 12),
          paddingBottom: Math.max(insets.bottom + 96, 96),
        },
      ]}
      keyboardShouldPersistTaps="handled"
    >
      <View style={{ marginBottom: 16 }}>
        <InlineBackButton />
        <Text style={[styles.title, { marginTop: 12, textAlign: 'left' }]}>Contractele mele</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Contracte generate în aplicație</Text>
        <Text style={styles.cardText}>
          Selectează o tranzacție și apasă „Creează contract". Contractul include toate detaliile produsului și este salvat în aplicație.
        </Text>

        <Text style={styles.label}>Caută după ID / Nr. contract / Produs</Text>
        <TextInput
          value={transactionId}
          onChangeText={setTransactionId}
          placeholder="ex: abc123 sau 5 lei 1951..."
          placeholderTextColor={colors.textSecondary}
          style={styles.input}
          autoCapitalize="none"
          autoCorrect={false}
        />

        {renderStatusFilters()}

        <TouchableOpacity style={styles.secondaryBtn} activeOpacity={0.9} onPress={loadContractsData}>
          <Text style={styles.secondaryBtnText}>Reîncarcă</Text>
        </TouchableOpacity>
      </View>

      {!loading && !error && (
        <View style={{ marginTop: 10, marginBottom: 4 }}>
          <Text style={styles.sectionTitle}>Tranzacții disponibile pentru contract</Text>
        </View>
      )}

      {!loading && !error && filteredSourceOrders.map((source) => {
        const createdAt =
          source.order.createdAt instanceof Date
            ? source.order.createdAt
            : new Date(source.order.createdAt);
        const sourceKey =
          user?.uid ? buildSourceContractDocId(source.order.id, source.role, user.uid) : `${source.order.id}_${source.role}`;
        const existing = contractById.get(sourceKey);
        const isCreating = creatingContractKey === sourceKey;

        return (
          <View key={sourceKey} style={styles.contractCard}>
            <View style={styles.contractHeaderRow}>
              <View style={{ flex: 1, marginRight: 10 }}>
                <Text style={styles.contractNumber}>{source.contractNumber}</Text>
                <Text style={styles.contractMeta}>Tranzacție: {source.order.id.slice(0, 12)}...</Text>
              </View>
              <Text style={[styles.statusBadge, { color: statusColor(source.order.status) }]}>
                {formatStatusLabel(source.order.status)}
              </Text>
            </View>

            <Text style={styles.contractMeta}>Rol: {source.role === 'buyer' ? 'Cumpărător' : 'Vânzător'}</Text>
            <Text style={styles.contractMeta}>Produs ID: {source.order.productId.slice(0, 16)}...</Text>
            <Text style={styles.contractMeta}>Valoare: {source.order.price.toFixed(2)} {source.order.currency}</Text>
            <Text style={styles.contractMeta}>Data: {createdAt.toLocaleDateString('ro-RO')}</Text>
            
            {existing && (
              <View style={styles.existingContractBadge}>
                <Text style={styles.existingContractText}>
                  ✓ Contract: {existing.productName}
                </Text>
              </View>
            )}

            <View style={styles.actionsRow}>
              <TouchableOpacity
                style={[styles.primaryBtn, { flex: 1, marginBottom: 0, marginRight: 8 }]}
                activeOpacity={0.9}
                onPress={() => handleCreateContract(source)}
                disabled={isCreating}
              >
                <Text style={styles.primaryBtnText}>
                  {isCreating ? 'Se creează...' : existing ? 'Actualizează' : 'Creează contract'}
                </Text>
              </TouchableOpacity>

              {!!existing && (
                <TouchableOpacity
                  style={[styles.secondaryBtn, { flex: 1 }]}
                  activeOpacity={0.9}
                  onPress={() => setSelectedContract(existing)}
                >
                  <Text style={styles.secondaryBtnText}>Vezi</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        );
      })}

      {!loading && !error && (
        <View style={{ marginTop: 6, marginBottom: 4 }}>
          <Text style={styles.sectionTitle}>
            Contracte salvate ({filteredContracts.length})
          </Text>
        </View>
      )}

      {loading ? (
        <View style={styles.stateCard}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={styles.stateText}>Se încarcă...</Text>
        </View>
      ) : error ? (
        <View style={styles.stateCard}>
          <Text style={[styles.stateText, { color: colors.error }]}>{error}</Text>
        </View>
      ) : filteredContracts.length === 0 ? (
        <View style={styles.stateCard}>
          <Text style={styles.stateText}>
            {statusFilter === 'all' 
              ? 'Nu ai contracte create.' 
              : `Nu ai contracte cu statusul "${STATUS_LABELS[statusFilter]}".`}
          </Text>
        </View>
      ) : (
        filteredContracts.map((item) => {
          const createdAt = item.createdAt instanceof Date ? item.createdAt : new Date(item.createdAt);
          return (
            <View key={item.id} style={styles.contractCard}>
              <View style={styles.contractHeaderRow}>
                <View style={{ flex: 1, marginRight: 10 }}>
                  <Text style={styles.contractNumber}>{item.contractNumber}</Text>
                  <Text style={styles.contractMeta}>Produs: {item.productName}</Text>
                </View>
                <View style={[styles.statusBadgeContainer, { backgroundColor: STATUS_COLORS[item.status] + '20' }]}>
                  <Text style={[styles.statusBadge, { color: STATUS_COLORS[item.status] }]}>
                    {STATUS_LABELS[item.status]}
                  </Text>
                </View>
              </View>

              <Text style={styles.contractMeta}>Rol: {item.role === 'buyer' ? 'Cumpărător' : 'Vânzător'}</Text>
              <Text style={styles.contractMeta}>Valoare: {item.body.match(/PREȚUL TOTAL:\s*(.+)/)?.[1] || 'N/A'}</Text>
              <Text style={styles.contractMeta}>Creat: {createdAt.toLocaleDateString('ro-RO')}</Text>

              <View
                style={[
                  styles.eSignBadge,
                  { backgroundColor: `${ESIGN_STATUS_COLORS[getESignStatus(item)]}22` },
                ]}
              >
                <Text style={[styles.eSignBadgeText, { color: ESIGN_STATUS_COLORS[getESignStatus(item)] }]}>
                  Semnare: {ESIGN_STATUS_LABELS[getESignStatus(item)]}
                </Text>
              </View>
              
              {/* Product details in contract card */}
              {item.productYear && (
                <Text style={styles.contractMeta}>An: {item.productYear}</Text>
              )}
              {item.productCountry && (
                <Text style={styles.contractMeta}>Țară: {item.productCountry}</Text>
              )}
              {item.productCondition && (
                <Text style={styles.contractMeta}>Stare: {item.productCondition}</Text>
              )}

              {/* Acceptance status */}
              <View style={styles.acceptanceRow}>
                <View style={[styles.acceptanceBadge, item.buyerAcceptedAt ? styles.acceptanceBadgeYes : styles.acceptanceBadgeNo]}>
                  <Text style={styles.acceptanceText}>
                    Cumpărător: {item.buyerAcceptedAt ? '✓' : '✗'}
                  </Text>
                </View>
                <View style={[styles.acceptanceBadge, item.sellerAcceptedAt ? styles.acceptanceBadgeYes : styles.acceptanceBadgeNo]}>
                  <Text style={styles.acceptanceText}>
                    Vânzător: {item.sellerAcceptedAt ? '✓' : '✗'}
                  </Text>
                </View>
              </View>

              <View style={styles.actionsRow}>
                <TouchableOpacity
                  style={[styles.primaryBtn, { flex: 1, marginBottom: 0, marginRight: 8 }]}
                  activeOpacity={0.9}
                  onPress={() => setSelectedContract(item)}
                >
                  <Text style={styles.primaryBtnText}>Vezi contract</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.secondaryBtn, { flex: 1 }]}
                  activeOpacity={0.9}
                  onPress={() => shareContract(item)}
                >
                  <Text style={styles.secondaryBtnText}>Partajează</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.actionsRow}>
                {(getESignStatus(item) === 'not_started' || getESignStatus(item) === 'failed') && (
                  <TouchableOpacity
                    style={[styles.warningBtn, { flex: 1, marginRight: 8, marginBottom: 0 }]}
                    activeOpacity={0.9}
                    onPress={() => handleStartESign(item)}
                    disabled={eSigningId === item.id}
                  >
                    <Text style={styles.warningBtnText}>
                      {eSigningId === item.id ? 'Se trimite...' : 'Trimite la semnare'}
                    </Text>
                  </TouchableOpacity>
                )}

                {(getESignStatus(item) === 'in_progress' || getESignStatus(item) === 'completed') && (
                  <TouchableOpacity
                    style={[styles.secondaryBtn, { flex: 1, marginBottom: 0 }]}
                    activeOpacity={0.9}
                    onPress={() => handleSyncESign(item)}
                    disabled={eSignSyncingId === item.id}
                  >
                    <Text style={styles.secondaryBtnText}>
                      {eSignSyncingId === item.id ? 'Se sincronizează...' : 'Sincronizează semnarea'}
                    </Text>
                  </TouchableOpacity>
                )}

                {getESignStatus(item) === 'in_progress' && (
                  <TouchableOpacity
                    style={[styles.dangerBtn, { flex: 1, marginLeft: 8, marginBottom: 0 }]}
                    activeOpacity={0.9}
                    onPress={() => handleCancelESign(item)}
                    disabled={eSignCancellingId === item.id}
                  >
                    <Text style={styles.dangerBtnText}>
                      {eSignCancellingId === item.id ? 'Se anulează...' : 'Anulează semnarea'}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          );
        })
      )}

      <Modal visible={!!selectedContract} animationType="slide" onRequestClose={() => setSelectedContract(null)}>
        <View style={styles.modalContainer}>
          <View style={[styles.modalHeader, { paddingTop: Math.max(insets.top, 12), paddingBottom: 16 }]}> 
            <Text style={styles.modalTitle}>{selectedContract?.contractNumber || 'Contract'}</Text>
            <TouchableOpacity onPress={() => setSelectedContract(null)}>
              <Text style={styles.modalClose}>Închide</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            {!!selectedContract && (
              <View style={{ marginBottom: 12 }}>
                <View
                  style={[
                    styles.eSignBadge,
                    { backgroundColor: `${ESIGN_STATUS_COLORS[getESignStatus(selectedContract)]}22` },
                  ]}
                >
                  <Text
                    style={[
                      styles.eSignBadgeText,
                      { color: ESIGN_STATUS_COLORS[getESignStatus(selectedContract)] },
                    ]}
                  >
                    Semnare electronică: {ESIGN_STATUS_LABELS[getESignStatus(selectedContract)]}
                  </Text>
                </View>

                {!!selectedContract.eSignCompletedDocUrl && (
                  <TouchableOpacity
                    style={[styles.secondaryBtn, { marginTop: 10 }]}
                    onPress={() => Linking.openURL(selectedContract.eSignCompletedDocUrl || '')}
                  >
                    <Text style={styles.secondaryBtnText}>Deschide PDF semnat</Text>
                  </TouchableOpacity>
                )}

                {Array.isArray(selectedContract.eSignRecipients) && selectedContract.eSignRecipients.length > 0 && (
                  <View style={{ marginTop: 10 }}>
                    {selectedContract.eSignRecipients.map((recipient, idx) => (
                      <View key={`${recipient.id || recipient.email || idx}`} style={styles.recipientRow}>
                        <Text style={styles.recipientText}>
                          {recipient.role === 'buyer' ? 'Cumpărător' : 'Vânzător'}: {recipient.name || recipient.email || 'Semnatar'}
                        </Text>
                        {!!recipient.email && (
                          <Text style={styles.recipientSubText}>Email: {recipient.email}</Text>
                        )}
                        <Text style={styles.recipientSubText}>{recipient.sigStatus || 'PENDING'}</Text>
                        {!!recipient.signUrl && (
                          <TouchableOpacity onPress={() => Linking.openURL(recipient.signUrl || '')}>
                            <Text style={styles.signUrlText}>Deschide link semnare</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    ))}
                  </View>
                )}
              </View>
            )}

            <Text style={styles.contractText}>{selectedContractText}</Text>
          </ScrollView>

          <View style={[styles.modalFooter, { paddingBottom: Math.max(insets.bottom + 12, 16) }]}>
            {!!selectedContract && !selectedContract.immutableAfterBothAccepted && selectedContract.status !== 'cancelled' && (
              <>
                {(getESignStatus(selectedContract) === 'not_started' || getESignStatus(selectedContract) === 'failed') && (
                  <TouchableOpacity
                    style={[styles.warningBtn, { marginBottom: 10 }]}
                    onPress={() => handleStartESign(selectedContract)}
                    disabled={eSigningId === selectedContract.id}
                  >
                    <Text style={styles.warningBtnText}>
                      {eSigningId === selectedContract.id ? 'Se trimite...' : 'Trimite contractul la semnare'}
                    </Text>
                  </TouchableOpacity>
                )}

                {(getESignStatus(selectedContract) === 'in_progress' || getESignStatus(selectedContract) === 'completed') && (
                  <TouchableOpacity
                    style={[styles.secondaryBtn, { marginBottom: 10 }]}
                    onPress={() => handleSyncESign(selectedContract)}
                    disabled={eSignSyncingId === selectedContract.id}
                  >
                    <Text style={styles.secondaryBtnText}>
                      {eSignSyncingId === selectedContract.id ? 'Se sincronizează...' : 'Sincronizează status semnare'}
                    </Text>
                  </TouchableOpacity>
                )}

                {getESignStatus(selectedContract) === 'in_progress' && (
                  <TouchableOpacity
                    style={[styles.dangerBtn, { marginBottom: 10 }]}
                    onPress={() => handleCancelESign(selectedContract)}
                    disabled={eSignCancellingId === selectedContract.id}
                  >
                    <Text style={styles.dangerBtnText}>
                      {eSignCancellingId === selectedContract.id ? 'Se anulează...' : 'Anulează solicitarea de semnare'}
                    </Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  style={[styles.secondaryBtn, { marginBottom: 10 }]}
                  onPress={handleAcceptContract}
                  disabled={accepting}
                >
                  <Text style={styles.secondaryBtnText}>
                    {accepting ? 'Se acceptă...' : 'Acceptă contractul'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.dangerBtn, { marginBottom: 10 }]}
                  onPress={() => setShowRejectModal(true)}
                  disabled={rejecting}
                >
                  <Text style={styles.dangerBtnText}>
                    {rejecting ? 'Se respinge...' : 'Respinge contractul'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.warningBtn, { marginBottom: 10 }]}
                  onPress={() => setShowDisputeModal(true)}
                  disabled={disputing}
                >
                  <Text style={styles.warningBtnText}>
                    {disputing ? 'Se trimite...' : 'Ridică dispută'}
                  </Text>
                </TouchableOpacity>
              </>
            )}

            <TouchableOpacity
              style={[styles.primaryBtn, { marginBottom: 0 }]}
              onPress={() => {
                if (selectedContract) {
                  shareContract(selectedContract);
                }
              }}
            >
              <Text style={styles.primaryBtnText}>Partajează</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Reject Contract Modal */}
      <Modal visible={showRejectModal} animationType="slide" onRequestClose={() => setShowRejectModal(false)}>
        <View style={styles.modalContainer}>
          <View style={[styles.modalHeader, { paddingTop: Math.max(insets.top, 12), paddingBottom: 16 }]}> 
            <Text style={styles.modalTitle}>Respinge Contract</Text>
            <TouchableOpacity onPress={() => setShowRejectModal(false)}>
              <Text style={styles.modalClose}>Anulează</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            <Text style={[styles.cardText, { marginBottom: 16 }]}>
              Ești sigur că vrei să respingi acest contract? Poți specifica un motiv mai jos.
            </Text>

            <Text style={styles.label}>Motiva respingerii</Text>
            <TouchableOpacity
              style={[styles.filterBtn, rejectReason === 'buyer_refused' && styles.filterBtnActive]}
              onPress={() => setRejectReason('buyer_refused')}
            >
              <Text style={[styles.filterBtnText, rejectReason === 'buyer_refused' && styles.filterBtnTextActive]}>
                Nu sunt de acord cu termenii
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.filterBtn, rejectReason === 'payment_failed' && styles.filterBtnActive]}
              onPress={() => setRejectReason('payment_failed')}
            >
              <Text style={[styles.filterBtnText, rejectReason === 'payment_failed' && styles.filterBtnTextActive]}>
                Probleme cu plata
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.filterBtn, rejectReason === 'other' && styles.filterBtnActive]}
              onPress={() => setRejectReason('other')}
            >
              <Text style={[styles.filterBtnText, rejectReason === 'other' && styles.filterBtnTextActive]}>
                Alt motiv
              </Text>
            </TouchableOpacity>

            <Text style={[styles.label, { marginTop: 16 }]}>Informații suplimentare (opțional)</Text>
            <TextInput
              value={rejectAdditionalReason}
              onChangeText={setRejectAdditionalReason}
              placeholder="Detalii suplimentare..."
              placeholderTextColor={colors.textSecondary}
              style={[styles.input, { minHeight: 80, textAlignVertical: 'top' }]}
              multiline
            />
          </ScrollView>

          <View style={[styles.modalFooter, { paddingBottom: Math.max(insets.bottom + 12, 16) }]}>
            <TouchableOpacity
              style={[styles.dangerBtn, { marginBottom: 0 }]}
              onPress={handleRejectContract}
              disabled={rejecting || !rejectReason}
            >
              <Text style={styles.dangerBtnText}>
                {rejecting ? 'Se respinge...' : 'Confirmă respingerea'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Dispute Modal */}
      <Modal visible={showDisputeModal} animationType="slide" onRequestClose={() => setShowDisputeModal(false)}>
        <View style={styles.modalContainer}>
          <View style={[styles.modalHeader, { paddingTop: Math.max(insets.top, 12), paddingBottom: 16 }]}> 
            <Text style={styles.modalTitle}>Ridică Dispută</Text>
            <TouchableOpacity onPress={() => setShowDisputeModal(false)}>
              <Text style={styles.modalClose}>Anulează</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            <Text style={[styles.cardText, { marginBottom: 16 }]}>
              Descrie problema întâmpinată. Un administrator va analiza disputa ta.
            </Text>

            <Text style={styles.label}>Descrie problema</Text>
            <TextInput
              value={disputeReason}
              onChangeText={setDisputeReason}
              placeholder="Descrie problema în detaliu..."
              placeholderTextColor={colors.textSecondary}
              style={[styles.input, { minHeight: 120, textAlignVertical: 'top' }]}
              multiline
            />
          </ScrollView>

          <View style={[styles.modalFooter, { paddingBottom: Math.max(insets.bottom + 12, 16) }]}>
            <TouchableOpacity
              style={[styles.warningBtn, { marginBottom: 0 }]}
              onPress={handleRaiseDispute}
              disabled={disputing || !disputeReason.trim()}
            >
              <Text style={styles.warningBtnText}>
                {disputing ? 'Se trimite...' : 'Trimite disputa'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

// =====================================================
// STYLES
// =====================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: 16,
    paddingBottom: 96,
  },
  title: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'center',
    flex: 1,
    marginHorizontal: 10,
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.borderColor,
    backgroundColor: colors.cardBackground,
    padding: 16,
  },
  cardTitle: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 10,
  },
  cardText: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 14,
  },
  sectionTitle: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 6,
  },
  label: {
    color: colors.textPrimary,
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.borderColor,
    borderRadius: 12,
    backgroundColor: colors.inputBackground,
    color: colors.textPrimary,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  filterBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: colors.borderColor,
  },
  filterBtnActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterBtnText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  filterBtnTextActive: {
    color: colors.primaryText,
  },
  primaryBtn: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    alignItems: 'center',
    marginBottom: 10,
  },
  primaryBtnText: {
    color: colors.primaryText,
    fontWeight: '800',
  },
  secondaryBtn: {
    borderWidth: 1,
    borderColor: colors.borderColor,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
  },
  secondaryBtnText: {
    color: colors.textPrimary,
    fontWeight: '700',
  },
  hint: {
    marginTop: 10,
    color: colors.textSecondary,
    fontSize: 11,
  },
  stateCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.borderColor,
    backgroundColor: colors.cardBackground,
    padding: 16,
    marginBottom: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stateText: {
    color: colors.textSecondary,
    fontSize: 13,
    marginTop: 8,
    textAlign: 'center',
  },
  contractCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.borderColor,
    backgroundColor: colors.cardBackground,
    padding: 14,
    marginBottom: 10,
  },
  contractHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  contractNumber: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '800',
  },
  contractMeta: {
    color: colors.textSecondary,
    fontSize: 12,
    marginBottom: 3,
  },
  statusBadge: {
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  statusBadgeContainer: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  existingContractBadge: {
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginTop: 6,
    marginBottom: 4,
  },
  existingContractText: {
    color: '#22c55e',
    fontSize: 11,
    fontWeight: '600',
  },
  acceptanceRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
    marginBottom: 4,
  },
  acceptanceBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  acceptanceBadgeYes: {
    backgroundColor: 'rgba(34, 197, 94, 0.15)',
  },
  acceptanceBadgeNo: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
  },
  acceptanceText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  actionsRow: {
    flexDirection: 'row',
    marginTop: 8,
    alignItems: 'center',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  modalHeader: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderColor,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalTitle: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '800',
    flex: 1,
    marginRight: 10,
  },
  modalClose: {
    color: colors.primary,
    fontWeight: '700',
  },
  modalContent: {
    flex: 1,
    padding: 16,
  },
  contractText: {
    color: colors.textPrimary,
    fontSize: 11,
    lineHeight: 16,
    fontFamily: 'monospace',
  },
  modalFooter: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: colors.borderColor,
  },
  dangerBtn: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: '#ef4444',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    alignItems: 'center',
  },
  dangerBtnText: {
    color: '#ef4444',
    fontWeight: '700',
  },
  warningBtn: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderWidth: 1,
    borderColor: '#f59e0b',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    alignItems: 'center',
  },
  warningBtnText: {
    color: '#f59e0b',
    fontWeight: '700',
  },
  eSignBadge: {
    marginTop: 6,
    marginBottom: 4,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 5,
    alignSelf: 'flex-start',
  },
  eSignBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  recipientRow: {
    borderWidth: 1,
    borderColor: colors.borderColor,
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
    backgroundColor: colors.cardBackground,
  },
  recipientText: {
    color: colors.textPrimary,
    fontSize: 12,
    fontWeight: '700',
  },
  recipientSubText: {
    color: colors.textSecondary,
    fontSize: 11,
    marginTop: 2,
    marginBottom: 6,
  },
  signUrlText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '700',
  },
});
