import React, { useState, useEffect, useMemo } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  ScrollView, 
  ActivityIndicator, 
  Alert, 
  FlatList,
  StyleSheet,
  Share,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RouteProp } from '@react-navigation/native';
import { z } from 'zod';
import { Ionicons } from '@expo/vector-icons';
import { useAuction } from '../hooks/useAuctions';
import { useBids } from '../hooks/useBids';
import { useAuth } from '../context/AuthContext';
import { placeBid, setAutoBid } from '@shared/auctionService';
import { Bid } from '@shared/types';
import { RootStackParamList } from '../navigationTypes';
import { colors } from '../styles/sharedStyles';
import PullbackButton from '../components/PullbackButton';
import PullbackStatusIndicator from '../components/PullbackStatusIndicator';
import InlineBackButton from '../components/InlineBackButton';
import { isAuctionEligibleForPullbackData } from '@shared/pullbackEligibility';
import { formatEUR } from '../utils/currency';

const bidSchema = z.object({
  amount: z.number().positive('Bid amount must be positive'),
});

const CountdownTimer: React.FC<{ endTime: Date; onEnded?: () => void }> = ({ endTime, onEnded }) => {
  const [timeLeft, setTimeLeft] = useState('');

  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date().getTime();
      const distance = endTime.getTime() - now;

      if (distance < 0) {
        setTimeLeft('ÎNCHEIATĂ');
        clearInterval(timer);
        onEnded?.();
        return;
      }

      const days = Math.floor(distance / (1000 * 60 * 60 * 24));
      const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((distance % (1000 * 60)) / 1000);

      if (days > 0) {
        setTimeLeft(`${days}z ${hours}h ${minutes}m`);
      } else if (hours > 0) {
        setTimeLeft(`${hours}h ${minutes}m ${seconds}s`);
      } else {
        setTimeLeft(`${minutes}m ${seconds}s`);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [endTime]);

  return (
    <Text style={[styles.timerText, timeLeft === 'ÎNCHEIATĂ' && styles.timerEnded]}>
      {timeLeft}
    </Text>
  );
};

const BidItem: React.FC<{ bid: Bid }> = ({ bid }) => (
  <View style={styles.bidItem}>
    <View>
      <Text style={styles.bidAmount}>{formatEUR(bid.amount)}</Text>
      <Text style={styles.bidTime}>
        {bid.timestamp.toLocaleString()}
      </Text>
    </View>
    <Text style={styles.bidUser}>
      #{bid.userId.slice(-6)}
    </Text>
  </View>
);

