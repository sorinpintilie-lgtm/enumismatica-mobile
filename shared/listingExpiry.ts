import { Timestamp } from 'firebase/firestore';

// Existing approved direct listings without explicit listingExpiresAt
// should start counting from this rollout moment.
export const LISTING_EXPIRY_ROLLOUT_AT = new Date('2026-02-12T00:00:00Z');
const LISTING_WINDOW_DAYS = 30;

export function toDateSafe(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (value instanceof Timestamp) return value.toDate();
  if (typeof (value as any)?.toDate === 'function') {
    try {
      return (value as any).toDate();
    } catch {
      return null;
    }
  }
  const parsed = new Date(value as any);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function getEffectiveListingExpiryDate(product: any): Date | null {
  const explicit = toDateSafe(product?.listingExpiresAt);
  if (explicit) return explicit;

  // Backward compatibility for already-live products before this feature.
  if (product?.listingType === 'direct' && product?.status === 'approved' && product?.isSold !== true) {
    const fallback = new Date(LISTING_EXPIRY_ROLLOUT_AT);
    fallback.setDate(fallback.getDate() + LISTING_WINDOW_DAYS);
    return fallback;
  }

  return null;
}

export function isDirectListingExpired(product: any, now: Date = new Date()): boolean {
  if (!product || product.listingType !== 'direct') return false;
  if (product.status !== 'approved') return false;
  if (product.isSold === true) return false;

  const expiresAt = getEffectiveListingExpiryDate(product);
  if (!expiresAt) return false;
  return expiresAt.getTime() <= now.getTime();
}

