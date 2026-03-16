import React, { useCallback, useState, useEffect, useRef } from 'react';
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
  Platform,
} from 'react-native';
import { useIAP, type Purchase } from 'expo-iap';
import { isUserCancelledError } from 'expo-iap/build/utils/errorMapping';
import type { PurchaseError } from 'expo-iap/build/utils/errorMapping';
import InlineBackButton from '../components/InlineBackButton';
import { colors } from '../styles/sharedStyles';
import { useAuth } from '../context/AuthContext';
import { getUserCredits } from '@shared/creditService';
import {
  IAP_PRODUCT_SKUS,
  PRODUCT_CREDITS_MAP,
  PRODUCT_PRICE_MAP,
  validatePurchaseWithBackend,
} from '@shared/paymentService';

const BuyCreditsScreen: React.FC = () => {
  const { user } = useAuth();

  // -----------------------------------------------------------------------
  // Local state
  // -----------------------------------------------------------------------
  const [selectedSku, setSelectedSku] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [currentCredits, setCurrentCredits] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [iapError, setIapError] = useState<string | null>(null);

  // Track whether we're currently processing a purchase to avoid double-handling
  const processingRef = useRef(false);

  // -----------------------------------------------------------------------
  // Credit balance
  // -----------------------------------------------------------------------
  const refreshCredits = useCallback(async () => {
    if (!user?.uid) return;
    const credits = await getUserCredits(user.uid);
    setCurrentCredits(credits);
  }, [user?.uid]);

  useEffect(() => {
    refreshCredits().catch((err) => {
      console.warn('[BuyCreditsScreen] Failed to fetch credits:', err);
    });
  }, [refreshCredits]);

  // -----------------------------------------------------------------------
  // Purchase success handler — called by useIAP's onPurchaseSuccess
  // -----------------------------------------------------------------------
  const handlePurchaseSuccess = useCallback(
    async (purchase: Purchase) => {
      // Guard against double processing
      if (processingRef.current) return;
      processingRef.current = true;
      setProcessing(true);

      try {
        // Safely extract fields — purchase object may be a native Proxy
        // so we use try/catch on each field access
        const getField = (key: string): string => {
          try { return (purchase as any)?.[key] ?? ''; } catch { return ''; }
        };

        // Use the currently-selected SKU as primary product ID since it's reliable
        const productId = selectedSku || getField('productId') || getField('id');
        const transactionId = getField('transactionId') || getField('originalTransactionIdentifierIOS') || null;
        const purchaseToken = getField('purchaseToken') || getField('transactionReceipt') || getField('verificationResultIOS') || getField('id');

        // Ensure we always have at least a purchaseToken or transactionId so the
        // Cloud Function can create a unique payment record
        const effectiveToken = purchaseToken || transactionId || `${productId}_${Date.now()}`;
        const effectiveTransactionId = transactionId || null;

        console.log('[BuyCreditsScreen] Purchase success, validating…', {
          productId,
          hasTransactionId: !!transactionId,
          hasPurchaseToken: !!purchaseToken,
        });

        // 1. Validate with backend Cloud Function — this credits the user
        const validation = await validatePurchaseWithBackend(
          productId,
          effectiveToken,
          effectiveTransactionId,
          Platform.OS,
        );

        if (validation.success) {
          // 2. Finish (consume) the transaction so it can be purchased again
          try {
            // Use the iap ref to call finishTransaction
            await finishTransactionRef.current?.(purchase);
          } catch (finishErr) {
            console.warn('[BuyCreditsScreen] finishTransaction error:', finishErr);
          }

          await refreshCredits();
          Alert.alert(
            'Succes',
            `Plata a fost procesată cu succes! S-au adăugat ${validation.creditsAdded} credite.`,
          );
        } else {
          Alert.alert(
            'Eroare',
            validation.error || 'Validarea achiziției a eșuat.',
          );
        }
      } catch (error: any) {
        console.error('[BuyCreditsScreen] Purchase processing error:', error);
        Alert.alert(
          'Eroare',
          error?.message || 'A apărut o eroare la procesarea achiziției.',
        );
      } finally {
        setProcessing(false);
        processingRef.current = false;
      }
    },
    [refreshCredits],
  );

  // -----------------------------------------------------------------------
  // Purchase error handler — called by useIAP's onPurchaseError
  // -----------------------------------------------------------------------
  const handlePurchaseError = useCallback((error: PurchaseError) => {
    setProcessing(false);
    processingRef.current = false;

    if (isUserCancelledError(error)) {
      // User tapped Cancel — no need to show an error
      console.log('[BuyCreditsScreen] Purchase cancelled by user');
      return;
    }

    console.error('[BuyCreditsScreen] Purchase error:', error);
    Alert.alert(
      'Eroare',
      error?.message || 'A apărut o eroare la achiziție.',
    );
  }, []);

  // -----------------------------------------------------------------------
  // useIAP hook — manages connection, listeners, and state
  // -----------------------------------------------------------------------
  const {
    connected,
    products,
    fetchProducts,
    requestPurchase,
    finishTransaction,
    restorePurchases,
  } = useIAP({
    onPurchaseSuccess: handlePurchaseSuccess,
    onPurchaseError: handlePurchaseError,
  });

  // Keep a ref to finishTransaction so the callback can use it
  const finishTransactionRef = useRef<((purchase: Purchase) => Promise<void>) | undefined>(undefined);
  useEffect(() => {
    finishTransactionRef.current = (purchase: Purchase) =>
      finishTransaction({ purchase, isConsumable: true });
  }, [finishTransaction]);

  // -----------------------------------------------------------------------
  // Fetch products once connected
  // -----------------------------------------------------------------------
  useEffect(() => {
    if (!connected) return;

    (async () => {
      try {
        await fetchProducts({ skus: IAP_PRODUCT_SKUS, type: 'in-app' });
        setIapError(null);
      } catch (err) {
        console.error('[BuyCreditsScreen] fetchProducts error:', err);
        setIapError(
          'Nu s-au putut încărca produsele. Asigură-te că ai conexiune la internet și încearcă din nou.',
        );
      } finally {
        setLoading(false);
      }
    })();
  }, [connected, fetchProducts]);

  // If not connected after mount, stop loading after timeout
  useEffect(() => {
    if (connected) return;
    const timeout = setTimeout(() => {
      if (!connected) {
        setLoading(false);
        setIapError(
          'Nu s-a putut conecta la magazin. Asigură-te că ai conexiune la internet și încearcă din nou.',
        );
      }
    }, 10_000);
    return () => clearTimeout(timeout);
  }, [connected]);

  // When products arrive, select the first one
  useEffect(() => {
    if (products.length > 0 && !selectedSku) {
      setSelectedSku(products[0].id);
      setLoading(false);
    }
  }, [products, selectedSku]);

  // -----------------------------------------------------------------------
  // UI actions
  // -----------------------------------------------------------------------
  const handlePurchase = async () => {
    if (!selectedSku) {
      Alert.alert('Eroare', 'Selectează un pachet de credite.');
      return;
    }

    try {
      setProcessing(true);
      processingRef.current = false; // will be set true in onPurchaseSuccess
      Keyboard.dismiss();

      await requestPurchase({
        request: {
          apple: { sku: selectedSku },
          google: { skus: [selectedSku] },
        },
        type: 'in-app',
      });
      // The result is handled asynchronously via onPurchaseSuccess / onPurchaseError
    } catch (err: any) {
      // requestPurchase may throw for Proxy / native errors; the listener
      // should still fire, so only show an alert if it's NOT a Proxy error.
      const msg = String(err?.message || err || '');
      if (
        msg.includes('Native state') ||
        msg.includes('HostFunction') ||
        msg.includes('Proxy')
      ) {
        console.warn('[BuyCreditsScreen] Suppressed Proxy error from requestPurchase — listener will handle result');
        return;
      }
      console.error('[BuyCreditsScreen] requestPurchase error:', err);
      setProcessing(false);
      processingRef.current = false;
      Alert.alert('Eroare', err?.message || 'Nu s-a putut iniția achiziția.');
    }
  };

  const handleRestorePurchases = async () => {
    try {
      setProcessing(true);
      await restorePurchases();
      // restorePurchases updates availablePurchases state internally;
      // for consumables there is typically nothing to restore.
      Alert.alert('Info', 'Restaurarea achizițiilor s-a efectuat. Consumabilele nu pot fi restaurate.');
    } catch (err: any) {
      console.error('[BuyCreditsScreen] Restore error:', err);
      Alert.alert('Eroare', err?.message || 'Nu s-au putut restaura achizițiile.');
    } finally {
      setProcessing(false);
    }
  };

  // -----------------------------------------------------------------------
  // Derived display data
  // -----------------------------------------------------------------------

  // Build display items from store products, or fallback from constants
  const displayItems = products.length > 0
    ? products
        .filter((p) => IAP_PRODUCT_SKUS.includes(p.id))
        .sort((a, b) => (PRODUCT_CREDITS_MAP[a.id] ?? 0) - (PRODUCT_CREDITS_MAP[b.id] ?? 0))
        .map((p) => ({
          sku: p.id,
          credits: PRODUCT_CREDITS_MAP[p.id] ?? 0,
          price: p.displayPrice || (p as any).localizedPrice || PRODUCT_PRICE_MAP[p.id] || '',
        }))
    : IAP_PRODUCT_SKUS.map((sku) => ({
        sku,
        credits: PRODUCT_CREDITS_MAP[sku] ?? 0,
        price: PRODUCT_PRICE_MAP[sku] ?? '',
      }));

  const selectedItem = displayItems.find((i) => i.sku === selectedSku);
  const estimatedCredits = selectedItem?.credits ?? 0;

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------
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
        <Text style={styles.subtitle}>
          Creditele sunt folosite pentru promovări, listări și licitații.
        </Text>

        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>Cum funcționează creditele</Text>
          <Text style={styles.infoLine}>• 1 RON = 1 credit</Text>
          <Text style={styles.infoLine}>
            • Creditele sunt adăugate după confirmarea plății
          </Text>
          <Text style={styles.infoLine}>
            • Pot fi folosite pentru boost, promovare și publicare
          </Text>
        </View>

        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>Sold curent</Text>
          <Text style={styles.balanceValue}>
            {currentCredits === null ? '—' : `${currentCredits} credite`}
          </Text>
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
              {displayItems.map((item) => {
                const selected = selectedSku === item.sku;
                return (
                  <TouchableOpacity
                    key={item.sku}
                    style={[
                      styles.productButton,
                      selected && styles.productButtonSelected,
                      iapError && products.length === 0 && styles.productButtonDisabled,
                    ]}
                    onPress={() => setSelectedSku(item.sku)}
                  >
                    <Text
                      style={[
                        styles.productCredits,
                        selected && styles.productCreditsSelected,
                      ]}
                    >
                      {item.credits} credite
                    </Text>
                    <Text
                      style={[
                        styles.productPrice,
                        selected && styles.productPriceSelected,
                      ]}
                    >
                      {item.price}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {iapError ? <Text style={styles.errorText}>{iapError}</Text> : null}

            {selectedItem && (
              <Text style={styles.estimateText}>
                Vei primi {estimatedCredits} credite după confirmarea plății.
              </Text>
            )}
          </View>
        )}

        {!loading && displayItems.length > 0 && (
          <TouchableOpacity
            style={[styles.primaryButton, processing && styles.primaryButtonDisabled]}
            disabled={processing}
            onPress={handlePurchase}
          >
            {processing ? (
              <ActivityIndicator color={colors.primaryText} />
            ) : (
              <Text style={styles.primaryButtonText}>
                Cumpără {estimatedCredits} credite
              </Text>
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
      </ScrollView>
    </TouchableWithoutFeedback>
  );
};

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

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
  errorText: {
    color: colors.error,
    textAlign: 'center',
    fontSize: 14,
    marginTop: 8,
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
});

export default BuyCreditsScreen;
