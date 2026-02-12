import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  where,
  doc,
  limit,
  startAfter,
  getDocs,
  type QueryDocumentSnapshot,
  type DocumentData,
} from '@shared/firebaseConfig';
import { db } from '@shared/firebaseConfig';
import { Product } from '@shared/types';

// Default fields for product list view - optimize for performance
const DEFAULT_PRODUCT_FIELDS = ['name', 'images', 'price', 'createdAt', 'updatedAt'];

interface UseProductsOptions {
  ownerId?: string;
  pageSize?: number;
  fields?: string[];
  enabled?: boolean;
  listingType?: 'direct' | 'auction' | 'all';
  live?: boolean;
  loadAllAtOnce?: boolean;
}

export function useProducts(
  options: UseProductsOptions = {}
) {
  const {
    ownerId,
    pageSize = 20,
    fields = DEFAULT_PRODUCT_FIELDS,
    enabled = true,
    listingType = 'direct',
    live = true,
    loadAllAtOnce = false,
  } = options;
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [lastVisible, setLastVisible] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const unsubscribeRef = useRef<(() => void) | null>(null);

  const debug = typeof __DEV__ !== 'undefined' ? __DEV__ : true;

  // `fields` is commonly passed as an inline array literal from screens.
  // If we depend on the array reference, we'll resubscribe on every render.
  // Normalize into a stable key + memoized array to avoid subscription loops.
  const fieldsKey = useMemo(() => {
    const list = Array.isArray(fields) ? fields : DEFAULT_PRODUCT_FIELDS;
    // Keep order deterministic so key is stable.
    return Array.from(new Set(list)).sort().join('|');
  }, [fields]);

  const normalizedFields = useMemo(() => {
    if (!fieldsKey) return DEFAULT_PRODUCT_FIELDS;
    return fieldsKey.split('|').filter(Boolean);
  }, [fieldsKey]);

  const loadProducts = useCallback(() => {
    // Clean up previous listener
    if (unsubscribeRef.current) unsubscribeRef.current();

    setLoading(true);

    // Base query: only approved products that are not sold
    let q = query(
      collection(db, 'products'),
      where('status', '==', 'approved'),
    );

    // Apply ownerId filter BEFORE orderBy (Firestore requirement)
    if (ownerId) {
      q = query(q, where('ownerId', '==', ownerId));
    }

    // Apply listing type filter unless we explicitly want all listing types
    if (listingType !== 'all') {
      q = query(
        q,
        where('listingType', '==', listingType),
      );
    }

    // Order and limit (must come after all where clauses)
    // Load extra documents to account for sold/pulled-back items that will be filtered out
    // This ensures we get at least pageSize valid products
    q = query(
      q,
      orderBy('createdAt', 'desc'),
      ...(loadAllAtOnce ? [] : [limit(pageSize + 5)]), // Load 5 extra to account for filtered items
    );

    if (debug) {
      console.log('[useProducts] subscribing', {
        ownerId: ownerId ?? null,
        pageSize,
        fields: normalizedFields,
        fieldsKey,
        loadAllAtOnce,
        listingType,
      });
    }

    // Set timeout for loading state
    const timeoutId = setTimeout(() => {
      setError('Timeout: Unable to load products. Please check your connection.');
      setLoading(false);
    }, 60000); // 60 second timeout

    const unsubscribe = onSnapshot(
      q,
      (querySnapshot) => {
        clearTimeout(timeoutId);

        if (debug) {
          console.log('[useProducts] snapshot received', {
            size: querySnapshot.size,
            empty: querySnapshot.empty,
            loadAllAtOnce,
            pageSize,
          });
          const sample = querySnapshot.docs[0];
          const sampleData = sample?.data?.() as any;
          console.log('[useProducts] sample doc', {
            id: sample?.id ?? null,
            hasImages: !!sampleData?.images,
            imageCount: sampleData?.images?.length ?? 0,
            firstImage: sampleData?.images?.[0]?.substring(0, 100) ?? null,
          });
        }

        const productsData: Product[] = [];
        querySnapshot.forEach((doc) => {
          const data = doc.data();
          
        // Skip sold items (isSold == true)
        if (data.isSold === true) {
          if (debug) {
            console.log('[useProducts] Skipping sold product:', doc.id);
          }
          return;
        }

        // Skip pulled-back items (isPulledBack == true)
        if (data.isPulledBack === true) {
          if (debug) {
            console.log('[useProducts] Skipping pulled-back product:', doc.id);
          }
          return;
        }
        
        // NOTE:
          // The web hook only filters by `status === 'approved'` at query level
          // and then skips sold items in-memory. It does NOT filter on
          // other status values here. To keep mobile E‑shop behavior identical
          // to the web catalog, we do the same and do not reject items based
          // on additional status checks at this stage.
          const productData: any = { id: doc.id };

        // Only include requested fields for performance
        normalizedFields.forEach((field) => {
          if (data[field] !== undefined) {
            productData[field] = data[field];
          }
        });

        // Always include dates for proper typing
        if (normalizedFields.includes('createdAt')) {
          productData.createdAt = data.createdAt?.toDate() || new Date();
        }
        if (normalizedFields.includes('updatedAt')) {
          productData.updatedAt = data.updatedAt?.toDate() || new Date();
        }

          productsData.push(productData as Product);
        });

        if (debug) {
          console.log('[useProducts] final productsData', {
            count: productsData.length,
            hasMoreSetTo: querySnapshot.size >= pageSize + 5,
            sampleImages: productsData.slice(0, 3).map(p => ({
              id: p.id,
              hasImages: !!p.images,
              imageCount: p.images?.length ?? 0,
            })),
          });
        }

        // Replace products for initial load
        setProducts(productsData);

        // Check if there are more products to load.
        // When loading all at once, pagination must stay disabled to avoid
        // extra fetch cycles triggered by list interactions (e.g. search/filter updates).
        setHasMore(loadAllAtOnce ? false : querySnapshot.size >= pageSize + 5);
        if (productsData.length > 0) {
          setLastVisible(querySnapshot.docs[querySnapshot.docs.length - 1]);
        }
        setLoading(false);
      },
      (err) => {
        clearTimeout(timeoutId);

        console.error('[useProducts] snapshot error', {
          message: err?.message,
          code: (err as any)?.code,
          name: (err as any)?.name,
          stack: (err as any)?.stack,
        });

        setError(err.message);
        setLoading(false);
      }
    );

    unsubscribeRef.current = unsubscribe;
    return unsubscribe;
  }, [ownerId, pageSize, debug, fieldsKey, normalizedFields, listingType, loadAllAtOnce]);

  // Separate function for pagination using getDocs to avoid scroll jumping
  const loadMoreProducts = useCallback(async () => {
    if (loadAllAtOnce || !hasMore || !lastVisible || loading) return;

    setLoading(true);
    setError(null);

    try {
      // Base query: only approved products that are not sold
      let q = query(
        collection(db, 'products'),
        where('status', '==', 'approved'),
      );

      // Apply ownerId filter BEFORE orderBy (Firestore requirement)
      if (ownerId) {
        q = query(q, where('ownerId', '==', ownerId));
      }

      // Apply listing type filter unless we explicitly want all listing types
      if (listingType !== 'all') {
        q = query(
          q,
          where('listingType', '==', listingType),
        );
      }

      // Order and limit (must come after all where clauses)
      // Load extra documents to account for sold/pulled-back items that will be filtered out
      // This ensures we get at least pageSize valid products
      q = query(
        q,
        orderBy('createdAt', 'desc'),
        limit(pageSize + 5), // Load 5 extra to account for filtered items
      );

      q = query(q, startAfter(lastVisible));

      if (debug) {
        console.log('[useProducts] loading more (getDocs)', {
          ownerId: ownerId ?? null,
          pageSize,
          fields: normalizedFields,
          fieldsKey,
          startAfter: lastVisible.id,
        });
      }

      const querySnapshot = await getDocs(q);

      if (debug) {
        const sample = querySnapshot.docs[0];
        const sampleData = sample?.data?.() as any;
        console.log('[useProducts] getDocs snapshot', {
          size: querySnapshot.size,
          empty: querySnapshot.empty,
          firstId: sample?.id ?? null,
          firstKeys: sampleData ? Object.keys(sampleData).slice(0, 30) : [],
        });
      }

      const productsData: Product[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        
        // Skip sold items (isSold == true)
        if (data.isSold === true) {
          if (debug) {
            console.log('[useProducts] Skipping sold product:', doc.id);
          }
          return;
        }

        // Skip pulled-back items (isPulledBack == true)
        if (data.isPulledBack === true) {
          if (debug) {
            console.log('[useProducts] Skipping pulled-back product:', doc.id);
          }
          return;
        }
        
        const productData: any = { id: doc.id };

        // Only include requested fields for performance
        normalizedFields.forEach((field) => {
          if (data[field] !== undefined) {
            productData[field] = data[field];
          }
        });

        // Always include dates for proper typing
        if (normalizedFields.includes('createdAt')) {
          productData.createdAt = data.createdAt?.toDate() || new Date();
        }
        if (normalizedFields.includes('updatedAt')) {
          productData.updatedAt = data.updatedAt?.toDate() || new Date();
        }

        productsData.push(productData as Product);
      });

      // Append to existing products for pagination
      setProducts(prev => [...prev, ...productsData]);

      // Check if there are more products to load
      // If we got fewer documents than requested (pageSize + 5), we've reached the end
      setHasMore(querySnapshot.size >= pageSize + 5);
      if (productsData.length > 0) {
        setLastVisible(querySnapshot.docs[querySnapshot.docs.length - 1]);
      }
      setLoading(false);
    } catch (err: any) {
      if (debug) {
        console.error('[useProducts] getDocs error', {
          message: err?.message,
          code: err?.code,
          name: err?.name,
        });
      }
      setError(err.message);
      setLoading(false);
    }
  }, [loadAllAtOnce, hasMore, lastVisible, loading, ownerId, pageSize, debug, fieldsKey, normalizedFields, listingType]);

  useEffect(() => {
    const unsubscribe = loadProducts();
    return () => {
      unsubscribe();
      unsubscribeRef.current = null;
    };
  }, [loadProducts]);

  const loadMore = useCallback(() => {
    loadMoreProducts();
  }, [loadMoreProducts]);

  return { products, loading, error, hasMore, loadMore };
}

export function useProduct(id: string) {
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;

    const unsubscribe = onSnapshot(
      doc(db, 'products', id),
      (doc) => {
        if (doc.exists()) {
          setProduct({
            id: doc.id,
            ...doc.data(),
            createdAt: doc.data().createdAt?.toDate() || new Date(),
            updatedAt: doc.data().updatedAt?.toDate() || new Date(),
          } as Product);
        } else {
          setProduct(null);
        }
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [id]);

  return { product, loading, error };
}
