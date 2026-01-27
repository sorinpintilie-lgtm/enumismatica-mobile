import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, ActivityIndicator, TouchableOpacity, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { useAuth } from '../context/AuthContext';
import { RootStackParamList } from '../navigationTypes';
import { useProducts } from '../hooks/useProducts';
import { getOrdersForBuyer } from '@shared/orderService';
import type { Order } from '@shared/types';
import { colors } from '../styles/sharedStyles';
import InlineBackButton from '../components/InlineBackButton';

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

const OrderHistoryScreen: React.FC = () => {
  const { user, loading: authLoading } = useAuth();
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  const userId = user?.uid || null;

  const [orders, setOrders] = useState<Order[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [ordersError, setOrdersError] = useState<string | null>(null);

  const {
    products,
    loading: productsLoading,
  } = useProducts({
    pageSize: 200,
  });

  useEffect(() => {
    let isMounted = true;

    const loadOrders = async () => {
      if (!userId) {
        if (isMounted) {
          setOrders([]);
          setOrdersError(null);
        }
        return;
      }

      setLoadingOrders(true);
      setOrdersError(null);
      try {
        const data = await getOrdersForBuyer(userId);
        if (isMounted) {
          setOrders(data);
        }
      } catch (err: any) {
        console.error('Failed to load orders for buyer (mobile)', err);
        if (isMounted) {
          setOrdersError(err?.message || 'Nu s-au putut încărca comenzile tale.');
        }
      } finally {
        if (isMounted) {
          setLoadingOrders(false);
        }
      }
    };

    loadOrders();

    return () => {
      isMounted = false;
    };
  }, [userId]);

  const loading = authLoading || loadingOrders || productsLoading;

  const lines = useMemo(
    () =>
      orders.map((order) => {
        const product = products.find((p) => p.id === order.productId) || null;
        return { order, product };
      }),
    [orders, products],
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.subtitle, { marginTop: 12 }]}>Se încarcă comenzile tale...</Text>
      </View>
    );
  }

  if (!user) {
    return (
      <View style={styles.center}>
        <Text style={[styles.title, { fontSize: 18, textAlign: 'center', marginBottom: 12 }]}>
          Istoricul comenzilor este disponibil doar pentru utilizatori autentificați.
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

  if (ordersError) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorTitle}>
          Eroare la încărcarea comenzilor
        </Text>
        <Text style={styles.errorText}>{ordersError}</Text>
      </View>
    );
  }

  const isEmpty = lines.length === 0;

  return (
    <ScrollView style={styles.screen}>
      <View style={styles.content}>
        <InlineBackButton />
        <View style={{ marginTop: 12, marginBottom: 16 }}>
          <Text style={styles.title}>Comenzile mele</Text>
          <Text style={styles.subtitle}>
            {isEmpty
              ? 'Nu ai încă nicio comandă înregistrată.'
              : `Ai plasat ${lines.length} ${lines.length === 1 ? 'comandă' : 'comenzi'} în magazin.`}
          </Text>
        </View>

        {isEmpty ? (
          <View style={styles.card}>
            <Text style={[styles.mutedText, { marginBottom: 12 }]}>
              Nu ai cumpărat încă niciun produs din magazin.
            </Text>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() => navigation.navigate('MainTabs', { screen: 'ProductCatalog' })}
            >
              <Text style={styles.primaryButtonText}>Mergi la magazin</Text>
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
                  <Text style={[styles.tinyText, { marginBottom: 12 }]}>
                    Plasată la {createdAt.toLocaleDateString()} {createdAt.toLocaleTimeString()}
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
                    <TouchableOpacity
                      style={[styles.primaryButton, { flex: 1 }]}
                      onPress={() =>
                        navigation.navigate('OrderDetails', { orderId: order.id })
                      }
                    >
                      <Text style={styles.primaryButtonText}>
                        Detalii comandă
                      </Text>
                    </TouchableOpacity>
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

export default OrderHistoryScreen;
