import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, ActivityIndicator, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { useAuth } from '../context/AuthContext';
import { RootStackParamList } from '../navigationTypes';
import { useProducts } from '../hooks/useProducts';
import { getOrderById } from '@shared/orderService';
import type { Order } from '@shared/types';
import { colors } from '../styles/sharedStyles';
import { Ionicons } from '@expo/vector-icons';
import InlineBackButton from '../components/InlineBackButton';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@shared/firebaseConfig';

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
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
    marginTop: 16,
    marginBottom: 8,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  detailLabel: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  detailValue: {
    fontSize: 13,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  productImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
    marginRight: 12,
  },
  productInfo: {
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
});

type OrderDetailsScreenRouteProp = RouteProp<RootStackParamList, 'OrderDetails'>;

const OrderDetailsScreen: React.FC = () => {
  const { user, loading: authLoading } = useAuth();
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  const route = useRoute<OrderDetailsScreenRouteProp>();
  const { orderId } = route.params;

  const [order, setOrder] = useState<Order | null>(null);
  const [loadingOrder, setLoadingOrder] = useState(false);
  const [orderError, setOrderError] = useState<string | null>(null);
  const [buyerFallbackEmail, setBuyerFallbackEmail] = useState<string | null>(null);
  const [sellerFallbackEmail, setSellerFallbackEmail] = useState<string | null>(null);

  const {
    products,
    loading: productsLoading,
  } = useProducts({
    pageSize: 200,
  });

  useEffect(() => {
    let isMounted = true;

    const loadOrder = async () => {
      if (!orderId) {
        if (isMounted) {
          setOrder(null);
          setOrderError('ID comandă lipsă');
        }
        return;
      }

      setLoadingOrder(true);
      setOrderError(null);
      try {
        const data = await getOrderById(orderId);
        if (isMounted) {
          setOrder(data);
        }
      } catch (err: any) {
        console.error('Failed to load order details (mobile)', err);
        if (isMounted) {
          setOrderError(err?.message || 'Nu s-a putut încărca detaliile comenzii.');
        }
      } finally {
        if (isMounted) {
          setLoadingOrder(false);
        }
      }
    };

    loadOrder();

    return () => {
      isMounted = false;
    };
  }, [orderId]);

  const loading = authLoading || loadingOrder || productsLoading;

  const product = order ? products.find((p) => p.id === order.productId) || null : null;

  useEffect(() => {
    let cancelled = false;

    const loadPartyEmails = async () => {
      if (!order) {
        setBuyerFallbackEmail(null);
        setSellerFallbackEmail(null);
        return;
      }

      try {
        const [buyerSnap, sellerSnap] = await Promise.all([
          getDoc(doc(db, 'users', order.buyerId)),
          getDoc(doc(db, 'users', order.sellerId)),
        ]);

        if (cancelled) return;

        setBuyerFallbackEmail(
          buyerSnap.exists() ? (buyerSnap.data().email || null) : null
        );
        setSellerFallbackEmail(
          sellerSnap.exists() ? (sellerSnap.data().email || null) : null
        );
      } catch (err) {
        console.error('Failed to load buyer/seller fallback emails', err);
        if (!cancelled) {
          setBuyerFallbackEmail(null);
          setSellerFallbackEmail(null);
        }
      }
    };

    loadPartyEmails();
    return () => {
      cancelled = true;
    };
  }, [order]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.subtitle, { marginTop: 12 }]}>Se încarcă detaliile comenzii...</Text>
      </View>
    );
  }

  if (!user) {
    return (
      <View style={styles.center}>
        <Text style={[styles.title, { fontSize: 18, textAlign: 'center', marginBottom: 12 }]}>
          Detaliile comenzii sunt disponibile doar pentru utilizatori autentificați.
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

  if (orderError) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorTitle}>
          Eroare la încărcarea detaliilor comenzii
        </Text>
        <Text style={styles.errorText}>{orderError}</Text>
      </View>
    );
  }

  if (!order) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorTitle}>Comandă negăsită</Text>
        <Text style={styles.errorText}>Comanda cu ID-ul {orderId} nu a fost găsită.</Text>
      </View>
    );
  }

  const getStatusStyle = () => {
    switch (order.status) {
      case 'paid':
        return {
          backgroundColor: 'rgba(34, 197, 94, 0.12)',
          borderColor: 'rgba(34, 197, 94, 0.7)',
        };
      case 'pending':
        return {
          backgroundColor: 'rgba(245, 158, 11, 0.12)',
          borderColor: 'rgba(245, 158, 11, 0.7)',
        };
      case 'cancelled':
      case 'failed':
        return {
          backgroundColor: 'rgba(239, 68, 68, 0.12)',
          borderColor: 'rgba(239, 68, 68, 0.7)',
        };
      case 'refunded':
        return {
          backgroundColor: 'rgba(147, 51, 234, 0.12)',
          borderColor: 'rgba(147, 51, 234, 0.7)',
        };
      default:
        return {
          backgroundColor: 'rgba(148, 163, 184, 0.12)',
          borderColor: 'rgba(148, 163, 184, 0.7)',
        };
    }
  };

  const getStatusColor = () => {
    switch (order.status) {
      case 'paid':
        return '#22c55e';
      case 'pending':
        return '#f59e0b';
      case 'cancelled':
      case 'failed':
        return '#ef4444';
      case 'refunded':
        return '#9333ea';
      default:
        return '#94a3b8';
    }
  };

  const createdAt = order.createdAt instanceof Date ? order.createdAt : new Date();

  return (
    <ScrollView style={styles.screen}>
      <View style={styles.content}>
        <InlineBackButton />
        <View style={{ marginTop: 12, marginBottom: 16 }}>
          <Text style={styles.title}>Detalii comandă</Text>
          <Text style={styles.subtitle}>
            Comanda #{order.id}
          </Text>
        </View>

        {/* Order Status */}
        <View style={styles.card}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <Text style={styles.cardTitle}>Stare comandă</Text>
            <View style={[styles.statusBadge, getStatusStyle(), { borderWidth: 1 }]}>
              <Text style={[styles.statusText, { color: getStatusColor() }]}>
                {order.status === 'paid' ? 'Plătită' : 
                 order.status === 'pending' ? 'În așteptare' : 
                 order.status === 'cancelled' ? 'Anulată' : 
                 order.status === 'failed' ? 'Eșuată' : 
                 order.status === 'refunded' ? 'Rambursată' : order.status}
              </Text>
            </View>
          </View>

          <Text style={[styles.tinyText, { marginBottom: 12 }]}>
            Plasată la {createdAt.toLocaleDateString()} {createdAt.toLocaleTimeString()}
          </Text>

          {order.status === 'paid' && (
            <View style={{ flexDirection: 'row', gap: 10 }}>
              {product && (
                <TouchableOpacity
                  style={[styles.secondaryButton, { flex: 1 }]}
                  onPress={() =>
                    navigation.navigate('ProductDetails', { productId: product.id })
                  }
                >
                  <Text style={styles.secondaryButtonText}>Vezi produsul</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>

        {/* Product Information */}
        {product && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Produs</Text>
            <View style={{ flexDirection: 'row', marginTop: 12 }}>
              {product.images && product.images.length > 0 && (
                <Image
                  source={{ uri: product.images[0] }}
                  style={styles.productImage}
                />
              )}
              <View style={styles.productInfo}>
                <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textPrimary, marginBottom: 4 }} numberOfLines={2}>
                  {product.name}
                </Text>
                <Text style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 4 }}>
                  {product.country} • {product.year}
                </Text>
                <Text style={{ fontSize: 13, fontWeight: '800', color: colors.success }}>
                  {order.price.toFixed(2)} {order.currency}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Order Details */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Detalii comandă</Text>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>ID comandă</Text>
            <Text style={styles.detailValue}>{order.id}</Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Data comenzii</Text>
            <Text style={styles.detailValue}>{createdAt.toLocaleString()}</Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Metodă de plată</Text>
            <Text style={styles.detailValue}>{order.paymentProvider === 'stripe' ? 'Stripe' : 'Manual'}</Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Referință plată</Text>
            <Text style={styles.detailValue}>{order.paymentReference || 'N/A'}</Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Total plătit</Text>
            <Text style={styles.detailValue}>{order.price.toFixed(2)} {order.currency}</Text>
          </View>
        </View>

        {/* Parties Information */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Părți implicate</Text>

          <Text style={[styles.sectionTitle, { marginTop: 0 }]}>Cumpărător</Text>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Nume</Text>
            <Text style={styles.detailValue}>{order.buyerName || buyerFallbackEmail || 'N/A'}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>ID</Text>
            <Text style={styles.detailValue}>{order.buyerId}</Text>
          </View>

          <Text style={styles.sectionTitle}>Vânzător</Text>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Nume</Text>
            <Text style={styles.detailValue}>{order.sellerName || sellerFallbackEmail || 'N/A'}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>ID</Text>
            <Text style={styles.detailValue}>{order.sellerId}</Text>
          </View>
        </View>

        {/* Additional Actions */}
        {order.status === 'paid' && order.conversationId && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Acțiuni</Text>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() => {
                // For now, just show a message since we don't have a chat screen
                alert('Conversație deschisă: ' + order.conversationId)
              }}
            >
              <Text style={styles.primaryButtonText}>Deschide conversația</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </ScrollView>
  );
};

export default OrderDetailsScreen;
