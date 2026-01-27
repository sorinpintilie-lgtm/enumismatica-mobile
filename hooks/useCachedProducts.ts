import { useState, useEffect } from 'react';
import {
  collection,
  query,
  orderBy,
  where,
  limit,
  getDocs,
  doc,
  getDoc,
} from '@shared/firebaseConfig';
import { db } from '@shared/firebaseConfig';
import { Product } from '@shared/types';
import { Cache } from '../utils/cache';

// Default fields for product list view - optimize for performance
const DEFAULT_PRODUCT_FIELDS = ['name', 'images', 'price', 'createdAt', 'updatedAt'];

export function useCachedProducts(ownerId?: string, pageSize: number = 20, fields: string[] = DEFAULT_PRODUCT_FIELDS) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Normalize fields to avoid mutating the caller-provided array and to keep
  // the effect dependency stable even if callers pass a new array literal.
  const normalizedFields = Array.from(new Set(fields));
  const fieldsKey = normalizedFields.slice().sort().join('_');

  useEffect(() => {
    const cacheKey = `products_${ownerId || 'all'}_${pageSize}_${fieldsKey}`;

    const fetchProducts = async () => {
      try {
        // Try to get from cache first
        const cached = await Cache.get<Product[]>(cacheKey);
        if (cached) {
          setProducts(cached);
          setLoading(false);
          return;
        }

        // Fetch from Firestore
        let q = query(collection(db, 'products'), orderBy('createdAt', 'desc'), limit(pageSize));

        if (ownerId) {
          q = query(q, where('ownerId', '==', ownerId));
        }

        const querySnapshot = await getDocs(q);
        const productsData: Product[] = [];

        querySnapshot.forEach((doc) => {
          const data = doc.data();
          const productData: any = { id: doc.id };

          // Only include requested fields for performance
          normalizedFields.forEach(field => {
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

        // Cache the result
        await Cache.set(cacheKey, productsData, { ttl: 5 * 60 * 1000 }); // 5 minutes

        setProducts(productsData);
        setLoading(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
        setLoading(false);
      }
    };

    fetchProducts();
  }, [ownerId, pageSize, fieldsKey]);

  return { products, loading, error };
}

export function useCachedProduct(id: string, fields: string[] = DEFAULT_PRODUCT_FIELDS) {
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const normalizedFields = Array.from(new Set(fields));
  const fieldsKey = normalizedFields.slice().sort().join('_');

  useEffect(() => {
    if (!id) return;

    const cacheKey = `product_${id}_${fieldsKey}`;

    const fetchProduct = async () => {
      try {
        // Try to get from cache first
        const cached = await Cache.get<Product>(cacheKey);
        if (cached) {
          setProduct(cached);
          setLoading(false);
          return;
        }

        // Fetch from Firestore
        const docRef = doc(db, 'products', id);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          const data = docSnap.data();
          const productData: any = { id: docSnap.id };

          // Only include requested fields for performance
          normalizedFields.forEach(field => {
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

          const product = productData as Product;

          // Cache the result
          await Cache.set(cacheKey, product, { ttl: 5 * 60 * 1000 }); // 5 minutes

          setProduct(product);
        } else {
          setProduct(null);
        }
        setLoading(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
        setLoading(false);
      }
    };

    fetchProduct();
  }, [id, fieldsKey]);

  return { product, loading, error };
}
