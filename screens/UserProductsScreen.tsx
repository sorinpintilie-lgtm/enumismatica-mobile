import React, { useMemo } from 'react';
import { View, Text, ScrollView, ActivityIndicator, TouchableOpacity, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { useAuth } from '../context/AuthContext';
import { useProducts } from '../hooks/useProducts';
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
});

const UserProductsScreen: React.FC = () => {
  const { user, loading: authLoading } = useAuth();
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();

  const userId = user?.uid || null;

  const { products, loading: productsLoading, error: productsError } = useProducts({
    ownerId: userId || undefined,
    pageSize: 200,
    listingType: 'direct',
    loadAllAtOnce: true,
  });

  const activeProducts = useMemo(() => products, [products]);

  const loading = authLoading || productsLoading;

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.subtitle, { marginTop: 12 }]}>Se încarcă produsele tale...</Text>
      </View>
    );
  }

  if (!user) {
    return (
      <View style={styles.center}>
        <Text style={[styles.title, { fontSize: 18, textAlign: 'center', marginBottom: 12 }]}>
          Produsele tale sunt disponibile doar pentru utilizatori autentificați.
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

  if (productsError) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorTitle}>Eroare la încărcarea produselor</Text>
        <Text style={styles.errorText}>{productsError}</Text>
      </View>
    );
  }

  const isEmpty = activeProducts.length === 0;

  return (
    <ScrollView style={styles.screen}>
      <View style={styles.content}>
        <InlineBackButton />
        <View style={{ marginTop: 12, marginBottom: 16 }}>
          <View style={styles.headerRow}>
            <View style={{ flex: 1, marginRight: 12 }}>
              <Text style={styles.title}>Produsele mele</Text>
              <Text style={styles.subtitle}>
                {isEmpty
                  ? 'Nu ai încă produse active listate în magazin.'
                  : `Ai ${activeProducts.length} ${activeProducts.length === 1 ? 'produs activ' : 'produse active'} în magazin.`}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() => navigation.navigate('NewListing', { listingType: 'direct' })}
            >
              <Text style={styles.primaryButtonText}>Adaugă</Text>
            </TouchableOpacity>
          </View>
        </View>

        {isEmpty ? (
          <View style={styles.card}>
            <Text style={[styles.mutedText, { marginBottom: 12 }]}>Nu ai produse active încă.</Text>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() => navigation.navigate('NewListing', { listingType: 'direct' })}
            >
              <Text style={styles.primaryButtonText}>Listează un produs</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View>
            {activeProducts.map((product) => (
              <View key={product.id} style={styles.card}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <View style={{ flex: 1, marginRight: 10 }}>
                    <Text style={styles.cardTitle} numberOfLines={2}>
                      {product.name}
                    </Text>
                    <Text style={styles.mutedText}>
                      {product.country ? `${product.country}${product.year ? ` • ${product.year}` : ''}` : 'Produs listat'}
                    </Text>
                  </View>
                  <Text style={styles.priceText}>{formatEUR(product.price)}</Text>
                </View>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <TouchableOpacity
                    style={[styles.secondaryButton, { flex: 1 }]}
                    onPress={() => navigation.navigate('ProductDetails', { productId: product.id })}
                  >
                    <Text style={styles.secondaryButtonText}>Vezi produsul</Text>
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

export default UserProductsScreen;
