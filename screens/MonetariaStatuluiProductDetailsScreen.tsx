import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
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

type MonetariaStatuluiProductDetailsScreenNavigationProp = StackNavigationProp<
  RootStackParamList,
  'MonetariaStatuluiProductDetails'
>;

interface RouteParams {
  productId: string;
}

export default function MonetariaStatuluiProductDetailsScreen() {
  const navigation = useNavigation<MonetariaStatuluiProductDetailsScreenNavigationProp>();
  const route = useRoute();
  const { productId } = route.params as RouteParams;
  
  const [product, setProduct] = useState<TransformedProduct | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadProduct = async () => {
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

        // Find the product by ID
        const rawProduct = data.products.find((p: RawProduct) => p.product_id === productId);
        if (!rawProduct) {
          throw new Error('Product not found');
        }

        // Extract properties from specifications
        const specs = rawProduct.specifications || '';
        const lines = specs.split('|').map((line: string) => line.trim());

        let productDiameter = '';
        let productWeight = '';
        let productMaterial = '';
        let productQuality = '';

        lines.forEach((line: string) => {
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

        const transformedProduct: TransformedProduct = {
          ...rawProduct,
          id: rawProduct.product_id,
          title: rawProduct.title || 'Piesă fără titlu',
          description: rawProduct.full_description,
          price: rawProduct.price,
          category: rawProduct.category,
          image: `/Monetaria_statului/romanian_mint_products/${rawProduct.category_slug}/${rawProduct.image_files}`,
          link: `/monetaria-statului/${rawProduct.product_id}`,
          diameter: productDiameter,
          weight: productWeight,
          mint: productMaterial,
          era: productQuality,
        };
        setProduct(transformedProduct);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    loadProduct();
  }, [productId]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Se încarcă produsul...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Eroare la încărcarea produsului: {error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => navigation.goBack()}>
          <Text style={styles.retryButtonText}>Înapoi</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!product) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Produsul nu a fost găsit</Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => navigation.goBack()}>
          <Text style={styles.retryButtonText}>Înapoi</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Text style={styles.backBtnText}>←</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Detalii Produs</Text>
          <View style={{ width: 36 }} />
        </View>

        {/* Product Image */}
        <View style={styles.productImageContainer}>
          <Image
            source={{ uri: `${process.env.EXPO_PUBLIC_API_URL || 'https://enumismatica.ro'}${product.image}` }}
            style={styles.productImage}
            resizeMode="contain"
          />
        </View>

        {/* Product Info */}
        <View style={styles.productInfoSection}>
          <Text style={styles.productTitle}>{product.title}</Text>
          <Text style={styles.productPrice}>{product.price}</Text>
          <Text style={styles.productCategory}>Categorie: {product.category}</Text>
        </View>

        {/* Product Description */}
        <View style={styles.descriptionSection}>
          <Text style={styles.sectionTitle}>Descriere</Text>
          <Text style={styles.productDescription}>{product.description}</Text>
        </View>

        {/* Product Specifications */}
        <View style={styles.specificationsSection}>
          <Text style={styles.sectionTitle}>Specificații</Text>
          <View style={styles.specificationsGrid}>
            {product.mint && (
              <View style={styles.specificationItem}>
                <Text style={styles.specificationLabel}>Material</Text>
                <Text style={styles.specificationValue}>{product.mint}</Text>
              </View>
            )}
            {product.diameter && (
              <View style={styles.specificationItem}>
                <Text style={styles.specificationLabel}>Diametru</Text>
                <Text style={styles.specificationValue}>{product.diameter}</Text>
              </View>
            )}
            {product.weight && (
              <View style={styles.specificationItem}>
                <Text style={styles.specificationLabel}>Greutate</Text>
                <Text style={styles.specificationValue}>{product.weight}</Text>
              </View>
            )}
            {product.era && (
              <View style={styles.specificationItem}>
                <Text style={styles.specificationLabel}>Calitate</Text>
                <Text style={styles.specificationValue}>{product.era}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Add to Cart Button */}
        <View style={styles.addToCartSection}>
          <TouchableOpacity style={styles.addToCartButton} onPress={() => Alert.alert('Funcție în dezvoltare', 'Adăugarea în coș va fi disponibilă în viitoarele versiuni')}>
            <Text style={styles.addToCartButtonText}>Adaugă în coș</Text>
          </TouchableOpacity>
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
  productImageContainer: {
    aspectRatio: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
    marginBottom: 16,
  },
  productImage: {
    width: '100%',
    height: '100%',
  },
  productInfoSection: {
    marginBottom: 24,
  },
  productTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 8,
  },
  productPrice: {
    fontSize: 20,
    color: colors.primary,
    fontWeight: '700',
    marginBottom: 4,
  },
  productCategory: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  descriptionSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 12,
  },
  productDescription: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  specificationsSection: {
    marginBottom: 24,
  },
  specificationsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  specificationItem: {
    width: '48%',
    marginBottom: 12,
  },
  specificationLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  specificationValue: {
    fontSize: 14,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  addToCartSection: {
    alignItems: 'center',
  },
  addToCartButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    minWidth: 200,
    alignItems: 'center',
  },
  addToCartButtonText: {
    color: colors.primaryText,
    fontSize: 16,
    fontWeight: '700',
  },
});
