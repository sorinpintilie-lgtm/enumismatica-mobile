import React, { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, Alert, StyleSheet, Image } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../navigationTypes';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../hooks/useCart';
import { useProducts } from '../hooks/useProducts';
import { createDirectOrderForProduct } from '@shared/orderService';
import { colors } from '../styles/sharedStyles';
import InlineBackButton from '../components/InlineBackButton';
import { formatEUR } from '../utils/currency';

const CartScreen: React.FC = () => {
  const { user, loading: authLoading } = useAuth();
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  const [placingOrderFor, setPlacingOrderFor] = useState<string | null>(null);

  if (authLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Se încarcă coșul...</Text>
      </View>
    );
  }

  if (!user) {
    return (
      <View style={styles.authContainer}>
        <Text style={styles.authTitle}>
          Autentificați-vă pentru a accesa coșul de cumpărături.
        </Text>
        <TouchableOpacity
          style={styles.authButton}
          onPress={() => navigation.navigate('Login')}
        >
          <Text style={styles.authButtonText}>Autentificare</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const { items, loading: cartLoading, error, removeItem, clearCart } = useCart(user.uid);

  // Ensure we fetch images for cart display.
  const productFields = useMemo(
    () => ['name', 'images', 'price', 'createdAt', 'updatedAt'] as const,
    [],
  );
  const {
    products,
    loading: productsLoading,
  } = useProducts({
    pageSize: 200,
    fields: productFields as unknown as string[],
  });

  const loading = cartLoading || productsLoading;

  const lines = useMemo(
    () =>
      items.map((item) => {
        const product = products.find((p) => p.id === item.productId) || null;
        return { item, product };
      }),
    [items, products],
  );

  const parseMintPrice = (price: unknown) => {
    if (typeof price === 'number') return price;
    if (typeof price !== 'string') return null;
    const cleaned = price.replace(/[\s\u00A0]/g, '').replace(/\./g, '').replace(',', '.');
    const numeric = Number(cleaned.replace(/[^\d.-]/g, ''));
    return Number.isFinite(numeric) ? numeric : null;
  };

  const totalValue = useMemo(
    () =>
      lines.reduce((sum, { item, product }) => {
        if (item.isMintProduct) {
          const mintPrice = parseMintPrice(item.mintProductData?.price);
          return sum + (mintPrice ?? 0);
        }
        if (!product || typeof product.price !== 'number') return sum;
        return sum + product.price;
      }, 0),
    [lines],
  );

  const handleCheckoutItem = async (item: {
    productId: string;
    id: string;
    isMintProduct?: boolean;
    mintProductData?: any;
  }) => {
    if (!user) {
      Alert.alert('Autentificare necesară', 'Trebuie să fie autentificat pentru a cumpăra.');
      return;
    }

    try {
      setPlacingOrderFor(item.productId);
      await createDirectOrderForProduct(
        item.productId,
        user.uid,
        item.isMintProduct,
        item.mintProductData,
      );
      await removeItem(item.id);

      Alert.alert(
        'Comandă creată',
        'Comanda a fost înregistrată. Se poate vedea în istoricul comenzilor pe web.',
      );
    } catch (err: any) {
      console.error('Failed to create order from cart', err);
      Alert.alert(
        'Eroare la cumpărare',
        err?.message || 'Nu s-a putut finaliza cumpărarea acestui produs.',
      );
    } finally {
      setPlacingOrderFor(null);
    }
  };

  const handleClearCart = () => {
    if (!items.length) return;
    Alert.alert(
      'Golește coșul',
      'Este sigur că doriți să golești întregul coș?',
      [
        { text: 'Anulează', style: 'cancel' },
        {
          text: 'Da, golește',
          style: 'destructive',
          onPress: async () => {
            try {
              await clearCart();
            } catch (err: any) {
              console.error('Failed to clear cart', err);
              Alert.alert(
                'Eroare',
                err?.message || 'Nu s-a putut goli coșul. Încearcă din nou.',
              );
            }
          },
        },
      ],
    );
  };

  const isEmpty = !loading && lines.length === 0;

  return (
    <ScrollView style={styles.screenContainer}>
      <View style={styles.headerContainer}>
        <InlineBackButton />
        <Text style={styles.headerTitle}>Coșul de cumpărături</Text>
        {loading ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={styles.loadingText}>Se încarcă produsele din coș...</Text>
          </View>
        ) : isEmpty ? (
          <Text style={styles.emptyText}>
            Coșul este gol. Adăugați monede din magazin pentru a le cumpăra direct.
          </Text>
        ) : (
          <View style={styles.cartSummary}>
            <Text style={styles.cartSummaryText}>
              Există {lines.length} {lines.length === 1 ? 'produs' : 'produse'} în coș.
            </Text>
            <Text style={styles.cartTotalText}>
              Total estimat:{' '}
              <Text style={styles.totalValue}>
                {formatEUR(totalValue)}
              </Text>
            </Text>
          </View>
        )}
        {error && (
          <Text style={styles.errorText}>
            Eroare la încărcarea coșului: {error}
          </Text>
        )}
      </View>

      {!isEmpty && !loading && (
        <View style={styles.cartContent}>
          {lines.map(({ item, product }) => {
            const label = product?.name || `Produs ${item.productId}`;
            const price =
              product && typeof product.price === 'number'
                ? formatEUR(product.price)
                : 'Preț indisponibil';

            return (
              <View
                key={item.id}
                style={styles.cartItem}
              >
                <View style={styles.itemRow}>
                  <View style={styles.itemImageWrap}>
                    {product?.images && product.images.length > 0 ? (
                      <Image
                        source={{ uri: product.images[0] }}
                        style={styles.itemImage}
                      />
                    ) : (
                      <Text style={styles.itemImagePlaceholder}>Fără imagine</Text>
                    )}
                  </View>

                  <View style={{ flex: 1 }}>
                    <View style={styles.itemHeader}>
                      <Text style={styles.itemName} numberOfLines={2}>
                        {label}
                      </Text>
                      <Text style={styles.itemPrice}>
                        {price}
                      </Text>
                    </View>
                    <Text style={styles.itemProductId}>
                      ID produs: {item.productId}
                    </Text>
                  </View>
                </View>
                <View style={styles.itemActions}>
                  <TouchableOpacity
                    style={styles.viewButton}
                    onPress={() =>
                      navigation.navigate('ProductDetails', { productId: item.productId })
                    }
                  >
                    <Text style={styles.viewButtonText}>
                      Vezi produsul
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.buyButton}
                    disabled={placingOrderFor === item.productId}
                    onPress={() => handleCheckoutItem(item)}
                  >
                    {placingOrderFor === item.productId ? (
                      <ActivityIndicator size="small" color={colors.primaryText} />
                    ) : (
                      <Text style={styles.buyButtonText}>
                        Cumpără acum
                      </Text>
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.removeButton}
                    onPress={() => removeItem(item.id)}
                  >
                    <Text style={styles.removeButtonText}>×</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}

          <TouchableOpacity
            style={styles.clearButton}
            onPress={handleClearCart}
          >
            <Text style={styles.clearButtonText}>
              Golește coșul
            </Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.continueShoppingContainer}>
        <Text style={styles.continueShoppingTitle}>Continuă cumpărăturile</Text>
        <View style={styles.continueShoppingButtons}>
          <TouchableOpacity
            style={styles.shopButton}
            onPress={() => navigation.navigate('MainTabs', { screen: 'ProductCatalog' })}
          >
            <Text style={styles.shopButtonText}>
              Magazin
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.auctionsButton}
            onPress={() => navigation.navigate('MainTabs', { screen: 'AuctionList', params: { filters: undefined } })}
          >
            <Text style={styles.auctionsButtonText}>
              Vezi licitațiile
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.checkoutButton}
            onPress={() => navigation.navigate('Checkout')}
          >
            <Text style={styles.checkoutButtonText}>
              Finalizează cumpărarea
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  screenContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  headerContainer: {
    backgroundColor: colors.background,
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
    color: colors.primary,
    marginBottom: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
    backgroundColor: colors.background,
  },
  loadingText: {
    marginTop: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    fontSize: 16,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 8,
  },
  authContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
    backgroundColor: colors.background,
  },
  authTitle: {
    fontSize: 18,
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: 24,
  },
  authButton: {
    backgroundColor: colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    shadowColor: colors.primary,
    shadowOpacity: 0.6,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
    elevation: 4,
  },
  authButtonText: {
    color: colors.primaryText,
    fontWeight: '600',
    textAlign: 'center',
  },
  cartSummary: {
    marginVertical: 8,
  },
  cartSummaryText: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  cartTotalText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  totalValue: {
    color: colors.primary,
  },
  errorText: {
    color: colors.error,
    fontSize: 14,
    marginTop: 8,
  },
  cartContent: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  cartItem: {
    backgroundColor: colors.cardBackground,
    borderWidth: 1,
    borderColor: colors.borderColor,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  itemRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  itemImageWrap: {
    width: 72,
    height: 72,
    borderRadius: 14,
    backgroundColor: colors.navy800,
    borderWidth: 1,
    borderColor: 'rgba(231, 183, 60, 0.25)',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  itemImagePlaceholder: {
    color: colors.textSecondary,
    fontSize: 11,
    textAlign: 'center',
    paddingHorizontal: 6,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  itemName: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
    marginRight: 8,
  },
  itemPrice: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.success,
  },
  itemProductId: {
    fontSize: 12,
    color: colors.textTertiary,
    marginBottom: 12,
  },
  itemActions: {
    flexDirection: 'row',
    gap: 8,
  },
  viewButton: {
    flex: 1,
    backgroundColor: colors.navy800,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.borderColor,
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewButtonText: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '500',
  },
  buyButton: {
    flex: 1,
    backgroundColor: colors.primary,
    paddingVertical: 8,
    borderRadius: 12,
    shadowColor: colors.primary,
    shadowOpacity: 0.6,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
    elevation: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buyButtonText: {
    color: colors.primaryText,
    fontSize: 14,
    fontWeight: '500',
  },
  removeButton: {
    width: 40,
    backgroundColor: colors.navy800,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.borderColor,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeButtonText: {
    color: colors.textPrimary,
    fontSize: 20,
    fontWeight: 'bold',
  },
  clearButton: {
    backgroundColor: colors.navy800,
    paddingVertical: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.borderColor,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  clearButtonText: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '600',
  },
  continueShoppingContainer: {
    backgroundColor: colors.cardBackground,
    borderWidth: 1,
    borderColor: colors.borderColor,
    borderRadius: 16,
    padding: 16,
    margin: 16,
  },
  continueShoppingTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.primary,
    marginBottom: 16,
  },
  continueShoppingButtons: {
    gap: 8,
  },
  shopButton: {
    backgroundColor: colors.navy800,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.borderColor,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shopButtonText: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '600',
  },
  auctionsButton: {
    backgroundColor: colors.navy800,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.borderColor,
    alignItems: 'center',
    justifyContent: 'center',
  },
  auctionsButtonText: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '600',
  },
  checkoutButton: {
    backgroundColor: colors.primary,
    paddingVertical: 12,
    borderRadius: 12,
    shadowColor: colors.primary,
    shadowOpacity: 0.6,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
    elevation: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkoutButtonText: {
    color: colors.primaryText,
    fontSize: 16,
    fontWeight: '600',
  },
  emptyText: {
    fontSize: 14,
    color: colors.textSecondary,
    marginVertical: 8,
  },
});

export default CartScreen;
