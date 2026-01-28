import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  StyleSheet,
  Image,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { useAuth } from '../context/AuthContext';
import { RootStackParamList, TabParamList } from '../navigationTypes';
import { WatchlistItem } from '@shared/types';
import { getUserWatchlist, removeFromWatchlist, clearWatchlist } from '@shared/watchlistService';
import { colors } from '../styles/sharedStyles';
import { formatEUR } from '../utils/currency';
import InlineBackButton from '../components/InlineBackButton';

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#00020d',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#00020d',
  },
  loadingTitle: {
    marginTop: 16,
    color: '#e5e7eb',
    textAlign: 'center',
    fontSize: 16,
  },
  loadingSubtitle: {
    marginTop: 8,
    color: '#94a3b8',
    textAlign: 'center',
    fontSize: 14,
  },
  errorText: {
    color: '#f87171',
    fontSize: 16,
    textAlign: 'center',
  },
  headerContainer: {
    backgroundColor: '#00020d',
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
    color: '#e7b73c',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#cbd5f5',
    marginBottom: 8,
  },
  resultsSummary: {
    fontSize: 13,
    color: '#e5e7eb',
    marginBottom: 10,
  },
  resultsHighlight: {
    fontWeight: '600',
    color: '#facc6b',
  },
  categoryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 10,
  },
  categoryChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#020617',
    marginRight: 6,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.5)',
  },
  categoryChipActive: {
    backgroundColor: '#e7b73c',
    borderColor: '#e7b73c',
    shadowColor: '#e7b73c',
    shadowOpacity: 0.6,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
    elevation: 4,
  },
  categoryChipText: {
    fontSize: 11,
    color: '#e5e7eb',
  },
  categoryChipTextActive: {
    color: '#000940',
    fontWeight: '600',
  },
  listContent: {
    paddingVertical: 16,
  },
  emptyListContent: {
    flexGrow: 1,
  },
  columnWrapper: {
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  emptyTitle: {
    color: '#e5e7eb',
    fontSize: 18,
    textAlign: 'center',
    marginBottom: 16,
  },
  emptyButton: {
    backgroundColor: '#e7b73c',
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 12,
    shadowColor: '#e7b73c',
    shadowOpacity: 0.6,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
    elevation: 4,
  },
  emptyButtonText: {
    color: '#000940',
    fontWeight: '600',
  },
  card: {
    flex: 1,
    marginBottom: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(231, 183, 60, 0.6)',
    backgroundColor: 'rgba(15, 23, 42, 0.9)',
    padding: 12,
    shadowColor: '#e7b73c',
    shadowOpacity: 0.35,
    shadowRadius: 15,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
    maxWidth: '48%',
  },
  cardImageContainer: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: '#00020d',
    marginBottom: 8,
    borderRadius: 12,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardImage: {
    width: '100%',
    height: '100%',
  },
  cardNoImageContainer: {
    width: '100%',
    height: '100%',
    backgroundColor: '#020617',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardNoImageText: {
    color: '#94a3b8',
    fontSize: 11,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#f9fafb',
    marginBottom: 4,
  },
  cardMeta: {
    fontSize: 11,
    color: '#cbd5f5',
    marginBottom: 6,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardPrice: {
    fontSize: 16,
    fontWeight: '700',
    color: '#e7b73c',
  },
  cardRarityPill: {
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: 'rgba(231, 183, 60, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(231, 183, 60, 0.4)',
  },
  cardRarityText: {
    fontSize: 10,
    color: '#facc6b',
    textTransform: 'capitalize',
  },
  actionButton: {
    backgroundColor: '#e7b73c',
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 12,
    shadowColor: '#e7b73c',
    shadowOpacity: 0.6,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
    elevation: 4,
  },
  actionButtonText: {
    color: '#000940',
    fontWeight: '600',
  },
  secondaryButton: {
    backgroundColor: '#020617',
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#4b5563',
  },
  secondaryButtonText: {
    color: '#e5e7eb',
    fontWeight: '600',
  },
  removeButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#ef4444',
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 20,
  },
});

