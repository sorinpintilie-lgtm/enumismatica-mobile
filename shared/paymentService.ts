import { auth, functions } from './firebaseConfig';
import { httpsCallable } from 'firebase/functions';
import { Platform } from 'react-native';

type IapProductRaw = {
  id: string;
  productId?: string;
  title?: string;
  description?: string;
  price?: string;
  localizedPrice?: string;
  displayPrice?: string;
};

type IapPurchaseRaw = {
  id: string;
  productId?: string;
  transactionId?: string | null;
  originalTransactionIdentifierIOS?: string | null;
  purchaseToken?: string;
  transactionReceipt?: string;
  verificationResultIOS?: string;
};

type IapSubscription = { remove: () => void };

type IapModule = {
  initConnection: () => Promise<boolean>;
  endConnection: () => Promise<void>;
  fetchProducts: (params: { skus: string[]; type: 'in-app' | 'subs' }) => Promise<IapProductRaw[]>;
  requestPurchase: (params: {
    request: { apple: { sku: string }; google: { skus: string[] } };
    type: 'in-app' | 'subs';
  }) => Promise<unknown>;
  finishTransaction: (params: { purchase: IapPurchaseRaw; isConsumable: boolean }) => Promise<void>;
  getAvailablePurchases: () => Promise<IapPurchaseRaw[]>;
  purchaseUpdatedListener: (listener: (purchase: IapPurchaseRaw) => void | Promise<void>) => IapSubscription;
  purchaseErrorListener: (listener: (error: any) => void) => IapSubscription;
  ErrorCode?: {
    UserCancelled?: string;
  };
};

function getIapModule(): IapModule | null {
  try {
    return require('expo-iap') as IapModule;
  } catch (error) {
    console.warn('expo-iap native module is unavailable in this client (Expo Go).', error);
    return null;
  }
}

function isUserCancelledError(error: any, iap: IapModule | null): boolean {
  const code = safeReadString(error, 'code');
  if (!code) return false;

  return (
    code === 'E_USER_CANCELLED' ||
    code === 'USER_CANCELLED' ||
    code === iap?.ErrorCode?.UserCancelled
  );
}

function safeReadString(target: any, key: string): string | undefined {
  try {
    if (!target || typeof target !== 'object') return undefined;
    const value = (target as Record<string, unknown>)[key];
    return typeof value === 'string' ? value : undefined;
  } catch {
    return undefined;
  }
}

function safeReadAny(target: any, key: string): any {
  try {
    if (!target || typeof target !== 'object') return undefined;
    return (target as Record<string, unknown>)[key];
  } catch {
    return undefined;
  }
}

function safeToString(value: any): string {
  try {
    return typeof value === 'string' ? value : String(value);
  } catch {
    return '[unreadable-native-error]';
  }
}

/**
 * Safely extract all fields from a native IAP purchase proxy object.
 * Every property access is wrapped in try/catch to avoid
 * "Exception in HostFunction: Native state unsupported on Proxy".
 */
function safeExtractPurchase(purchase: any): {
  id: string;
  productId: string;
  transactionId: string | null;
  originalTransactionIdentifierIOS: string | null;
  purchaseToken: string;
  transactionReceipt: string;
  verificationResultIOS: string;
} {
  return {
    id: safeReadString(purchase, 'id') || '',
    productId: safeReadString(purchase, 'productId') || '',
    transactionId: safeReadString(purchase, 'transactionId') || null,
    originalTransactionIdentifierIOS: safeReadString(purchase, 'originalTransactionIdentifierIOS') || null,
    purchaseToken: safeReadString(purchase, 'purchaseToken') || '',
    transactionReceipt: safeReadString(purchase, 'transactionReceipt') || '',
    verificationResultIOS: safeReadString(purchase, 'verificationResultIOS') || '',
  };
}

/**
 * Safely extract fields from a native IAP product proxy object.
 */
