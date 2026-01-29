import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Modal,
  ScrollView,
  Image,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { useAuctions } from '../hooks/useAuctions';
import { useProducts } from '../hooks/useProducts';
import { useAuth } from '../context/AuthContext';
import AuthPromptModal from '../components/AuthPromptModal';
import { Auction, Product } from '@shared/types';
import { RootStackParamList } from '../navigationTypes';
import { WatchlistButton } from '../components/WatchlistButton';
import { colors } from '../styles/sharedStyles';
import { formatEUR } from '../utils/currency';

interface FilterOptions {
  searchTerm: string;
  category: string;
  country: string;
  minPrice: number;
  maxPrice: number;
  minYear: number;
  maxYear: number;
  metal: string;
  rarity: string;
  grade: string;
  faceValue: string;
  issueYear: string;
  diameter: string;
  weight: string;
  mint: string;
  era: string;
  sortBy: 'best-match' | 'price-asc' | 'price-desc' | 'ending-soonest' | 'newly-listed';
}

const categories = [
  'Toate Categoriile',
  'Monede',
  'Bancnote',
];

const countries = [
  'Toate Țările',
  'Rusia',
  'SUA',
  'Germania',
  'Italia',
  'Franța',
  'Finlanda',
  'Spania',
  'Danemarca',
  'Mexic',
  'România',
  'Austria',
];

const metals = [
  'Toate Metalele',
  'Aur',
  'Argint',
  'Bronz',
  'Cupru',
  'Nichel',
  'Platină',
];

const rarities = [
  'Toate Raritățile',
  'comună',
  'neobișnuită',
  'rară',
  'foarte rară',
  'extrem de rară',
];

