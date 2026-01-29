import React, { useMemo, useRef, useState } from 'react';
import { 
  View, 
  Text, 
  ScrollView, 
  TouchableOpacity, 
  ActivityIndicator, 
  StyleSheet, 
  Image,
  Alert,
  Share,
  Linking,
} from 'react-native';
import Modal from 'react-native-modal';
import PhotoGallery from '../components/PhotoGallery';
import { useRoute, useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useProduct, useProducts } from '../hooks/useProducts';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../hooks/useCart';
import { RootStackParamList } from '../navigationTypes';
import { sharedStyles, colors } from '../styles/sharedStyles';
import PullbackButton from '../components/PullbackButton';
import PullbackStatusIndicator from '../components/PullbackStatusIndicator';
import { WatchlistButton } from '../components/WatchlistButton';
import { isProductEligibleForPullbackData } from '@shared/pullbackEligibility';
import OfferManagement from '../components/OfferManagement';
import { createDirectOrderForProduct } from '@shared/orderService';
import { createOrGetConversation } from '@shared/chatService';
import { logEvent } from '../hooks/useActivityLogger';
import OfferModal from '../components/OfferModal';
import InlineBackButton from '../components/InlineBackButton';
import { formatEUR } from '../utils/currency';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@shared/firebaseConfig';

