import type { Product, Auction } from './types';

/**
 * Pure eligibility helpers (no Firestore reads).
 *
 * These mirror the server-side validation rules used by:
 * - `pullbackProduct()`
 * - `pullbackAuction()`
 */

export function isProductEligibleForPullbackData(
  product: Pick<Product, 'ownerId' | 'isSold' | 'isPulledBack'> | null | undefined,
  userId: string | null | undefined,
): boolean {
  if (!product || !userId) return false;
  return product.ownerId === userId && !product.isSold && !product.isPulledBack;
}

export function isAuctionEligibleForPullbackData(
  auction: Pick<Auction, 'ownerId' | 'status' | 'winnerId' | 'isPulledBack'> | null | undefined,
  userId: string | null | undefined,
): boolean {
  if (!auction || !userId) return false;
  return auction.ownerId === userId && auction.status === 'ended' && !auction.winnerId && !auction.isPulledBack;
}

