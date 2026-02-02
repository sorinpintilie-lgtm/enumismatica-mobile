import React, { useState, useMemo, useRef, useEffect } from 'react';
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
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { useProducts } from '../hooks/useProducts';
import { Product } from '@shared/types';
import { RootStackParamList } from '../navigationTypes';
import { colors } from '../styles/sharedStyles';
import { formatEUR } from '../utils/currency';
import { romanianCoinOptions } from '../utils/romanianCoinData';
import { WatchlistButton } from '../components/WatchlistButton';
import { useAuth } from '../context/AuthContext';
import AuthPromptModal from '../components/AuthPromptModal';

// Sort options aligned with web E-shop page (products only use a subset)
type SortOption = 'best-match' | 'price-asc' | 'price-desc' | 'newly-listed';

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
  sortBy: SortOption;
  // Romanian coin specific filters
  faceValue: string;
  issueYear: string;
  diameter: string;
  weight: string;
  mint: string;
  era: string;
}

const categories = ['Toate Categoriile', 'Monede', 'Bancnote'];

// Countries / metals aligned with web FilterBar (Romanian labels)
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

const metals = ['Toate Metalele', 'Aur', 'Argint', 'Bronz', 'Cupru', 'Nichel', 'Platină'];

// Store rarity values in English (DB values) but show Romanian labels in UI
const rarities = [
  { value: 'all', label: 'Toate Raritățile' },
  { value: 'common', label: 'Comună' },
  { value: 'uncommon', label: 'Neobișnuită' },
  { value: 'rare', label: 'Rară' },
  { value: 'very-rare', label: 'Foarte rară' },
  { value: 'extremely-rare', label: 'Extrem de rară' },
];

// For now we expose a simple grade filter; values should match what is stored in Firestore
const grades = ['Toate Gradele', 'VG', 'F', 'VF', 'XF', 'AU', 'MS-60', 'MS-65', 'MS-70'];

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
  // Keep header above the list while we animate it.
  // NOTE: FlatList is rendered after the header, so without zIndex/elevation
  // it can visually overlap the header during layout/animation.
  headerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 50,
    elevation: 50,
  },
  headerHidden: {
    transform: [{ translateY: -1000 }],
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
  modalBackground: {
    flex: 1,
    backgroundColor: '#00020d',
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
});