function safeExtractProduct(product: any): IapProductRaw {
  return {
    id: safeReadString(product, 'id') || '',
    productId: safeReadString(product, 'productId') || '',
    title: safeReadString(product, 'title') || '',
    description: safeReadString(product, 'description') || '',
    price: safeReadString(product, 'price') || '',
    localizedPrice: safeReadString(product, 'localizedPrice') || '',
    displayPrice: safeReadString(product, 'displayPrice') || '',
  };
}

// In-App Purchase product IDs
// These must match the products configured in App Store Connect and Google Play Console
export const IAP_PRODUCTS = {
  CREDITS_20: 'ro.enumismatica.credits.20',
  CREDITS_25: 'ro.enumismatica.credits.25',
  CREDITS_50: 'ro.enumismatica.credits.50',
  CREDITS_100: 'ro.enumismatica.credits.100',
  CREDITS_200: 'ro.enumismatica.credits.200',
};

const IAP_PRODUCT_ALIASES: Record<string, string[]> = {
  [IAP_PRODUCTS.CREDITS_20]: [
    IAP_PRODUCTS.CREDITS_20,
    'ro.recordtrust.enumismatica.credits.20',
  ],
  [IAP_PRODUCTS.CREDITS_25]: [
    IAP_PRODUCTS.CREDITS_25,
    'ro.recordtrust.enumismatica.credits.25',
  ],
  [IAP_PRODUCTS.CREDITS_50]: [
    IAP_PRODUCTS.CREDITS_50,
    'ro.recordtrust.enumismatica.credits.50',
  ],
  [IAP_PRODUCTS.CREDITS_100]: [
    IAP_PRODUCTS.CREDITS_100,
    'ro.recordtrust.enumismatica.credits.100',
  ],
  [IAP_PRODUCTS.CREDITS_200]: [
    IAP_PRODUCTS.CREDITS_200,
    'ro.recordtrust.enumismatica.credits.200',
  ],
};

const SUPPORTED_IAP_PRODUCT_IDS = new Set(
  Object.values(IAP_PRODUCT_ALIASES).flatMap((aliases) => aliases)
);

const CANONICAL_PRODUCT_BY_ANY_ID = Object.entries(IAP_PRODUCT_ALIASES).reduce(
  (acc, [canonicalId, aliases]) => {
    aliases.forEach((id) => {
      acc[id] = canonicalId;
    });
    return acc;
  },
  {} as Record<string, string>
);

function toCanonicalProductId(productId: string | null | undefined): string | null {
  if (!productId) return null;
  return CANONICAL_PRODUCT_BY_ANY_ID[productId] || null;
}

// Product ID to credits mapping
export const PRODUCT_CREDITS_MAP: Record<string, number> = {
  [IAP_PRODUCTS.CREDITS_20]: 20,
  [IAP_PRODUCTS.CREDITS_25]: 25,
  [IAP_PRODUCTS.CREDITS_50]: 50,
  [IAP_PRODUCTS.CREDITS_100]: 100,
  [IAP_PRODUCTS.CREDITS_200]: 200,
};

// Product ID to price mapping (for display purposes - fallback if store price unavailable)
export const PRODUCT_PRICE_MAP: Record<string, string> = {
  [IAP_PRODUCTS.CREDITS_20]: '20 RON',
  [IAP_PRODUCTS.CREDITS_25]: '25 RON',
  [IAP_PRODUCTS.CREDITS_50]: '50 RON',
  [IAP_PRODUCTS.CREDITS_100]: '100 RON',
  [IAP_PRODUCTS.CREDITS_200]: '200 RON',
};

export interface IAPProduct {
  productId: string;
  title: string;
  description: string;
  price: string;
  localizedPrice: string;
  credits: number;
}

export interface IAPPurchaseResult {
  success: boolean;
  creditsAdded: number;
  transactionId: string | null;
  error?: string;
}

