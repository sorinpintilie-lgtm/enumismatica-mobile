import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, ActivityIndicator, TouchableOpacity, StyleSheet, Image, TextInput, Alert } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { useAuth } from '../context/AuthContext';
import { RootStackParamList } from '../navigationTypes';
import { useProducts } from '../hooks/useProducts';
import {
  getOrderById,
  markOrderPaymentByBuyer,
  confirmOrderPaymentBySeller,
  getBankingDetailsForOrder,
  getShippingAddressForOrder,
  shareShippingAddress,
  saveShippingInfo,
} from '@shared/orderService';
import { createOrGetConversation } from '@shared/chatService';
import type { Order } from '@shared/types';
import { colors } from '../styles/sharedStyles';
import InlineBackButton from '../components/InlineBackButton';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
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
  input: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.10)',
    borderRadius: 8,
    padding: 12,
    marginVertical: 8,
    color: colors.textPrimary,
    fontSize: 13,
  },
  inputLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  timelineItem: {
    flexDirection: 'row',
    gap: 12,
    marginVertical: 8,
  },
  timelineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
    marginTop: 6,
    flexShrink: 0,
  },
  timelineContent: {
    flex: 1,
  },
  timelineLabel: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  timelineValue: {
    fontSize: 13,
    color: colors.textPrimary,
  },
  expandableSection: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.05)',
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
  const [updatingPaymentStatus, setUpdatingPaymentStatus] = useState(false);
  const [openingChat, setOpeningChat] = useState(false);

  // Banking details state
  const [showBankingDetails, setShowBankingDetails] = useState(false);
  const [bankingDetails, setBankingDetails] = useState<{ bankAccount: string; accountName: string | null } | null>(null);
  const [bankingLoading, setBankingLoading] = useState(false);
  const [bankingError, setBankingError] = useState<string | null>(null);

  // Shipping address state
  const [showShippingAddress, setShowShippingAddress] = useState(false);
  const [shippingDetails, setShippingDetails] = useState<any>(null);
  const [shippingLoading, setShippingLoading] = useState(false);
  const [shippingError, setShippingError] = useState<string | null>(null);
  const [shareShippingLoading, setShareShippingLoading] = useState(false);
  const [shareShippingMessage, setShareShippingMessage] = useState<string | null>(null);

  // Shipping info state
  const [awbNumber, setAwbNumber] = useState('');
  const [shippingDate, setShippingDate] = useState('');
  const [courierName, setCourierName] = useState('');
  const [shippingInfoSaving, setShippingInfoSaving] = useState(false);

  // Payment details state
  const [paymentDate, setPaymentDate] = useState('');
  const [paymentProofUrl, setPaymentProofUrl] = useState<string | null>(null);
  const [paymentProofLoading, setPaymentProofLoading] = useState(false);

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
          // Initialize shipping info if available
          if (data.awbNumber) setAwbNumber(data.awbNumber);
          if (data.shippingDate) setShippingDate(data.shippingDate.toISOString().split('T')[0]);
          if (data.courierName) setCourierName(data.courierName);
          if (data.paymentDate) setPaymentDate(data.paymentDate.toISOString().split('T')[0]);
          if (data.paymentProofUrl) setPaymentProofUrl(data.paymentProofUrl);
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

  const getStatusStyle = () => {
    if (!order) return {};
    
    switch (order.status) {
      case 'paid':
        return {
          backgroundColor: 'rgba(34, 197, 94, 0.12)',
          borderColor: 'rgba(34, 197, 94, 0.7)',
        };
      case 'payment_marked_by_buyer':
        return {
          backgroundColor: 'rgba(59, 130, 246, 0.12)',
          borderColor: 'rgba(59, 130, 246, 0.7)',
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
    if (!order) return colors.textSecondary;
    
    switch (order.status) {
      case 'paid':
        return '#22c55e';
      case 'payment_marked_by_buyer':
        return '#3b82f6';
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

  const createdAt = order?.createdAt instanceof Date ? order.createdAt : new Date();
  const isBuyer = user?.uid === order?.buyerId;
  const isSeller = user?.uid === order?.sellerId;

  const reloadOrder = async () => {
    const refreshed = await getOrderById(order!.id);
    setOrder(refreshed);
  };

  const handleBuyerMarkPaid = async () => {
    try {
      setUpdatingPaymentStatus(true);
      await markOrderPaymentByBuyer(order!.id, user!.uid);
      await reloadOrder();
    } catch (err: any) {
      Alert.alert('Eroare', err?.message || 'Nu s-a putut marca plata.');
    } finally {
      setUpdatingPaymentStatus(false);
    }
  };

  const handleSellerConfirmPaid = async () => {
    try {
      setUpdatingPaymentStatus(true);
      await confirmOrderPaymentBySeller(order!.id, user!.uid);
      await reloadOrder();
    } catch (err: any) {
      Alert.alert('Eroare', err?.message || 'Nu s-a putut confirma plata.');
    } finally {
      setUpdatingPaymentStatus(false);
    }
  };

  const handleFetchBankingDetails = async () => {
    if (!user || !order) return;
    
    try {
      setBankingLoading(true);
      setBankingError(null);
      const details = await getBankingDetailsForOrder(order.id, user.uid);
      setBankingDetails(details);
    } catch (err: any) {
      console.error('Failed to fetch banking details:', err);
      setBankingError(err?.message || 'Nu s-au putut încărca detaliile bancare.');
    } finally {
      setBankingLoading(false);
    }
  };

  const handleFetchShippingDetails = async () => {
    if (!user || !order) return;
    
    try {
      setShippingLoading(true);
      setShippingError(null);
      const details = await getShippingAddressForOrder(order.id, user.uid);
      setShippingDetails(details);
    } catch (err: any) {
      console.error('Failed to fetch shipping details:', err);
      setShippingError(err?.message || 'Adresa nu este disponibilă.');
    } finally {
      setShippingLoading(false);
    }
  };

  const handleShareShippingAddress = async () => {
    if (!user || !order) return;
    
    try {
      setShareShippingLoading(true);
      setShareShippingMessage(null);
      await shareShippingAddress(order.id, user.uid);
      setShareShippingMessage('Adresa a fost partajată cu succes!');
      await reloadOrder();
    } catch (err: any) {
      console.error('Failed to share shipping address:', err);
      setShareShippingMessage(err?.message || 'Nu s-a putut partaja adresa.');
    } finally {
      setShareShippingLoading(false);
    }
  };

  const handleSaveShippingInfo = async () => {
    if (!user || !order) return;
    
    if (!awbNumber || !shippingDate || !courierName) {
      Alert.alert('Eroare', 'Te rugăm să completezi toate câmpurile necesare.');
      return;
    }

    try {
      setShippingInfoSaving(true);
      await saveShippingInfo(order.id, user.uid, {
        awbNumber,
        shippingDate: new Date(shippingDate),
        courierName,
      });
      await reloadOrder();
      Alert.alert('Succes', 'Informațiile de expediere au fost salvate.');
    } catch (err: any) {
      console.error('Failed to save shipping info:', err);
      Alert.alert('Eroare', err?.message || 'Nu s-au putut salva informațiile de expediere.');
    } finally {
      setShippingInfoSaving(false);
    }
  };

  const handleOpenConversation = async () => {
    if (!user || !order) return;

    // Orders involving Monetaria Statului should go to contact page.
    if (order.sellerId === 'monetaria-statului' || order.buyerId === 'monetaria-statului') {
      navigation.navigate('Contact');
      return;
    }

    try {
      setOpeningChat(true);

      const conversationId =
        order.conversationId ||
        (await createOrGetConversation(order.buyerId, order.sellerId, undefined, order.productId, false));

      // Persist conversation id on order for future quick open.
      if (!order.conversationId && db) {
        try {
          await updateDoc(doc(db, 'orders', order.id), {
            conversationId,
            updatedAt: serverTimestamp(),
          });
          setOrder((prev) => (prev ? { ...prev, conversationId } : prev));
        } catch (persistErr) {
          console.error('Failed to persist conversationId on order:', persistErr);
        }
      }

      navigation.navigate('Messages', { conversationId });
    } catch (err: any) {
      console.error('Failed to open order conversation:', err);
      Alert.alert('Eroare', err?.message || 'Nu s-a putut deschide conversația.');
    } finally {
      setOpeningChat(false);
    }
  };

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
                 order.status === 'payment_marked_by_buyer' ? 'Plată marcată de cumpărător' :
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

          {order.status === 'pending' && isBuyer && (
            <TouchableOpacity
              style={[styles.primaryButton, { marginTop: 8 }]}
              disabled={updatingPaymentStatus}
              onPress={handleBuyerMarkPaid}
            >
              <Text style={styles.primaryButtonText}>
                {updatingPaymentStatus ? 'Se procesează...' : 'Am efectuat plata'}
              </Text>
            </TouchableOpacity>
          )}

          {order.status === 'payment_marked_by_buyer' && isSeller && (
            <TouchableOpacity
              style={[styles.primaryButton, { marginTop: 8 }]}
              disabled={updatingPaymentStatus}
              onPress={handleSellerConfirmPaid}
            >
              <Text style={styles.primaryButtonText}>
                {updatingPaymentStatus ? 'Se procesează...' : 'Confirmă plata'}
              </Text>
            </TouchableOpacity>
          )}

          {order.status === 'payment_marked_by_buyer' && (
            <Text style={[styles.tinyText, { marginTop: 8 }]}>Plata a fost marcată de cumpărător. Vânzătorul trebuie să confirme în maxim 10 zile, altfel comanda va fi marcată automat ca plătită și semnalată către admin.</Text>
          )}

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

          {/* Action Buttons */}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
            {isBuyer && order.sellerId !== 'monetaria-statului' && (
              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={() => {
                  setShowBankingDetails(!showBankingDetails);
                  if (!showBankingDetails && !bankingDetails && !bankingLoading) {
                    handleFetchBankingDetails();
                  }
                }}
              >
                <Text style={styles.secondaryButtonText}>
                  {showBankingDetails ? 'Ascunde' : 'Detalii bancare'}
                </Text>
              </TouchableOpacity>
            )}

            {isBuyer && order.sellerId !== 'monetaria-statului' && !order.shippingAddressShared && (
              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={handleShareShippingAddress}
                disabled={shareShippingLoading}
              >
                <Text style={styles.secondaryButtonText}>
                  {shareShippingLoading ? 'Se trimite...' : 'Partajează adresa'}
                </Text>
              </TouchableOpacity>
            )}

            {isSeller && order.sellerId !== 'monetaria-statului' && (
              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={() => {
                  setShowShippingAddress(!showShippingAddress);
                  if (!showShippingAddress && !shippingDetails && !shippingLoading) {
                    handleFetchShippingDetails();
                  }
                }}
              >
                <Text style={styles.secondaryButtonText}>
                  {showShippingAddress ? 'Ascunde' : 'Adresă expediere'}
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Banking Details Section */}
          {showBankingDetails && (
            <View style={styles.expandableSection}>
              <Text style={[styles.sectionTitle, { marginTop: 0 }]}>Detalii bancare</Text>
              {bankingLoading ? (
                <Text style={styles.tinyText}>Se încarcă...</Text>
              ) : bankingError ? (
                <Text style={[styles.tinyText, { color: colors.error }]}>{bankingError}</Text>
              ) : bankingDetails ? (
                <View style={{ gap: 8 }}>
                  <View>
                    <Text style={styles.detailLabel}>Cont bancar (IBAN)</Text>
                    <Text style={styles.detailValue}>{bankingDetails.bankAccount}</Text>
                  </View>
                  {bankingDetails.accountName && (
                    <View>
                      <Text style={styles.detailLabel}>Nume complet</Text>
                      <Text style={styles.detailValue}>{bankingDetails.accountName}</Text>
                    </View>
                  )}
                </View>
              ) : (
                <Text style={styles.tinyText}>Nu sunt disponibile detalii bancare.</Text>
              )}
            </View>
          )}

          {/* Shipping Address Section */}
          {showShippingAddress && (
            <View style={styles.expandableSection}>
              <Text style={[styles.sectionTitle, { marginTop: 0 }]}>Adresă expediere</Text>
              {shippingLoading ? (
                <Text style={styles.tinyText}>Se încarcă...</Text>
              ) : shippingError ? (
                <Text style={[styles.tinyText, { color: colors.error }]}>{shippingError}</Text>
              ) : shippingDetails ? (
                <View style={{ gap: 8 }}>
                  {shippingDetails.address && (
                    <View>
                      <Text style={styles.detailLabel}>Adresă</Text>
                      <Text style={styles.detailValue}>{shippingDetails.address}</Text>
                    </View>
                  )}
                  {shippingDetails.county && (
                    <View>
                      <Text style={styles.detailLabel}>Județ</Text>
                      <Text style={styles.detailValue}>{shippingDetails.county}</Text>
                    </View>
                  )}
                  {shippingDetails.postalCode && (
                    <View>
                      <Text style={styles.detailLabel}>Cod poștal</Text>
                      <Text style={styles.detailValue}>{shippingDetails.postalCode}</Text>
                    </View>
                  )}
                  {shippingDetails.country && (
                    <View>
                      <Text style={styles.detailLabel}>Țară</Text>
                      <Text style={styles.detailValue}>{shippingDetails.country}</Text>
                    </View>
                  )}
                  {shippingDetails.phone && (
                    <View>
                      <Text style={styles.detailLabel}>Telefon</Text>
                      <Text style={styles.detailValue}>{shippingDetails.phone}</Text>
                    </View>
                  )}
                </View>
              ) : (
                <Text style={styles.tinyText}>Cumpărătorul nu a partajat încă adresa.</Text>
              )}
            </View>
          )}

          {shareShippingMessage && (
            <Text style={[styles.tinyText, { marginTop: 8, color: colors.success }]}>
              {shareShippingMessage}
            </Text>
          )}
        </View>

        {/* Shipping Information for Sellers */}
        {isSeller && order.status === 'paid' && !order.awbNumber && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Expediere</Text>
            
            <View style={{ marginTop: 8 }}>
              <Text style={styles.inputLabel}>Număr AWB</Text>
              <TextInput
                style={styles.input}
                value={awbNumber}
                onChangeText={setAwbNumber}
                placeholder="Ex: 123456789"
                editable={!shippingInfoSaving}
              />
            </View>

            <View style={{ marginTop: 8 }}>
              <Text style={styles.inputLabel}>Data expedierii</Text>
              <TextInput
                style={styles.input}
                value={shippingDate}
                onChangeText={setShippingDate}
                placeholder="YYYY-MM-DD"
                editable={!shippingInfoSaving}
              />
            </View>

            <View style={{ marginTop: 8 }}>
              <Text style={styles.inputLabel}>Nume curier</Text>
              <TextInput
                style={styles.input}
                value={courierName}
                onChangeText={setCourierName}
                placeholder="Ex: Fan Courier, DHL, etc."
                editable={!shippingInfoSaving}
              />
            </View>

            <TouchableOpacity
              style={[styles.primaryButton, { marginTop: 12 }]}
              onPress={handleSaveShippingInfo}
              disabled={shippingInfoSaving}
            >
              <Text style={styles.primaryButtonText}>
                {shippingInfoSaving ? 'Se salvează...' : 'Salvează informații expediere'}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Shipping Information Display */}
        {isSeller && order.awbNumber && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Informații expediere</Text>
            
            <View style={{ marginTop: 8, gap: 8 }}>
              <View>
                <Text style={styles.detailLabel}>Număr AWB</Text>
                <Text style={styles.detailValue}>{order.awbNumber}</Text>
              </View>
              {order.shippingDate && (
                <View>
                  <Text style={styles.detailLabel}>Data expedierii</Text>
                  <Text style={styles.detailValue}>{order.shippingDate.toLocaleDateString()}</Text>
                </View>
              )}
              {order.courierName && (
                <View>
                  <Text style={styles.detailLabel}>Curier</Text>
                  <Text style={styles.detailValue}>{order.courierName}</Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Timeline */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Cronologie</Text>
          
          <View style={styles.timelineItem}>
            <View style={[styles.timelineDot, { backgroundColor: colors.primary }]} />
            <View style={styles.timelineContent}>
              <Text style={styles.timelineLabel}>Comandă creată</Text>
              <Text style={styles.timelineValue}>{createdAt.toLocaleString()}</Text>
            </View>
          </View>

          {order.buyerMarkedPaidAt && (
            <View style={styles.timelineItem}>
              <View style={[styles.timelineDot, { backgroundColor: '#22c55e' }]} />
              <View style={styles.timelineContent}>
                <Text style={styles.timelineLabel}>Plată marcată ca efectuată</Text>
                <Text style={styles.timelineValue}>{order.buyerMarkedPaidAt.toLocaleString()}</Text>
              </View>
            </View>
          )}

          {order.sellerConfirmedPaidAt && (
            <View style={styles.timelineItem}>
              <View style={[styles.timelineDot, { backgroundColor: '#22c55e' }]} />
              <View style={styles.timelineContent}>
                <Text style={styles.timelineLabel}>Plată confirmată de vânzător</Text>
                <Text style={styles.timelineValue}>{order.sellerConfirmedPaidAt.toLocaleString()}</Text>
              </View>
            </View>
          )}

          {order.shippingDate && (
            <View style={styles.timelineItem}>
              <View style={[styles.timelineDot, { backgroundColor: colors.primary }]} />
              <View style={styles.timelineContent}>
                <Text style={styles.timelineLabel}>Colet expediat</Text>
                <Text style={styles.timelineValue}>{order.shippingDate.toLocaleString()}</Text>
              </View>
            </View>
          )}
        </View>

        {/* Additional Actions */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Acțiuni</Text>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={handleOpenConversation}
            disabled={openingChat}
          >
            <Text style={styles.primaryButtonText}>
              {openingChat ? 'Se deschide...' : 'Deschide conversația'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
};

export default OrderDetailsScreen;
