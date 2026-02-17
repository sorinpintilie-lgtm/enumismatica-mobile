import { auth, functions } from './firebaseConfig';
import { httpsCallable } from 'firebase/functions';
import {
  initConnection,
  endConnection,
  fetchProducts,
  requestPurchase,
  finishTransaction,
  getAvailablePurchases,
  purchaseUpdatedListener,
  purchaseErrorListener,
  Product,
  Purchase,
  ErrorCode,
} from 'expo-iap';
import { Platform } from 'react-native';

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
    const result = await initConnection();
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
    await endConnection();
  } catch (error) {
    console.error('Failed to end IAP connection:', error);
  }
}

/**
 * Get available products from App Store / Google Play
 */
export async function getIAPProducts(): Promise<IAPProduct[]> {
  const productIds = Object.values(IAP_PRODUCTS);
  
  try {
    // fetchProducts returns an array of products.
    // In TestFlight, if only some SKUs exist/are attached, a bulk query can return empty.
    let products = await fetchProducts({ skus: productIds, type: 'in-app' });

    // Retry strategy: query each SKU individually and merge unique results.
    if (!products || products.length === 0) {
      const merged: any[] = [];
      const seen = new Set<string>();

      for (const sku of productIds) {
        try {
          const partial = await fetchProducts({ skus: [sku], type: 'in-app' });
          for (const p of partial) {
            if (!seen.has(p.id)) {
              seen.add(p.id);
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
    
    return products.map((product) => ({
      productId: product.id,
      title: product.title || 'Credite eNumismatica',
      description: product.description || `${PRODUCT_CREDITS_MAP[product.id] || 0} credite`,
      price: String(product.price || ''),
      localizedPrice: String(product.price || ''), // localizedPrice may not exist on all platforms
      credits: PRODUCT_CREDITS_MAP[product.id] || 0,
    }));
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
    purchaseSubscription = purchaseUpdatedListener(async (purchase: Purchase) => {
      if (resolved) return;
      
      // Check if this purchase is for our product
      if (purchase.id !== productId) return;
      
      resolved = true;
      cleanup();

      try {
        // Get transaction details
        const transactionId = purchase.transactionId || null;
        const purchaseToken = purchase.purchaseToken || '';

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
            await finishTransaction({ purchase, isConsumable: true });
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
    errorSubscription = purchaseErrorListener((error) => {
      if (resolved) return;
      
      resolved = true;
      cleanup();

      // Handle user cancellation
      if (error.code === ErrorCode.UserCancelled) {
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
          error: error.message || 'A apărut o eroare la achiziție',
        });
      }
    });

    // Request purchase - expo-iap API
    requestPurchase({
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
        if (error.code === ErrorCode.UserCancelled) {
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
export async function getPendingPurchases(): Promise<Purchase[]> {
  try {
    const purchases = await getAvailablePurchases();
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
    const purchases = await getAvailablePurchases();
    const results: IAPPurchaseResult[] = [];

    if (!purchases || purchases.length === 0) {
      return results;
    }

    for (const purchase of purchases) {
      const productId = purchase.id;
      const purchaseToken = purchase.purchaseToken;
      const transactionId = purchase.transactionId || null;

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
          await finishTransaction({ purchase, isConsumable: true });
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
