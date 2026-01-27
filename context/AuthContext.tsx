import React, { createContext, useContext, useEffect, useState } from 'react';
import { User } from 'firebase/auth';
import { onAuthStateChange } from '@shared/auth';

interface AuthContextType {
  user: User | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({ user: null, loading: true });

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Show splash screen for at least 3.5 seconds to ensure branding is visible
    const minimumLoadingTime = setTimeout(() => {
      setLoading(false);
    }, 3500);

    const unsubscribe = onAuthStateChange((user: User | null) => {
      setUser(user);
      // Clear timeout if authentication completes before minimum time
      clearTimeout(minimumLoadingTime);
      // Still show splash screen for minimum duration
      setTimeout(() => setLoading(false), 3500);
    });

    return () => {
      unsubscribe();
      clearTimeout(minimumLoadingTime);
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading }}>
      {children}
    </AuthContext.Provider>
  );
};