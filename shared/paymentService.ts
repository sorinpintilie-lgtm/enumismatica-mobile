import { auth, functions } from './firebaseConfig';
import { httpsCallable } from 'firebase/functions';
import { Platform } from 'react-native';

type IapProductRaw = {
  id: string;
  title?: string;
  description?: string;
  price?: string;
};

type IapPurchaseRaw = {
  id: string;
  transactionId?: string | null;
  purchaseToken?: string;
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

/**
 * Safely read a string property from a potentially native Proxy object.
 * expo-iap returns JSI host objects that throw
 * "Exception in HostFunction: Native state unsupported on Proxy"
 * when you access properties directly.
 */
function safeStr(obj: any, key: string): string {
  try {
    const v = obj?.[key];
    return typeof v === 'string' ? v : (v != null ? String(v) : '');
  } catch { return ''; }
}

function getIapModule(): IapModule | null {
  try {
    const mod = require('expo-iap') as IapModule & {
      emitter?: { addListener: (event: string, listener: (...args: any[]) => void) => { remove: () => void } };
    };

    // Bypass expo-iap's normalizePurchasePlatform which accesses native Proxy
    // properties and throws "Exception in HostFunction: Native state unsupported on Proxy".
    if (mod.emitter) {
      const rawEmitter = mod.emitter;
      mod.purchaseUpdatedListener = (listener) =>
        rawEmitter.addListener('purchase-updated', listener);
      mod.purchaseErrorListener = (listener) =>
        rawEmitter.addListener('purchase-error', listener);
    }

    // Wrap requestPurchase to catch Proxy errors from return value normalization
    const origRequestPurchase = mod.requestPurchase;
    mod.requestPurchase = async (params) => {
      try {
        await origRequestPurchase(params);
      } catch (err: any) {
        const msg = String(err?.message || err || '');
        if (msg.includes('Native state') || msg.includes('HostFunction') || msg.includes('Proxy')) {
          // Purchase was initiated; listener will handle the result
          return null;
        }
        throw err;
      }
      return null;
    };

    // Wrap getAvailablePurchases to catch Proxy errors
    const origGetAvailable = mod.getAvailablePurchases;
    mod.getAvailablePurchases = async () => {
      try { return await origGetAvailable(); }
      catch (err: any) {
        const msg = String(err?.message || err || '');
        if (msg.includes('Native state') || msg.includes('HostFunction') || msg.includes('Proxy')) return [];
        throw err;
      }
    };

    return mod;
  } catch (error) {
    console.warn('expo-iap native module is unavailable in this client (Expo Go).', error);
    return null;
  }
}

function isUserCancelledError(error: any, iap: IapModule | null): boolean {
  const code = safeStr(error, 'code');
  if (!code) return false;

  return (
    code === 'E_USER_CANCELLED' ||
    code === 'USER_CANCELLED' ||
    code === iap?.ErrorCode?.UserCancelled
  );
}

// In-App Purchase product IDs
// These must match the products configured in App Store Connect and Google Play Console
export const IAP_PRODUCTS = {
  CREDITS_20: 'ro.enumismatica.credits.20',
  CREDITS_50: 'ro.enumismatica.credits.50',
  CREDITS_100: 'ro.enumismatica.credits.100',
  CREDITS_200: 'ro.enumismatica.credits.200',
};

// Product ID to credits mapping
export const PRODUCT_CREDITS_MAP: Record<string, number> = {
  [IAP_PRODUCTS.CREDITS_20]: 20,
  [IAP_PRODUCTS.CREDITS_50]: 50,
  [IAP_PRODUCTS.CREDITS_100]: 100,
  [IAP_PRODUCTS.CREDITS_200]: 200,
};

// Product ID to price mapping (for display purposes - fallback if store price unavailable)
export const PRODUCT_PRICE_MAP: Record<string, string> = {
  [IAP_PRODUCTS.CREDITS_20]: '20 RON',
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
    const iap = getIapModule();
    if (!iap) {
      return false;
    }

    const result = await iap.initConnection();
    console.log('IAP connection initialized:', result);
    return result;
  } catch (error) {
    console.error('Failed to initialize IAP:', error);
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
  } catch (error) {
    console.error('Failed to end IAP connection:', error);
  }
}

/**
 * Get available products from App Store / Google Play
 */
