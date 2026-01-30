import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { User } from 'firebase/auth';
import { onAuthStateChange } from '@shared/auth';
import { registerPushTokenForUser, unregisterPushTokenForUser } from '../services/pushTokenService';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@shared/firebaseConfig';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  twoFactorRequired: boolean;
  refreshAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({ user: null, loading: true, twoFactorRequired: false, refreshAuth: async () => {} });

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [twoFactorRequired, setTwoFactorRequired] = useState(false);
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [previousUserId, setPreviousUserId] = useState<string | null>(null);

  const check2FAStatus = useCallback(async (currentUser: User | null) => {
    if (!currentUser) {
      setUser(null);
      setTwoFactorRequired(false);
      return;
    }

    // Check if user has 2FA enabled
    try {
      const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
      const twoFactorEnabled = userDoc.exists() && Boolean(userDoc.data()?.twoFactorEnabled);

      if (twoFactorEnabled) {
        // Check if 2FA has been verified for this session
        const okKey = `enumismatica_2fa_ok_${currentUser.uid}`;
        const sessionValue = await AsyncStorage.getItem(okKey);

        if (sessionValue === '1') {
          // 2FA verified, user is fully authenticated
          setUser(currentUser);
          setTwoFactorRequired(false);

          if (currentUser?.uid) {
            console.log('[AuthContext] Registering push token for user (2FA verified):', currentUser.uid);
            registerPushTokenForUser(currentUser.uid).catch((error) => {
              console.error('[AuthContext] Failed to register push token:', error);
            });
          }
        } else {
          // 2FA required but not verified
          setUser(null);
          setTwoFactorRequired(true);
        }
      } else {
        // No 2FA, user is fully authenticated
        setUser(currentUser);
        setTwoFactorRequired(false);

        if (currentUser?.uid) {
          console.log('[AuthContext] Registering push token for user (no 2FA):', currentUser.uid);
          registerPushTokenForUser(currentUser.uid).catch((error) => {
            console.error('[AuthContext] Failed to register push token:', error);
          });
        }
      }
    } catch (err) {
      console.error('[AuthContext] Error checking 2FA status:', err);
      // On error, allow user to proceed (fail-open)
      setUser(currentUser);
      setTwoFactorRequired(false);

      if (currentUser?.uid) {
        console.log('[AuthContext] Registering push token for user (error case):', currentUser.uid);
        registerPushTokenForUser(currentUser.uid).catch((error) => {
          console.error('[AuthContext] Failed to register push token:', error);
        });
      }
    }
  }, []);

  const refreshAuth = useCallback(async () => {
    await check2FAStatus(firebaseUser);
  }, [check2FAStatus, firebaseUser]);

  useEffect(() => {
    // Show splash screen for at least 3.5 seconds to ensure branding is visible
    const minimumLoadingTime = setTimeout(() => {
      setLoading(false);
    }, 3500);

    const unsubscribe = onAuthStateChange(async (currentUser: User | null) => {
      setFirebaseUser(currentUser);

      if (!currentUser) {
        // User logged out - remove device token from previous user
        if (previousUserId) {
          console.log('[AuthContext] Unregistering push token for user:', previousUserId);
          unregisterPushTokenForUser(previousUserId).catch((error) => {
            console.error('[AuthContext] Failed to unregister push token:', error);
          });
          setPreviousUserId(null);
        }
        setUser(null);
        setTwoFactorRequired(false);
        // Let minimumLoadingTime handle loading state for unauthenticated users
        return;
      }

      // User logged in - register device token for new user
      if (previousUserId && previousUserId !== currentUser.uid) {
        // Switched users - remove device token from previous user
        console.log('[AuthContext] Switching users, unregistering push token for previous user:', previousUserId);
        unregisterPushTokenForUser(previousUserId).catch((error) => {
          console.error('[AuthContext] Failed to unregister push token:', error);
        });
      }

      setPreviousUserId(currentUser.uid);
      console.log('[AuthContext] Set previousUserId to:', currentUser.uid);
      await check2FAStatus(currentUser);

      // Clear timeout if authentication completes before minimum time
      clearTimeout(minimumLoadingTime);
      // Still show splash screen for minimum duration
      setTimeout(() => setLoading(false), 3500);
    });

    return () => {
      unsubscribe();
      clearTimeout(minimumLoadingTime);
    };
  }, [check2FAStatus, previousUserId]);

  return (
    <AuthContext.Provider value={{ user, loading, twoFactorRequired, refreshAuth }}>
      {children}
    </AuthContext.Provider>
  );
};