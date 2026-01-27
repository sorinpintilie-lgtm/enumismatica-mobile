'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { collection, getCountFromServer, query, where } from 'firebase/firestore';
import { db } from '@shared/firebaseConfig';
import { useAuth } from '../context/AuthContext';
import { useProducts } from '../hooks/useProducts';
import { useAuctions } from '../hooks/useAuctions';
import { RootStackParamList } from '../navigationTypes';
import { Product, Auction } from '@shared/types';
import { colors } from '../styles/sharedStyles';

type SellerTab = 'products' | 'auctions';
type SellerProfileRouteProp = RouteProp<RootStackParamList, 'SellerProfile'>;
type SellerProfileNavigationProp = StackNavigationProp<RootStackParamList, 'SellerProfile'>;

export default function SellerProfileScreen() {
  const route = useRoute<SellerProfileRouteProp>();
  const navigation = useNavigation<SellerProfileNavigationProp>();
  const sellerId = route.params.sellerId;
  const [tab, setTab] = useState<SellerTab>('products');

  const { user, loading: authLoading } = useAuth();
  const authUserId = user?.uid;

  // Firestore security rules only allow reading full user documents for the owner or admins.
  // When viewing another seller's profile, we avoid reading their private user document and
  // instead rely on aggregated counts and route parameters.
  const canReadOwnProfile = !!user && !authLoading && user.uid === sellerId;
  const isOwnProfile = canReadOwnProfile;

  useEffect(() => {
    console.log('[SellerProfileScreen] sellerId:', sellerId, 'authUser:', user?.uid);
  }, [sellerId, user?.uid]);

  // IMPORTANT: memoize hook inputs to avoid re-subscribing on every render
  // (which can cause "Maximum update depth exceeded" in hooks that depend on referential equality).
  const productFields = useMemo(
    () => ['name', 'images', 'price', 'createdAt', 'updatedAt', 'boostExpiresAt', 'boostedAt'] as const,
    [],
  );
  const productsQuery = useMemo(
    () => ({
      ownerId: sellerId,
      pageSize: 20,
      // Keep the exact same array reference between renders.
      fields: productFields as unknown as string[],
      enabled: !!user?.uid && !authLoading,
      listingType: 'direct' as const,
      loadAllAtOnce: false,
    }),
    [sellerId, productFields, user?.uid, authLoading],
  );

  const {
    products,
    loading: productsLoading,
    error: productsError,
    hasMore: productsHasMore,
    loadMore: loadMoreProducts,
  } = useProducts(productsQuery);

  const auctionFields = useMemo(
    () => [
      'productId',
      'startTime',
      'endTime',
      'reservePrice',
      'currentBid',
      'currentBidderId',
      'status',
      'buyNowPrice',
      'buyNowUsed',
      'createdAt',
      'updatedAt',
      'ownerId',
    ] as const,
    [],
  );

  const auctionFieldsParam = useMemo(
    () => auctionFields as unknown as string[],
    [auctionFields],
  );

  const {
    auctions,
    loading: auctionsLoading,
    error: auctionsError,
    hasMore: auctionsHasMore,
    loadMore: loadMoreAuctions,
  } = useAuctions(undefined, 20, auctionFieldsParam);

  const sellerAuctions = useMemo(
    () => auctions.filter((a) => a.ownerId === sellerId),
    [auctions, sellerId],
  );

  const [directCount, setDirectCount] = useState<number | null>(null);
  const [auctionCount, setAuctionCount] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadCounts = async () => {
      if (!db || !sellerId || !authUserId || authLoading) {
        setDirectCount(null);
        setAuctionCount(null);
        return;
      }

      try {
        const base = query(
          collection(db, 'products'),
          where('status', '==', 'approved'),
          where('ownerId', '==', sellerId),
        );
        const qDirect = query(base, where('listingType', '==', 'direct'));
        const qAuction = query(base, where('listingType', '==', 'auction'));

        const [directSnap, auctionSnap] = await Promise.all([
          getCountFromServer(qDirect),
          getCountFromServer(qAuction),
        ]);

        if (cancelled) return;
        setDirectCount(directSnap.data().count);
        setAuctionCount(auctionSnap.data().count);
      } catch (err) {
        console.error('[SellerProfileScreen] Failed to load counts', err);
        if (!cancelled) {
          setDirectCount(null);
          setAuctionCount(null);
        }
      }
    };

    loadCounts();

    return () => {
      cancelled = true;
    };
  }, [sellerId, authUserId, authLoading]);

  const sellerName = useMemo(() => {
    // Prefer passing in display data from previous screen to avoid private profile reads.
    if (!isOwnProfile && route.params?.sellerName) {
      return route.params.sellerName;
    }
    if (isOwnProfile && user?.displayName) {
      return user.displayName;
    }
    if (sellerId) {
      return `Vânzător #${sellerId.slice(-6)}`;
    }
    return 'Vânzător';
  }, [isOwnProfile, user?.displayName, sellerId, route.params?.sellerName]);

  const sellerUsername = useMemo(() => {
    if (!isOwnProfile && route.params?.sellerUsername) {
      return route.params.sellerUsername;
    }
    // We only have reliable username for own profile (from auth user).
    return undefined;
  }, [isOwnProfile, route.params?.sellerUsername]);

  const sellerVerified = useMemo(() => {
    if (!isOwnProfile && typeof route.params?.sellerVerified === 'boolean') {
      return route.params.sellerVerified;
    }
    if (isOwnProfile) {
      return !!user?.emailVerified;
    }
    return false;
  }, [isOwnProfile, route.params?.sellerVerified, user?.emailVerified]);

  const avatarUrl = useMemo(() => {
    if (isOwnProfile && user?.photoURL) {
      return user.photoURL;
    }
    return undefined;
  }, [isOwnProfile, user?.photoURL]);

  const memberSince = useMemo(() => {
    if (!isOwnProfile || !user?.metadata?.creationTime) {
      return null;
    }
    const date = new Date(user.metadata.creationTime);
    return Number.isNaN(date.getTime()) ? null : date;
  }, [isOwnProfile, user?.metadata?.creationTime]);

  if (authLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#e7b73c" />
        <Text style={styles.loadingText}>Se verifică sesiunea de utilizator...</Text>
      </View>
    );
  }

  if (!user) {
    return (
      <View style={styles.authContainer}>
        <View style={styles.authCard}>
          <Text style={styles.authTitle}>Profilul vânzătorului este disponibil doar pentru utilizatori autentificați</Text>
           <Text style={styles.authDescription}>
             Autentifică-te pentru a vedea toate produsele și licitațiile acestui vânzător.
           </Text>
           <View style={styles.authButtons}>
             <TouchableOpacity
               style={styles.loginButton}
               onPress={() => navigation.navigate('Login')}
             >
               <Text style={styles.loginButtonText}>Autentificare</Text>
             </TouchableOpacity>
             <TouchableOpacity
               style={styles.registerButton}
               onPress={() => navigation.navigate('Register')}
             >
              <Text style={styles.registerButtonText}>Creează cont</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerContent}>
            <View style={styles.avatarContainer}>
              {avatarUrl ? (
                <Image source={{ uri: avatarUrl }} style={styles.avatar} />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Text style={styles.avatarText}>{sellerName.slice(0, 1).toUpperCase()}</Text>
                </View>
              )}
            </View>
            <View style={styles.sellerInfo}>
              <Text style={styles.sellerName}>{sellerName}</Text>
              <View style={styles.sellerBadges}>
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>ID: <Text style={styles.badgeId}>{sellerId}</Text></Text>
                </View>
                {!!sellerUsername && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>@{sellerUsername}</Text>
                  </View>
                )}
                {sellerVerified && (
                  <View style={[styles.badge, styles.verifiedBadge]}>
                    <Text style={styles.verifiedBadgeText}>Verificat</Text>
                  </View>
                )}
                {!!memberSince && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>Membru din {memberSince.toLocaleDateString()}</Text>
                  </View>
                )}
              </View>
            </View>
          </View>

          <View style={styles.statsContainer}>
            <View style={styles.stat}>
              <Text style={styles.statLabel}>Produse</Text>
              <Text style={styles.statValue}>{directCount ?? '—'}</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statLabel}>Licitații</Text>
              <Text style={styles.statValue}>{auctionCount ?? '—'}</Text>
            </View>
          </View>
        </View>

        {/* Tabs */}
        <View style={styles.tabsContainer}>
          <TouchableOpacity
            style={[styles.tab, tab === 'products' && styles.activeTab]}
            onPress={() => setTab('products')}
          >
            <Text style={[styles.tabText, tab === 'products' && styles.activeTabText]}>Produse</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, tab === 'auctions' && styles.activeTab]}
            onPress={() => setTab('auctions')}
          >
            <Text style={[styles.tabText, tab === 'auctions' && styles.activeTabText]}>Licitații</Text>
          </TouchableOpacity>
        </View>

        {/* Content */}
        <View style={styles.contentSection}>
          {tab === 'products' ? (
            <>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Produse</Text>
                {productsHasMore && (
                  <TouchableOpacity
                    style={styles.loadMoreButton}
                    onPress={loadMoreProducts}
                    disabled={productsLoading}
                  >
                    <Text style={styles.loadMoreButtonText}>
                      {productsLoading ? 'Se încarcă…' : 'Încarcă mai multe'}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>

              {productsError && (
                <View style={styles.errorContainer}>
                  <Text style={styles.errorText}>Eroare la încărcarea produselor: {productsError}</Text>
                </View>
              )}

              {!productsLoading && !productsError && products.length === 0 && (
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyText}>Acest vânzător nu are produse listate momentan.</Text>
                </View>
              )}

              {products.length > 0 && (
                <View style={styles.productsGrid}>
                  {products.map((p: Product) => (
                    <TouchableOpacity
                      key={p.id}
                      style={styles.listCard}
                      onPress={() => navigation.navigate('ProductDetails', { productId: p.id })}
                      accessibilityRole="button"
                    >
                      <View style={styles.listCardImage}>
                        {p.images && p.images.length > 0 ? (
                          <Image source={{ uri: p.images[0] }} style={styles.listCardImageInner} />
                        ) : (
                          <Text style={styles.listCardImagePlaceholder}>No image</Text>
                        )}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.listCardTitle} numberOfLines={2}>
                          {p.name}
                        </Text>
                        {typeof p.price === 'number' && (
                          <Text style={styles.listCardSubtitle}>{p.price} EUR</Text>
                        )}
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </>
          ) : (
            <>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Licitații</Text>
                {auctionsHasMore && (
                  <TouchableOpacity
                    style={styles.loadMoreButton}
                    onPress={loadMoreAuctions}
                    disabled={auctionsLoading}
                  >
                    <Text style={styles.loadMoreButtonText}>
                      {auctionsLoading ? 'Se încarcă…' : 'Încarcă mai multe'}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>

              {auctionsError && (
                <View style={styles.errorContainer}>
                  <Text style={styles.errorText}>Eroare la încărcarea licitațiilor: {auctionsError}</Text>
                </View>
              )}

               {!auctionsLoading && !auctionsError && sellerAuctions.length === 0 && (
                 <View style={styles.emptyContainer}>
                   <Text style={styles.emptyText}>Acest vânzător nu are licitații listate momentan.</Text>
                 </View>
                )}

                {sellerAuctions.length > 0 && (
                  <View style={styles.auctionsGrid}>
                    {sellerAuctions.map((a: Auction) => (
                      <TouchableOpacity
                        key={a.id}
                        style={styles.listCard}
                        onPress={() => navigation.navigate('AuctionDetails', { auctionId: a.id })}
                        accessibilityRole="button"
                      >
                        <View style={[styles.listCardImage, { justifyContent: 'center' }]}>
                          <Text style={styles.listCardImagePlaceholder}>Auction</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.listCardTitle}>Licitație #{a.id.slice(-6)}</Text>
                          <Text style={styles.listCardSubtitle}>
                            Preț curent: {(a.currentBid ?? a.reservePrice).toString()} EUR
                          </Text>
                        </View>
                      </TouchableOpacity>
                   ))}
                 </View>
               )}
            </>
          )}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
    maxWidth: 1200,
    width: '100%',
    alignSelf: 'center',
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
    backgroundColor: colors.background,
  },
  loadingText: {
    color: colors.textSecondary,
    marginTop: 8,
  },
  authContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
    backgroundColor: colors.background,
  },
  authCard: {
    maxWidth: 400,
    width: '100%',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(231, 183, 60, 0.35)',
    backgroundColor: 'rgba(0, 2, 13, 0.85)',
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.85,
    shadowRadius: 55,
    elevation: 10,
  },
  authTitle: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 12,
  },
  authDescription: {
    color: colors.textSecondary,
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 20,
  },
  authButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
  },
  loginButton: {
    backgroundColor: colors.primary,
    borderRadius: 25,
    paddingVertical: 10,
    paddingHorizontal: 20,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.5,
    shadowRadius: 18,
    elevation: 5,
  },
  loginButtonText: {
    color: colors.primaryText,
    fontSize: 14,
    fontWeight: '600',
  },
  registerButton: {
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 25,
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  registerButtonText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  header: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(231, 183, 60, 0.25)',
    backgroundColor: 'rgba(0, 2, 13, 0.8)',
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.85,
    shadowRadius: 55,
    elevation: 10,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  avatarContainer: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: colors.navy800,
    borderWidth: 1,
    borderColor: 'rgba(231, 183, 60, 0.25)',
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatar: {
    width: '100%',
    height: '100%',
  },
  avatarPlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.navy800,
  },
  avatarText: {
    color: colors.primary,
    fontSize: 24,
    fontWeight: 'bold',
  },
  sellerInfo: {
    flex: 1,
  },
  sellerName: {
    color: colors.textPrimary,
    fontSize: 20,
    fontWeight: 'bold',
  },
  sellerBadges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  badge: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(231, 183, 60, 0.25)',
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  badgeText: {
    color: colors.textSecondary,
    fontSize: 10,
  },
  badgeId: {
    color: colors.slate300,
  },
  verifiedBadge: {
    borderColor: 'rgba(16, 185, 129, 0.4)',
    backgroundColor: 'rgba(16, 185, 129, 0.25)',
  },
  verifiedBadgeText: {
    color: colors.emerald300,
  },
  profileStatus: {
    color: colors.textSecondary,
    fontSize: 10,
    marginTop: 4,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 16,
    marginTop: 16,
  },
  stat: {
    alignItems: 'flex-end',
  },
  statLabel: {
    color: colors.textSecondary,
    fontSize: 10,
  },
  statValue: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: 'bold',
  },
  tabsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 16,
  },
  tab: {
    borderRadius: 25,
    borderWidth: 1,
    borderColor: 'rgba(231, 183, 60, 0.25)',
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  tabText: {
    color: colors.textPrimary,
    fontSize: 12,
    fontWeight: '600',
  },
  activeTab: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.65,
    shadowRadius: 18,
    elevation: 5,
  },
  activeTabText: {
    color: colors.primaryText,
  },
  contentSection: {
    marginTop: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: 'bold',
  },
  loadMoreButton: {
    borderRadius: 25,
    borderWidth: 1,
    borderColor: 'rgba(231, 183, 60, 0.3)',
    backgroundColor: colors.navy800,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  loadMoreButtonText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '600',
  },
  errorContainer: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    padding: 16,
  },
  errorText: {
    color: colors.errorLight,
  },
  emptyContainer: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(231, 183, 60, 0.2)',
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    padding: 24,
    alignItems: 'center',
  },
  emptyText: {
    color: colors.textSecondary,
  },
  productsGrid: {
    gap: 10,
  },
  auctionsGrid: {
    gap: 10,
  },
  listCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(231, 183, 60, 0.22)',
    backgroundColor: 'rgba(0, 2, 13, 0.8)',
    padding: 12,
  },
  listCardImage: {
    width: 64,
    height: 64,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(231, 183, 60, 0.18)',
    backgroundColor: colors.navy800,
    overflow: 'hidden',
    alignItems: 'center',
  },
  listCardImageInner: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  listCardImagePlaceholder: {
    color: colors.textSecondary,
    fontSize: 10,
    textAlign: 'center',
    paddingHorizontal: 6,
  },
  listCardTitle: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  listCardSubtitle: {
    color: colors.gold400,
    marginTop: 4,
    fontSize: 12,
    fontWeight: '700',
  },
});
