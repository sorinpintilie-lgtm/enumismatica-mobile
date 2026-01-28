import React, { useMemo } from 'react';
import { View, Text, ScrollView, ActivityIndicator, TouchableOpacity, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { useAuth } from '../context/AuthContext';
import { useAuctions } from '../hooks/useAuctions';
import { RootStackParamList } from '../navigationTypes';
import { colors } from '../styles/sharedStyles';
import { formatEUR } from '../utils/currency';
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
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.4)',
  },
  statusText: {
    fontSize: 11,
    color: colors.success,
    fontWeight: '700',
  },
});

const UserAuctionsScreen: React.FC = () => {
  const { user, loading: authLoading } = useAuth();
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();

  const userId = user?.uid || null;

  const { auctions, loading: auctionsLoading, error: auctionsError } = useAuctions('active', 200);

  const userAuctions = useMemo(
    () =>
      auctions.filter(
        (auction) =>
          auction.status === 'active' &&
          (auction.ownerId === userId || auction.currentBidderId === userId)
      ),
    [auctions, userId]
  );

  const loading = authLoading || auctionsLoading;

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.subtitle, { marginTop: 12 }]}>Se încarcă licitațiile tale...</Text>
      </View>
    );
  }

  if (!user) {
    return (
      <View style={styles.center}>
        <Text style={[styles.title, { fontSize: 18, textAlign: 'center', marginBottom: 12 }]}>
          Licitațiile tale sunt disponibile doar pentru utilizatori autentificați.
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

  if (auctionsError) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorTitle}>Eroare la încărcarea licitațiilor</Text>
        <Text style={styles.errorText}>{auctionsError}</Text>
      </View>
    );
  }

  const isEmpty = userAuctions.length === 0;

  return (
    <ScrollView style={styles.screen}>
      <View style={styles.content}>
        <InlineBackButton />
        <View style={{ marginTop: 12, marginBottom: 16 }}>
          <View style={styles.headerRow}>
            <View style={{ flex: 1, marginRight: 12 }}>
              <Text style={styles.title}>Licitațiile mele</Text>
              <Text style={styles.subtitle}>
                {isEmpty
                  ? 'Nu ai licitații active în acest moment.'
                  : `Ai ${userAuctions.length} ${userAuctions.length === 1 ? 'licitație activă' : 'licitații active'}.`}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() => navigation.navigate('NewListing', { listingType: 'auction' })}
            >
              <Text style={styles.primaryButtonText}>Adaugă</Text>
            </TouchableOpacity>
          </View>
        </View>

        {isEmpty ? (
          <View style={styles.card}>
            <Text style={[styles.mutedText, { marginBottom: 12 }]}>Nu ai licitații active încă.</Text>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() => navigation.navigate('NewListing', { listingType: 'auction' })}
            >
              <Text style={styles.primaryButtonText}>Creează o licitație</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View>
            {userAuctions.map((auction) => (
              <View key={auction.id} style={styles.card}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <View style={{ flex: 1, marginRight: 10 }}>
                    <Text style={styles.cardTitle}>Licitatie #{auction.id.slice(-6)}</Text>
                    <Text style={styles.mutedText}>ID produs: {auction.productId}</Text>
                  </View>
                  <View style={styles.statusPill}>
                    <Text style={styles.statusText}>Activă</Text>
                  </View>
                </View>
                <Text style={[styles.mutedText, { marginBottom: 8 }]}>Ofertă curentă</Text>
                <Text style={styles.priceText}>
                  {formatEUR(auction.currentBid || auction.reservePrice)}
                </Text>
                <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
                  <TouchableOpacity
                    style={[styles.secondaryButton, { flex: 1 }]}
                    onPress={() => navigation.navigate('AuctionDetails', { auctionId: auction.id })}
                  >
                    <Text style={styles.secondaryButtonText}>Vezi licitația</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}
      </View>
    </ScrollView>
  );
};

export default UserAuctionsScreen;