const WatchlistItemCard: React.FC<{ item: WatchlistItem; onRemove: (itemId: string) => void }> = ({ item, onRemove }) => {
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  const [itemData, setItemData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchItemData = async () => {
      try {
        setLoading(true);
        const { doc, getDoc } = await import('firebase/firestore');
        const { db } = await import('@shared/firebaseConfig');
        
        const collectionName = item.itemType === 'product' ? 'products' : 'auctions';
        const docRef = doc(db, collectionName, item.itemId);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          setItemData(docSnap.data());
        }
      } catch (error) {
        console.error('Error fetching watchlist item data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchItemData();
  }, [item.itemId, item.itemType]);

  const handlePress = () => {
    if (item.itemType === 'product') {
      navigation.navigate('ProductDetails', { productId: item.itemId });
    } else {
      navigation.navigate('AuctionDetails', { auctionId: item.itemId });
    }
  };

  if (loading) {
    return (
      <View style={styles.card}>
        <ActivityIndicator size="small" color={colors.primary} />
      </View>
    );
  }

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={handlePress}
    >
      {/* Image */}
      <View style={styles.cardImageContainer}>
        {itemData?.images && itemData.images.length > 0 ? (
          <Image
            source={{ uri: itemData.images[0] }}
            style={styles.cardImage}
            resizeMode="contain"
          />
        ) : (
          <View style={styles.cardNoImageContainer}>
            <Text style={styles.cardNoImageText}>Fără imagine</Text>
          </View>
        )}
      </View>

      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
        <View style={{ flex: 1, marginRight: 8 }}>
          <Text style={styles.cardTitle} numberOfLines={2}>
            {itemData?.name || `${item.itemType === 'product' ? 'Produs' : 'Licitație'} #${item.itemId.slice(-6)}`}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.removeButton}
          onPress={() => onRemove(item.itemId)}
        >
          <Text style={styles.removeButtonText}>×</Text>
        </TouchableOpacity>
      </View>

      {itemData?.price && (
        <Text style={styles.cardPrice}>
          {formatEUR(itemData.price)}
        </Text>
      )}

      {itemData?.country && (
        <Text style={styles.cardMeta} numberOfLines={1}>
          {itemData.country}{itemData.year ? ` • ${itemData.year}` : ''}
        </Text>
      )}

      {item.notes && (
        <Text style={styles.cardMeta} numberOfLines={2}>
          Notițe: {item.notes}
        </Text>
      )}

      <Text style={[styles.cardMeta, { fontSize: 10 }]}>
        Adăugat: {new Date(item.addedAt).toLocaleDateString()}
      </Text>
    </TouchableOpacity>
  );
};

