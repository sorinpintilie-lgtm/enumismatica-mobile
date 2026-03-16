import { auth, functions } from './firebaseConfig';
import { httpsCallable } from 'firebase/functions';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

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

// Product ID to price mapping (fallback if store price unavailable)
export const PRODUCT_PRICE_MAP: Record<string, string> = {
  [IAP_PRODUCTS.CREDITS_20]: '20 RON',
  [IAP_PRODUCTS.CREDITS_50]: '50 RON',
  [IAP_PRODUCTS.CREDITS_100]: '100 RON',
  [IAP_PRODUCTS.CREDITS_200]: '200 RON',
};

// All product SKUs as an array, for passing to expo-iap fetchProducts
export const IAP_PRODUCT_SKUS: string[] = Object.values(IAP_PRODUCTS);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface IAPPurchaseResult {
  success: boolean;
  creditsAdded: number;
  transactionId: string | null;
  error?: string;
}

// ---------------------------------------------------------------------------
// Backend validation
// ---------------------------------------------------------------------------

/**
 * Validate an IAP purchase with the Cloud Function backend.
 * The backend credits the user and returns success/failure.
 */
export async function validatePurchaseWithBackend(
  productId: string,
  purchaseToken: string,
  transactionId: string | null,
  platform: string,
): Promise<{ success: boolean; creditsAdded: number; error?: string }> {
  try {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      throw new Error('Trebuie să fii autentificat pentru a cumpăra credite.');
    }
    // Ensure a fresh token is available for the callable
    await currentUser.getIdToken();

    const call = httpsCallable(functions, 'validateIAPPurchaseCallable');
    const result = await call({
      productId,
      purchaseToken,
      transactionId,
      platform,
    });
    return result.data as { success: boolean; creditsAdded: number; error?: string };
  } catch (error: any) {
    console.error('[paymentService] Backend validation error:', error);
    return {
      success: false,
      creditsAdded: 0,
      error: error?.message || 'Eroare la validarea achiziției',
    };
  }
}
