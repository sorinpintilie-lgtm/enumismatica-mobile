import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@shared/firebaseConfig';

export type PublicUserProfile = {
  id: string;
  displayName?: string;
  name?: string;
  avatar?: string;
  createdAt?: Date;
  updatedAt?: Date;
  idVerificationStatus?: 'not_provided' | 'pending' | 'verified' | 'rejected';
};

const toDateSafe = (value: any): Date | undefined => {
  if (!value) return undefined;
  if (value instanceof Date) return value;
  if (value?.toDate && typeof value.toDate === 'function') return value.toDate();
  if (typeof value === 'string' || typeof value === 'number') {
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return undefined;
};

/**
 * Hook for fetching user profile in mobile app
 */
export function useUserProfile(userId?: string, enabled: boolean = true) {
  const [profile, setProfile] = useState<PublicUserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) {
      setProfile(null);
      setLoading(false);
      setError(null);
      return;
    }

    if (!userId || !db) {
      setProfile(null);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    const unsubscribe = onSnapshot(
      doc(db, 'users', userId),
      (snap) => {
        if (!snap.exists()) {
          setProfile(null);
          setLoading(false);
          return;
        }

        const data = snap.data() as any;

        setProfile({
          id: snap.id,
          displayName: data.displayName,
          name: data.name,
          avatar: data.avatar,
          createdAt: toDateSafe(data.createdAt),
          updatedAt: toDateSafe(data.updatedAt),
          idVerificationStatus: data.idVerificationStatus,
        });

        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      },
    );

    return () => unsubscribe();
  }, [userId, enabled]);

  return { profile, loading, error };
}