const ProductDetailsScreen: React.FC = () => {
  const route = useRoute<RouteProp<RootStackParamList, 'ProductDetails'>>();
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  const { productId } = route.params;
  const { product, loading, error } = useProduct(productId);
  const { user } = useAuth();

  const scrollRef = useRef<ScrollView | null>(null);
  const [optimisticPulledBack, setOptimisticPulledBack] = useState(false);
  const [showBuyConfirm, setShowBuyConfirm] = useState(false);
  const [buying, setBuying] = useState(false);
  const [showOfferModal, setShowOfferModal] = useState(false);
  const [showOfferManagement, setShowOfferManagement] = useState(false);
  const [isAdminUser, setIsAdminUser] = useState(false);
  const [viewMode, setViewMode] = useState<'owner' | 'preview'>('preview');
  const [viewModeSet, setViewModeSet] = useState(false);

  // Seller information state
  const [sellerName, setSellerName] = useState<string | null>(null);
  const [sellerVerified, setSellerVerified] = useState(false);
  const [sellerUsername, setSellerUsername] = useState<string | null>(null);

  const isOwner = user?.uid === product?.ownerId;
  const isPulledBack = !!product?.isPulledBack || optimisticPulledBack;

  const eligibleForPullback = useMemo(() => {
    console.log('Eligibility check:', {
      productId: product?.id,
      productOwnerId: product?.ownerId,
      userId: user?.uid,
      isOwner: user?.uid === product?.ownerId,
      isSold: product?.isSold,
      isPulledBack,
    });
    
    if (!product || !user) return false;
    const result = isProductEligibleForPullbackData(
      {
        ownerId: product.ownerId,
        isSold: product.isSold,
        isPulledBack: isPulledBack,
      },
      user?.uid,
    );
    console.log('Eligibility result:', Boolean(result));
    return Boolean(result);
  }, [product?.ownerId, product?.isSold, isPulledBack, user?.uid]);

  // Get other products by the same seller
  const { products: otherProducts } = useProducts({
    ownerId: product?.ownerId,
    pageSize: 20,
    fields: ['name', 'images', 'price', 'createdAt'],
    enabled: !!product?.ownerId,
    listingType: 'direct',
    live: false,
  });

  // Scroll to top when changing product
  React.useEffect(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [productId]);

  // Set default view mode for owners to 'owner' on first load
  React.useEffect(() => {
    if (isOwner && !viewModeSet) {
      setViewMode('owner');
      setViewModeSet(true);
    }
  }, [isOwner, viewModeSet]);

  // Check if user is admin
  React.useEffect(() => {
    const checkAdmin = async () => {
      if (user) {
        const { isAdmin } = require('@shared/adminService');
        const adminStatus = await isAdmin(user.uid);
        setIsAdminUser(adminStatus);
      }
    };
    checkAdmin();
  }, [user]);

  // Fetch seller information
  React.useEffect(() => {
    let cancelled = false;
    const loadSeller = async () => {
      if (!product?.ownerId) return;
      try {
        const snap = await getDoc(doc(db, 'users', product.ownerId));
        if (!snap.exists()) return;
        const data = snap.data() as any;
        if (cancelled) return;
        setSellerName(data.displayName || data.name || data.email || `Vânzător #${product.ownerId.slice(-6)}`);
        setSellerUsername(data.username || data.displayName || data.name || `utilizator${product.ownerId.slice(-4)}`);
        setSellerVerified(data.idVerificationStatus === 'verified');
      } catch (err) {
        console.error('Failed to load seller', err);
      }
    };

    setSellerName(null);
    setSellerUsername(null);
    setSellerVerified(false);
    loadSeller();
    return () => {
      cancelled = true;
    };
  }, [product?.ownerId]);

  const handleShareProduct = async () => {
    if (!product) return;
    const deepLinkUrl = `enumismatica://product/${product.id}`;
    const message = `${product.name} - ${formatEUR(product.price)}\n\n${deepLinkUrl}`;

    try {
      await Share.share({
        message,
        title: product.name,
      });
    } catch (error) {
      console.error('Failed to share product:', error);
    }
  };

  const handleBuyClick = () => {
    if (!product) return;

    if (!user) {
      Alert.alert(
        'Autentificare necesară',
        'Trebuie să fie autentificat pentru a cumpăra această piesă.',
        [{ text: 'OK' }]
      );
      return;
    }

    if (product.ownerId === user.uid) {
      Alert.alert(
        'Nu poți cumpăra propria piesă',
        'Este deja proprietarul acestei piese.',
        [{ text: 'OK' }]
      );
      return;
    }

    if (product.isSold) {
      Alert.alert(
        'Piesă indisponibilă',
        'Această piesă a fost deja vândută.',
        [{ text: 'OK' }]
      );
      return;
    }

    setShowBuyConfirm(true);
  };

  const handleBuy = async () => {
    if (!product || !user) return;

    try {
      setBuying(true);
      const orderId = await createDirectOrderForProduct(product.id, user.uid);

      // Admin activity log: direct shop purchase from product detail page
      await logEvent(user, 'product_buy', {
        productId: product.id,
        productName: product.name,
        price: product.price,
        orderId,
        source: 'product_detail',
      });

      // Ensure a private conversation exists between buyer and seller and redirect to it
      if (product.ownerId && product.ownerId !== user.uid) {
        try {
          const conversationId = await createOrGetConversation(
            user.uid,
            product.ownerId,
            undefined,
            product.id,
            false,
          );
          navigation.navigate('Messages', { conversationId: conversationId });
        } catch (convError) {
          console.error('Failed to open conversation after direct product purchase:', convError);
        }
      }

      Alert.alert(
        'Cumpărare reușită',
        `S-a cumpărat această piesă. Comanda a fost înregistrată (ID: ${orderId}).`,
        [{ text: 'OK' }]
      );
    } catch (error) {
      console.error('Failed to buy product:', error);
      const message =
        error instanceof Error ? error.message : 'A apărut o eroare la cumpărarea piesei.';
      Alert.alert('Eroare la cumpărare', message, [{ text: 'OK' }]);
    } finally {
      setBuying(false);
    }
  };

  const { addToCart, items: cartItems } = useCart(user?.uid);
  const cartCount = cartItems?.length ?? 0;

  const handleAddToCart = async () => {
    if (!product) return;

    if (!user) {
      Alert.alert(
        'Autentificare necesară',
        'Trebuie să fie autentificat pentru a adăuga în coș.',
        [{ text: 'OK' }]
      );
      return;
    }

    if (product.ownerId === user.uid) {
      Alert.alert(
        'Nu poți adăuga propria piesă în coș',
        'Este deja proprietarul acestei piese.',
        [{ text: 'OK' }]
      );
      return;
    }

    if (product.isSold) {
      Alert.alert(
        'Piesă indisponibilă',
        'Această piesă a fost deja vândută.',
        [{ text: 'OK' }]
      );
      return;
    }

    try {
      await addToCart(product.id);
      Alert.alert('Adăugat în coș', 'Produsul a fost adăugat în coșul de cumpărături.', [{ text: 'OK' }]);
    } catch (error) {
      console.error('Failed to add to cart:', error);
      Alert.alert(
        'Eroare',
        'Nu s-a putut adăuga produsul în coș. Încearcă din nou.',
        [{ text: 'OK' }]
      );
    }
  };

  const handleMakeOffer = () => {
    if (!product) return;

    if (!user) {
      Alert.alert(
        'Autentificare necesară',
        'Trebuie să fie autentificat pentru a face o ofertă.',
        [{ text: 'OK' }]
      );
      return;
    }

    if (product.ownerId === user.uid) {
      Alert.alert(
        'Nu poți face ofertă pe propria piesă',
        'Este deja proprietarul acestei piese.',
        [{ text: 'OK' }]
      );
      return;
    }

    if (product.isSold) {
      Alert.alert(
        'Piesă indisponibilă',
        'Această piesă a fost deja vândută.',
        [{ text: 'OK' }]
      );
      return;
    }

    if (product.acceptsOffers === false) {
      Alert.alert(
        'Ofertele nu sunt acceptate',
        'Vânzătorul nu acceptă oferte pentru această piesă.',
        [{ text: 'OK' }]
      );
      return;
    }

    setShowOfferModal(true);
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    headerContainer: {
      backgroundColor: 'rgba(0, 2, 13, 0.8)',
      paddingHorizontal: 16,
      paddingTop: 24,
      paddingBottom: 16,
      borderBottomWidth: 1,
      borderBottomColor: 'rgba(231, 183, 60, 0.4)',
      shadowColor: '#000',
      shadowOpacity: 0.9,
      shadowRadius: 20,
      shadowOffset: { width: 0, height: 18 },
      elevation: 10,
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
    editButton: {
      backgroundColor: colors.primary,
      paddingVertical: 10,
      paddingHorizontal: 18,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: 'rgba(231, 183, 60, 0.6)',
    },
    editButtonText: {
      color: colors.primaryText,
      fontWeight: '700',
      letterSpacing: 0.5,
    },
    imageContainer: {
      width: '100%',
      height: 256,
      backgroundColor: colors.navy900,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: 'rgba(231, 183, 60, 0.4)',
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 24,
    },
    image: {
      width: '100%',
      height: '100%',
      resizeMode: 'contain',
    },
    productName: {
      fontSize: 28,
      fontWeight: 'bold',
      color: colors.primary,
      marginBottom: 8,
    },
    productPrice: {
      fontSize: 24,
      fontWeight: 'bold',
      color: colors.gold400,
      marginBottom: 16,
    },
    productDescription: {
      fontSize: 16,
      color: colors.textPrimary,
      lineHeight: 24,
    },
    detailsCard: {
      backgroundColor: 'rgba(0, 2, 13, 0.8)',
      padding: 16,
      borderRadius: 20,
      marginBottom: 24,
      borderWidth: 1,
      borderColor: 'rgba(231, 183, 60, 0.3)',
    },
    detailsCardTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.primary,
      marginBottom: 12,
    },
    detailRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 8,
    },
    detailLabel: {
      color: colors.textSecondary,
      fontSize: 14,
    },
    detailValue: {
      color: colors.textPrimary,
      fontWeight: '500',
      fontSize: 14,
    },
    actionButton: {
      width: '100%',
      backgroundColor: colors.primary,
      paddingVertical: 14,
      borderRadius: 16,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: 'rgba(231, 183, 60, 0.6)',
    },
    actionButtonText: {
      color: colors.primaryText,
      textAlign: 'center',
      fontWeight: '700',
      fontSize: 16,
      letterSpacing: 0.5,
    },
    secondaryActionButton: {
      width: '100%',
      backgroundColor: 'rgba(15, 23, 42, 0.8)',
      paddingVertical: 14,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: 'rgba(148, 163, 184, 0.5)',
      marginBottom: 12,
    },
    secondaryActionButtonText: {
      color: colors.textPrimary,
      textAlign: 'center',
      fontWeight: '700',
      fontSize: 16,
      letterSpacing: 0.5,
    },

    // Bento action layout
    bentoContainer: {
      gap: 12,
    },
    bentoRow: {
      flexDirection: 'row',
      gap: 12,
    },
    bentoBuyButton: {
      flex: 3,
      backgroundColor: colors.primary,
      paddingVertical: 14,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: 'rgba(231, 183, 60, 0.6)',
    },
    bentoCartButton: {
      flex: 1,
      backgroundColor: 'rgba(15, 23, 42, 0.85)',
      paddingVertical: 14,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: 'rgba(231, 183, 60, 0.45)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    bentoOfferButton: {
      width: '100%',
      backgroundColor: 'rgba(15, 23, 42, 0.85)',
      paddingVertical: 14,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: 'rgba(231, 183, 60, 0.45)',
    },
    bentoOfferText: {
      color: colors.primary,
      textAlign: 'center',
      fontWeight: '800',
      fontSize: 16,
      letterSpacing: 0.5,
    },
    removeButton: {
      width: '100%',
      backgroundColor: 'rgba(239, 68, 68, 0.9)',
      paddingVertical: 12,
      borderRadius: 12,
    },
    removeButtonText: {
      color: colors.textPrimary,
      textAlign: 'center',
      fontWeight: '600',
      fontSize: 16,
    },
    sellerInfo: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 16,
    },
    sellerName: {
      color: colors.textSecondary,
      fontSize: 14,
    },
    verifiedBadge: {
      backgroundColor: 'rgba(16, 185, 129, 0.15)',
      borderWidth: 1,
      borderColor: 'rgba(16, 185, 129, 0.4)',
      borderRadius: 12,
      paddingHorizontal: 8,
      paddingVertical: 2,
    },
    verifiedBadgeText: {
      color: colors.emerald300,
      fontSize: 10,
      fontWeight: 'bold',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },

    modalContent: {
      width: '90%',
      maxWidth: 400,
      backgroundColor: 'rgba(2, 6, 23, 0.95)',
      borderRadius: 20,
      borderWidth: 1,
      borderColor: 'rgba(231, 183, 60, 0.3)',
      padding: 24,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.5,
      shadowRadius: 20,
      elevation: 10,
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: 'bold',
      color: 'white',
      marginBottom: 16,
      textAlign: 'center',
    },
    modalText: {
      color: colors.textSecondary,
      fontSize: 14,
      marginBottom: 24,
      textAlign: 'center',
      lineHeight: 20,
    },
    modalButtons: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      gap: 12,
    },
    modalButton: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 8,
      borderWidth: 1,
    },
    modalButtonText: {
      fontSize: 14,
      fontWeight: '600',
      textAlign: 'center',
    },
    cancelButton: {
      borderColor: colors.slate600,
    },
    cancelButtonText: {
      color: colors.textSecondary,
    },
    confirmButton: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    confirmButtonText: {
      color: colors.primaryText,
    },
    noImageText: {
      color: colors.textTertiary,
      fontSize: 16,
    },
    ownerView: {
      backgroundColor: 'rgba(0, 2, 13, 0.8)',
      padding: 16,
      borderRadius: 20,
      marginBottom: 24,
      borderWidth: 1,
      borderColor: 'rgba(231, 183, 60, 0.3)',
    },
    ownerViewTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.primary,
      marginBottom: 8,
    },
    ownerViewDescription: {
      fontSize: 14,
      color: colors.textSecondary,
      marginBottom: 16,
      lineHeight: 20,
    },
    ownerActions: {
      flexDirection: 'column',
      gap: 12,
    },
    ownerActionButton: {
      width: '100%',
      alignItems: 'center',
      paddingVertical: 12,
      borderRadius: 12,
      borderWidth: 1,
    },
    ownerActionPrimary: {
      backgroundColor: colors.primary,
      borderColor: 'rgba(231, 183, 60, 0.6)',
    },
    ownerActionSecondary: {
      backgroundColor: 'rgba(15, 23, 42, 0.85)',
      borderColor: 'rgba(148, 163, 184, 0.5)',
    },
    ownerActionButtonText: {
      color: colors.primaryText,
      textAlign: 'center',
      fontWeight: '700',
      fontSize: 14,
      letterSpacing: 0.5,
    },
    otherProductsSection: {
      marginTop: 40,
      paddingTop: 24,
      borderTopWidth: 1,
      borderTopColor: 'rgba(231, 183, 60, 0.3)',
    },
    otherProductsTitle: {
      fontSize: 24,
      fontWeight: 'bold',
      color: colors.primary,
      marginBottom: 16,
    },
    otherProductsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
    },
    otherProductCard: {
      width: '47%',
      backgroundColor: 'rgba(0, 2, 13, 0.8)',
      borderRadius: 16,
      borderWidth: 1,
      borderColor: 'rgba(231, 183, 60, 0.3)',
      padding: 12,
    },
    otherProductImage: {
      width: '100%',
      height: 120,
      backgroundColor: colors.navy900,
      borderRadius: 12,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 8,
    },
    otherProductName: {
      fontSize: 14,
      color: colors.textPrimary,
      marginBottom: 4,
    },
    otherProductPrice: {
      fontSize: 16,
      fontWeight: 'bold',
      color: colors.gold400,
    },
  });

  if (loading) {
    return (
      <View style={sharedStyles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={sharedStyles.loadingTitle}>Loading product...</Text>
      </View>
    );
  }

  if (error || !product) {
    return (
      <View style={sharedStyles.loadingContainer}>
        <Text style={sharedStyles.errorMessage}>
          {error || 'Product not found'}
        </Text>
        <InlineBackButton style={{ marginTop: 16 }} />
      </View>
    );
  }

  return (
    <ScrollView ref={scrollRef} style={styles.container}>
      <View style={styles.headerContainer}>
        <InlineBackButton />
        {/* Header */}
          <View style={styles.header}>
            <View style={{ flex: 1 }} />
            <View style={styles.actionButtonsContainer}>
              <WatchlistButton itemType="product" itemId={product.id} size="medium" />
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
              <PullbackStatusIndicator isPulledBack={isPulledBack} />
            {eligibleForPullback && (
              <PullbackButton
                itemId={product.id}
                itemType="product"
                onPullbackSuccess={() => setOptimisticPulledBack(true)}
              />
            )}
            {isOwner && (
              <TouchableOpacity 
                style={styles.editButton}
                onPress={() => navigation.navigate('NewListing', { 
                  listingType: product.listingType as 'direct' | 'auction',
                  productId: product.id 
                })}
              >
                <Text style={styles.editButtonText}>Edit</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Product Images */}
        <View>
          {product.images && product.images.length > 0 ? (
            <PhotoGallery images={product.images} />
          ) : (
            <View style={styles.imageContainer}>
              <Text style={styles.noImageText}>Imagine indisponibilă</Text>
            </View>
          )}
        </View>

        {/* Product Info */}
        <View style={{ marginBottom: 24 }}>
          <Text style={styles.productName}>{product.name}</Text>
          <Text style={styles.productPrice}>{formatEUR(product.price)}</Text>
          
          {/* Seller Information */}
          <View style={styles.sellerInfo}>
            <Text style={styles.sellerName}>Vânzător:</Text>
            <TouchableOpacity
              accessibilityRole="button"
              onPress={() => {
                if (!product?.ownerId) return;
                navigation.navigate('SellerProfile', {
                  sellerId: product.ownerId,
                  sellerName: sellerName ?? undefined,
                  sellerUsername: sellerUsername ?? undefined,
                  sellerVerified,
                });
              }}
              style={{ paddingVertical: 2, paddingHorizontal: 4, marginHorizontal: -4, borderRadius: 8 }}
            >
              <Text style={[styles.sellerName, { color: colors.primary, fontWeight: '700' }]}>
                @{sellerUsername}
              </Text>
            </TouchableOpacity>
            {sellerVerified && (
              <View style={styles.verifiedBadge}>
                <Text style={styles.verifiedBadgeText}>VERIFICAT</Text>
              </View>
            )}
          </View>

          <Text style={styles.productDescription}>{product.description}</Text>
        </View>

        {/* Product Details */}
        <View style={styles.detailsCard}>
          <Text style={styles.detailsCardTitle}>Detalii monedă</Text>
          <View>
            {/* Basic Information */}
            <Text style={{ fontSize: 16, color: colors.primary, marginBottom: 8, fontWeight: '500' }}>
              Informații generale
            </Text>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>ID piesă:</Text>
              <Text style={styles.detailValue}>{product.id}</Text>
            </View>
            {product.country && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Țară:</Text>
                <Text style={styles.detailValue}>{product.country}</Text>
              </View>
            )}
            {product.year && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>An:</Text>
                <Text style={styles.detailValue}>{product.year}</Text>
              </View>
            )}
            {product.era && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Epocă:</Text>
                <Text style={styles.detailValue}>{product.era}</Text>
              </View>
            )}
            {product.denomination && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Valoare nominală:</Text>
                <Text style={styles.detailValue}>{product.denomination}</Text>
              </View>
            )}
            {product.category && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Categorie:</Text>
                <Text style={styles.detailValue}>{product.category}</Text>
              </View>
            )}

            {/* Physical Properties */}
            <Text style={{ fontSize: 16, color: colors.primary, marginTop: 16, marginBottom: 8, fontWeight: '500' }}>
              Proprietăți fizice
            </Text>
            {product.metal && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Metal:</Text>
                <Text style={styles.detailValue}>{product.metal}</Text>
              </View>
            )}
            {product.weight && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Greutate:</Text>
                <Text style={styles.detailValue}>{product.weight} g</Text>
              </View>
            )}
            {product.diameter && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Diametru:</Text>
                <Text style={styles.detailValue}>{product.diameter} mm</Text>
              </View>
            )}
            {product.grade && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Grad:</Text>
                <Text style={styles.detailValue}>{product.grade}</Text>
              </View>
            )}
            {product.mintMark && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Marcă monetărie:</Text>
                <Text style={styles.detailValue}>{product.mintMark}</Text>
              </View>
            )}
            {product.rarity && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Raritate:</Text>
                <Text style={{ 
                  ...styles.detailValue,
                  backgroundColor: product.rarity === 'extremely-rare' ? 'rgba(239, 68, 68, 0.2)' :
                                     product.rarity === 'very-rare' ? 'rgba(251, 146, 60, 0.2)' :
                                     product.rarity === 'rare' ? 'rgba(234, 179, 8, 0.2)' :
                                     product.rarity === 'uncommon' ? 'rgba(59, 130, 246, 0.2)' :
                                     'rgba(107, 114, 128, 0.2)',
                  color: product.rarity === 'extremely-rare' ? colors.red200 :
                         product.rarity === 'very-rare' ? colors.gold400 :
                         product.rarity === 'rare' ? colors.gold500 :
                         product.rarity === 'uncommon' ? colors.blue500 :
                         colors.slate300,
                  paddingHorizontal: 8,
                  paddingVertical: 2,
                  borderRadius: 8,
                  fontSize: 12
                }}>
                  {product.rarity.replace('-', ' ').toUpperCase()}
                </Text>
              </View>
            )}

            {/* Certification Section */}
            {(product.hasCertification || product.hasNgcCertification || product.certificationCompany || product.ngcCode) && (
              <>
                <Text style={{ fontSize: 16, color: colors.primary, marginTop: 16, marginBottom: 8, fontWeight: '500' }}>
                  Certificare
                </Text>
                {product.certificationCompany && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Companie certificare:</Text>
                    <Text style={styles.detailValue}>
                      {product.certificationCompany === 'NGC' ? 'Numismatic Guaranty Corporation' : 'Professional Coin Grading Service'}
                    </Text>
                  </View>
                )}
                {product.certificationCode && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Cod certificare:</Text>
                    <Text style={styles.detailValue}>{product.certificationCode}</Text>
                  </View>
                )}
                {product.ngcCode && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Cod NGC:</Text>
                    <Text style={styles.detailValue}>{product.ngcCode}</Text>
                  </View>
                )}
                {product.certificationGrade && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Grad certificare:</Text>
                    <Text style={styles.detailValue}>{product.certificationGrade}</Text>
                  </View>
                )}
                {product.ngcGrade && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Grad NGC:</Text>
                    <Text style={styles.detailValue}>{product.ngcGrade}</Text>
                  </View>
                )}
              </>
            )}

            {/* Listing Information */}
            <Text style={{ fontSize: 16, color: colors.primary, marginTop: 16, marginBottom: 8, fontWeight: '500' }}>
              Informații listare
            </Text>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Listat:</Text>
              <Text style={styles.detailValue}>{product.createdAt.toLocaleDateString()}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Ultima actualizare:</Text>
              <Text style={styles.detailValue}>{product.updatedAt.toLocaleDateString()}</Text>
            </View>
            {product.listingExpiresAt && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Expiră listarea:</Text>
                <Text style={styles.detailValue}>
                  {(() => {
                    const date = product.listingExpiresAt;
                    if (date instanceof Date) return date.toLocaleDateString();
                    if (date && typeof (date as any).toDate === 'function') {
                      return (date as any).toDate().toLocaleDateString();
                    }
                    return new Date(date as any).toLocaleDateString();
                  })()}
                </Text>
              </View>
            )}
            {product.boostExpiresAt && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Promovat până la:</Text>
                <Text style={{ ...styles.detailValue, color: colors.emerald300 }}>
                  {(() => {
                    const date = product.boostExpiresAt;
                    if (date instanceof Date) return date.toLocaleDateString();
                    if (date && typeof (date as any).toDate === 'function') {
                      return (date as any).toDate().toLocaleDateString();
                    }
                    return new Date(date as any).toLocaleDateString();
                  })()}
                </Text>
              </View>
            )}
            {product.promotionExpiresAt && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Promoție până la:</Text>
                <Text style={{ ...styles.detailValue, color: colors.emerald300 }}>
                  {(() => {
                    const date = product.promotionExpiresAt;
                    if (date instanceof Date) return date.toLocaleDateString();
                    if (date && typeof (date as any).toDate === 'function') {
                      return (date as any).toDate().toLocaleDateString();
                    }
                    return new Date(date as any).toLocaleDateString();
                  })()}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Actions */}
        {viewMode === 'preview' ? (
          <View>
            {!isOwner && (
              <View style={styles.bentoContainer}>
                {/* Row 1: Buy (75%) + Cart icon (25%) */}
                <View style={styles.bentoRow}>
                  <TouchableOpacity
                    style={[styles.bentoBuyButton, (product.isSold || buying) && { opacity: 0.6 }]}
                    onPress={handleBuyClick}
                    disabled={product.isSold || buying}
                  >
                    <Text style={styles.actionButtonText}>
                      {product.isSold ? 'Deja vândut' : buying ? 'Se procesează...' : 'Cumpără acum'}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.bentoCartButton, product.isSold && { opacity: 0.6 }]}
                    onPress={handleAddToCart}
                    disabled={product.isSold}
                    accessibilityLabel="Adaugă în coș"
                  >
                    <Ionicons name="cart-outline" size={22} color={colors.primary} />
                  </TouchableOpacity>
                </View>

                {/* Row 2: Offer (100%) */}
                <TouchableOpacity
                  style={[
                    styles.bentoOfferButton,
                    (product.isSold || product.acceptsOffers === false) && { opacity: 0.6 },
                  ]}
                  onPress={handleMakeOffer}
                  disabled={product.isSold || product.acceptsOffers === false}
                >
                  <Text style={styles.bentoOfferText}>
                    {product.isSold
                      ? 'Deja vândut'
                      : product.acceptsOffers === false
                        ? 'Ofertele nu sunt acceptate'
                        : 'Transmite o ofertă'}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
            
            {isOwner && (
              <View style={{ gap: 12 }}>
                <TouchableOpacity style={styles.actionButton}>
                  <Text style={styles.actionButtonText}>Creează licitație</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.removeButton}>
                  <Text style={styles.removeButtonText}>Șterge listare</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        ) : (
          <View style={styles.ownerView}>
            <Text style={styles.ownerViewTitle}>Mod Proprietar</Text>
            <Text style={styles.ownerViewDescription}>
              Gestionați piesa și vizualizați ofertele primite.
            </Text>
            <View style={styles.ownerActions}>
              <TouchableOpacity 
                style={[styles.ownerActionButton, styles.ownerActionPrimary]}
                onPress={() => navigation.navigate('NewListing', { 
                  listingType: product.listingType as 'direct' | 'auction',
                  productId: product.id 
                })}
              >
                <Text style={styles.ownerActionButtonText}>Editează Piesa</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.ownerActionButton, styles.ownerActionSecondary]}
                onPress={() => setShowOfferManagement(true)}
              >
                <Text style={styles.ownerActionButtonText}>Gestionare Oferte</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Other Products by this Seller */}
        {otherProducts.filter(p => p.id !== product.id).length > 0 && (
          <View style={styles.otherProductsSection}>
            <Text style={styles.otherProductsTitle}>Există mai multe piese din magazinul acestui vânzător</Text>
            <View style={styles.otherProductsGrid}>
              {otherProducts
                .filter(p => p.id !== product.id)
                .slice(0, 6)
                .map((otherProduct) => (
                  <TouchableOpacity
                    key={otherProduct.id}
                    style={styles.otherProductCard}
                    onPress={() => navigation.navigate('ProductDetails', { productId: otherProduct.id })}
                  >
                    <View style={styles.otherProductImage}>
                      {otherProduct.images && otherProduct.images.length > 0 ? (
                        <Image
                          source={{ uri: otherProduct.images[0] }}
                          style={{ width: '100%', height: '100%', resizeMode: 'contain' }}
                        />
                      ) : (
                        <Text style={styles.noImageText}>No Image</Text>
                      )}
                    </View>
                    <Text style={styles.otherProductName} ellipsizeMode="tail" numberOfLines={2}>{otherProduct.name}</Text>
                    <Text style={styles.otherProductPrice}>{formatEUR(otherProduct.price)}</Text>
                  </TouchableOpacity>
                ))}
            </View>
          </View>
        )}
      </View>

      {/* Buy Confirmation Modal */}
      <Modal
        isVisible={showBuyConfirm}
        onBackdropPress={() => setShowBuyConfirm(false)}
        onBackButtonPress={() => setShowBuyConfirm(false)}
        backdropColor="rgba(0, 0, 0, 0.7)"
        backdropOpacity={0.7}
        animationIn="fadeIn"
        animationOut="fadeOut"
      >
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Confirmă cumpărarea</Text>
          <Text style={styles.modalText}>
            Este sigur că doriți să cumperi această piesă pentru {formatEUR(product.price)}?
          </Text>
          <View style={styles.modalButtons}>
            <TouchableOpacity
              style={[styles.modalButton, styles.cancelButton]}
              onPress={() => setShowBuyConfirm(false)}
              disabled={buying}
            >
              <Text style={styles.modalButtonText}>Nu</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalButton, styles.confirmButton]}
              onPress={handleBuy}
              disabled={buying}
            >
              <Text style={styles.modalButtonText}>
                {buying ? 'Se procesează...' : 'Da, cumpără'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Offer Modal */}
      {showOfferModal && (
        <OfferModal
          isOpen={showOfferModal}
          onClose={() => setShowOfferModal(false)}
          itemType="product"
          itemId={product.id}
          itemName={product.name}
          currentPrice={product.price}
          buyerId={user?.uid || ''}
        />
      )}

      {/* Offer Management */}
      {showOfferManagement && (
        <Modal
          isVisible={showOfferManagement}
          onBackdropPress={() => setShowOfferManagement(false)}
          onBackButtonPress={() => setShowOfferManagement(false)}
          backdropOpacity={0.6}
          style={{ margin: 0 }}
        >
          <OfferManagement
            productId={product.id}
            productName={product.name}
            onClose={() => setShowOfferManagement(false)}
            onNavigateToMessages={(conversationId) => navigation.navigate('Messages', { conversationId })}
          />
        </Modal>
      )}
    </ScrollView>
  );
};

export default ProductDetailsScreen;