const WatchlistScreen: React.FC = () => {
  const { user } = useAuth();
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'products' | 'auctions'>('products');

  const fetchWatchlist = async () => {
    if (!user) return;

    try {
      setLoading(true);
      setError(null);
      const result = await getUserWatchlist(user.uid);
      if (result.success && result.items) {
        setWatchlist(result.items);
      } else {
        setError(result.error || 'Failed to fetch watchlist');
      }
    } catch (err) {
      console.error('Error fetching watchlist:', err);
      setError('Failed to fetch watchlist');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRemoveItem = async (itemId: string) => {
    if (!user) return;

    try {
      const result = await removeFromWatchlist(user.uid, itemId);
      if (result.success) {
        await fetchWatchlist();
      } else {
        Alert.alert('Error', result.error || 'Failed to remove from watchlist');
      }
    } catch (err) {
      console.error('Error removing from watchlist:', err);
      Alert.alert('Error', 'Failed to remove from watchlist');
    }
  };

  const handleClearWatchlist = async () => {
    if (!user) return;

    Alert.alert(
      'Golește watchlist',
      'Sigur doriți să ștergeți toate elementele din watchlist?',
      [
        { text: 'Anulează', style: 'cancel' },
        {
          text: 'Șterge',
          style: 'destructive',
          onPress: async () => {
            try {
              const result = await clearWatchlist(user.uid);
              if (result.success) {
                await fetchWatchlist();
              } else {
                Alert.alert('Error', result.error || 'Failed to clear watchlist');
              }
            } catch (err) {
              console.error('Error clearing watchlist:', err);
              Alert.alert('Error', 'Failed to clear watchlist');
            }
          }
        }
      ]
    );
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchWatchlist();
  };

  // Fetch watchlist on mount and when screen comes into focus
  useEffect(() => {
    fetchWatchlist();
  }, [user]);

  // Refresh watchlist when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      fetchWatchlist();
    }, [user])
  );

  if (!user) {
    return (
      <View style={styles.loadingContainer}>
        <InlineBackButton />
        <Text style={styles.loadingTitle}>
          Vă rugăm să vă autentificați pentru a accesa watchlist-ul
        </Text>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => navigation.navigate('Login')}
        >
          <Text style={styles.actionButtonText}>Autentificare</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const productsInWatchlist = watchlist.filter(item => item.itemType === 'product');
  const auctionsInWatchlist = watchlist.filter(item => item.itemType === 'auction');

  return (
      <View style={styles.screen}>
        {/* Header */}
        <View style={styles.headerContainer}>
          <InlineBackButton />
          <Text style={[styles.headerTitle, { marginTop: 12 }]}>Watchlist-ul utilizatorului</Text>
          <Text style={styles.headerSubtitle}>
            {watchlist.length} elemente • {productsInWatchlist.length} produse • {auctionsInWatchlist.length} licitații
          </Text>

          {/* Tabs */}
          <View style={styles.categoryRow}>
            {['products', 'auctions'].map((tab) => {
              const label = tab === 'products' ? 'Produse' : 'Licitații';
              const count = tab === 'products' ? productsInWatchlist.length : auctionsInWatchlist.length;
              const active = activeTab === tab;
              return (
                <TouchableOpacity
                  key={tab}
                  style={active ? [styles.categoryChip, styles.categoryChipActive] : styles.categoryChip}
                  onPress={() => setActiveTab(tab as 'products' | 'auctions')}
                >
                  <Text
                    style={
                      active
                        ? [styles.categoryChipText, styles.categoryChipTextActive]
                        : styles.categoryChipText
                    }
                  >
                    {label} ({count})
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Action Buttons */}
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
            <TouchableOpacity
              style={[styles.secondaryButton, { flex: 1 }]}
              onPress={handleClearWatchlist}
            >
              <Text style={styles.secondaryButtonText}>Șterge tot</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, { flex: 1 }]}
              onPress={onRefresh}
              disabled={refreshing}
            >
              <Text style={styles.actionButtonText}>
                {refreshing ? 'Se reîncarcă...' : 'Reîncarcă'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Content */}
        {loading && !refreshing ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingTitle}>Se încarcă watchlist-ul...</Text>
          </View>
        ) : error ? (
          <View style={styles.loadingContainer}>
            <Text style={styles.errorText}>Eroare: {error}</Text>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={fetchWatchlist}
            >
              <Text style={styles.actionButtonText}>Încercă din nou</Text>
            </TouchableOpacity>
          </View>
        ) : watchlist.length === 0 ? (
          <View style={[styles.listContent, styles.emptyListContent]}>
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyTitle}>
                Watchlist-ul este gol
              </Text>
              <Text style={styles.loadingSubtitle}>
                Adaugă produse și licitații în watchlist pentru a le monitoriza cu ușurință
              </Text>
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 16 }}>
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={() => navigation.navigate('MainTabs', { screen: 'ProductCatalog' })}
                >
                  <Text style={styles.actionButtonText}>Caută produse</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.secondaryButton}
                  onPress={() => navigation.navigate('MainTabs', { screen: 'AuctionList', params: { filters: undefined } })}
                >
                  <Text style={styles.secondaryButtonText}>Vezi licitații</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        ) : (
          <FlatList
            data={activeTab === 'products' ? productsInWatchlist : auctionsInWatchlist}
            renderItem={({ item }) => (
              <WatchlistItemCard
                item={item}
                onRemove={handleRemoveItem}
              />
            )}
            keyExtractor={(item) => item.id}
            numColumns={2}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.listContent}
            columnWrapperStyle={styles.columnWrapper}
            refreshing={refreshing}
            onRefresh={onRefresh}
            ListEmptyComponent={
              <View style={[styles.listContent, styles.emptyListContent]}>
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyTitle}>
                    Nu există {activeTab === 'products' ? 'produse' : 'licitații'} în watchlist
                  </Text>
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => {
                      if (activeTab === 'products') {
                        navigation.navigate('MainTabs', { screen: 'ProductCatalog' });
                      } else {
                        navigation.navigate('MainTabs', { screen: 'AuctionList', params: { filters: undefined } });
                      }
                    }}
                  >
                    <Text style={styles.actionButtonText}>
                      Caută {activeTab === 'products' ? 'produse' : 'licitații'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            }
          />
        )}
      </View>
  );
};

export default WatchlistScreen;