export async function getIAPProducts(): Promise<IAPProduct[]> {
  const productIds = Object.values(IAP_PRODUCTS);
  const iap = getIapModule();

  if (!iap) {
    return [];
  }
  
  try {
    // fetchProducts returns an array of products.
    // In TestFlight, if only some SKUs exist/are attached, a bulk query can return empty.
    let products = await iap.fetchProducts({ skus: productIds, type: 'in-app' });

    // Retry strategy: query each SKU individually and merge unique results.
    if (!products || products.length === 0) {
      const merged: any[] = [];
      const seen = new Set<string>();

      for (const sku of productIds) {
        try {
          const partial = await iap.fetchProducts({ skus: [sku], type: 'in-app' });
          for (const p of partial) {
            const pid = safeStr(p, 'id');
            if (pid && !seen.has(pid)) {
              seen.add(pid);
              merged.push(p);
            }
          }
        } catch (singleErr) {
          console.warn(`[IAP] SKU not available yet: ${sku}`, singleErr);
        }
      }

      products = merged;
    }
    
    if (!products || products.length === 0) {
      console.warn('No IAP products found. Verify SKUs are attached to current App Store Connect version/TestFlight build.');
      return [];
    }
    
    return products.map((product) => {
      const pid = safeStr(product, 'id');
      const rawPrice = safeStr(product, 'localizedPrice') || safeStr(product, 'displayPrice') || safeStr(product, 'price');
      // Use fallback RON price from our map if store returns garbage floats or empty
      const displayPrice = (rawPrice && !rawPrice.includes('e+') && rawPrice.length < 20)
        ? rawPrice
        : (PRODUCT_PRICE_MAP[pid] || rawPrice || '');
      return {
        productId: pid,
        title: safeStr(product, 'title') || 'Credite eNumismatica',
        description: safeStr(product, 'description') || `${PRODUCT_CREDITS_MAP[pid] || 0} credite`,
        price: displayPrice,
        localizedPrice: displayPrice,
        credits: PRODUCT_CREDITS_MAP[pid] || 0,
      };
    });
  } catch (error) {
    console.error('Failed to get IAP products:', error);
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
      resolve({
        success: false,
        creditsAdded: 0,
        transactionId: null,
        error: 'Achizițiile in-app nu sunt disponibile în Expo Go. Folosește development build.',
      });
      return;
    }

    // Verify product ID
    if (!Object.values(IAP_PRODUCTS).includes(productId)) {
      reject(new Error('ID produs invalid'));
      return;
    }

    const creditsToAdd = PRODUCT_CREDITS_MAP[productId] || 0;
    if (creditsToAdd === 0) {
      reject(new Error('Nu s-a putut determina numărul de credite'));
      return;
    }

    let purchaseSubscription: { remove: () => void } | null = null;
    let errorSubscription: { remove: () => void } | null = null;
    let resolved = false;

    const cleanup = () => {
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
    purchaseSubscription = iap.purchaseUpdatedListener(async (purchase: IapPurchaseRaw) => {
      if (resolved) return;
      
      // Check if this purchase is for our product (safe read from native Proxy)
      const purchaseId = safeStr(purchase, 'id') || safeStr(purchase, 'productId');
      if (purchaseId !== productId) return;
      
      resolved = true;
      cleanup();

      try {
        // Get transaction details (safe reads from native Proxy)
        const transactionId = safeStr(purchase, 'transactionId') || safeStr(purchase, 'originalTransactionIdentifierIOS') || null;
        const purchaseToken = safeStr(purchase, 'purchaseToken') || safeStr(purchase, 'transactionReceipt') || safeStr(purchase, 'verificationResultIOS') || '';

        // Validate receipt with backend
        const validationResult = await validatePurchaseWithBackend(
          productId,
          purchaseToken,
          transactionId,
          Platform.OS
        );

        if (validationResult.success) {
          // Finish the transaction
          try {
            await iap.finishTransaction({ purchase, isConsumable: true });
          } catch (finishError) {
            console.warn('Failed to finish transaction:', finishError);
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
            error: validationResult.error || 'Validarea achiziției a eșuat',
          });
        }
      } catch (error: any) {
        resolve({
          success: false,
          creditsAdded: 0,
          transactionId: null,
          error: error?.message || 'A apărut o eroare la procesarea achiziției',
        });
      }
    });

    // Set up error listener
    errorSubscription = iap.purchaseErrorListener((error) => {
      if (resolved) return;
      
      resolved = true;
      cleanup();

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
          error: safeStr(error, 'message') || 'A apărut o eroare la achiziție',
        });
      }
    });

    // Request purchase - expo-iap API
    iap.requestPurchase({
      request: {
        apple: { sku: productId },
        google: { skus: [productId] },
      },
      type: 'in-app',
    })
      .catch((error: any) => {
        if (resolved) return;
        resolved = true;
        cleanup();
        
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
            error: error?.message || 'A apărut o eroare la achiziție',
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
    await getAuthTokenOrThrow();
    const call = httpsCallable(functions, 'validateIAPPurchaseCallable');
    const result = await call({
      productId,
      purchaseToken,
      transactionId,
      platform,
    });
    return result.data as { success: boolean; creditsAdded: number; error?: string };
  } catch (error: any) {
    console.error('Backend validation error:', error);
    return {
      success: false,
      creditsAdded: 0,
      error: error?.message || 'Eroare la validarea achiziției',
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

    const purchases = await iap.getAvailablePurchases();
    return purchases || [];
  } catch (error) {
    console.error('Failed to get pending purchases:', error);
    return [];
  }
}

/**
 * Restore previous purchases
 */
export async function restorePurchases(): Promise<IAPPurchaseResult[]> {
  try {
    const iap = getIapModule();
    if (!iap) return [];

    const purchases = await iap.getAvailablePurchases();
    const results: IAPPurchaseResult[] = [];

    if (!purchases || purchases.length === 0) {
      return results;
    }

    for (const purchase of purchases) {
      const productId = safeStr(purchase, 'id') || safeStr(purchase, 'productId');
      const purchaseToken = safeStr(purchase, 'purchaseToken') || safeStr(purchase, 'transactionReceipt') || safeStr(purchase, 'verificationResultIOS');
      const transactionId = safeStr(purchase, 'transactionId') || safeStr(purchase, 'originalTransactionIdentifierIOS') || null;

      // Validate with backend
      const validationResult = await validatePurchaseWithBackend(
        productId,
        purchaseToken,
        transactionId,
        Platform.OS
      );

      if (validationResult.success) {
        // Finish the transaction
        try {
          await iap.finishTransaction({ purchase, isConsumable: true });
        } catch (finishError) {
          console.warn('Failed to finish transaction:', finishError);
        }
      }

      results.push({
        success: validationResult.success,
        creditsAdded: validationResult.creditsAdded,
        transactionId,
        error: validationResult.error,
      });
    }

    return results;
  } catch (error: any) {
    console.error('Restore purchases error:', error);
    return [];
  }
}