export interface IAPDiagnosticsEntry {
  timestamp: string;
  stage: string;
  message: string;
  details?: Record<string, unknown>;
}

function sanitizeError(error: any): Record<string, unknown> {
  if (!error) return { type: 'unknown' };

  const message = safeReadString(error, 'message') || safeToString(error);
  const code = safeReadString(error, 'code');
  const domain = safeReadString(error, 'domain');

  // expo-iap can surface native proxy/host objects on errors.
  // Accessing or JSON-stringifying them may throw runtime errors such as:
  // "Exception in HostFunction: Native state unsupported on Proxy".
  // Keep diagnostics strictly to primitive-safe fields.
  let userInfo: string | undefined;
  try {
    if (error && typeof error === 'object') {
      const rawUserInfo = (error as Record<string, unknown>).userInfo;

      if (rawUserInfo && typeof rawUserInfo === 'object') {
        const safeEntries = Object.entries(rawUserInfo as Record<string, unknown>)
          .map(([key, value]) => {
            const valueType = typeof value;
            if (value == null || valueType === 'string' || valueType === 'number' || valueType === 'boolean') {
              return [key, value] as const;
            }
            return [key, `[${valueType}]`] as const;
          });
        userInfo = JSON.stringify(Object.fromEntries(safeEntries)).slice(0, 1200);
      }
    }
  } catch {
    userInfo = undefined;
  }

  return {
    message,
    code,
    domain,
    userInfo,
  };
}

function pushIapDiagnostic(_stage: string, _message: string, _details?: Record<string, unknown>): void {}

export function getIAPDiagnostics(): IAPDiagnosticsEntry[] {
  return [];
}

export function clearIAPDiagnostics(): void {
  // Diagnostics intentionally disabled in production UX flow.
}

function toUserFacingPurchaseError(message?: string): string {
  const normalized = (message || '').toLowerCase();
  if (normalized.includes('anulat') || normalized.includes('cancel')) {
    return 'Achiziția a fost anulată';
  }
  return 'Nu s-a putut procesa achiziția. Încearcă din nou.';
}

function toDisplayPrice(localizedPrice: string, canonicalProductId: string): string {
  const fallbackPrice = PRODUCT_PRICE_MAP[canonicalProductId] || localizedPrice;
  const normalized = (localizedPrice || '').trim();

  if (!normalized) return fallbackPrice;

  // Sandbox/TestFlight accounts are often tied to a USD storefront and may return
  // "$" even when the app communicates in RON credits. Show configured RON fallback
  // in that case to keep package pricing consistent in the UI.
  const lower = normalized.toLowerCase();
  const looksUsd = normalized.includes('$') || lower.includes('usd');

  return looksUsd ? fallbackPrice : normalized;
}

async function getAuthTokenOrThrow(): Promise<string> {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error('Trebuie să fii autentificat pentru a cumpăra credite.');
  }
  return currentUser.getIdToken();
}

/**
 * Initialize IAP connection
 */
export async function initIAP(): Promise<boolean> {
  try {
    pushIapDiagnostic('init:start', 'Initializing IAP connection', {
      platform: Platform.OS,
    });

    const iap = getIapModule();
    if (!iap) {
      pushIapDiagnostic('init:module-missing', 'expo-iap module unavailable');
      return false;
    }

    const result = await iap.initConnection();
    pushIapDiagnostic('init:result', 'IAP connection initialized', {
      result,
    });
    return result;
  } catch (error) {
    pushIapDiagnostic('init:error', 'Failed to initialize IAP', sanitizeError(error));
    return false;
  }
}

/**
 * End IAP connection
 */
export async function endIAP(): Promise<void> {
  try {
    const iap = getIapModule();
    if (!iap) return;

    await iap.endConnection();
  } catch {}
}

/**
 * Get available products from App Store / Google Play
 */
