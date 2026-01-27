import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  RefreshControl,
  FlatList,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import type { RootStackParamList } from '../navigationTypes';
import { colors } from '../styles/sharedStyles';

interface RawProduct {
  title: string;
  product_url: string;
  product_id: string;
  price: string;
  price_without_vat: string;
  category: string;
  category_slug: string;
  stock: string;
  model: string;
  sku: string;
  price_full: string;
  full_description: string;
  specifications: string;
  images_downloaded: number;
  image_files: string;
}

interface TransformedProduct {
  id: string;
  title: string;
  description: string;
  price: string;
  category: string;
  image: string;
  link: string;
  diameter: string;
  weight: string;
  mint: string;
  era: string;
}

export default function MonetariaStatuluiScreen() {
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  const [products, setProducts] = useState<TransformedProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [refreshing, setRefreshing] = useState(false);
  const productsPerPage = 12;

  // Monetaria Statului filters
  const [material, setMaterial] = useState<string>('Toate Materialele');
  const [diameter, setDiameter] = useState<string>('Toate Diametrele');
  const [weight, setWeight] = useState<string>('Toate Greutățile');
  const [quality, setQuality] = useState<string>('Toate Calitățile');

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Load monetaria-data.json from public folder
        const response = await fetch(`${process.env.EXPO_PUBLIC_API_URL || 'https://enumismatica.ro'}/monetaria-data.json`);
        if (!response.ok) throw new Error('Failed to load data');
        const data = await response.json();

        // Validate data structure
        if (!data || !data.products || !Array.isArray(data.products)) {
          throw new Error('Invalid data format: missing products array');
        }

        const transformedProducts = data.products.map((p: RawProduct) => {
          // Extract properties from specifications
          const specs = p.specifications || '';
          const lines = specs.split('|').map(line => line.trim());

          let productDiameter = '';
          let productWeight = '';
          let productMaterial = '';
          let productQuality = '';

          lines.forEach(line => {
            if (line.includes('Diametru:')) {
              productDiameter = line.split('Diametru:')[1]?.trim() || '';
            }
            if (line.includes('Greutate:')) {
              productWeight = line.split('Greutate:')[1]?.trim() || '';
            }
            if (line.includes('Material:')) {
              productMaterial = line.split('Material:')[1]?.trim() || '';
            }
            if (line.includes('Calitate:')) {
              productQuality = line.split('Calitate:')[1]?.trim() || '';
            }
          });

          return {
            ...p,
            id: p.product_id,
            title: p.title || 'Piesă fără titlu',
            description: p.full_description,
            price: p.price,
            category: p.category,
            image: `/Monetaria_statului/romanian_mint_products/${p.category_slug}/${p.image_files}`,
            link: `/monetaria-statului/${p.product_id}`,
            diameter: productDiameter,
            weight: productWeight,
            mint: productMaterial,
            era: productQuality,
          };
        });
        setProducts(transformedProducts);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    // Reload data
    await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate delay
    // In a real app, you would reload the data from the API
    setRefreshing(false);
  };

  // Calculate dynamic filter options based on current selections
  const getFilteredProductsExcluding = (excludeFilter: string) => {
    let baseProducts = selectedCategory === 'all' ? products : products.filter(p => p.category === selectedCategory);

    // Apply current filters EXCEPT the one we're calculating options for
    if (excludeFilter !== 'material' && material !== 'Toate Materialele') {
      baseProducts = baseProducts.filter(p => p.mint === material);
    }
    if (excludeFilter !== 'diameter' && diameter !== 'Toate Diametrele') {
      baseProducts = baseProducts.filter(p => p.diameter === diameter);
    }
    if (excludeFilter !== 'weight' && weight !== 'Toate Greutățile') {
      baseProducts = baseProducts.filter(p => p.weight === weight);
    }
    if (excludeFilter !== 'quality' && quality !== 'Toate Calitățile') {
      baseProducts = baseProducts.filter(p => p.era === quality);
    }

    return baseProducts;
  };

  // Calculate available options for each filter based on other filters
  const availableMaterials = ['Toate Materialele', ...new Set(getFilteredProductsExcluding('material').map(p => p.mint).filter(Boolean))];
  const availableDiameters = ['Toate Diametrele', ...new Set(getFilteredProductsExcluding('diameter').map(p => p.diameter).filter(Boolean))];
  const availableWeights = ['Toate Greutățile', ...new Set(getFilteredProductsExcluding('weight').map(p => p.weight).filter(Boolean))];
  const availableQualities = ['Toate Calitățile', ...new Set(getFilteredProductsExcluding('quality').map(p => p.era).filter(Boolean))];

  const categories = ['all', ...new Set(products.map(p => p.category))];
  let filteredProducts = selectedCategory === 'all' ? products : products.filter(p => p.category === selectedCategory);

  // Apply Monetaria Statului filters
  if (material !== 'Toate Materialele') {
    filteredProducts = filteredProducts.filter(p => p.mint === material);
  }
  if (diameter !== 'Toate Diametrele') {
    filteredProducts = filteredProducts.filter(p => p.diameter === diameter);
  }
  if (weight !== 'Toate Greutățile') {
    filteredProducts = filteredProducts.filter(p => p.weight === weight);
  }
  if (quality !== 'Toate Calitățile') {
    filteredProducts = filteredProducts.filter(p => p.era === quality);
  }

  const totalPages = Math.ceil(filteredProducts.length / productsPerPage);
  const startIndex = (currentPage - 1) * productsPerPage;
  const endIndex = startIndex + productsPerPage;
  const currentProducts = filteredProducts.slice(startIndex, endIndex);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Se încarcă produsele...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Eroare la încărcarea produselor: {error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => {
          // In React Native, we can reload the app by calling reloadAsync from Expo
          // For web, we can use window.location.reload()
          if (typeof window !== 'undefined' && window.location) {
            window.location.reload();
          } else {
            // For native, you might want to implement a different logic
            // For now, we'll just log a message
            console.log('Reload functionality not available on this platform');
          }
        }}>
          <Text style={styles.retryButtonText}>Reîncearcă</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Text style={styles.backBtnText}>←</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Monetăria Statului</Text>
          <View style={{ width: 36 }} />
        </View>

        <View style={styles.heroSection}>
          <Text style={styles.heroTitle}>Tradiție și Excelență</Text>
          <Text style={styles.heroSubtitle}>
            Fondată în 1870, Monetăria Statului este standardul pentru monedă și artefacte prețioase în România.
          </Text>
        </View>

        {/* Category Selection */}
        <View style={styles.categorySection}>
          <Text style={styles.sectionTitle}>Categorii</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScrollView}>
            {categories.map(category => (
              <TouchableOpacity
                key={category}
                style={[
                  styles.categoryButton,
                  selectedCategory === category && styles.categoryButtonSelected,
                ]}
                onPress={() => {
                  setSelectedCategory(category);
                  setCurrentPage(1);
                }}
              >
                <Text style={[
                  styles.categoryButtonText,
                  selectedCategory === category && styles.categoryButtonTextSelected,
                ]}>
                  {category === 'all' ? 'Toate categoriile' : category}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Monetaria Statului Filters */}
        {products.length > 0 && (
          <View style={styles.filtersSection}>
            <Text style={styles.sectionTitle}>Filtre</Text>
            <View style={styles.filtersContainer}>
              <View style={styles.filterColumn}>
                <Text style={styles.filterLabel}>Material</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScrollView}>
                  {availableMaterials.map((m) => (
                    <TouchableOpacity
                      key={m}
                      style={[
                        styles.filterButton,
                        material === m && styles.filterButtonSelected,
                      ]}
                      onPress={() => setMaterial(m)}
                    >
                      <Text style={[
                        styles.filterButtonText,
                        material === m && styles.filterButtonTextSelected,
                      ]}>
                        {m}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              <View style={styles.filterColumn}>
                <Text style={styles.filterLabel}>Diametru</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScrollView}>
                  {availableDiameters.map((d) => (
                    <TouchableOpacity
                      key={d}
                      style={[
                        styles.filterButton,
                        diameter === d && styles.filterButtonSelected,
                      ]}
                      onPress={() => setDiameter(d)}
                    >
                      <Text style={[
                        styles.filterButtonText,
                        diameter === d && styles.filterButtonTextSelected,
                      ]}>
                        {d}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              <View style={styles.filterColumn}>
                <Text style={styles.filterLabel}>Greutate</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScrollView}>
                  {availableWeights.map((w) => (
                    <TouchableOpacity
                      key={w}
                      style={[
                        styles.filterButton,
                        weight === w && styles.filterButtonSelected,
                      ]}
                      onPress={() => setWeight(w)}
                    >
                      <Text style={[
                        styles.filterButtonText,
                        weight === w && styles.filterButtonTextSelected,
                      ]}>
                        {w}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              <View style={styles.filterColumn}>
                <Text style={styles.filterLabel}>Calitate</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScrollView}>
                  {availableQualities.map((q) => (
                    <TouchableOpacity
                      key={q}
                      style={[
                        styles.filterButton,
                        quality === q && styles.filterButtonSelected,
                      ]}
                      onPress={() => setQuality(q)}
                    >
                      <Text style={[
                        styles.filterButtonText,
                        quality === q && styles.filterButtonTextSelected,
                      ]}>
                        {q}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            </View>
          </View>
        )}

        {/* Products Grid */}
        <View style={styles.productsSection}>
          <Text style={styles.sectionTitle}>Produse</Text>
          <View style={styles.productsContainer}>
            {currentProducts.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={styles.productCard}
                onPress={() => navigation.navigate('MonetariaStatuluiProductDetails', { productId: item.id })}
              >
                <View style={styles.productImageContainer}>
                  <Image
                    source={{ uri: `${process.env.EXPO_PUBLIC_API_URL || 'https://enumismatica.ro'}${item.image}` }}
                    style={styles.productImage}
                    resizeMode="contain"
                  />
                </View>
                <View style={styles.productInfo}>
                  <Text style={styles.productTitle} numberOfLines={2}>
                    {item.title}
                  </Text>
                  <Text style={styles.productPrice}>{item.price}</Text>
                </View>
                <TouchableOpacity style={styles.addToCartButton}>
                  <Text style={styles.addToCartButtonText}>Adaugă în coș</Text>
                </TouchableOpacity>
              </TouchableOpacity>
            ))}
          </View>

          {/* Pagination */}
          {totalPages > 1 && (
            <View style={styles.paginationContainer}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.paginationScrollContent}>
                <TouchableOpacity
                  style={[styles.paginationButton, currentPage === 1 && styles.disabledButton]}
                  onPress={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                >
                  <Text style={styles.paginationButtonText}>Previoase</Text>
                </TouchableOpacity>

                <View style={styles.pageNumbersContainer}>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                    <TouchableOpacity
                      key={page}
                      style={[
                        styles.pageNumberButton,
                        currentPage === page && styles.pageNumberButtonSelected,
                      ]}
                      onPress={() => setCurrentPage(page)}
                    >
                      <Text style={[
                        styles.pageNumberButtonText,
                        currentPage === page && styles.pageNumberButtonTextSelected,
                      ]}>
                        {page}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <TouchableOpacity
                  style={[styles.paginationButton, currentPage === totalPages && styles.disabledButton]}
                  onPress={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage === totalPages}
                >
                  <Text style={styles.paginationButtonText}>Următoare</Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 96,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.borderColor,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  backBtnText: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: '700',
  },
  title: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'center',
    flex: 1,
    marginHorizontal: 10,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  loadingText: {
    color: colors.textSecondary,
    marginTop: 16,
    fontSize: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
    padding: 20,
  },
  errorText: {
    color: '#ef4444',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryButtonText: {
    color: colors.primaryText,
    fontSize: 14,
    fontWeight: '600',
  },
  heroSection: {
    marginBottom: 24,
  },
  heroTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 8,
  },
  heroSubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  categorySection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 12,
  },
  categoryScrollView: {
    flexDirection: 'row',
  },
  categoryButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: colors.borderColor,
    marginRight: 8,
  },
  categoryButtonSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  categoryButtonText: {
    fontSize: 14,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  categoryButtonTextSelected: {
    color: colors.primaryText,
  },
  filtersSection: {
    marginBottom: 24,
  },
  filtersContainer: {
    gap: 16,
  },
  filterColumn: {
    gap: 8,
    marginBottom: 16,
  },
  filterLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 8,
  },
  filterScrollView: {
    flexDirection: 'row',
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: colors.borderColor,
    marginRight: 8,
    minWidth: 100,
    alignItems: 'center',
  },
  filterButtonSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
    transform: [{ scale: 1.05 }],
  },
  filterButtonText: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  filterButtonTextSelected: {
    color: colors.primaryText,
    fontSize: 13,
  },
  productsSection: {
    marginBottom: 24,
  },
  productsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    padding: 4,
  },
  productCard: {
    width: '48%',
    backgroundColor: colors.cardBackground,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 16,
  },
  productImageContainer: {
    aspectRatio: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  productImage: {
    width: '100%',
    height: '100%',
  },
  productInfo: {
    padding: 12,
  },
  productTitle: {
    fontSize: 14,
    color: colors.textPrimary,
    fontWeight: '500',
    marginBottom: 4,
  },
  productPrice: {
    fontSize: 16,
    color: colors.primary,
    fontWeight: '700',
  },
  paginationContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginTop: 24,
  },
  paginationButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: colors.borderColor,
  },
  paginationButtonText: {
    fontSize: 14,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  disabledButton: {
    opacity: 0.5,
  },
  pageNumbersContainer: {
    flexDirection: 'row',
    gap: 4,
  },
  pageNumberButton: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: colors.borderColor,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pageNumberButtonSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  pageNumberButtonText: {
    fontSize: 14,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  pageNumberButtonTextSelected: {
    color: colors.primaryText,
  },
  paginationScrollContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  addToCartButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    alignSelf: 'flex-end',
    marginRight: 12,
    marginBottom: 12,
  },
  addToCartButtonText: {
    color: colors.primaryText,
    fontSize: 12,
    fontWeight: '600',
  },
});