const grades = [
  'Toate Gradele',
  'Slabă',
  'Acceptabilă',
  'Bună',
  'VG',
  'Fină',
  'VF',
  'XF',
  'AU',
  'MS-60',
  'MS-65',
  'MS-70',
];

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#00020d',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#00020d',
  },
  loadingTitle: {
    marginTop: 16,
    color: '#e5e7eb',
    textAlign: 'center',
    fontSize: 16,
  },
  loadingSubtitle: {
    marginTop: 8,
    color: '#94a3b8',
    textAlign: 'center',
    fontSize: 14,
  },
  errorText: {
    color: '#f87171',
    fontSize: 16,
    textAlign: 'center',
  },
  headerContainer: {
    backgroundColor: '#00020d',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(231, 183, 60, 0.4)',
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.9,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 18 },
    elevation: 10,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#e7b73c',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#cbd5f5',
    marginBottom: 8,
  },
  resultsSummary: {
    fontSize: 13,
    color: '#e5e7eb',
    marginBottom: 10,
  },
  resultsHighlight: {
    fontWeight: '600',
    color: '#facc6b',
  },
  categoryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 10,
  },
  categoryChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#020617',
    marginRight: 6,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.5)',
  },
  categoryChipActive: {
    backgroundColor: '#e7b73c',
    borderColor: '#e7b73c',
    shadowColor: '#e7b73c',
    shadowOpacity: 0.6,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
    elevation: 4,
  },
  categoryChipText: {
    fontSize: 11,
    color: '#e5e7eb',
  },
  categoryChipTextActive: {
    color: '#000940',
    fontWeight: '600',
  },
  searchInput: {
    width: '100%',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(231, 183, 60, 0.4)',
    backgroundColor: 'rgba(0, 2, 13, 0.7)',
    color: '#f9fafb',
    marginBottom: 12,
  },
  sortRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sortButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: '#020617',
    marginHorizontal: 2,
  },
  sortButtonActive: {
    backgroundColor: '#e7b73c',
    shadowColor: '#e7b73c',
    shadowOpacity: 0.6,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
    elevation: 4,
  },
  sortButtonText: {
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '500',
    color: '#e5e7eb',
  },
  sortButtonTextActive: {
    color: '#000940',
  },
  filtersButton: {
    marginTop: 4,
    backgroundColor: '#e7b73c',
    paddingVertical: 12,
    borderRadius: 12,
    shadowColor: '#e7b73c',
    shadowOpacity: 0.6,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
    elevation: 4,
  },
  filtersButtonText: {
    color: '#000940',
    textAlign: 'center',
    fontWeight: '600',
  },
  listContent: {
    paddingVertical: 16,
  },
  emptyListContent: {
    flexGrow: 1,
  },
  columnWrapper: {
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  emptyTitle: {
    color: '#e5e7eb',
    fontSize: 18,
    textAlign: 'center',
    marginBottom: 16,
  },
  emptyButton: {
    backgroundColor: '#e7b73c',
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 12,
    shadowColor: '#e7b73c',
    shadowOpacity: 0.6,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
    elevation: 4,
  },
  emptyButtonText: {
    color: '#000940',
    fontWeight: '600',
  },
  modalScreen: {
    flex: 1,
    backgroundColor: '#00020d',
  },
  modalHeader: {
    backgroundColor: '#e7b73c',
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalTitle: {
    color: '#000940',
    fontSize: 20,
    fontWeight: 'bold',
  },
  modalClose: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  modalContent: {
    flex: 1,
    padding: 16,
  },
  filterLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#e5e7eb',
    marginBottom: 8,
  },
  filterChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 16,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: '#020617',
    marginRight: 8,
    marginBottom: 8,
  },
  filterChipActive: {
    backgroundColor: '#e7b73c',
  },
  filterChipText: {
    color: '#e5e7eb',
  },
  filterChipTextActive: {
    color: '#000940',
    fontWeight: '600',
  },
  rangeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  rangeInput: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(231, 183, 60, 0.4)',
    backgroundColor: 'rgba(0, 2, 13, 0.7)',
    color: '#f9fafb',
    marginRight: 8,
  },
  rangeLabelHighlight: {
    color: '#e7b73c',
    fontWeight: '600',
  },
  rangeLabelMuted: {
    color: '#94a3b8',
  },
  modalActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  modalResetButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#020617',
    borderWidth: 1,
    borderColor: '#4b5563',
    marginRight: 8,
  },
  modalResetText: {
    color: '#e5e7eb',
    textAlign: 'center',
    fontWeight: '500',
  },
  modalApplyButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#e7b73c',
    shadowColor: '#e7b73c',
    shadowOpacity: 0.6,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
    elevation: 4,
  },
  modalApplyText: {
    color: '#000940',
    textAlign: 'center',
    fontWeight: '600',
  },
  card: {
    flex: 1,
    marginBottom: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(231, 183, 60, 0.6)',
    backgroundColor: 'rgba(15, 23, 42, 0.9)',
    padding: 12,
    shadowColor: '#e7b73c',
    shadowOpacity: 0.35,
    shadowRadius: 15,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
    maxWidth: '48%',
  },
  cardImageContainer: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: '#00020d',
    marginBottom: 8,
    borderRadius: 12,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardImage: {
    width: '100%',
    height: '100%',
  },
  cardNoImageContainer: {
    width: '100%',
    height: '100%',
    backgroundColor: '#020617',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardNoImageText: {
    color: '#94a3b8',
    fontSize: 11,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#f9fafb',
    marginBottom: 4,
  },
  cardMeta: {
    fontSize: 11,
    color: '#cbd5f5',
    marginBottom: 6,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardPrice: {
    fontSize: 16,
    fontWeight: '700',
    color: '#e7b73c',
  },
  cardRarityPill: {
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: 'rgba(231, 183, 60, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(231, 183, 60, 0.4)',
  },
  cardRarityText: {
    fontSize: 10,
    color: '#facc6b',
    textTransform: 'capitalize',
  },
  statusPill: {
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: 'rgba(231, 183, 60, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(231, 183, 60, 0.4)',
  },
  statusPillActive: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    borderColor: 'rgba(16, 185, 129, 0.4)',
  },
  statusPillEnded: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    borderColor: 'rgba(239, 68, 68, 0.4)',
  },
  statusText: {
    fontSize: 10,
    color: '#facc6b',
    textTransform: 'capitalize',
  },
  statusTextActive: {
    color: '#10b981',
  },
  statusTextEnded: {
    color: '#ef4444',
  },
});

