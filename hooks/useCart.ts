import { useState, useEffect, useCallback } from 'react';
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  addDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  type QueryDocumentSnapshot,
  type DocumentData,
} from '@shared/firebaseConfig';
import { db } from '@shared/firebaseConfig';
import type { CartItem } from '@shared/types';

/**
 * Hook for managing the authenticated user's shopping cart on mobile.
 *
 * Data model (shared with web):
 *   users/{userId}/cart/{itemId}
 *
 * Firestore rules are expected to enforce:
 *   - read: owner or admin
 *   - create: owner with fields userId, productId, quantity, addedAt
 *   - update/delete: owner or admin
 */
export function useCart(userId?: string) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastSnapshot, setLastSnapshot] =
    useState<QueryDocumentSnapshot<DocumentData> | null>(null);

  useEffect(() => {
    if (!userId || !db) {
      setItems([]);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    const cartRef = collection(db, 'users', userId, 'cart');
    const q = query(cartRef, orderBy('addedAt', 'desc'));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const data: CartItem[] = [];
        snapshot.forEach((d) => {
          const raw = d.data() as any;
          data.push({
            id: d.id,
            userId: raw.userId,
            productId: raw.productId,
            quantity:
              typeof raw.quantity === 'number' && raw.quantity > 0
                ? raw.quantity
                : 1,
            addedAt: raw.addedAt?.toDate ? raw.addedAt.toDate() : new Date(),
          });
        });
        setItems(data);
        if (snapshot.docs.length > 0) {
          setLastSnapshot(snapshot.docs[snapshot.docs.length - 1]);
        }
        setLoading(false);
      },
      (err) => {
        console.error('[useCart] Firestore error:', err);
        setError(err.message);
        setLoading(false);
      },
    );

    return () => unsubscribe();
  }, [userId]);

  const addToCart = useCallback(
    async (productId: string) => {
      if (!userId) {
        throw new Error('Trebuie să fii autentificat pentru a adăuga produse în coș.');
      }
      if (!db) {
        throw new Error('Baza de date nu este inițializată.');
      }
      if (!productId) {
        throw new Error('Produs invalid.');
      }

      const cartRef = collection(db, 'users', userId, 'cart');
      await addDoc(cartRef, {
        userId,
        productId,
        // We always store quantity = 1 on mobile – no quantity management.
        quantity: 1,
        addedAt: serverTimestamp(),
      });
    },
    [userId],
  );

  const removeItem = useCallback(
    async (itemId: string) => {
      if (!userId) {
        throw new Error('Trebuie să fii autentificat pentru a modifica coșul.');
      }
      if (!db) {
        throw new Error('Baza de date nu este inițializată.');
      }
      if (!itemId) return;

      const itemRef = doc(db, 'users', userId, 'cart', itemId);
      await deleteDoc(itemRef);
    },
    [userId],
  );

  const clearCart = useCallback(async () => {
    if (!userId) {
      throw new Error('Trebuie să fii autentificat pentru a modifica coșul.');
    }
    if (!db) {
      throw new Error('Baza de date nu este inițializată.');
    }

    const cartRef = collection(db, 'users', userId, 'cart');
    const q = query(cartRef);
    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const batchDeletes = snapshot.docs.map((d) => deleteDoc(d.ref));
      await Promise.all(batchDeletes);
    });

    // Unsubscribe immediately after first execution
    unsubscribe();
  }, [userId]);

  return {
    items,
    loading,
    error,
    addToCart,
    removeItem,
    clearCart,
    lastSnapshot,
  };
}
