import { useState, useEffect } from 'react';
import { getSiteAsset } from '../../shared/siteAssetService';
import { SiteAsset } from '../../shared/types';

// In-memory cache so we only hit Firestore once per asset name per session.
// This is especially important for above-the-fold assets like the logo
// and homepage hero image, which are used in multiple components.
const assetCache: Record<string, SiteAsset | null> = {};
const inflightRequests: Record<string, Promise<SiteAsset | null>> = {};

/**
 * Custom hook to fetch a site asset by name in mobile app.
 *
 * Optimizations:
 * - Uses Firestore doc-by-ID under the hood (via getSiteAsset)
 * - Caches the value in-memory so repeated calls (logo, hero) are instant
 * - Deduplicates concurrent fetches with an inflight request map
 *
 * @param name - The unique name of the asset (e.g., 'logo', 'homepage-hero')
 * @returns Object containing the asset data, loading state, and error
 */
export function useSiteAsset(name: string) {
  const [data, setData] = useState<SiteAsset | null>(() => assetCache[name] ?? null);
  const [isLoading, setIsLoading] = useState<boolean>(() => assetCache[name] === undefined);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let isMounted = true;

    // Fast path: if we already have this asset cached, use it and skip network.
    if (assetCache[name] !== undefined) {
      setData(assetCache[name]);
      setIsLoading(false);
      return () => {
        isMounted = false;
      };
    }

    const fetchAsset = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // If a request for this asset is already in-flight, reuse it.
        if (!inflightRequests[name]) {
          inflightRequests[name] = getSiteAsset(name).finally(() => {
            delete inflightRequests[name];
          });
        }

        const asset = await inflightRequests[name];

        // Update global cache for future hook calls.
        assetCache[name] = asset;

        if (isMounted) {
          setData(asset);
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err : new Error('Failed to fetch site asset'));
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    fetchAsset();

    return () => {
      isMounted = false;
    };
  }, [name]);

  return { data, isLoading, error };
}