export async function getIAPProducts(): Promise<IAPProduct[]> {
  const productIds = Array.from(SUPPORTED_IAP_PRODUCT_IDS);
  const iap = getIapModule();

  if (!iap) {
    pushIapDiagnostic('products:module-missing', 'expo-iap module unavailable');
    return [];
  }

  try {
    pushIapDiagnostic('products:fetch:start', 'Fetching IAP products (bulk)', {
      requestedSkus: productIds,
      requestedCount: productIds.length,
    });

    // fetchProducts returns an array of products.
    // In TestFlight, if only some SKUs exist/are attached, a bulk query can return empty.
    let rawProducts = await iap.fetchProducts({ skus: productIds, type: 'in-app' });

    // Safely extract all product data from native proxy objects immediately
    let products: IapProductRaw[] = (rawProducts || []).map(safeExtractProduct);

    pushIapDiagnostic('products:fetch:bulk-result', 'Bulk fetch completed', {
      receivedCount: products.length,
      receivedIds: products.map((p) => p.id || p.productId || 'unknown'),
    });

    // Retry strategy: query each SKU individually and merge unique results.
    if (products.length === 0) {
      const merged: IapProductRaw[] = [];
      const seen = new Set<string>();

      for (const sku of productIds) {
        try {
          const rawPartial = await iap.fetchProducts({ skus: [sku], type: 'in-app' });
          const partial = (rawPartial || []).map(safeExtractProduct);
          pushIapDiagnostic('products:fetch:single-result', 'Single SKU fetch completed', {
            sku,
            receivedCount: partial.length,
            receivedIds: partial.map((p) => p.id || p.productId || 'unknown'),
          });

          for (const p of partial) {
            const id = p.id || p.productId || '';
            if (id && !seen.has(id)) {
              seen.add(id);
              merged.push(p);
            }
          }
        } catch (singleErr) {
          pushIapDiagnostic('products:fetch:single-error', `SKU not available yet: ${sku}`, {
            sku,
            error: sanitizeError(singleErr),
          });
        }
      }

      products = merged;
    }

    if (products.length === 0) {
      pushIapDiagnostic('products:empty', 'No IAP products found after retry strategy', {
        requestedSkus: productIds,
      });
      return [];
    }

    const mapped = products
      .map((product) => {
        const rawId = product.id || product.productId;
        const canonicalProductId = toCanonicalProductId(rawId);

        if (!rawId || !canonicalProductId) {
          pushIapDiagnostic('products:unknown-product', 'Unknown product returned by store', {
            rawId: rawId || null,
            title: product.title || null,
          });
          return null;
        }

        const rawLocalizedPrice = String(
          product.localizedPrice || product.displayPrice || product.price || ''
        ).trim();
        const displayPrice = toDisplayPrice(rawLocalizedPrice, canonicalProductId);

        return {
          productId: rawId,
          title: product.title || 'Credite eNumismatica',
          description:
            product.description || `${PRODUCT_CREDITS_MAP[canonicalProductId] || 0} credite`,
          price: displayPrice,
          localizedPrice: displayPrice,
          credits: PRODUCT_CREDITS_MAP[canonicalProductId] || 0,
          canonicalProductId,
        };
      })
      .filter((item): item is (IAPProduct & { canonicalProductId: string }) => !!item);

    const seenCanonical = new Set<string>();
    const uniqueByCreditsPackage: IAPProduct[] = [];

    for (const item of mapped) {
      if (seenCanonical.has(item.canonicalProductId)) continue;
      seenCanonical.add(item.canonicalProductId);
      uniqueByCreditsPackage.push({
        productId: item.productId,
        title: item.title,
        description: item.description,
        price: item.price,
        localizedPrice: item.localizedPrice,
        credits: item.credits,
      });
    }

    pushIapDiagnostic('products:success', 'IAP products mapped successfully', {
      returnedCount: uniqueByCreditsPackage.length,
      returnedIds: uniqueByCreditsPackage.map((p) => p.productId),
    });

    return uniqueByCreditsPackage;
  } catch (error) {
    pushIapDiagnostic('products:error', 'Failed to fetch IAP products', sanitizeError(error));
    return [];
  }
}