const AuctionDetailsScreen: React.FC = () => {
  const route = useRoute<RouteProp<RootStackParamList, 'AuctionDetails'>>();
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  const { user } = useAuth();
  const { auctionId } = route.params;
  const { auction, loading: auctionLoading, error: auctionError } = useAuction(auctionId);
  const { bids, loading: bidsLoading } = useBids(auctionId);

  const [bidAmount, setBidAmount] = useState('');
  const [autoBidAmount, setAutoBidAmount] = useState('');
  const [bidding, setBidding] = useState(false);
  const [settingAutoBid, setSettingAutoBid] = useState(false);
  const [auctionEnded, setAuctionEnded] = useState(false);
  const [optimisticPulledBack, setOptimisticPulledBack] = useState(false);

  const isEnded = auctionEnded || (auction && new Date() > auction.endTime);
  const currentBid = auction?.currentBid || auction?.reservePrice || 0;
  const bidIncrement = currentBid < 1000 ? 10 : 50;
  const minBid = Math.max(currentBid + bidIncrement, auction?.reservePrice || 0);

  const isOwner = !!user?.uid && auction?.ownerId === user.uid;
  const isPulledBack = !!auction?.isPulledBack || optimisticPulledBack;
  
  const eligibleForPullback = useMemo(() => {
    if (!auction) return false;
    return isAuctionEligibleForPullbackData(
      {
        ownerId: auction.ownerId,
        status: auction.status,
        winnerId: auction.winnerId,
        isPulledBack: isPulledBack,
      },
      user?.uid,
    );
  }, [auction?.ownerId, auction?.status, auction?.winnerId, isPulledBack, user?.uid]);

  const handleShareAuction = async () => {
    if (!auction) return;
    const url = `https://enumismatica.ro/auction/${auction.id}`;
    const message = `Licitație #${auction.id.slice(-6)} - ${formatEUR(currentBid)}\n${url}`;

    try {
      await Share.share({
        message,
        title: `Licitație #${auction.id.slice(-6)}`,
        url,
      });
    } catch (error) {
      console.error('Failed to share auction:', error);
    }
  };

  const handleBid = async () => {
    if (!user || !auction) return;

    try {
      const amount = parseFloat(bidAmount);
      bidSchema.parse({ amount });
      if (amount < minBid) {
        throw new Error(`Licitația trebuie să fie cel puțin ${formatEUR(minBid)}`);
      }
      setBidding(true);
      await placeBid(auctionId, amount, user.uid);
      setBidAmount('');
      Alert.alert('Succes', 'Licitație plasată cu succes!');
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        Alert.alert('Eroare validare', error.issues[0].message);
      } else {
        Alert.alert('Licitație eșuată', error.message);
      }
    } finally {
      setBidding(false);
    }
  };

  const handleAutoBid = async () => {
    if (!user || !auction) return;

    try {
      const amount = parseFloat(autoBidAmount);
      bidSchema.parse({ amount });
      if (amount < minBid) {
        throw new Error(`Auto-licitarea trebuie să fie cel puțin ${formatEUR(minBid)}`);
      }
      setSettingAutoBid(true);
      await setAutoBid(auctionId, amount, user.uid);
      setAutoBidAmount('');
      Alert.alert('Succes', 'Auto-licitare setată cu succes!');
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        Alert.alert('Eroare validare', error.issues[0].message);
      } else {
        Alert.alert('Auto-licitare eșuată', error.message);
      }
    } finally {
      setSettingAutoBid(false);
    }
  };

  if (auctionLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Se încarcă licitația...</Text>
      </View>
    );
  }

  if (auctionError || !auction) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.errorText}>
          {auctionError || 'Licitație negăsită'}
        </Text>
        <InlineBackButton />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.headerContainer}>
        <InlineBackButton />
        {/* Header */}
        <View style={styles.header}>
          <View style={{ flex: 1 }} />
          <View style={styles.headerActions}>
            <TouchableOpacity
              style={styles.shareButton}
              accessibilityRole="button"
              accessibilityLabel="Distribuie licitația"
              onPress={handleShareAuction}
            >
              <Ionicons name="share-social-outline" size={18} color={colors.primary} />
            </TouchableOpacity>
            <PullbackStatusIndicator isPulledBack={isPulledBack} />
            {eligibleForPullback && isOwner && (
              <PullbackButton
                itemId={auction.id}
                itemType="auction"
                onPullbackSuccess={() => setOptimisticPulledBack(true)}
              />
            )}
            <View style={[
              styles.statusBadge,
              auction.status === 'active' ? styles.statusBadgeActive : styles.statusBadgeEnded
            ]}>
              <Text style={[
                styles.statusText,
                auction.status === 'active' ? styles.statusTextActive : styles.statusTextEnded
              ]}>
                {auction.status.toUpperCase()}
              </Text>
            </View>
          </View>
        </View>

        {/* Auction Title */}
        <Text style={styles.title}>
          Licitație #{auction.id.slice(-6)}
        </Text>

        {/* Current Bid & Timer */}
        <View style={styles.bidInfoCard}>
          <View style={styles.bidInfoRow}>
            <View>
              <Text style={styles.bidLabel}>Licitație Curentă</Text>
              <Text style={styles.bidValue}>{formatEUR(currentBid)}</Text>
            </View>
            <View style={styles.timerContainer}>
              <Text style={styles.bidLabel}>Timp Rămas</Text>
              <CountdownTimer
                endTime={auction.endTime}
                onEnded={() => setAuctionEnded(true)}
              />
            </View>
          </View>

          <View style={styles.bidInfoFooter}>
            <Text style={styles.bidInfoText}>
              Preț Rezervă: {formatEUR(auction.reservePrice)}
            </Text>
            <Text style={styles.bidInfoText}>
              {auction.currentBidderId ? `Licitator: #${auction.currentBidderId.slice(-6)}` : 'Nicio licitație încă'}
            </Text>
          </View>
        </View>

        {/* Bidding Section */}
        {!isEnded && user && !isOwner && (
          <View style={styles.biddingSection}>
            <Text style={styles.sectionTitle}>Plasați Licitația Dvs.</Text>

            {/* Manual Bid */}
            <View style={styles.bidInputSection}>
              <Text style={styles.inputLabel}>
                Licitație minimă: {formatEUR(minBid)}
              </Text>
              <View style={styles.inputRow}>
                <TextInput
                  style={styles.input}
                  placeholder={`Min: ${formatEUR(minBid)}`}
                  placeholderTextColor={colors.textTertiary}
                  value={bidAmount}
                  onChangeText={setBidAmount}
                  keyboardType="numeric"
                />
                <TouchableOpacity
                  style={[styles.bidButton, bidding && styles.bidButtonDisabled]}
                  onPress={handleBid}
                  disabled={bidding}
                >
                  <Text style={styles.bidButtonText}>
                    {bidding ? 'Se procesează...' : 'Licitează'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Auto Bid */}
            <View style={styles.bidInputSection}>
              <Text style={styles.inputLabel}>
                Setați suma maximă pentru auto-licitare
              </Text>
              <View style={styles.inputRow}>
                <TextInput
                  style={styles.input}
                  placeholder={`Auto-licitare max: ${formatEUR(minBid)}`}
                  placeholderTextColor={colors.textTertiary}
                  value={autoBidAmount}
                  onChangeText={setAutoBidAmount}
                  keyboardType="numeric"
                />
                <TouchableOpacity
                  style={[styles.autoBidButton, settingAutoBid && styles.bidButtonDisabled]}
                  onPress={handleAutoBid}
                  disabled={settingAutoBid}
                >
                  <Text style={styles.bidButtonText}>
                    {settingAutoBid ? '...' : 'Auto'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}

        {isEnded && (
          <View style={styles.endedCard}>
            <Text style={styles.endedTitle}>Licitație Încheiată</Text>
            <Text style={styles.endedText}>
              {auction.currentBid && auction.currentBid >= auction.reservePrice
                ? `Vândut pentru ${formatEUR(auction.currentBid)}`
                : 'Nu a îndeplinit prețul rezervă'}
            </Text>
          </View>
        )}

        {!user && !isEnded && (
          <View style={styles.loginPrompt}>
            <Text style={styles.loginPromptText}>
              Autentifică-te pentru a licita
            </Text>
          </View>
        )}

        {/* Bid History */}
        <View style={styles.bidHistorySection}>
          <View style={styles.bidHistoryHeader}>
            <Text style={styles.sectionTitle}>Istoric Licitații</Text>
            <TouchableOpacity
              style={styles.viewAllButton}
              onPress={() => navigation.navigate('BidHistory', { auctionId })}
            >
              <Text style={styles.viewAllButtonText}>Vezi Tot</Text>
            </TouchableOpacity>
          </View>
          {bidsLoading ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : bids.length === 0 ? (
            <Text style={styles.noBidsText}>Nicio licitație încă</Text>
          ) : (
            <FlatList
              data={bids.slice(0, 5)}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => <BidItem bid={item} />}
              scrollEnabled={false}
            />
          )}
        </View>

        {/* Auction Details */}
        <View style={styles.detailsCard}>
          <Text style={styles.sectionTitle}>Detalii Licitație</Text>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Început:</Text>
            <Text style={styles.detailValue}>
              {auction.startTime.toLocaleString()}
            </Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Se termină:</Text>
            <Text style={styles.detailValue}>
              {auction.endTime.toLocaleString()}
            </Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Total Licitații:</Text>
            <Text style={styles.detailValue}>{bids.length}</Text>
          </View>
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#00020d',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#00020d',
    padding: 16,
  },
  loadingText: {
    marginTop: 16,
    color: '#e5e7eb',
    fontSize: 16,
  },
  errorText: {
    color: '#f87171',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 16,
  },
  headerContainer: {
    backgroundColor: 'rgba(0, 2, 13, 0.8)',
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(231, 183, 60, 0.4)',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  shareButton: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: 'rgba(15, 23, 42, 0.7)',
    borderWidth: 1,
    borderColor: 'rgba(231, 183, 60, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  statusBadgeActive: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderColor: 'rgba(16, 185, 129, 0.6)',
  },
  statusBadgeEnded: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderColor: 'rgba(239, 68, 68, 0.6)',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  statusTextActive: {
    color: '#10b981',
  },
  statusTextEnded: {
    color: '#ef4444',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#e7b73c',
    marginBottom: 16,
  },
  bidInfoCard: {
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    padding: 16,
    borderRadius: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(231, 183, 60, 0.3)',
  },
  bidInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  bidLabel: {
    fontSize: 12,
    color: '#94a3b8',
    marginBottom: 4,
  },
  bidValue: {
    fontSize: 28,
    fontWeight: '700',
    color: '#facc6b',
  },
  timerContainer: {
    alignItems: 'flex-end',
  },
  timerText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ef4444',
  },
  timerEnded: {
    color: '#6b7280',
  },
  bidInfoFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  bidInfoText: {
    fontSize: 12,
    color: '#cbd5e1',
  },
  biddingSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#e7b73c',
    marginBottom: 12,
  },
  bidInputSection: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 13,
    color: '#cbd5e1',
    marginBottom: 8,
  },
  inputRow: {
    flexDirection: 'row',
    gap: 8,
  },
  input: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: 'rgba(231, 183, 60, 0.4)',
    borderRadius: 12,
    backgroundColor: 'rgba(15, 23, 42, 0.7)',
    color: '#f9fafb',
    fontSize: 14,
  },
  bidButton: {
    backgroundColor: '#e7b73c',
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 12,
    justifyContent: 'center',
    shadowColor: '#e7b73c',
    shadowOpacity: 0.6,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
    elevation: 4,
  },
  autoBidButton: {
    backgroundColor: '#10b981',
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 12,
    justifyContent: 'center',
  },
  bidButtonDisabled: {
    opacity: 0.6,
  },
  bidButtonText: {
    color: '#000940',
    fontWeight: '600',
    fontSize: 14,
  },
  endedCard: {
    backgroundColor: 'rgba(231, 183, 60, 0.1)',
    padding: 16,
    borderRadius: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(231, 183, 60, 0.4)',
  },
  endedTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#facc6b',
    marginBottom: 8,
  },
  endedText: {
    fontSize: 14,
    color: '#fef3c7',
  },
  loginPrompt: {
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    padding: 16,
    borderRadius: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#475569',
  },
  loginPromptText: {
    color: '#e5e7eb',
    textAlign: 'center',
    fontSize: 14,
  },
  bidHistorySection: {
    marginBottom: 24,
  },
  bidHistoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  viewAllButton: {
    backgroundColor: '#e7b73c',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    shadowColor: '#e7b73c',
    shadowOpacity: 0.6,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
    elevation: 4,
  },
  viewAllButtonText: {
    color: '#000940',
    fontSize: 12,
    fontWeight: '600',
  },
  noBidsText: {
    color: '#94a3b8',
    textAlign: 'center',
    paddingVertical: 16,
    fontSize: 14,
  },
  bidItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  bidAmount: {
    color: '#f9fafb',
    fontWeight: '600',
    fontSize: 16,
  },
  bidTime: {
    color: '#94a3b8',
    fontSize: 12,
    marginTop: 2,
  },
  bidUser: {
    color: '#cbd5e1',
    fontSize: 13,
  },
  detailsCard: {
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(231, 183, 60, 0.3)',
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  detailLabel: {
    color: '#94a3b8',
    fontSize: 14,
  },
  detailValue: {
    color: '#f9fafb',
    fontWeight: '500',
    fontSize: 14,
  },
});

export default AuctionDetailsScreen;