const CountdownTimer: React.FC<{ endTime: Date }> = ({ endTime }) => {
  const [timeLeft, setTimeLeft] = useState('');

  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date().getTime();
      const distance = endTime.getTime() - now;

      if (distance < 0) {
        setTimeLeft('ENDED');
        clearInterval(timer);
        return;
      }

      const days = Math.floor(distance / (1000 * 60 * 60 * 24));
      const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((distance % (1000 * 60)) / 1000);

      if (days > 0) {
        setTimeLeft(`${days}d ${hours}h ${minutes}m`);
      } else if (hours > 0) {
        setTimeLeft(`${hours}h ${minutes}m ${seconds}s`);
      } else {
        setTimeLeft(`${minutes}m ${seconds}s`);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [endTime]);

  return (
    <Text style={[
      { fontSize: 14, fontWeight: '500' },
      timeLeft === 'ENDED' ? { color: '#6b7280' } : { color: '#dc2626' }
    ]}>
      {timeLeft}
    </Text>
  );
};

const AuctionCard: React.FC<{ auction: Auction; product?: Product | null }> = ({ auction, product }) => {
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();

  const isEnded = new Date() > auction.endTime;
  const currentBid = auction.currentBid || auction.reservePrice;

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => navigation.navigate('AuctionDetails', { auctionId: auction.id })}
    >
      <View style={{ position: 'relative' }}>
        <View style={styles.cardImageContainer}>
          {product?.images && product.images.length > 0 ? (
            <Image
              source={{ uri: product.images[0] }}
              style={styles.cardImage}
              resizeMode="contain"
            />
          ) : (
            <View style={styles.cardNoImageContainer}>
              <Text style={styles.cardNoImageText}>Fără imagine</Text>
            </View>
          )}
        </View>
        <View style={{ position: 'absolute', top: 8, right: 8, zIndex: 10 }}>
          <WatchlistButton itemType="auction" itemId={auction.id} size="small" />
        </View>
      </View>

      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        <View style={{ flex: 1, marginRight: 8 }}>
          <Text style={styles.cardMeta}>
            Licitație #{auction.id.slice(-6)}
          </Text>
          <Text style={styles.cardTitle} numberOfLines={1}>
            {product?.name || 'Monedă' }
          </Text>
          {product?.country && (
            <Text style={styles.cardMeta}>
              {product.country} {product.year ? `• ${product.year}` : ''}
            </Text>
          )}
        </View>
        <View style={[
          styles.statusPill,
          auction.status === 'active' ? styles.statusPillActive : styles.statusPillEnded
        ]}>
          <Text style={[
            styles.statusText,
            auction.status === 'active' ? styles.statusTextActive : styles.statusTextEnded
          ]}>
            {auction.status.toUpperCase()}
          </Text>
        </View>
      </View>

      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <View>
          <Text style={styles.cardMeta}>Ofertă curentă</Text>
          <Text style={styles.cardPrice}>{formatEUR(currentBid)}</Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={styles.cardMeta}>Timp rămas</Text>
          <CountdownTimer endTime={auction.endTime} />
        </View>
      </View>

      <Text style={[styles.cardPrice, { fontSize: 14 }]}>Vezi detalii & licitează →</Text>
    </TouchableOpacity>
  );
};