/**
 * Purchase credits via In-App Purchase
 * Returns a promise that resolves when the purchase flow completes
 */
export function purchaseCredits(productId: string): Promise<IAPPurchaseResult> {
  return new Promise((resolve, reject) => {
    const iap = getIapModule();
    if (!iap) {
      pushIapDiagnostic('purchase:module-missing', 'expo-iap module unavailable');
      resolve({
        success: false,
        creditsAdded: 0,
        transactionId: null,
        error: 'Achizițiile in-app nu sunt disponibile în Expo Go. Folosește development build.',
      });
      return;
    }

    // Verify product ID
    const canonicalProductId = toCanonicalProductId(productId);
    if (!canonicalProductId) {
      pushIapDiagnostic('purchase:invalid-product', 'Invalid productId passed to purchaseCredits', {
        productId,
      });
      reject(new Error('ID produs invalid'));
      return;
    }

    const creditsToAdd = PRODUCT_CREDITS_MAP[canonicalProductId] || 0;
    if (creditsToAdd === 0) {
      pushIapDiagnostic('purchase:no-credits-map', 'Credits mapping missing for canonical product', {
        productId,
        canonicalProductId,
      });
      reject(new Error('Nu s-a putut determina numărul de credite'));
      return;
    }

    pushIapDiagnostic('purchase:start', 'Starting purchase flow', {
      productId,
      canonicalProductId,
      creditsToAdd,
      platform: Platform.OS,
    });

    let purchaseSubscription: { remove: () => void } | null = null;
    let errorSubscription: { remove: () => void } | null = null;
    let timeoutHandle: ReturnType<typeof setTimeout> | null = null;
    let resolved = false;

    const cleanup = () => {
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
        timeoutHandle = null;
      }
      if (purchaseSubscription) {
        purchaseSubscription.remove();
        purchaseSubscription = null;
      }
      if (errorSubscription) {
        errorSubscription.remove();
        errorSubscription = null;
      }
    };

    // Set up purchase update listener
    purchaseSubscription = iap.purchaseUpdatedListener(async (rawPurchase: IapPurchaseRaw) => {
      if (resolved) return;

      // Immediately extract all data from the native proxy into plain JS values
      // to avoid "Exception in HostFunction: Native state unsupported on Proxy"
      const purchase = safeExtractPurchase(rawPurchase);

      const incomingRawId = purchase.id || purchase.productId;
      // Check if this purchase is for our product
      const purchaseProductId = toCanonicalProductId(incomingRawId);
      if (purchaseProductId !== canonicalProductId) {
        pushIapDiagnostic('purchase:update:ignored', 'Purchase update ignored for different SKU', {
          incomingRawId: incomingRawId || null,
          purchaseProductId,
          expectedCanonicalProductId: canonicalProductId,
        });
        return;
      }

      resolved = true;
      cleanup();

      try {
        // Get transaction details (already safely extracted)
        const transactionId = purchase.transactionId || purchase.originalTransactionIdentifierIOS || null;
        const purchaseToken =
          purchase.purchaseToken ||
          purchase.transactionReceipt ||
          purchase.verificationResultIOS ||
          transactionId ||
          '';

        pushIapDiagnostic('purchase:update:matched', 'Purchase update matched selected SKU', {
          incomingRawId: incomingRawId || null,
          canonicalProductId,
          hasTransactionId: !!transactionId,
          hasPurchaseToken: !!purchaseToken,
          tokenLength: purchaseToken.length,
        });

        // Validate receipt with backend
        const validationResult = await validatePurchaseWithBackend(
          canonicalProductId,
          purchaseToken,
          transactionId,
          Platform.OS
        );

        pushIapDiagnostic('purchase:validation:result', 'Backend validation result received', {
          success: validationResult.success,
          creditsAdded: validationResult.creditsAdded,
          error: validationResult.error || null,
        });

        if (validationResult.success) {
          // Finish the transaction — pass the ORIGINAL native object, not our extracted copy
          try {
            await iap.finishTransaction({ purchase: rawPurchase, isConsumable: true });
            pushIapDiagnostic('purchase:finish:success', 'Transaction finished successfully');
          } catch (finishError) {
            pushIapDiagnostic('purchase:finish:error', 'Failed to finish transaction', {
              error: sanitizeError(finishError),
            });
          }

          resolve({
            success: true,
            creditsAdded: validationResult.creditsAdded,
            transactionId,
          });
        } else {
          resolve({
            success: false,
            creditsAdded: 0,
            transactionId,
            error: toUserFacingPurchaseError(validationResult.error),
          });
        }
      } catch (error: any) {
        pushIapDiagnostic('purchase:update:error', 'Error while processing purchase update', {
          error: sanitizeError(error),
        });
        resolve({
          success: false,
          creditsAdded: 0,
          transactionId: null,
          error: toUserFacingPurchaseError(safeReadString(error, 'message')),
        });
      }
    });

    // Set up error listener
    errorSubscription = iap.purchaseErrorListener((error) => {
      if (resolved) return;

      resolved = true;
      cleanup();

      pushIapDiagnostic('purchase:error-listener', 'Purchase error listener fired', {
        error: sanitizeError(error),
        isUserCancelled: isUserCancelledError(error, iap),
      });

      // Handle user cancellation
      if (isUserCancelledError(error, iap)) {
        resolve({
          success: false,
          creditsAdded: 0,
          transactionId: null,
          error: 'Achiziția a fost anulată',
        });
      } else {
        resolve({
          success: false,
          creditsAdded: 0,
          transactionId: null,
          error: toUserFacingPurchaseError(safeReadString(error, 'message')),
        });
      }
    });

    timeoutHandle = setTimeout(() => {
      if (resolved) return;
      resolved = true;
      cleanup();
      pushIapDiagnostic('purchase:timeout', 'Purchase flow timed out waiting for callbacks', {
        productId,
        canonicalProductId,
      });
      resolve({
        success: false,
        creditsAdded: 0,
        transactionId: null,
        error:
          'Achiziția a expirat înainte de confirmare. Verifică conexiunea și contul Sandbox/App Store, apoi încearcă din nou.',
      });
    }, 90_000);

    // Request purchase - expo-iap API
    iap.requestPurchase({
      request: {
        apple: { sku: productId },
        google: { skus: [productId] },
      },
      type: 'in-app',
    })
      .then(() => {
        pushIapDiagnostic('purchase:request:started', 'requestPurchase accepted by native bridge', {
          productId,
        });
      })
      .catch((error: any) => {
        if (resolved) return;
        resolved = true;
        cleanup();

        pushIapDiagnostic('purchase:request:error', 'requestPurchase rejected before listener update', {
          error: sanitizeError(error),
          isUserCancelled: isUserCancelledError(error, iap),
        });

        // Handle user cancellation
        if (isUserCancelledError(error, iap)) {
          resolve({
            success: false,
            creditsAdded: 0,
            transactionId: null,
            error: 'Achiziția a fost anulată',
          });
        } else {
          resolve({
            success: false,
            creditsAdded: 0,
            transactionId: null,
            error: toUserFacingPurchaseError(safeReadString(error, 'message')),
          });
        }
      });
  });
}

