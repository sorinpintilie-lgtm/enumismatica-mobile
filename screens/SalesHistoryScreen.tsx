import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, ActivityIndicator, TouchableOpacity, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { useAuth } from '../context/AuthContext';
import { RootStackParamList } from '../navigationTypes';
import { useProducts } from '../hooks/useProducts';
import { getSalesForSeller } from '@shared/orderService';
import type { Order } from '@shared/types';
import { colors } from '../styles/sharedStyles';

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: 16,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
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
  backButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.borderColor,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
  },
  backButtonText: {
    fontSize: 12,
    color: colors.primary,
    fontWeight: '700',
  },
  card: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.borderColor,
    backgroundColor: colors.cardBackground,
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
  tinyText: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  priceText: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.success,
  },
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

const SalesHistoryScreen: React.FC = () => {
  const { user, loading: authLoading } = useAuth();
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  const userId = user?.uid || null;

  const [sales, setSales] = useState<Order[]>([]);
  const [loadingSales, setLoadingSales] = useState(false);
  const [salesError, setSalesError] = useState<string | null>(null);

  const {
    products,
    loading: productsLoading,
  } = useProducts({
    pageSize: 200,
  });

  useEffect(() => {
    let isMounted = true;

    const loadSales = async () => {
      if (!userId) {
        if (isMounted) {
          setSales([]);
          setSalesError(null);
        }
        return;
      }

      setLoadingSales(true);
      setSalesError(null);
      try {
        const data = await getSalesForSeller(userId);
        if (isMounted) {
          setSales(data);
        }
      } catch (err: any) {
        console.error('Failed to load sales for seller (mobile)', err);
        if (isMounted) {
          setSalesError(err?.message || 'Nu s-au putut încărca vânzările tale.');
        }
      } finally {
        if (isMounted) {
          setLoadingSales(false);
        }
      }
    };

    loadSales();

    return () => {
      isMounted = false;
    };
  }, [userId]);

  const loading = authLoading || loadingSales || productsLoading;

  const lines = useMemo(
    () =>
      sales.map((order) => {
        const product = products.find((p) => p.id === order.productId) || null;
        return { order, product };
      }),
    [sales, products],
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.subtitle, { marginTop: 12 }]}>Se încarcă vânzările tale...</Text>
      </View>
    );
  }

  if (!user) {
    return (
      <View style={styles.center}>
        <Text style={[styles.title, { fontSize: 18, textAlign: 'center', marginBottom: 12 }]}>
          Istoricul vânzărilor este disponibil doar pentru utilizatori autentificați.
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

  if (salesError) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorTitle}>
          Eroare la încărcarea vânzărilor
        </Text>
        <Text style={styles.errorText}>{salesError}</Text>
      </View>
    );
  }

  const isEmpty = lines.length === 0;

  return (
    <ScrollView style={styles.screen}>
      <View style={styles.content}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.title}>Vânzările mele</Text>
            <Text style={styles.subtitle}>
              {isEmpty
                ? 'Nu ai încă nicio vânzare înregistrată prin magazin.'
                : `Ai înregistrat ${lines.length} ${lines.length === 1 ? 'vânzare' : 'vânzări'} în magazin.`}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.backButtonText}>Înapoi</Text>
          </TouchableOpacity>
        </View>

        {isEmpty ? (
          <View style={styles.card}>
            <Text style={[styles.mutedText, { marginBottom: 12 }]}>
              Nu ai vândut încă niciun produs prin magazin.
            </Text>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() => navigation.navigate('MainTabs', { screen: 'ProductCatalog' })}
            >
              <Text style={styles.primaryButtonText}>Listează și vinde monede</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View>
            {lines.map(({ order, product }) => {
              const createdAt =
                order.createdAt instanceof Date ? order.createdAt : new Date();
              const productName = product?.name || `Produs ${order.productId}`;

              return (
                <View
                  key={order.id}
                  style={styles.card}
                >
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <View style={{ flex: 1, marginRight: 10 }}>
                      <Text style={styles.cardTitle} numberOfLines={2}>
                        {productName}
                      </Text>
                      <Text style={styles.tinyText}>
                        Comandă ID: {order.id}
                      </Text>
                    </View>
                    <Text style={styles.priceText}>
                      {order.price.toFixed(2)} EUR
                    </Text>
                  </View>
                  <Text style={[styles.tinyText, { marginBottom: 4 }]}>
                    Vândut la {createdAt.toLocaleDateString()} {createdAt.toLocaleTimeString()}
                  </Text>
                  <Text style={[styles.tinyText, { marginBottom: 12 }]}>
                    Cumpărător ID: {order.buyerId}
                  </Text>
                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    {product && (
                      <TouchableOpacity
                        style={[styles.secondaryButton, { flex: 1 }]}
                        onPress={() =>
                          navigation.navigate('ProductDetails', { productId: product.id })
                        }
                      >
                        <Text style={styles.secondaryButtonText}>
                          Vezi produsul
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </View>
    </ScrollView>
  );
};

export default SalesHistoryScreen;
