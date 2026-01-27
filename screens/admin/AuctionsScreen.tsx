import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, TextInput, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { useAuth } from '../../context/AuthContext';
import { RootStackParamList } from '../../navigationTypes';
import { isAdmin, getAllAuctions, deleteAuction, approveAuction, rejectAuction, forceEndAuction, getProductById } from '@shared/adminService';
import { Product, Auction } from '@shared/types';

type AuctionsScreenNavigationProp = StackNavigationProp<RootStackParamList>;

export default function AuctionsScreen() {
  const { user, loading: authLoading } = useAuth();
  const navigation = useNavigation<AuctionsScreenNavigationProp>();
  const [isAdminUser, setIsAdminUser] = useState(false);
  const [loading, setLoading] = useState(true);
  const [auctions, setAuctions] = useState<Auction[]>([]);
  const [products, setProducts] = useState<Record<string, Product>>({});
  const [filter, setFilter] = useState<'all' | 'pending' | 'active' | 'ended' | 'rejected'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [goToText, setGoToText] = useState('');

  const normalizeAuctionId = (raw: string): string => {
    const text = raw.trim();
    if (!text) return '';
    const m = text.match(/\/auctions\/([^/?#]+)/i);
    return m?.[1] ? m[1] : text;
  };

  useEffect(() => {
    const checkAdmin = async () => {
      if (!user) {
        navigation.navigate('Login' as never);
        return;
      }

      const adminStatus = await isAdmin(user.uid);
      if (!adminStatus) {
        navigation.navigate('Dashboard' as never);
        return;
      }

      setIsAdminUser(true);
      await loadAuctions();
      setLoading(false);
    };

    if (!authLoading) {
      checkAdmin();
    }
  }, [user, authLoading, navigation]);

  const loadAuctions = async () => {
    const allAuctions = await getAllAuctions();
    setAuctions(allAuctions);

    // Fetch products for category filtering
    const productPromises = allAuctions.map(async (auction) => {
      if (auction.productId) {
        const product = await getProductById(auction.productId);
        return { productId: auction.productId, product };
      }
      return null;
    });

    const productResults = await Promise.all(productPromises);
    const productsMap: Record<string, Product> = {};
    productResults.forEach(result => {
      if (result && result.product) {
        productsMap[result.productId] = result.product;
      }
    });
    setProducts(productsMap);
  };

  const handleDelete = async (auctionId: string) => {
    Alert.alert(
      'Confirmare',
      'Ești sigur că vrei să ștergi această licitație?',
      [
        { text: 'Anulează', style: 'cancel' },
        {
          text: 'Șterge',
          style: 'destructive',
          onPress: async () => {
            const result = await deleteAuction(auctionId);
            if (result.success) {
              await loadAuctions();
            } else {
              Alert.alert('Eroare', result.error || 'A apărut o eroare la ștergerea licitației');
            }
          },
        },
      ],
    );
  };

  const handleApprove = async (auctionId: string) => {
    const result = await approveAuction(auctionId);
    if (result.success) {
      await loadAuctions();
    } else {
      Alert.alert('Eroare', result.error || 'A apărut o eroare la aprobarea licitației');
    }
  };

  const handleReject = async (auctionId: string) => {
    const result = await rejectAuction(auctionId);
    if (result.success) {
      await loadAuctions();
    } else {
      Alert.alert('Eroare', result.error || 'A apărut o eroare la respingerea licitației');
    }
  };

  const handleForceEnd = async (auctionId: string) => {
    Alert.alert(
      'Confirmare',
      'Ești sigur că vrei să închei forțat această licitație?',
      [
        { text: 'Anulează', style: 'cancel' },
        {
          text: 'Încheie',
          style: 'destructive',
          onPress: async () => {
            const result = await forceEndAuction(auctionId);
            if (result.success) {
              await loadAuctions();
            } else {
              Alert.alert('Eroare', result.error || 'A apărut o eroare la încheierea licitației');
            }
          },
        },
      ],
    );
  };

  const filteredAuctions = auctions.filter(a => {
    const statusMatch = filter === 'all' ? true : a.status === filter;
    const categoryMatch = categoryFilter === 'all' ? true : products[a.productId]?.category === categoryFilter;
    return statusMatch && categoryMatch;
  });

  const searchedAuctions = filteredAuctions.filter((a) => {
    if (!searchTerm.trim()) return true;
    const q = searchTerm.trim().toLowerCase();
    const product = products[a.productId];
    const productName = product?.name || '';
    const ownerId = product?.ownerId || '';
    return (
      a.id.toLowerCase().includes(q) ||
      a.productId.toLowerCase().includes(q) ||
      ownerId.toLowerCase().includes(q) ||
      productName.toLowerCase().includes(q)
    );
  });

  if (authLoading || loading || !isAdminUser) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>Gestionează licitații</Text>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.navigate('AdminDashboard' as never)}>
            <Text style={styles.backButtonText}>Înapoi la Admin</Text>
          </TouchableOpacity>
        </View>

        {/* Filter Tabs */}
        <View style={styles.filterTabs}>
          <TouchableOpacity
            style={[styles.filterTab, filter === 'all' ? styles.filterTabActive : styles.filterTabInactive]}
            onPress={() => setFilter('all')}
          >
            <Text style={[styles.filterTabText, filter === 'all' ? styles.filterTabTextActive : styles.filterTabTextInactive]}>
              Toate ({auctions.length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterTab, filter === 'pending' ? styles.filterTabActiveYellow : styles.filterTabInactive]}
            onPress={() => setFilter('pending')}
          >
            <Text style={[styles.filterTabText, filter === 'pending' ? styles.filterTabTextActive : styles.filterTabTextInactive]}>
              În așteptare ({auctions.filter(a => a.status === 'pending').length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterTab, filter === 'active' ? styles.filterTabActiveGreen : styles.filterTabInactive]}
            onPress={() => setFilter('active')}
          >
            <Text style={[styles.filterTabText, filter === 'active' ? styles.filterTabTextActive : styles.filterTabTextInactive]}>
              Active ({auctions.filter(a => a.status === 'active').length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterTab, filter === 'ended' ? styles.filterTabActiveGray : styles.filterTabInactive]}
            onPress={() => setFilter('ended')}
          >
            <Text style={[styles.filterTabText, filter === 'ended' ? styles.filterTabTextActive : styles.filterTabTextInactive]}>
              Încheiate ({auctions.filter(a => a.status === 'ended').length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterTab, filter === 'rejected' ? styles.filterTabActiveRed : styles.filterTabInactive]}
            onPress={() => setFilter('rejected')}
          >
            <Text style={[styles.filterTabText, filter === 'rejected' ? styles.filterTabTextActive : styles.filterTabTextInactive]}>
              Respinse ({auctions.filter(a => a.status === 'rejected').length})
            </Text>
          </TouchableOpacity>
        </View>

        {/* Category Filter */}
        <View style={styles.categoryFilter}>
          <Text style={styles.categoryFilterLabel}>Filtru categorie</Text>
          <View style={styles.dropdownContainer}>
                <TextInput
              style={styles.dropdown}
              value={categoryFilter}
              onChangeText={setCategoryFilter}
            />
          </View>
        </View>

        {/* Search */}
        <View style={styles.searchSection}>
          <Text style={styles.searchLabel}>
            Caută după ID licitație / ID produs / ID proprietar / nume produs
          </Text>
              <TextInput
            style={styles.searchInput}
            value={searchTerm}
            onChangeText={setSearchTerm}
            placeholder="ex: 2a9c..., productId..., ownerId..., Roman Denarius..."
          />
          {searchTerm.trim() && (
            <Text style={styles.searchResults}>
              Rezultate: <Text style={styles.searchResultsCount}>{searchedAuctions.length}</Text>
            </Text>
          )}
        </View>

        {/* Go to auction */}
        <View style={styles.goToSection}>
          <Text style={styles.goToLabel}>Deschide direct o licitație (ID sau link)</Text>
          <View style={styles.goToRow}>
            <TextInput
              style={styles.goToInput}
              value={goToText}
              onChangeText={setGoToText}
              onSubmitEditing={(e) => {
                const id = normalizeAuctionId(goToText);
                if (id) (navigation as any).navigate('AuctionDetails', { auctionId: id });
              }}
              placeholder="ex: 2a9c... sau https://site.ro/auctions/2a9c..."
            />
            <TouchableOpacity
              style={[styles.goToButton, !goToText.trim() ? styles.goToButtonDisabled : null]}
              disabled={!goToText.trim()}
               onPress={() => {
                 const id = normalizeAuctionId(goToText);
                 if (id) (navigation as any).navigate('AuctionDetails', { auctionId: id });
               }}
            >
              <Text style={styles.goToButtonText}>Deschide</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Auctions List */}
        <View style={styles.auctionsList}>
          {searchedAuctions.length === 0 ? (
            <Text style={styles.emptyText}>Nicio licitație găsită.</Text>
          ) : (
            <View style={styles.auctionsListContent}>
              {searchedAuctions.map((auction) => (
                <View key={auction.id} style={styles.auctionItem}>
                  <View style={styles.auctionItemHeader}>
                    <View style={styles.auctionItemInfo}>
                      <View style={styles.auctionItemTitleRow}>
                         <TouchableOpacity onPress={() => (navigation as any).navigate('AuctionDetails', { auctionId: auction.id })}>
                          <Text style={styles.auctionItemTitle}>Licitație #{auction.id.slice(-6)}</Text>
                        </TouchableOpacity>
                        <Text style={[styles.auctionItemStatus, 
                          auction.status === 'active' ? styles.auctionItemStatusActive :
                          auction.status === 'pending' ? styles.auctionItemStatusPending :
                          auction.status === 'ended' ? styles.auctionItemStatusEnded :
                          styles.auctionItemStatusRejected
                        ]}>
                          {auction.status}
                        </Text>
                      </View>
                      <View style={styles.auctionItemDetails}>
                        <Text style={styles.auctionItemDetail}>ID piesă: {auction.productId}</Text>
                        <Text style={styles.auctionItemDetail}>Preț de rezervă: ${Math.round(auction.reservePrice)}</Text>
                        {auction.currentBid && (
                          <Text style={styles.auctionItemDetail}>Licitație curentă: ${Math.round(auction.currentBid)}</Text>
                        )}
                         {products[auction.productId]?.ownerId && (
                           <Text style={styles.auctionItemDetail}>
                              Proprietar: <TouchableOpacity onPress={() => (navigation as any).navigate('AdminUserDetail', { userId: products[auction.productId].ownerId })}>
                               <Text style={styles.auctionItemOwner}>{products[auction.productId].ownerId}</Text>
                             </TouchableOpacity>
                           </Text>
                         )}
                        <Text style={styles.auctionItemDetail}>
                          Start: {auction.startTime.toLocaleDateString()} - Sfârșit: {auction.endTime.toLocaleDateString()}
                        </Text>
                        <Text style={styles.auctionItemDetail}>Creat: {auction.createdAt.toLocaleDateString()}</Text>
                      </View>
                    </View>
                    <View style={styles.auctionItemActions}>
                      {auction.status === 'pending' && (
                        <>
                          <TouchableOpacity style={[styles.auctionActionButton, styles.auctionActionButtonGreen]} onPress={() => handleApprove(auction.id)}>
                            <Text style={styles.auctionActionButtonText}>Aprobă</Text>
                          </TouchableOpacity>
                          <TouchableOpacity style={[styles.auctionActionButton, styles.auctionActionButtonYellow]} onPress={() => handleReject(auction.id)}>
                            <Text style={styles.auctionActionButtonText}>Respinge</Text>
                          </TouchableOpacity>
                        </>
                      )}
                      {auction.status === 'active' && (
                        <TouchableOpacity style={[styles.auctionActionButton, styles.auctionActionButtonOrange]} onPress={() => handleForceEnd(auction.id)}>
                          <Text style={styles.auctionActionButtonText}>Încheie forțat</Text>
                        </TouchableOpacity>
                      )}
                      {auction.status === 'rejected' && (
                        <TouchableOpacity style={[styles.auctionActionButton, styles.auctionActionButtonGreen]} onPress={() => handleApprove(auction.id)}>
                          <Text style={styles.auctionActionButtonText}>Aprobă</Text>
                        </TouchableOpacity>
                      )}
                      <TouchableOpacity style={[styles.auctionActionButton, styles.auctionActionButtonRed]} onPress={() => handleDelete(auction.id)}>
                        <Text style={styles.auctionActionButtonText}>Șterge</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000940',
  },
  content: {
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  backButton: {
    padding: 8,
    backgroundColor: '#4b5563',
    borderRadius: 8,
  },
  backButtonText: {
    color: '#fff',
    fontSize: 12,
  },
  filterTabs: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  filterTab: {
    padding: 8,
    borderRadius: 8,
  },
  filterTabActive: {
    backgroundColor: '#3b82f6',
  },
  filterTabActiveYellow: {
    backgroundColor: '#fbbf24',
  },
  filterTabActiveGreen: {
    backgroundColor: '#10b981',
  },
  filterTabActiveGray: {
    backgroundColor: '#6b7280',
  },
  filterTabActiveRed: {
    backgroundColor: '#ef4444',
  },
  filterTabInactive: {
    backgroundColor: '#e5e7eb',
  },
  filterTabText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  filterTabTextActive: {
    color: '#fff',
  },
  filterTabTextInactive: {
    color: '#1f2937',
  },
  categoryFilter: {
    marginBottom: 16,
  },
  categoryFilterLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  dropdownContainer: {
    backgroundColor: '#e5e7eb',
    borderRadius: 8,
  },
  dropdown: {
    padding: 12,
    color: '#1f2937',
  },
  searchSection: {
    marginBottom: 16,
  },
  searchLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  searchInput: {
    padding: 12,
    backgroundColor: '#e5e7eb',
    borderRadius: 8,
    color: '#1f2937',
  },
  searchResults: {
    fontSize: 10,
    color: '#9ca3af',
    marginTop: 4,
  },
  searchResultsCount: {
    fontWeight: 'bold',
  },
  goToSection: {
    marginBottom: 16,
  },
  goToLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  goToRow: {
    flexDirection: 'row',
    gap: 8,
  },
  goToInput: {
    flex: 1,
    padding: 12,
    backgroundColor: '#e5e7eb',
    borderRadius: 8,
    color: '#1f2937',
  },
  goToButton: {
    padding: 12,
    backgroundColor: '#3b82f6',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  goToButtonDisabled: {
    backgroundColor: '#9ca3af',
  },
  goToButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  auctionsList: {
    backgroundColor: '#fff',
    borderRadius: 16,
  },
  auctionsListContent: {
    padding: 16,
    gap: 16,
  },
  auctionItem: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    padding: 12,
  },
  auctionItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  auctionItemInfo: {
    flex: 1,
  },
  auctionItemTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  auctionItemTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#3b82f6',
  },
  auctionItemStatus: {
    fontSize: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    fontWeight: 'bold',
  },
  auctionItemStatusActive: {
    backgroundColor: '#d1fae5',
    color: '#065f46',
  },
  auctionItemStatusPending: {
    backgroundColor: '#fef3c7',
    color: '#92400e',
  },
  auctionItemStatusEnded: {
    backgroundColor: '#e5e7eb',
    color: '#374151',
  },
  auctionItemStatusRejected: {
    backgroundColor: '#fee2e2',
    color: '#991b1b',
  },
  auctionItemDetails: {
    marginTop: 8,
    gap: 4,
  },
  auctionItemDetail: {
    fontSize: 12,
    color: '#6b7280',
  },
  auctionItemOwner: {
    color: '#3b82f6',
    fontWeight: 'bold',
  },
  auctionItemActions: {
    flexDirection: 'column',
    gap: 8,
    marginLeft: 8,
  },
  auctionActionButton: {
    padding: 8,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  auctionActionButtonGreen: {
    backgroundColor: '#10b981',
  },
  auctionActionButtonYellow: {
    backgroundColor: '#fbbf24',
  },
  auctionActionButtonOrange: {
    backgroundColor: '#f97316',
  },
  auctionActionButtonRed: {
    backgroundColor: '#ef4444',
  },
  auctionActionButtonText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  emptyText: {
    color: '#9ca3af',
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000940',
  },
});
