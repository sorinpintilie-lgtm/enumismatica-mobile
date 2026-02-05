import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Share,
} from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import type { RootStackParamList } from '../navigationTypes';
import { colors } from '../styles/sharedStyles';
import InlineBackButton from '../components/InlineBackButton';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../hooks/useCart';
import { Ionicons } from '@expo/vector-icons';

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
  const { user } = useAuth();
  const { addToCart, items: cartItems } = useCart(user?.uid);
  const cartCount = cartItems?.length ?? 0;

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

  const handleAddToCart = async () => {
    if (!user) {
      Alert.alert('Autentificare necesară', 'Este necesară autentificarea pentru a adăuga produse în coș.');
      return;
    }
    if (!product) {
      Alert.alert('Eroare', 'Produsul nu este disponibil.');
      return;
    }
    try {
      await addToCart(product.id, {
        isMintProduct: true,
        mintProductData: product,
      });
      Alert.alert('Succes', `${product.title} a fost adăugat în coș!`);
    } catch (error: any) {
      Alert.alert('Eroare', error.message || 'Nu s-a putut adăuga produsul în coș.');
    }
  };

  const handleBuyNow = async () => {
    if (!user) {
      Alert.alert('Autentificare necesară', 'Este necesară autentificarea pentru a cumpăra produse.');
      return;
    }
    if (!product) {
      Alert.alert('Eroare', 'Produsul nu este disponibil.');
      return;
    }
    // Navigate to checkout with product
    navigation.navigate('Checkout', { productId: product.id });
  };

  const handleShareProduct = async () => {
    if (!product) return;
    const deepLinkUrl = `enumismatica://monetaria-statului/${product.id}`;
    const message = `${product.title} - ${product.price}\n\n${deepLinkUrl}`;

    try {
      await Share.share({
        message,
        title: product.title,
      });
    } catch (error) {
      console.error('Failed to share product:', error);
    }
  };

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
        <InlineBackButton />
        <Text style={[styles.errorText, { marginTop: 12 }]}>Eroare la încărcarea produsului: {error}</Text>
      </View>
    );
  }

  if (!product) {
    return (
      <View style={styles.errorContainer}>
        <InlineBackButton />
        <Text style={[styles.errorText, { marginTop: 12 }]}>Produsul nu a fost găsit</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        <View style={{ marginBottom: 16 }}>
          <InlineBackButton />
          <View style={styles.header}>
            <View style={{ flex: 1 }} />
            <View style={styles.actionButtonsContainer}>
              <TouchableOpacity
                style={styles.cartIconButton}
                accessibilityRole="button"
                accessibilityLabel="Distribuie produsul"
                onPress={handleShareProduct}
              >
                <Ionicons name="share-social-outline" size={20} color={colors.primary} />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.cartIconButton}
                accessibilityRole="button"
                accessibilityLabel="Deschide coșul"
                onPress={() => navigation.navigate('Cart')}
              >
                <Ionicons name="cart-outline" size={20} color={colors.primary} />
                {cartCount > 0 && (
                  <View style={styles.cartBadge}>
                    <Text style={styles.cartBadgeText} numberOfLines={1}>
                      {cartCount > 99 ? '99+' : String(cartCount)}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>
          </View>
          <Text style={[styles.title, { marginTop: 12, textAlign: 'left' }]}>Detalii Produs</Text>
        </View>

        {/* Product Image */}
        <View style={styles.productImageContainer}>
          <ExpoImage
            source={{ uri: `${process.env.EXPO_PUBLIC_API_URL || 'https://enumismatica.ro'}${product.image}` }}
            style={styles.productImage}
            contentFit="contain"
            cachePolicy="memory-disk"
            transition={200}
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
          <View style={styles.buttonRow}>
            <TouchableOpacity style={[styles.actionButton, styles.buyNowButton]} onPress={handleBuyNow}>
              <Text style={styles.actionButtonText}>Cumpără acum</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionButton, styles.addToCartButton]} onPress={handleAddToCart}>
              <Text style={styles.actionButtonText}>Adaugă în coș</Text>
            </TouchableOpacity>
          </View>
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  actionButtonsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  cartIconButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.navy800,
    borderWidth: 1,
    borderColor: 'rgba(231, 183, 60, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cartBadge: {
    position: 'absolute',
    top: -6,
    right: -6,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.red500,
    borderWidth: 1,
    borderColor: 'rgba(0, 2, 13, 0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  cartBadgeText: {
    color: colors.textPrimary,
    fontSize: 11,
    fontWeight: '800',
    lineHeight: 12,
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
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  actionButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  buyNowButton: {
    backgroundColor: colors.primary,
  },
  addToCartButton: {
    backgroundColor: colors.primary,
    borderWidth: 1,
    borderColor: 'rgba(231, 183, 60, 0.6)',
  },
  actionButtonText: {
    color: colors.primaryText,
    fontSize: 16,
    fontWeight: '700',
  },
});