/**
 * Validate purchase with backend
 */
async function validatePurchaseWithBackend(
  productId: string,
  purchaseToken: string,
  transactionId: string | null,
  platform: string
): Promise<{ success: boolean; creditsAdded: number; error?: string }> {
  try {
    pushIapDiagnostic('validation:start', 'Validating purchase with backend', {
      productId,
      platform,
      hasTransactionId: !!transactionId,
      hasPurchaseToken: !!purchaseToken,
      purchaseTokenLength: purchaseToken?.length || 0,
    });

    await getAuthTokenOrThrow();
    const call = httpsCallable(functions, 'validateIAPPurchaseCallable');
    const result = await call({
      productId,
      purchaseToken,
      transactionId,
      platform,
    });

    pushIapDiagnostic('validation:success', 'Backend validation callable returned', {
      productId,
      platform,
      result: result.data as Record<string, unknown>,
    });

    return result.data as { success: boolean; creditsAdded: number; error?: string };
  } catch (error: any) {
    pushIapDiagnostic('validation:error', 'Backend validation error', {
      productId,
      platform,
      error: sanitizeError(error),
    });
    return {
      success: false,
      creditsAdded: 0,
      error: 'Nu s-a putut valida achiziția. Încearcă din nou.',
    };
  }
}

/**
 * Get pending purchases (for restoration)
 */
