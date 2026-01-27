import type { Product, Auction } from '../types';

/**
 * Normalize product data to ensure consistent field structure.
 * This handles legacy data and field naming inconsistencies.
 */
export function normalizeProductData(product: Partial<Product> & { mintLocation?: string }): Partial<Product> {
  const normalized = { ...product };

  // Fix mintLocation -> mintMark field naming inconsistency
  if (product.mintLocation && !product.mintMark) {
    normalized.mintMark = product.mintLocation;
    delete normalized.mintLocation;
  }

  // Ensure images is always an array
  if (!Array.isArray(normalized.images)) {
    normalized.images = [];
  }

  // Ensure imagesRaw is always an array
  if (!Array.isArray(normalized.imagesRaw)) {
    normalized.imagesRaw = [];
  }

  // Ensure image processing status is set if images are being processed
  if ((normalized.imagesRaw?.length ?? 0) > 0 && !normalized.imageProcessingStatus) {
    normalized.imageProcessingStatus = 'processing';
  }

  // Set processing status to 'done' if we have images but no processing status
  if ((normalized.images?.length ?? 0) > 0 && !normalized.imageProcessingStatus) {
    normalized.imageProcessingStatus = 'done';
  }

  return normalized;
}

/**
 * Normalize auction data to ensure consistent field structure.
 */
export function normalizeAuctionData(auction: Partial<Auction>): Partial<Auction> {
  const normalized = { ...auction };

  // Ensure status is valid
  if (!normalized.status) {
    normalized.status = 'pending';
  }

  // Ensure numeric fields are numbers
  if (normalized.reservePrice !== undefined && typeof normalized.reservePrice !== 'number') {
    normalized.reservePrice = Number(normalized.reservePrice) || 0;
  }

  if (normalized.buyNowPrice !== undefined && normalized.buyNowPrice !== null && typeof normalized.buyNowPrice !== 'number') {
    normalized.buyNowPrice = Number(normalized.buyNowPrice) || null;
  }

  if (normalized.currentBid !== undefined && normalized.currentBid !== null && typeof normalized.currentBid !== 'number') {
    normalized.currentBid = Number(normalized.currentBid) || null;
  }

  return normalized;
}

/**
 * Check if an image URL is valid and accessible.
 * Returns true if the URL appears to be a valid Firebase Storage URL.
 */
export function isValidImageUrl(url: string | null | undefined): boolean {
  if (!url || typeof url !== 'string') {
    return false;
  }

  // Check for empty strings or whitespace
  const trimmed = url.trim();
  if (!trimmed) {
    return false;
  }

  // Check for valid Firebase Storage URL pattern
  const firebaseStoragePattern = /^https:\/\/firebasestorage\.googleapis\.com\/v\d+\/b\/[^/]+\/o\/.+/;
  if (!firebaseStoragePattern.test(trimmed)) {
    return false;
  }

  return true;
}

/**
 * Validate and filter an array of image URLs.
 * Removes invalid, empty, or broken URLs.
 */
export function validateImageUrls(urls: (string | null | undefined)[]): string[] {
  return urls
    .filter((url): url is string => isValidImageUrl(url))
    .map(url => url.trim());
}

/**
 * Get the primary image URL for display, with fallback support.
 * Returns the first valid image URL or null if none exist.
 */
export function getPrimaryImageUrl(product: Partial<Product> & { mintLocation?: string } | null | undefined): string | null {
  if (!product) {
    return null;
  }

  const normalized = normalizeProductData(product);

  // Try images first
  if (normalized.images && normalized.images.length > 0) {
    const validImages = validateImageUrls(normalized.images);
    if (validImages.length > 0) {
      return validImages[0];
    }
  }

  // Fall back to imagesRaw
  if (normalized.imagesRaw && normalized.imagesRaw.length > 0) {
    const validRawImages = validateImageUrls(normalized.imagesRaw);
    if (validRawImages.length > 0) {
      return validRawImages[0];
    }
  }

  return null;
}

/**
 * Get all valid display images for a product.
 * Merges images and imagesRaw, filters invalid URLs.
 */
export function getAllDisplayImages(product: Partial<Product> & { mintLocation?: string } | null | undefined): string[] {
  if (!product) {
    return [];
  }

  const normalized = normalizeProductData(product);

  // Merge images and imagesRaw by index
  const allImages: string[] = [];
  const maxLength = Math.max(
    normalized.images?.length ?? 0,
    normalized.imagesRaw?.length ?? 0
  );

  for (let i = 0; i < maxLength; i++) {
    const primary = normalized.images?.[i];
    const fallback = normalized.imagesRaw?.[i];

    // Use primary if valid, otherwise use fallback
    if (isValidImageUrl(primary)) {
      allImages.push(primary.trim());
    } else if (isValidImageUrl(fallback)) {
      allImages.push(fallback.trim());
    }
  }

  return allImages;
}

/**
 * Check if a product has any valid images.
 */
export function hasValidImages(product: Partial<Product> & { mintLocation?: string } | null | undefined): boolean {
  return getAllDisplayImages(product).length > 0;
}

/**
 * Get image count for a product.
 */
export function getImageCount(product: Partial<Product> & { mintLocation?: string } | null | undefined): number {
  return getAllDisplayImages(product).length;
}

/**
 * Determine the processing status based on image fields.
 */
export function getImageProcessingStatus(product: Partial<Product> & { mintLocation?: string } | null | undefined): 'processing' | 'done' | 'error' | null {
  if (!product) {
    return null;
  }

  // If explicitly set, return that value
  if (product.imageProcessingStatus) {
    return product.imageProcessingStatus;
  }

  // If we have imagesRaw with processing metadata, infer status
  if (product.imagesRaw && product.imagesRaw.length > 0) {
    if (product.images && product.images.length > 0) {
      return 'done';
    }
    return 'processing';
  }

  // If we have images, assume done
  if (product.images && product.images.length > 0) {
    return 'done';
  }

  return null;
}

/**
 * Create a placeholder image URL for missing images.
 * Uses a data URI for a simple placeholder.
 */
export function getPlaceholderImageUrl(width: number = 400, height: number = 300): string {
  // Create a simple SVG placeholder as data URI
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      <rect fill="#1e293b" width="${width}" height="${height}"/>
      <text fill="#64748b" font-family="Arial, sans-serif" font-size="14" text-anchor="middle" x="${width/2}" y="${height/2}">
        Fără imagine
      </text>
    </svg>
  `;
  
  const encoded = encodeURIComponent(svg.trim());
  return `data:image/svg+xml;charset=utf-8,${encoded}`;
}

/**
 * Build an image URL with width parameter for Firebase Storage.
 * Handles URLs with or without existing query parameters.
 */
export function buildImageUrlWithWidth(url: string | null | undefined, width: number): string {
  if (!url || !isValidImageUrl(url)) {
    return '';
  }

  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}width=${width}`;
}

/**
 * Get a display-ready image URL with fallback to placeholder.
 */
export function getDisplayImageUrl(
  product: Partial<Product> & { mintLocation?: string } | null | undefined,
  width: number = 400
): string {
  const primaryUrl = getPrimaryImageUrl(product);
  
  if (primaryUrl) {
    return buildImageUrlWithWidth(primaryUrl, width);
  }

  return getPlaceholderImageUrl(width);
}

/**
 * Check if auction has associated product with valid images.
 */
export function auctionHasProductImages(auction: Partial<Auction>, product: Partial<Product> & { mintLocation?: string } | null | undefined): boolean {
  return auction?.productId !== undefined && hasValidImages(product);
}