const ProductCard: React.FC<{ product: Product }> = ({ product }) => {
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();

  return (
    <TouchableOpacity
      key={`product-card-${product.id}`}
      style={styles.card}
      onPress={() => navigation.navigate('ProductDetails', { productId: product.id })}
    >
      <View style={{ position: 'relative' }}>
        <View style={styles.cardImageContainer}>
        {product.images && product.images.length > 0 ? (
          <Image
            key={`product-image-${product.id}`}
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
          <WatchlistButton itemType="product" itemId={product.id} size="small" />
        </View>
      </View>

      <Text style={styles.cardTitle} numberOfLines={1}>
        {product.name}
      </Text>

      {(product.country || product.year) && (
        <Text style={styles.cardMeta} numberOfLines={1}>
          {product.country}
          {product.year ? ` • ${product.year}` : ''}
        </Text>
      )}

      <View style={styles.cardFooter}>
        <Text style={styles.cardPrice}>{formatEUR(product.price)}</Text>
        {product.rarity && (
          <View style={styles.cardRarityPill}>
            <Text style={styles.cardRarityText}>{String(product.rarity).replace('-', ' ')}</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
};

const ProductCatalogScreen: React.FC = () => {
  const { user } = useAuth();
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  const [headerMeasuredHeight, setHeaderMeasuredHeight] = useState(0);
  const [headerVisible, setHeaderVisible] = useState(true);
  const [authPromptVisible, setAuthPromptVisible] = useState(false);
  const scrollY = useRef(new Animated.Value(0)).current;
  const lastScrollY = useRef(0);

  const handleScroll = Animated.event(
    [{ nativeEvent: { contentOffset: { y: scrollY } } }],
    {
      useNativeDriver: true,
      listener: (event: any) => {
        const currentY = event.nativeEvent.contentOffset.y;
        const scrollDirection = currentY > lastScrollY.current ? 'down' : 'up';
        
        // Hide header when scrolling down past 50px from top
        if (scrollDirection === 'down' && currentY > 50 && headerVisible) {
          setHeaderVisible(false);
        } 
        // Show header when scrolling up near the top (below 30px)
        else if (scrollDirection === 'up' && currentY < 30 && !headerVisible) {
          setHeaderVisible(true);
        }
        
        lastScrollY.current = currentY;
      },
    }
  );

  // Request extended product fields so filtering matches the web E-shop page
  const productFields = useMemo(
    () => [
      'name',
      'images',
      'price',
      'description',
      'category',
      'country',
      'year',
      'denomination',
      'metal',
      'rarity',
      'grade',
      'createdAt',
      'updatedAt',
    ],
    [],
  );

  const { products, loading, error, loadMore, hasMore } = useProducts({
    pageSize: 20,
    fields: productFields,
    listingType: 'direct', // Only direct-sale products in E-shop
    loadAllAtOnce: true, // Load all products at once to avoid scroll jumping
  });

  const [showFilters, setShowFilters] = useState(false);

  const [filters, setFilters] = useState<FilterOptions>({
    searchTerm: '',
    category: 'Toate Categoriile',
    country: 'Toate Țările',
    // 0 / 0 = fără filtru de preț (matches web semantics)
    minPrice: 0,
    maxPrice: 0,
    // 0 / 0 = fără filtru de ani
    minYear: 0,
    maxYear: 0,
    metal: 'Toate Metalele',
    rarity: 'all',
    grade: 'Toate Gradele',
    sortBy: 'best-match',
    // Romanian coin specific filters
    faceValue: 'Toate Valorile',
    issueYear: 'Toți Anii',
    diameter: 'Toate Diametrele',
    weight: 'Toate Greutățile',
    mint: 'Toate Monetăriile',
    era: 'Toate Epocile',
  });

  const totalInCatalog = products.length;

  const allFilteredProducts = useMemo(() => {
    let filtered = [...products];

    // Search by name / description / country / denomination
    if (filters.searchTerm) {
      const searchLower = filters.searchTerm.toLowerCase();
      filtered = filtered.filter((product) =>
        product.name.toLowerCase().includes(searchLower) ||
        product.description.toLowerCase().includes(searchLower) ||
        product.country?.toLowerCase().includes(searchLower) ||
        product.denomination?.toLowerCase().includes(searchLower),
      );
    }

    // Category filter
    if (filters.category && filters.category !== 'Toate Categoriile') {
      filtered = filtered.filter((product: any) => product.category === filters.category);
    }

    // Country filter
    if (filters.country && filters.country !== 'Toate Țările') {
      filtered = filtered.filter((product) => product.country === filters.country);
    }

    // Price range: (0 / 0) means no price filter
    if (filters.minPrice || filters.maxPrice) {
      filtered = filtered.filter((product) => {
        if (filters.minPrice && product.price < filters.minPrice) return false;
        if (filters.maxPrice && product.price > filters.maxPrice) return false;
        return true;
      });
    }

    // Year range: apply only when user sets at least one bound.
    // If year is missing, keep the product so we don't hide items by default.
    if (filters.minYear || filters.maxYear) {
      filtered = filtered.filter((product) => {
        if (!product.year) return true;
        const min = filters.minYear || 0;
        const max = filters.maxYear || 9999;
        return product.year >= min && product.year <= max;
      });
    }

    // Metal filter
    if (filters.metal && filters.metal !== 'Toate Metalele') {
      filtered = filtered.filter((product) => product.metal === filters.metal);
    }

    // Rarity filter
    if (filters.rarity && filters.rarity !== 'all') {
      filtered = filtered.filter((product) => product.rarity === filters.rarity);
    }

    // Grade filter
    if (filters.grade && filters.grade !== 'Toate Gradele') {
      filtered = filtered.filter((product) => product.grade === filters.grade);
    }

    // Romanian coin specific filters
    if (filters.country === 'România') {
      // Load product data to get detailed information for filtering
      const productsData = require('../data/products.json');
      
      filtered = filtered.filter((product) => {
        // Find matching product in detailed data
        const detailedProduct = productsData.find((p: any) => {
          // Match by name or denomination (since we don't have id in the detailed data)
          const productName = product.name.toLowerCase();
          const detailedName = (p.face_value + ' ' + p.issue_year).toLowerCase();
          return productName.includes(detailedName) || detailedName.includes(productName);
        });

        if (!detailedProduct) {
          // If product not found in detailed data, include it
          return true;
        }

        // Apply face value filter
        if (filters.faceValue && filters.faceValue !== 'Toate Valorile') {
          if (detailedProduct.face_value !== filters.faceValue) {
            return false;
          }
        }

        // Apply issue year filter
        if (filters.issueYear && filters.issueYear !== 'Toți Anii') {
          if (detailedProduct.issue_year !== filters.issueYear) {
            return false;
          }
        }

        // Apply diameter filter
        if (filters.diameter && filters.diameter !== 'Toate Diametrele') {
          if (detailedProduct.diameter !== filters.diameter) {
            return false;
          }
        }

        // Apply weight filter
        if (filters.weight && filters.weight !== 'Toate Greutățile') {
          if (detailedProduct.weight !== filters.weight) {
            return false;
          }
        }

        // Apply mint filter
        if (filters.mint && filters.mint !== 'Toate Monetăriile') {
          if (detailedProduct.mint_or_theme !== filters.mint) {
            return false;
          }
        }

        // Apply era filter
        if (filters.era && filters.era !== 'Toate Epocile') {
          if (detailedProduct.era !== filters.era) {
            return false;
          }
        }

        return true;
      });
    }

    // Sorting (mirror web defaults)
    filtered.sort((a, b) => {
      switch (filters.sortBy) {
        case 'price-asc':
          return a.price - b.price;
        case 'price-desc':
          return b.price - a.price;
        case 'newly-listed':
        case 'best-match':
        default:
          return b.createdAt.getTime() - a.createdAt.getTime();
      }
    });

    return filtered;
  }, [products, filters]);

  // Limit items for unauthenticated users
  const displayProducts = useMemo(() => {
    if (!user) {
      return allFilteredProducts.slice(0, 10);
    }
    return allFilteredProducts;
  }, [allFilteredProducts, user]);

  // Animated header visibility - smooth transition based on visibility state
  const headerTranslateY = useRef(new Animated.Value(0)).current;
  
  useEffect(() => {
    Animated.timing(headerTranslateY, {
      toValue: headerVisible ? 0 : -1000,
      duration: 400, // Responsive animation duration
      easing: (t) => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t, // Easing function for smooth effect
      useNativeDriver: true,
    }).start();
  }, [headerVisible]);

  // Measure header height using onLayout
  const measureHeader = (event: any) => {
    const { height } = event.nativeEvent.layout;
    // Guard against repeated identical layouts (can happen on re-render)
    setHeaderMeasuredHeight((prev) => (prev === height ? prev : height));
  };

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
      rarity: 'all',
      grade: 'Toate Gradele',
      sortBy: 'best-match',
      faceValue: 'Toate Valorile',
      issueYear: 'Toți Anii',
      diameter: 'Toate Diametrele',
      weight: 'Toate Greutățile',
      mint: 'Toate Monetăriile',
      era: 'Toate Epocile',
    });
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingTitle}>Se încarcă piesele din E-shop...</Text>
        <Text style={styles.loadingSubtitle}>Încărcarea poate dura câteva momente</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.errorText}>Eroare la încărcarea pieselor: {error}</Text>
      </View>
    );
  }

  return (
      <View style={styles.screen}>
        {/* Header (fixed at top) */}
        <Animated.View
          onLayout={measureHeader}
          style={[
            styles.headerContainer,
            styles.headerOverlay,
            {
              transform: [{ translateY: headerTranslateY }],
            },
          ]}
        >
          <Text style={styles.headerTitle}>E-shop</Text>
          <Text style={styles.headerSubtitle}>Colecția include {totalInCatalog} piese</Text>

          {/* Results summary, aligned with web page copy */}
          <Text style={styles.resultsSummary}>
            Se afișează{' '}
            <Text style={styles.resultsHighlight}>{displayProducts.length}</Text> din{' '}
            <Text style={styles.resultsHighlight}>{totalInCatalog}</Text> piese
          </Text>

          {/* Category selector */}
          <View style={styles.categoryRow}>
            {categories.map((category) => {
              const active = filters.category === category;
              return (
                <TouchableOpacity
                  key={category}
                  style={active ? [styles.categoryChip, styles.categoryChipActive] : styles.categoryChip}
                  onPress={() => setFilters({ ...filters, category })}
                >
                  <Text
                    style={
                      active
                        ? [styles.categoryChipText, styles.categoryChipTextActive]
                        : styles.categoryChipText
                    }
                  >
                    {category}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Search Bar */}
          <TextInput
            style={styles.searchInput}
            placeholder="Caută după nume, descriere, țară..."
            placeholderTextColor={colors.textSecondary}
            value={filters.searchTerm}
            onChangeText={(text) => setFilters({ ...filters, searchTerm: text })}
          />

          {/* Quick Sort Buttons */}
          <View style={styles.sortRow}>
            <TouchableOpacity
              style={
                filters.sortBy === 'best-match'
                  ? [styles.sortButton, styles.sortButtonActive]
                  : styles.sortButton
              }
              onPress={() => setFilters({ ...filters, sortBy: 'best-match' })}
            >
              <Text
                style={
                  filters.sortBy === 'best-match'
                    ? [styles.sortButtonText, styles.sortButtonTextActive]
                    : styles.sortButtonText
                }
              >
                Relevanță
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
              Filtre avansate ({displayProducts.length} din {totalInCatalog})
            </Text>
          </TouchableOpacity>
        </Animated.View>

        {/* Products Grid - 2 columns, similar density to web grid */}
        <Animated.FlatList
          data={displayProducts}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <ProductCard product={item} />}
          numColumns={2}
          showsVerticalScrollIndicator={false}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          onEndReached={() => {
            // Automatically load more when user scrolls near the bottom
            if (user && hasMore && !loading) {
              loadMore();
            }
          }}
          onEndReachedThreshold={0.3}
          maintainVisibleContentPosition={{
            minIndexForVisible: 0,
            autoscrollToTopThreshold: 10,
          }}
          contentContainerStyle={
            displayProducts.length === 0
              ? [
                  {
                    paddingTop: headerMeasuredHeight + 16,
                    paddingBottom: 120,
                  },
                  styles.emptyListContent,
                ]
              : {
                  paddingTop: headerMeasuredHeight + 16,
                  paddingBottom: 120,
                }
          }
          columnWrapperStyle={styles.columnWrapper}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyTitle}>
                {filters.searchTerm
                  ? 'Nu s-au găsit piese pentru această căutare.'
                  : 'Nu există piese disponibile momentan.'}
              </Text>
              {filters.searchTerm && (
                <TouchableOpacity style={styles.emptyButton} onPress={resetFilters}>
                  <Text style={styles.emptyButtonText}>Resetare filtre</Text>
                </TouchableOpacity>
              )}
            </View>
          }
          ListFooterComponent={
            !user && displayProducts.length >= 10 ? (
              <View style={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 16, alignItems: 'center' }}>
                <Text style={{ color: colors.textSecondary, fontSize: 14, textAlign: 'center', marginBottom: 8 }}>
                  Autentificarea sau înregistrarea sunt necesare pentru a vedea toate piesele
                </Text>
                <TouchableOpacity
                  style={[styles.emptyButton, { backgroundColor: colors.primary }]}
                  onPress={() => setAuthPromptVisible(true)}
                >
                  <Text style={[styles.emptyButtonText, { color: '#000940' }]}>Acces la toate piesele</Text>
                </TouchableOpacity>
              </View>
            ) : user && hasMore && loading ? (
              <View style={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 16, alignItems: 'center' }}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={{ color: colors.textSecondary, fontSize: 14, marginTop: 8 }}>
                  Se încarcă mai multe piese...
                </Text>
              </View>
            ) : null
          }
        />

        <AuthPromptModal
          visible={authPromptVisible}
          title="Acces la întregul catalog"
          message="Autentificarea sau crearea unui cont permite explorarea tuturor pieselor din E-shop, salvarea favoritelor și notificări personalizate."
          benefits={[
            'Acces complet la catalog și licitații',
            'Liste de favorite și alerte de preț',
            'Comenzi și plăți securizate',
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
          transparent={true}
          onRequestClose={() => setShowFilters(false)}
        >
          <SafeAreaView style={styles.modalScreen}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Filtre E-shop</Text>
              <TouchableOpacity onPress={() => setShowFilters(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.modalBackground}>
              <ScrollView style={styles.modalContent}>
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
                  const active = filters.rarity === rarity.value;
                  return (
                    <TouchableOpacity
                      key={rarity.value}
                      style={active ? [styles.filterChip, styles.filterChipActive] : styles.filterChip}
                      onPress={() => setFilters({ ...filters, rarity: rarity.value })}
                    >
                      <Text style={active ? [styles.filterChipText, styles.filterChipTextActive] : styles.filterChipText}>
                        {rarity.label}
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
                Interval preț:{' '}
                {filters.minPrice || filters.maxPrice ? (
                  <Text style={styles.rangeLabelHighlight}>
                    {filters.minPrice || 0} EUR - {filters.maxPrice || '∞'} EUR
                  </Text>
                ) : (
                  <Text style={styles.rangeLabelMuted}>Fără filtru</Text>
                )}
              </Text>
              <View style={styles.rangeRow}>
                <TextInput
                  style={styles.rangeInput}
                  placeholder="Min"
                  placeholderTextColor={colors.textSecondary}
                  keyboardType="numeric"
                  value={filters.minPrice ? String(filters.minPrice) : ''}
                  onChangeText={(text) =>
                    setFilters({ ...filters, minPrice: text ? parseFloat(text) || 0 : 0 })
                  }
                />
                <TextInput
                  style={styles.rangeInput}
                  placeholder="Max"
                  placeholderTextColor={colors.textSecondary}
                  keyboardType="numeric"
                  value={filters.maxPrice ? String(filters.maxPrice) : ''}
                  onChangeText={(text) =>
                    setFilters({ ...filters, maxPrice: text ? parseFloat(text) || 0 : 0 })
                  }
                />
              </View>

              {/* Year Range */}
              <Text style={styles.filterLabel}>
                Interval an:{' '}
                {filters.minYear || filters.maxYear ? (
                  <Text style={styles.rangeLabelHighlight}>
                    {filters.minYear || 0} - {filters.maxYear || '∞'}
                  </Text>
                ) : (
                  <Text style={styles.rangeLabelMuted}>Fără filtru</Text>
                )}
              </Text>
              <View style={styles.rangeRow}>
                <TextInput
                  style={styles.rangeInput}
                  placeholder="An minim"
                  placeholderTextColor={colors.textSecondary}
                  keyboardType="numeric"
                  value={filters.minYear ? String(filters.minYear) : ''}
                  onChangeText={(text) =>
                    setFilters({ ...filters, minYear: text ? parseInt(text, 10) || 0 : 0 })
                  }
                />
                <TextInput
                  style={styles.rangeInput}
                  placeholder="An maxim"
                  placeholderTextColor={colors.textSecondary}
                  keyboardType="numeric"
                  value={filters.maxYear ? String(filters.maxYear) : ''}
                  onChangeText={(text) =>
                    setFilters({ ...filters, maxYear: text ? parseInt(text, 10) || 0 : 0 })
                  }
                />
              </View>

               {/* Romanian Coin Filters - Only show when country is Romania */}
               {filters.country === 'România' && (
                  <View style={{ marginTop: 16 }}>
                    <View style={{ borderTopWidth: 1, borderTopColor: 'rgba(231, 183, 60, 0.25)', paddingTop: 16, marginBottom: 16 }}>
                      <Text style={styles.filterLabel}>Filtre Monede Românești</Text>
                    </View>
                    
                    {/* Face Value Filter */}
                    <Text style={styles.filterLabel}>Valoare Nominală</Text>
                    <View style={styles.filterChipsRow}>
                      {romanianCoinOptions.faceValues.slice(0, 10).map((value) => {
                        const active = filters.faceValue === value;
                        return (
                          <TouchableOpacity
                            key={value}
                            style={active ? [styles.filterChip, styles.filterChipActive] : styles.filterChip}
                            onPress={() => setFilters({ ...filters, faceValue: value })}
                          >
                            <Text
                              style={
                                active
                                  ? [styles.filterChipText, styles.filterChipTextActive]
                                  : styles.filterChipText
                              }
                            >
                              {value}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                      {romanianCoinOptions.faceValues.length > 10 && (
                        <Text style={{ color: '#94a3b8', fontSize: 12 }}>
                          ... și alte {romanianCoinOptions.faceValues.length - 10} valori
                        </Text>
                      )}
                    </View>

                    {/* Issue Year Filter */}
                    <Text style={styles.filterLabel}>An Emisiune</Text>
                    <View style={styles.filterChipsRow}>
                      {romanianCoinOptions.issueYears.slice(0, 10).map((year) => {
                        const active = filters.issueYear === year;
                        return (
                          <TouchableOpacity
                            key={year}
                            style={active ? [styles.filterChip, styles.filterChipActive] : styles.filterChip}
                            onPress={() => setFilters({ ...filters, issueYear: year })}
                          >
                            <Text
                              style={
                                active
                                  ? [styles.filterChipText, styles.filterChipTextActive]
                                  : styles.filterChipText
                              }
                            >
                              {year}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                      {romanianCoinOptions.issueYears.length > 10 && (
                        <Text style={{ color: '#94a3b8', fontSize: 12 }}>
                          ... și alte {romanianCoinOptions.issueYears.length - 10} ani
                        </Text>
                      )}
                    </View>

                    {/* Diameter Filter */}
                    <Text style={styles.filterLabel}>Diametru</Text>
                    <View style={styles.filterChipsRow}>
                      {romanianCoinOptions.diameters.slice(0, 10).map((diameter) => {
                        const active = filters.diameter === diameter;
                        return (
                          <TouchableOpacity
                            key={diameter}
                            style={active ? [styles.filterChip, styles.filterChipActive] : styles.filterChip}
                            onPress={() => setFilters({ ...filters, diameter })}
                          >
                            <Text
                              style={
                                active
                                  ? [styles.filterChipText, styles.filterChipTextActive]
                                  : styles.filterChipText
                              }
                            >
                              {diameter}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                      {romanianCoinOptions.diameters.length > 10 && (
                        <Text style={{ color: '#94a3b8', fontSize: 12 }}>
                          ... și alte {romanianCoinOptions.diameters.length - 10} dimensiuni
                        </Text>
                      )}
                    </View>

                    {/* Weight Filter */}
                    <Text style={styles.filterLabel}>Greutate</Text>
                    <View style={styles.filterChipsRow}>
                      {romanianCoinOptions.weights.slice(0, 10).map((weight) => {
                        const active = filters.weight === weight;
                        return (
                          <TouchableOpacity
                            key={weight}
                            style={active ? [styles.filterChip, styles.filterChipActive] : styles.filterChip}
                            onPress={() => setFilters({ ...filters, weight })}
                          >
                            <Text
                              style={
                                active
                                  ? [styles.filterChipText, styles.filterChipTextActive]
                                  : styles.filterChipText
                              }
                            >
                              {weight}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                      {romanianCoinOptions.weights.length > 10 && (
                        <Text style={{ color: '#94a3b8', fontSize: 12 }}>
                          ... și alte {romanianCoinOptions.weights.length - 10} greutăți
                        </Text>
                      )}
                    </View>

                    {/* Mint Filter */}
                    <Text style={styles.filterLabel}>Monetărie</Text>
                    <View style={styles.filterChipsRow}>
                      {romanianCoinOptions.mints.slice(0, 10).map((mint) => {
                        const active = filters.mint === mint;
                        return (
                          <TouchableOpacity
                            key={mint}
                            style={active ? [styles.filterChip, styles.filterChipActive] : styles.filterChip}
                            onPress={() => setFilters({ ...filters, mint })}
                          >
                            <Text
                              style={
                                active
                                  ? [styles.filterChipText, styles.filterChipTextActive]
                                  : styles.filterChipText
                              }
                            >
                              {mint}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                      {romanianCoinOptions.mints.length > 10 && (
                        <Text style={{ color: '#94a3b8', fontSize: 12 }}>
                          ... și alte {romanianCoinOptions.mints.length - 10} monetării
                        </Text>
                      )}
                    </View>

                    {/* Era Filter */}
                    <Text style={styles.filterLabel}>Epocă</Text>
                    <View style={styles.filterChipsRow}>
                      {romanianCoinOptions.eras.slice(0, 10).map((era) => {
                        const active = filters.era === era;
                        return (
                          <TouchableOpacity
                            key={era}
                            style={active ? [styles.filterChip, styles.filterChipActive] : styles.filterChip}
                            onPress={() => setFilters({ ...filters, era })}
                          >
                            <Text
                              style={
                                active
                                  ? [styles.filterChipText, styles.filterChipTextActive]
                                  : styles.filterChipText
                              }
                            >
                              {era}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                      {romanianCoinOptions.eras.length > 10 && (
                        <Text style={{ color: '#94a3b8', fontSize: 12 }}>
                          ... și alte {romanianCoinOptions.eras.length - 10} epoci
                        </Text>
                      )}
                    </View>
                  </View>
               )}

               {/* Action Buttons */}
               <View style={styles.modalActionsRow}>
                  <TouchableOpacity style={styles.modalResetButton} onPress={resetFilters}>
                    <Text style={styles.modalResetText}>Resetează</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.modalApplyButton}
                    onPress={() => setShowFilters(false)}
                  >
                    <Text style={styles.modalApplyText}>Aplică filtrele</Text>
                  </TouchableOpacity>
                 </View>
              </ScrollView>
            </View>
          </SafeAreaView>
        </Modal>
      </View>
    );
};

export default ProductCatalogScreen;