export async function getPendingPurchases(): Promise<IapPurchaseRaw[]> {
  try {
    const iap = getIapModule();
    if (!iap) return [];

    const rawPurchases = await iap.getAvailablePurchases();
    // Safely extract from native proxy objects
    return (rawPurchases || []).map((p) => safeExtractPurchase(p));
  } catch (error) {
    return [];
  }
}

/**
 * Restore previous purchases
 */
export async function restorePurchases(): Promise<IAPPurchaseResult[]> {
  try {
    pushIapDiagnostic('restore:start', 'Restoring purchases');

    const iap = getIapModule();
    if (!iap) {
      pushIapDiagnostic('restore:module-missing', 'expo-iap module unavailable');
      return [];
    }

    const rawPurchases = await iap.getAvailablePurchases();
    const results: IAPPurchaseResult[] = [];

    pushIapDiagnostic('restore:available', 'Loaded available purchases', {
      count: rawPurchases?.length || 0,
    });

    if (!rawPurchases || rawPurchases.length === 0) {
      return results;
    }

    for (let i = 0; i < rawPurchases.length; i++) {
      const rawPurchase = rawPurchases[i];
      // Safely extract all data from native proxy immediately
      const purchase = safeExtractPurchase(rawPurchase);

      const productId = purchase.id || purchase.productId;
      const canonicalProductId = toCanonicalProductId(productId);
      if (!canonicalProductId) {
        pushIapDiagnostic('restore:skip-unknown', 'Skipping unknown restored product', {
          productId: productId || null,
        });
        continue;
      }

      const transactionId = purchase.transactionId || purchase.originalTransactionIdentifierIOS || null;
      const purchaseToken =
        purchase.purchaseToken ||
        purchase.transactionReceipt ||
        purchase.verificationResultIOS ||
        transactionId ||
        '';

      // Validate with backend
      const validationResult = await validatePurchaseWithBackend(
        canonicalProductId,
        purchaseToken,
        transactionId,
        Platform.OS
      );

      if (validationResult.success) {
        // Finish the transaction — pass the ORIGINAL native object
        try {
          await iap.finishTransaction({ purchase: rawPurchase, isConsumable: true });
        } catch (finishError) {
          pushIapDiagnostic('restore:finish:error', 'Failed to finish restored transaction', {
            error: sanitizeError(finishError),
          });
        }
      }

      results.push({
        success: validationResult.success,
        creditsAdded: validationResult.creditsAdded,
        transactionId,
        error: validationResult.error,
      });
    }

    pushIapDiagnostic('restore:done', 'Restore flow finished', {
      resultCount: results.length,
      successfulCount: results.filter((r) => r.success).length,
    });

    return results;
  } catch (error: any) {
    pushIapDiagnostic('restore:error', 'Restore purchases error', {
      error: sanitizeError(error),
    });
    return [];
  }
}