const AuctionListScreen: React.FC = () => {
  const { user } = useAuth();
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  const [authPromptVisible, setAuthPromptVisible] = useState(false);
  const { auctions, loading: auctionsLoading, error: auctionsError } = useAuctions('active');
  const { products, loading: productsLoading } = useProducts();
  const [statusFilter, setStatusFilter] = useState<'active' | 'ended' | 'all'>('active');
  const [showFilters, setShowFilters] = useState(false);
  
  const [filters, setFilters] = useState<FilterOptions>({
    searchTerm: '',
    category: 'Toate Categoriile',
    country: 'Toate Țările',
    minPrice: 0,
    maxPrice: 0,
    minYear: 0,
    maxYear: 0,
    metal: 'Toate Metalele',
    rarity: 'Toate Raritățile',
    grade: 'Toate Gradele',
    faceValue: 'Toate Valorile',
    issueYear: 'Toți Anii',
    diameter: 'Toate Diametrele',
    weight: 'Toate Greutățile',
    mint: 'Toate Monetăriile',
    era: 'Toate Epocile',
    sortBy: 'ending-soonest',
  });

  // Create a map of products for quick lookup
  const productMap = useMemo(() => {
    const map = new Map();
    products.forEach((product) => {
      map.set(product.id, product);
    });
    return map;
  }, [products]);

  const filteredAuctions = useMemo(() => {
    let filtered = [...auctions];

    // Apply status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter((auction) => auction.status === statusFilter);
    }

    // Apply filters based on associated product data
    filtered = filtered.filter((auction) => {
      const product = productMap.get(auction.productId);
      // Allow auctions even if product is not loaded yet
      if (!product) return true;

      // Search filter
      if (filters.searchTerm) {
        const searchLower = filters.searchTerm.toLowerCase();
        const matchesSearch =
          product.name.toLowerCase().includes(searchLower) ||
          product.description.toLowerCase().includes(searchLower) ||
          product.country?.toLowerCase().includes(searchLower) ||
          auction.id.toLowerCase().includes(searchLower);
        if (!matchesSearch) return false;
      }

      // Country filter
      if (filters.country && filters.country !== 'Toate Țările') {
        if (product.country !== filters.country) return false;
      }

      // Price range filter
      if (filters.minPrice || filters.maxPrice) {
        const auctionPrice = auction.currentBid || auction.reservePrice;
        const min = filters.minPrice || 0;
        const max = filters.maxPrice || Infinity;
        if (auctionPrice < min || auctionPrice > max) {
          return false;
        }
      }

      // Year range filter
      if (filters.minYear || filters.maxYear) {
        if (!product.year) return false;
        const min = filters.minYear || 0;
        const max = filters.maxYear || Infinity;
        if (product.year < min || product.year > max) {
          return false;
        }
      }

      // Metal filter
      if (filters.metal && filters.metal !== 'Toate Metalele') {
        if (product.metal !== filters.metal) return false;
      }

      // Rarity filter
      if (filters.rarity && filters.rarity !== 'Toate Raritățile') {
        if (product.rarity !== filters.rarity) return false;
      }

      // Grade filter
      if (filters.grade && filters.grade !== 'Toate Gradele') {
        if (product.grade !== filters.grade) return false;
      }

      return true;
    });

    // Apply sorting
    filtered.sort((a, b) => {
      const productA = productMap.get(a.productId);
      const productB = productMap.get(b.productId);

      switch (filters.sortBy) {
        case 'price-asc':
          return (a.currentBid || a.reservePrice) - (b.currentBid || b.reservePrice);
        case 'price-desc':
          return (b.currentBid || b.reservePrice) - (a.currentBid || a.reservePrice);
        case 'newly-listed':
          return b.createdAt.getTime() - a.createdAt.getTime();
        case 'ending-soonest':
        default:
          return a.endTime.getTime() - b.endTime.getTime();
      }
    });

    return filtered;
  }, [auctions, productMap, filters, statusFilter]);

  // Limit items for unauthenticated users
  const displayAuctions = useMemo(() => {
    if (!user) {
      return filteredAuctions.slice(0, 10);
    }
    return filteredAuctions;
  }, [filteredAuctions, user]);

  const resetFilters = () => {
    setFilters({
      searchTerm: '',
      category: 'Toate Categoriile',
      country: 'Toate Țările',
      minPrice: 0,
      maxPrice: 0,
      minYear: 0,
      maxYear: 0,
      metal: 'Toate Metalele',
      rarity: 'Toate Raritățile',
      grade: 'Toate Gradele',
      faceValue: 'Toate Valorile',
      issueYear: 'Toți Anii',
      diameter: 'Toate Diametrele',
      weight: 'Toate Greutățile',
      mint: 'Toate Monetăriile',
      era: 'Toate Epocile',
      sortBy: 'ending-soonest',
    });
  };

  const loading = auctionsLoading || productsLoading;
  const error = auctionsError;

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingTitle}>Se încarcă licitațiile...</Text>
        <Text style={styles.loadingSubtitle}>Te rugăm să aștepți câteva momente</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.errorText}>Eroare la încărcarea licitațiilor: {error}</Text>
      </View>
    );
  }

  return (
      <View style={styles.screen}>
        {/* Header */}
        <View style={styles.headerContainer}>
          <Text style={styles.headerTitle}>Licitații</Text>
          <Text style={styles.headerSubtitle}>
            Vezi licitațiile active și timp rămas pentru fiecare monedă.
          </Text>

          {/* Results summary */}
          <Text style={styles.resultsSummary}>
            Se afișează{' '}
            <Text style={styles.resultsHighlight}>{displayAuctions.length}</Text> din{' '}
            <Text style={styles.resultsHighlight}>{auctions.length}</Text> licitații
          </Text>

          {/* Status Filter Tabs */}
          <View style={styles.categoryRow}>
            {['active', 'all', 'ended'].map((status) => {
              const label = status === 'active' ? 'Active' : status === 'all' ? 'Toate' : 'Încheiate';
              const active = statusFilter === status;
              return (
                <TouchableOpacity
                  key={status}
                  style={active ? [styles.categoryChip, styles.categoryChipActive] : styles.categoryChip}
                  onPress={() => setStatusFilter(status as 'active' | 'ended' | 'all')}
                >
                  <Text
                    style={
                      active
                        ? [styles.categoryChipText, styles.categoryChipTextActive]
                        : styles.categoryChipText
                    }
                  >
                    {label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Search Bar */}
          <TextInput
            style={styles.searchInput}
            placeholder="Caută licitații..."
            placeholderTextColor={colors.textSecondary}
            value={filters.searchTerm}
            onChangeText={(text) => setFilters({ ...filters, searchTerm: text })}
          />

          {/* Quick Sort Buttons */}
          <View style={styles.sortRow}>
            <TouchableOpacity
              style={
                filters.sortBy === 'ending-soonest'
                  ? [styles.sortButton, styles.sortButtonActive]
                  : styles.sortButton
              }
              onPress={() => setFilters({ ...filters, sortBy: 'ending-soonest' })}
            >
              <Text
                style={
                  filters.sortBy === 'ending-soonest'
                    ? [styles.sortButtonText, styles.sortButtonTextActive]
                    : styles.sortButtonText
                }
              >
                Se încheie curând
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={
                filters.sortBy === 'price-asc'
                  ? [styles.sortButton, styles.sortButtonActive]
                  : styles.sortButton
              }
              onPress={() => setFilters({ ...filters, sortBy: 'price-asc' })}
            >
              <Text
                style={
                  filters.sortBy === 'price-asc'
                    ? [styles.sortButtonText, styles.sortButtonTextActive]
                    : styles.sortButtonText
                }
              >
                Preț ↑
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={
                filters.sortBy === 'price-desc'
                  ? [styles.sortButton, styles.sortButtonActive]
                  : styles.sortButton
              }
              onPress={() => setFilters({ ...filters, sortBy: 'price-desc' })}
            >
              <Text
                style={
                  filters.sortBy === 'price-desc'
                    ? [styles.sortButtonText, styles.sortButtonTextActive]
                    : styles.sortButtonText
                }
              >
                Preț ↓
              </Text>
            </TouchableOpacity>
          </View>

          {/* Filter Button */}
          <TouchableOpacity style={styles.filtersButton} onPress={() => setShowFilters(true)}>
            <Text style={styles.filtersButtonText}>
              Filtre avansate ({displayAuctions.length} din {auctions.length})
            </Text>
          </TouchableOpacity>
        </View>

        {/* Auctions List */}
        {filteredAuctions.length === 0 ? (
          <View style={[styles.listContent, styles.emptyListContent]}>
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyTitle}>
                {filters.searchTerm
                  ? 'Nicio licitație nu se potrivește căutării.'
                  : statusFilter === 'active'
                  ? 'Nu există licitații active în acest moment.'
                  : 'Nu există licitații disponibile.'}
              </Text>
              {filters.searchTerm && (
                <TouchableOpacity style={styles.emptyButton} onPress={resetFilters}>
                  <Text style={styles.emptyButtonText}>Resetează filtrele</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
         ) : (
          <FlatList
            data={displayAuctions}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => {
              const product = productMap.get(item.productId) as Product | null | undefined;
              return <AuctionCard auction={item} product={product || null} />;
            }}
            numColumns={2}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.listContent}
            columnWrapperStyle={styles.columnWrapper}
          />
        )}

        {/* Login/Register Prompt for unauthenticated users */}
        {!user && displayAuctions.length >= 10 && (
          <View style={{ padding: 16, alignItems: 'center' }}>
            <Text style={{ color: colors.textSecondary, fontSize: 14, textAlign: 'center', marginBottom: 8 }}>
              Autentifică-te sau înregistrează-te pentru a vedea toate licitațiile
            </Text>
            <TouchableOpacity
              style={[styles.emptyButton, { backgroundColor: colors.primary }]}
              onPress={() => setAuthPromptVisible(true)}
            >
              <Text style={[styles.emptyButtonText, { color: '#000940' }]}>Vezi toate licitațiile</Text>
            </TouchableOpacity>
          </View>
        )}

        <AuthPromptModal
          visible={authPromptVisible}
          title="Participă la licitații"
          message="Autentifică-te sau creează un cont pentru a licita în timp real, a urmări obiectele preferate și a primi alerte când se apropie finalul."
          benefits={[
            'Licitează în timp real și primești notificări',
            'Salvezi licitațiile urmărite',
            'Acces complet la istoricul ofertelor',
          ]}
          onClose={() => setAuthPromptVisible(false)}
          onLogin={() => {
            setAuthPromptVisible(false);
            navigation.navigate('Login');
          }}
          onRegister={() => {
            setAuthPromptVisible(false);
            navigation.navigate('Register');
          }}
        />

        {/* Filter Modal */}
        <Modal
          visible={showFilters}
          animationType="slide"
          transparent={false}
          onRequestClose={() => setShowFilters(false)}
        >
          <SafeAreaView style={styles.modalScreen}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Filtre</Text>
              <TouchableOpacity onPress={() => setShowFilters(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalContent}>
              {/* Category Filter */}
              <Text style={styles.filterLabel}>Categorie</Text>
              <View style={styles.filterChipsRow}>
                {categories.map((category) => {
                  const active = filters.category === category;
                  return (
                    <TouchableOpacity
                      key={category}
                      style={active ? [styles.filterChip, styles.filterChipActive] : styles.filterChip}
                      onPress={() => setFilters({ ...filters, category })}
                    >
                      <Text style={active ? [styles.filterChipText, styles.filterChipTextActive] : styles.filterChipText}>
                        {category}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Country Filter */}
              <Text style={styles.filterLabel}>Țară</Text>
              <View style={styles.filterChipsRow}>
                {countries.map((country) => {
                  const active = filters.country === country;
                  return (
                    <TouchableOpacity
                      key={country}
                      style={active ? [styles.filterChip, styles.filterChipActive] : styles.filterChip}
                      onPress={() => setFilters({ ...filters, country })}
                    >
                      <Text style={active ? [styles.filterChipText, styles.filterChipTextActive] : styles.filterChipText}>
                        {country}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Metal Filter */}
              <Text style={styles.filterLabel}>Metal</Text>
              <View style={styles.filterChipsRow}>
                {metals.map((metal) => {
                  const active = filters.metal === metal;
                  return (
                    <TouchableOpacity
                      key={metal}
                      style={active ? [styles.filterChip, styles.filterChipActive] : styles.filterChip}
                      onPress={() => setFilters({ ...filters, metal })}
                    >
                      <Text style={active ? [styles.filterChipText, styles.filterChipTextActive] : styles.filterChipText}>
                        {metal}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Rarity Filter */}
              <Text style={styles.filterLabel}>Raritate</Text>
              <View style={styles.filterChipsRow}>
                {rarities.map((rarity) => {
                  const active = filters.rarity === rarity;
                  return (
                    <TouchableOpacity
                      key={rarity}
                      style={active ? [styles.filterChip, styles.filterChipActive] : styles.filterChip}
                      onPress={() => setFilters({ ...filters, rarity })}
                    >
                      <Text style={active ? [styles.filterChipText, styles.filterChipTextActive] : styles.filterChipText}>
                        {rarity.charAt(0).toUpperCase() + rarity.slice(1).replace('-', ' ')}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Grade Filter */}
              <Text style={styles.filterLabel}>Grad</Text>
              <View style={styles.filterChipsRow}>
                {grades.map((grade) => {
                  const active = filters.grade === grade;
                  return (
                    <TouchableOpacity
                      key={grade}
                      style={active ? [styles.filterChip, styles.filterChipActive] : styles.filterChip}
                      onPress={() => setFilters({ ...filters, grade })}
                    >
                      <Text style={active ? [styles.filterChipText, styles.filterChipTextActive] : styles.filterChipText}>
                        {grade}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Price Range */}
              <Text style={styles.filterLabel}>
                Interval Preț: {filters.minPrice || filters.maxPrice ? `${filters.minPrice || 0} EUR - ${filters.maxPrice || '∞'} EUR` : 'Fără filtru'}
              </Text>
              <View style={styles.rangeRow}>
                <TextInput
                  style={styles.rangeInput}
                  placeholder="Preț Minim"
                  placeholderTextColor={colors.textSecondary}
                  keyboardType="numeric"
                  value={filters.minPrice.toString()}
                  onChangeText={(text) => setFilters({ ...filters, minPrice: parseInt(text) || 0 })}
                />
                <TextInput
                  style={styles.rangeInput}
                  placeholder="Preț Maxim"
                  placeholderTextColor={colors.textSecondary}
                  keyboardType="numeric"
                  value={filters.maxPrice.toString()}
                  onChangeText={(text) => setFilters({ ...filters, maxPrice: parseInt(text) || 0 })}
                />
              </View>

              {/* Year Range */}
              <Text style={styles.filterLabel}>
                Interval An: {filters.minYear || filters.maxYear ? `${filters.minYear} - ${filters.maxYear}` : 'Fără filtru'}
              </Text>
              <View style={styles.rangeRow}>
                <TextInput
                  style={styles.rangeInput}
                  placeholder="An Minim"
                  placeholderTextColor={colors.textSecondary}
                  keyboardType="numeric"
                  value={filters.minYear.toString()}
                  onChangeText={(text) => setFilters({ ...filters, minYear: parseInt(text) || 0 })}
                />
                <TextInput
                  style={styles.rangeInput}
                  placeholder="An Maxim"
                  placeholderTextColor={colors.textSecondary}
                  keyboardType="numeric"
                  value={filters.maxYear.toString()}
                  onChangeText={(text) => setFilters({ ...filters, maxYear: parseInt(text) || 0 })}
                />
              </View>

              {/* Action Buttons */}
              <View style={styles.modalActionsRow}>
                <TouchableOpacity style={styles.modalResetButton} onPress={resetFilters}>
                  <Text style={styles.modalResetText}>Resetează filtrele</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.modalApplyButton}
                  onPress={() => setShowFilters(false)}
                >
                  <Text style={styles.modalApplyText}>Aplică filtrele</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </SafeAreaView>
        </Modal>
      </View>
  );
};

export default AuctionListScreen;
