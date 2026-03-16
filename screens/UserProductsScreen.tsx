import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, ActivityIndicator, TouchableOpacity, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { useAuth } from '../context/AuthContext';
import { useProducts } from '../hooks/useProducts';
import { RootStackParamList } from '../navigationTypes';
import { colors } from '../styles/sharedStyles';
import { formatEUR } from '../utils/currency';
import InlineBackButton from '../components/InlineBackButton';
import { getEffectiveListingExpiryDate, isDirectListingExpired } from '@shared/listingExpiry';
import { relistProductWithCredits, calculateProductListingCost } from '@shared/creditService';

type Tab = 'active' | 'inactive';

const UserProductsScreen: React.FC = () => {
  const { user, loading: authLoading } = useAuth();
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();

  const userId = user?.uid || null;
  const [relistingProductId, setRelistingProductId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('active');

  const { products, loading: productsLoading, error: productsError } = useProducts({
    ownerId: userId || undefined,
    pageSize: 200,
    listingType: 'direct',
    loadAllAtOnce: true,
  });

  const ownerProducts = useMemo(() => {
    const all = [...products];
    return all.sort((a: any, b: any) => {
      const ad = a?.updatedAt instanceof Date ? a.updatedAt.getTime() : 0;
      const bd = b?.updatedAt instanceof Date ? b.updatedAt.getTime() : 0;
      return bd - ad;
    });
  }, [products]);

  const activeProducts = useMemo(
    () => ownerProducts.filter((p: any) => !isDirectListingExpired(p)),
    [ownerProducts]
  );

  const expiredProducts = useMemo(
    () => ownerProducts.filter((p: any) => isDirectListingExpired(p) && !p?.isSold),
    [ownerProducts]
  );

  const loading = authLoading || productsLoading;

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.subtitle, { marginTop: 12 }]}>Se încarcă produsele utilizatorului...</Text>
      </View>
    );
  }

  if (!user) {
    return (
      <View style={styles.center}>
        <Text style={[styles.title, { fontSize: 18, textAlign: 'center', marginBottom: 12 }]}>
          Produsele utilizatorului sunt disponibile doar pentru utilizatori autentificați.
        </Text>
        <TouchableOpacity
          style={[styles.primaryButton, { alignSelf: 'stretch' }]}
          onPress={() => navigation.navigate('Login')}
        >
          <Text style={styles.primaryButtonText}>Autentificare</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (productsError) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorTitle}>Eroare la încărcarea produselor</Text>
        <Text style={styles.errorText}>{productsError}</Text>
      </View>
    );
  }

  const relistDays = 30;
  const relistCost = calculateProductListingCost(relistDays);

  const handleRelist = async (productId: string) => {
    if (!user?.uid) return;
    try {
      setRelistingProductId(productId);
      await relistProductWithCredits(user.uid, productId, relistDays);
    } catch (e: any) {
      alert(e?.message || 'Nu s-a putut relista produsul.');
    } finally {
      setRelistingProductId(null);
    }
  };

  const displayedProducts = activeTab === 'active' ? activeProducts : expiredProducts;

  return (
    <ScrollView style={styles.screen}>
      <View style={styles.content}>
        <InlineBackButton />
        <View style={{ marginTop: 12, marginBottom: 16 }}>
          <View style={styles.headerRow}>
            <View style={{ flex: 1, marginRight: 12 }}>
              <Text style={styles.title}>Produsele mele</Text>
              <Text style={styles.subtitle}>
                {activeProducts.length} active · {expiredProducts.length} expirate
              </Text>
            </View>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() => navigation.navigate('NewListing', { listingType: 'direct' })}
            >
              <Text style={styles.primaryButtonText}>Adaugă</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── TAB BAR ── */}
        <View style={styles.tabBar}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'active' && styles.tabActive]}
            onPress={() => setActiveTab('active')}
          >
            <Text style={[styles.tabText, activeTab === 'active' && styles.tabTextActive]}>
              Active ({activeProducts.length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'inactive' && styles.tabInactive]}
            onPress={() => setActiveTab('inactive')}
          >
            <Text style={[styles.tabText, activeTab === 'inactive' && styles.tabTextInactive]}>
              Expirate ({expiredProducts.length})
            </Text>
          </TouchableOpacity>
        </View>

        {/* ── TAB CONTENT ── */}
        {displayedProducts.length === 0 ? (
          <View style={styles.card}>
            <Text style={[styles.mutedText, { marginBottom: activeTab === 'active' ? 12 : 0 }]}>
              {activeTab === 'active'
                ? 'Nu ai produse active în acest moment.'
                : 'Nu ai produse expirate disponibile pentru reactivare.'}
            </Text>
            {activeTab === 'active' && (
              <TouchableOpacity
                style={styles.primaryButton}
                onPress={() => navigation.navigate('NewListing', { listingType: 'direct' })}
              >
                <Text style={styles.primaryButtonText}>Listează un produs</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          displayedProducts.map((product: any) => {
            const expired = isDirectListingExpired(product);
            const expiryDate = getEffectiveListingExpiryDate(product);
            const relisting = relistingProductId === product.id;

            return (
              <View key={product.id} style={expired ? styles.expiredCard : styles.card}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <View style={{ flex: 1, marginRight: 10 }}>
                    <Text style={styles.cardTitle} numberOfLines={2}>
                      {product.name}
                    </Text>
                    <Text style={styles.mutedText}>
                      {product.country ? `${product.country}${product.year ? ` • ${product.year}` : ''}` : 'Produs listat'}
                    </Text>
                    <Text style={[styles.mutedText, { marginTop: 2 }]}>
                      {expired
                        ? (expiryDate ? `Expirat la: ${expiryDate.toLocaleDateString()}` : 'Expirat')
                        : (expiryDate ? `Expirare listare: ${expiryDate.toLocaleDateString()}` : 'Fără expirare definită')}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: 6 }}>
                    <Text style={styles.priceText}>{formatEUR(product.price)}</Text>
                    {expired && (
                      <View style={styles.expiredBadge}>
                        <Text style={styles.expiredBadgeText}>EXPIRAT</Text>
                      </View>
                    )}
                  </View>
                </View>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <TouchableOpacity
                    style={[styles.secondaryButton, { flex: 1 }]}
                    onPress={() => navigation.navigate('ProductDetails', { productId: product.id })}
                  >
                    <Text style={styles.secondaryButtonText}>Vezi produsul</Text>
                  </TouchableOpacity>
                  {expired && (
                    <TouchableOpacity
                      style={[styles.reactivateButton, { opacity: relisting ? 0.7 : 1 }]}
                      onPress={() => handleRelist(product.id)}
                      disabled={relisting}
                    >
                      <Text style={styles.reactivateButtonText}>
                        {relisting ? 'Se reactivează...' : `Reactivează (${relistCost} credite)`}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            );
          })
        )}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  subtitle: {
    fontSize: 13,
    marginTop: 6,
    color: colors.textSecondary,
  },
  // ── Tab bar ──
  tabBar: {
    flexDirection: 'row',
    marginBottom: 16,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: colors.borderColor,
    overflow: 'hidden',
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
  },
  tabActive: {
    backgroundColor: colors.primary,
  },
  tabInactive: {
    backgroundColor: '#dc2626',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  tabTextActive: {
    color: colors.primaryText,
  },
  tabTextInactive: {
    color: '#fff',
  },
  // ── Cards ──
  card: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.borderColor,
    backgroundColor: colors.cardBackground,
    padding: 16,
    marginBottom: 12,
  },
  expiredCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    backgroundColor: 'rgba(239, 68, 68, 0.04)',
    padding: 16,
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  mutedText: {
    color: colors.textSecondary,
  },
  priceText: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.success,
  },
  expiredBadge: {
    backgroundColor: 'rgba(239, 68, 68, 0.16)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.45)',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  expiredBadgeText: {
    color: '#fecaca',
    fontSize: 11,
    fontWeight: '700',
  },
  // ── Buttons ──
  primaryButton: {
    backgroundColor: colors.primary,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: colors.primaryText,
    fontWeight: '800',
  },
  secondaryButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.10)',
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: colors.textPrimary,
    fontWeight: '700',
  },
  reactivateButton: {
    backgroundColor: '#dc2626',
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    flex: 1,
  },
  reactivateButtonText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 13,
  },
  // ── Layout ──
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  errorTitle: {
    color: colors.error,
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 8,
  },
  errorText: {
    color: colors.errorLight,
    textAlign: 'center',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
    backgroundColor: colors.background,
  },
});

export default UserProductsScreen;
