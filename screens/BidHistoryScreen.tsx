import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Image, TouchableOpacity, FlatList } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RouteProp } from '@react-navigation/native';
import { format } from 'date-fns';
import { ro } from 'date-fns/locale/ro';
import { RootStackParamList } from '../navigationTypes';
import { getBidHistoryForAuction, getUserBidHistory } from '@shared/bidHistoryService';
import { BidHistory, BidHistoryStats } from '@shared/types';
import InlineBackButton from '../components/InlineBackButton';

// Currency formatting function
const formatRON = (amount: number): string => `${amount.toFixed(2)} EUR`;

export default function BidHistoryScreen() {
  type BidHistoryScreenRouteProp = RouteProp<RootStackParamList, 'BidHistory'>;
  const route = useRoute<BidHistoryScreenRouteProp>();
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  const { auctionId, userId } = route.params;
  const [bidHistory, setBidHistory] = useState<BidHistory[]>([]);
  const [stats, setStats] = useState<BidHistoryStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<'all' | 'lastHour' | 'lastDay' | 'lastWeek'>('all');

  useEffect(() => {
    const fetchBidHistory = async () => {
      try {
        setLoading(true);
        setError(null);

        if (auctionId) {
          // Fetch bid history for specific auction
          const { bids, stats } = await getBidHistoryForAuction(String(auctionId), 100);
          setBidHistory(bids);
          setStats(stats);
        } else if (userId) {
          // Fetch user's bid history
          const bids = await getUserBidHistory(String(userId), 50);
          setBidHistory(bids);
        }
      } catch (err) {
        console.error('Error fetching bid history:', err);
        setError(err instanceof Error ? err.message : 'Failed to load bid history');
      } finally {
        setLoading(false);
      }
    };

    fetchBidHistory();
  }, [auctionId, userId]);

  // Filter bids based on time range
  const filteredBids = bidHistory.filter(bid => {
    const now = new Date();
    const bidTime = bid.timestamp;

    switch (timeRange) {
      case 'lastHour':
        return now.getTime() - bidTime.getTime() <= 60 * 60 * 1000;
      case 'lastDay':
        return now.getTime() - bidTime.getTime() <= 24 * 60 * 60 * 1000;
      case 'lastWeek':
        return now.getTime() - bidTime.getTime() <= 7 * 24 * 60 * 60 * 1000;
      default:
        return true;
    }
  });

  const timeRangeOptions = [
    { value: 'all', label: 'Toate' },
    { value: 'lastHour', label: 'Ultimul oră' },
    { value: 'lastDay', label: 'Ultimul zi' },
    { value: 'lastWeek', label: 'Ultimul săptămână' }
  ];

  const renderBidItem = ({ item }: { item: BidHistory }) => (
    <View style={styles.bidItem}>
      <View style={styles.bidHeader}>
        <Text style={styles.bidTime}>{format(item.timestamp, 'HH:mm', { locale: ro })}</Text>
        <Text style={[styles.bidAmount, item.isAutoBid ? styles.autoBid : styles.manualBid]}>
          {formatRON(item.amount)}
        </Text>
      </View>

      <View style={styles.bidDetails}>
        <View style={styles.bidUserInfo}>
          {item.userAvatar && (
            <Image
              source={{ uri: item.userAvatar }}
              style={styles.userAvatar}
              onError={() => {}}
            />
          )}
          <Text style={styles.userName}>{item.userName}</Text>
        </View>

        <View style={styles.bidMeta}>
          {item.isAutoBid && <Text style={styles.autoBidLabel}>Auto</Text>}
          {item.priceChange !== 0 && item.priceChange !== undefined && (
            <Text style={[
              styles.priceChange,
              item.priceChange > 0 ? styles.priceIncrease : styles.priceDecrease
            ]}>
              {item.priceChange > 0 ? '+' : ''}{formatRON(item.priceChange || 0)}
              ({item.priceChange > 0 ? '+' : ''}{(item.priceChangePercent || 0).toFixed(1)}%)
            </Text>
          )}
        </View>
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#e7b73c" />
          <Text style={styles.loadingText}>Încărcare istoric licitații...</Text>
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => {
              const fetchData = async () => {
                try {
                  setLoading(true);
                  setError(null);

                  if (auctionId) {
                    // Fetch bid history for specific auction
                    const { bids, stats } = await getBidHistoryForAuction(String(auctionId), 100);
                    setBidHistory(bids);
                    setStats(stats);
                  } else if (userId) {
                    // Fetch user's bid history
                    const bids = await getUserBidHistory(String(userId), 50);
                    setBidHistory(bids);
                  }
                } catch (err) {
                  console.error('Error fetching bid history:', err);
                  setError(err instanceof Error ? err.message : 'Failed to load bid history');
                } finally {
                  setLoading(false);
                }
              };
              fetchData();
            }}
          >
            <Text style={styles.retryButtonText}>Reîncarcă</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView style={styles.content}>
        <View style={styles.header}>
          <InlineBackButton />
          <Text style={[styles.title, { marginTop: 10 }]}
          >
            {auctionId ? 'Istoric Licitări' : 'Licitările Mele'}
          </Text>

          <View style={styles.timeRangeSelector}>
            <Text style={styles.timeRangeLabel}>Perioadă:</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.timeRangeOptions}
            >
              {timeRangeOptions.map(option => (
                <TouchableOpacity
                  key={option.value}
                  style={[
                    styles.timeRangeButton,
                    timeRange === option.value && styles.timeRangeButtonActive
                  ]}
                  onPress={() => setTimeRange(option.value as any)}
                >
                  <Text style={[
                    styles.timeRangeButtonText,
                    timeRange === option.value && styles.timeRangeButtonTextActive
                  ]}>
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>

        {/* Statistics */}
        {stats && (
          <View style={styles.statsContainer}>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>Total</Text>
              <Text style={styles.statValue}>{stats.totalBids}</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>Maxim</Text>
              <Text style={[styles.statValue, styles.statHighlight]}>{formatRON(stats.highestBid)}</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>Minim</Text>
              <Text style={[styles.statValue, styles.statLowlight]}>{formatRON(stats.lowestBid)}</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>Mediu</Text>
              <Text style={[styles.statValue, styles.statAverage]}>{formatRON(stats.averageBid)}</Text>
            </View>
          </View>
        )}

        {/* Bid List */}
        <Text style={styles.sectionTitle}>
          {filteredBids.length} {filteredBids.length === 1 ? 'licitație' : 'licitații'}
        </Text>

        {filteredBids.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>Nu există licitații în această perioadă</Text>
          </View>
        ) : (
          <FlatList
            data={filteredBids}
            renderItem={renderBidItem}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.bidList}
            ListFooterComponent={
              <Text style={styles.footerText}>
                {filteredBids.length} licitații afișate din {bidHistory.length} totale
              </Text>
            }
          />
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#020617',
  },
  content: {
    flex: 1,
  },
  header: {
    padding: 20,
    paddingBottom: 10,
    backgroundColor: '#0a142f',
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 10,
  },
  timeRangeSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
  },
  timeRangeLabel: {
    color: '#94a3b8',
    fontSize: 14,
    marginRight: 10,
  },
  timeRangeOptions: {
    gap: 8,
  },
  timeRangeButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#1e293b',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#334155',
  },
  timeRangeButtonActive: {
    backgroundColor: '#e7b73c',
    borderColor: '#e7b73c',
  },
  timeRangeButtonText: {
    color: '#94a3b8',
    fontSize: 12,
  },
  timeRangeButtonTextActive: {
    color: '#020617',
    fontWeight: 'bold',
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: 15,
    backgroundColor: '#0f1a32',
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  statItem: {
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 12,
    color: '#94a3b8',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  statHighlight: {
    color: '#10b981',
  },
  statLowlight: {
    color: '#f87171',
  },
  statAverage: {
    color: '#60a5fa',
  },
  sectionTitle: {
    padding: 15,
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    backgroundColor: '#0a142f',
  },
  bidList: {
    paddingBottom: 20,
  },
  bidItem: {
    backgroundColor: '#1e293b',
    borderRadius: 8,
    padding: 15,
    marginHorizontal: 15,
    marginBottom: 10,
  },
  bidHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  bidTime: {
    color: '#94a3b8',
    fontSize: 12,
  },
  bidAmount: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  autoBid: {
    color: '#60a5fa',
  },
  manualBid: {
    color: '#ffffff',
  },
  bidDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  bidUserInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  userAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#334155',
  },
  userName: {
    color: '#e5e7eb',
    fontSize: 14,
  },
  bidMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  autoBidLabel: {
    backgroundColor: '#1e3a8a',
    color: '#60a5fa',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    fontSize: 10,
    overflow: 'hidden',
  },
  priceChange: {
    fontSize: 12,
    fontWeight: '500',
  },
  priceIncrease: {
    color: '#10b981',
  },
  priceDecrease: {
    color: '#f87171',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    color: '#94a3b8',
    marginTop: 10,
    fontSize: 14,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    color: '#f87171',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: '#e7b73c',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#020617',
    fontWeight: 'bold',
    fontSize: 14,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  emptyText: {
    color: '#64748b',
    fontSize: 14,
    textAlign: 'center',
  },
  footerText: {
    color: '#64748b',
    fontSize: 12,
    textAlign: 'center',
    padding: 10,
  },
});