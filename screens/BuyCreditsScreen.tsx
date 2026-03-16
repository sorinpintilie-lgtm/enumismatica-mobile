import React, { useCallback, useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  StyleSheet, 
  ScrollView, 
  Alert, 
  ActivityIndicator,
  TouchableWithoutFeedback,
  Keyboard,
} from 'react-native';
import InlineBackButton from '../components/InlineBackButton';
import { colors } from '../styles/sharedStyles';
import { useAuth } from '../context/AuthContext';
import { getUserCredits } from '@shared/creditService';
import {
  initIAP,
  endIAP,
  getIAPProducts,
  purchaseCredits,
  restorePurchases,
  IAP_PRODUCTS,
  PRODUCT_CREDITS_MAP,
  PRODUCT_PRICE_MAP,
  type IAPProduct,
  type IAPPurchaseResult,
} from '@shared/paymentService';

const BuyCreditsScreen: React.FC = () => {
  const { user } = useAuth();
  
  const [products, setProducts] = useState<IAPProduct[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [currentCredits, setCurrentCredits] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastPurchaseResult, setLastPurchaseResult] = useState<IAPPurchaseResult | null>(null);
  const [iapError, setIapError] = useState<string | null>(null);

  const refreshCredits = useCallback(async () => {
    if (!user?.uid) return;
    const credits = await getUserCredits(user.uid);
    setCurrentCredits(credits);
  }, [user?.uid]);

  // Initialize IAP and load products
  useEffect(() => {
    const init = async () => {
      try {
        setLoading(true);
        const initialized = await initIAP();
        if (initialized) {
          const iapProducts = await getIAPProducts();
          setProducts(iapProducts);

          if (iapProducts.length === 0) {
            setIapError('Nu s-au putut încărca produsele. Asigură-te că ai conexiune la internet și încearcă din nou.');
          } else {
            setIapError(null);
          }

          // Select first product by default
          if (iapProducts.length > 0) {
            setSelectedProductId(iapProducts[0].productId);
          }
        } else {
          setIapError('Nu s-au putut încărca produsele. Asigură-te că ai conexiune la internet și încearcă din nou.');
        }
      } catch (error) {
        console.error('Failed to initialize IAP:', error);
        setIapError('Nu s-au putut încărca produsele. Asigură-te că ai conexiune la internet și încearcă din nou.');
      } finally {
        setLoading(false);
      }
    };

    init();

    return () => {
      endIAP();
    };
  }, []);

  // Load current credits
  useEffect(() => {
    refreshCredits().catch((err) => {
      console.warn('[BuyCreditsScreen] Failed to fetch credits:', err);
    });
  }, [refreshCredits]);

  const handlePurchase = async () => {
    if (!selectedProductId) {
      Alert.alert('Eroare', 'Selectează un pachet de credite.');
      return;
    }

    try {
      setProcessing(true);
      Keyboard.dismiss();

      const result = await purchaseCredits(selectedProductId);
      setLastPurchaseResult(result);

      if (result.success) {
        await refreshCredits();
        Alert.alert(
          'Succes',
          `Plata a fost procesată cu succes! S-au adăugat ${result.creditsAdded} credite.`
        );
      } else {
        Alert.alert(
          'Eroare',
          result.error || 'Nu s-a putut procesa plata. Încearcă din nou.'
        );
      }
    } catch (err: any) {
      console.error('Purchase error:', err);
      Alert.alert('Eroare', err?.message || 'Nu s-a putut procesa plata.');
    } finally {
      setProcessing(false);
    }
  };

  const handleRestorePurchases = async () => {
    try {
      setProcessing(true);
      const results = await restorePurchases();
      
      if (results.length === 0) {
        Alert.alert('Info', 'Nu există achiziții de restaurat.');
      } else {
        const successful = results.filter(r => r.success);
        if (successful.length > 0) {
          await refreshCredits();
          const totalCredits = successful.reduce((sum, r) => sum + r.creditsAdded, 0);
          Alert.alert('Succes', `S-au restaurat ${totalCredits} credite.`);
        } else {
          Alert.alert('Info', 'Nu s-au putut restaura achiziții.');
        }
      }
    } catch (err: any) {
      console.error('Restore error:', err);
      Alert.alert('Eroare', err?.message || 'Nu s-au putut restaura achizițiile.');
    } finally {
      setProcessing(false);
    }
  };

  const fallbackProducts: IAPProduct[] = Object.values(IAP_PRODUCTS).map((productId) => ({
    productId,
    title: 'Credite eNumismatica',
    description: `${PRODUCT_CREDITS_MAP[productId] || 0} credite`,
    price: PRODUCT_PRICE_MAP[productId] || '',
    localizedPrice: PRODUCT_PRICE_MAP[productId] || '',
    credits: PRODUCT_CREDITS_MAP[productId] || 0,
  }));

  const displayedProducts = products.length > 0 ? products : fallbackProducts;
  const selectedProduct = displayedProducts.find(p => p.productId === selectedProductId);
  const estimatedCredits = selectedProduct?.credits || 0;

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <ScrollView 
        style={styles.container} 
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        <InlineBackButton />

        <Text style={styles.title}>Cumpărare credite</Text>
        <Text style={styles.subtitle}>Creditele sunt folosite pentru promovări, listări și licitații.</Text>

        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>Cum funcționează creditele</Text>
          <Text style={styles.infoLine}>• 1 RON = 1 credit</Text>
          <Text style={styles.infoLine}>• Creditele sunt adăugate după confirmarea plății</Text>
          <Text style={styles.infoLine}>• Pot fi folosite pentru boost, promovare și publicare</Text>
        </View>

        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>Sold curent</Text>
          <Text style={styles.balanceValue}>{currentCredits === null ? '—' : `${currentCredits} credite`}</Text>
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>Se încarcă produsele...</Text>
          </View>
        ) : (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Alege pachetul de credite</Text>
            <View style={styles.productGrid}>
              {displayedProducts.map((product) => {
                const selected = selectedProductId === product.productId;
                return (
                  <TouchableOpacity
                    key={product.productId}
                    style={[
                      styles.productButton,
                      selected && styles.productButtonSelected,
                      iapError && products.length === 0 && styles.productButtonDisabled,
                    ]}
                    onPress={() => setSelectedProductId(product.productId)}
                  >
                    <Text style={[styles.productCredits, selected && styles.productCreditsSelected]}>
                      {product.credits} credite
                    </Text>
                    <Text style={[styles.productPrice, selected && styles.productPriceSelected]}>
                      {product.localizedPrice}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {iapError ? (
              <Text style={styles.errorText}>{iapError}</Text>
            ) : null}
            
            {selectedProduct && (
              <Text style={styles.estimateText}>
                Vei primi {estimatedCredits} credite după confirmarea plății.
              </Text>
            )}
          </View>
        )}

        {!loading && displayedProducts.length > 0 && (
          <TouchableOpacity 
            style={[styles.primaryButton, processing && styles.primaryButtonDisabled]} 
            disabled={processing} 
            onPress={handlePurchase}
          >
            {processing ? (
              <ActivityIndicator color={colors.primaryText} />
            ) : (
              <Text style={styles.primaryButtonText}>Cumpără {estimatedCredits} credite</Text>
            )}
          </TouchableOpacity>
        )}

        <TouchableOpacity 
          style={styles.restoreButton} 
          disabled={processing} 
          onPress={handleRestorePurchases}
        >
          <Text style={styles.restoreButtonText}>Restaurează achizițiile</Text>
        </TouchableOpacity>

        {lastPurchaseResult ? (
          <View style={styles.statusCard}>
            <Text style={styles.statusTitle}>Ultima tranzacție</Text>
            <Text style={styles.statusLine}>
              Status: {lastPurchaseResult.success ? 'Succes' : 'Eșuat'}
            </Text>
            <Text style={styles.statusLine}>
              Credite: {lastPurchaseResult.creditsAdded}
            </Text>
            {lastPurchaseResult.transactionId && (
              <Text style={styles.statusLine}>
                ID: {lastPurchaseResult.transactionId}
              </Text>
            )}
            {lastPurchaseResult.error && (
              <Text style={styles.statusError}>
                Eroare: {lastPurchaseResult.error}
              </Text>
            )}
          </View>
        ) : null}
      </ScrollView>
    </TouchableWithoutFeedback>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: 16,
    gap: 14,
    paddingBottom: 96,
  },
  title: {
    color: colors.textPrimary,
    fontSize: 22,
    fontWeight: '800',
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: 13,
  },
  infoCard: {
    borderWidth: 1,
    borderColor: 'rgba(231, 183, 60, 0.35)',
    backgroundColor: 'rgba(231, 183, 60, 0.08)',
    borderRadius: 14,
    padding: 14,
    gap: 6,
  },
  infoTitle: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  },
  infoLine: {
    color: colors.textSecondary,
    fontSize: 12,
  },
  balanceCard: {
    borderWidth: 1,
    borderColor: colors.borderColor,
    backgroundColor: colors.cardBackground,
    borderRadius: 14,
    padding: 14,
  },
  balanceLabel: {
    color: colors.textSecondary,
    fontSize: 12,
  },
  balanceValue: {
    color: colors.primary,
    fontSize: 24,
    fontWeight: '800',
    marginTop: 4,
  },
  section: {
    borderWidth: 1,
    borderColor: colors.borderColor,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 14,
    padding: 14,
  },
  sectionTitle: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 10,
  },
  productGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  productButton: {
    borderWidth: 1,
    borderColor: colors.borderColor,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: 'rgba(255,255,255,0.03)',
    minWidth: '45%',
    alignItems: 'center',
  },
  productButtonSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  productCredits: {
    color: colors.textPrimary,
    fontWeight: '700',
    fontSize: 16,
  },
  productCreditsSelected: {
    color: colors.primaryText,
  },
  productPrice: {
    color: colors.textSecondary,
    fontSize: 14,
    marginTop: 4,
  },
  productPriceSelected: {
    color: colors.primaryText,
  },
  productButtonDisabled: {
    opacity: 0.6,
  },
  estimateText: {
    marginTop: 12,
    color: colors.textSecondary,
    fontSize: 12,
  },
  loadingContainer: {
    padding: 24,
    alignItems: 'center',
  },
  loadingText: {
    color: colors.textSecondary,
    marginTop: 12,
    fontSize: 14,
  },
  errorContainer: {
    padding: 24,
    alignItems: 'center',
  },
  errorText: {
    color: colors.error,
    textAlign: 'center',
    fontSize: 14,
  },
  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryButtonDisabled: {
    opacity: 0.6,
  },
  primaryButtonText: {
    color: colors.primaryText,
    fontWeight: '700',
    fontSize: 16,
  },
  restoreButton: {
    backgroundColor: 'transparent',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.borderColor,
  },
  restoreButtonText: {
    color: colors.textSecondary,
    fontWeight: '600',
    fontSize: 14,
  },
  statusCard: {
    borderWidth: 1,
    borderColor: colors.borderColor,
    borderRadius: 12,
    padding: 12,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  statusTitle: {
    color: colors.textPrimary,
    fontWeight: '700',
    marginBottom: 8,
  },
  statusLine: {
    color: colors.textSecondary,
    fontSize: 12,
  },
  statusError: {
    color: colors.error,
    fontSize: 12,
    marginTop: 4,
  },
});

export default BuyCreditsScreen;
