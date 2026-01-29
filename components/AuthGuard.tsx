import React from 'react';
import { useEffect, useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../navigationTypes';
import { useAuth } from '../context/AuthContext';

interface AuthGuardProps {
  children: React.ReactNode;
}

const AuthGuard: React.FC<AuthGuardProps> = ({ children }) => {
  const { user } = useAuth();
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  const [isNavigating, setIsNavigating] = useState(false);

  useEffect(() => {
    if (!user && !isNavigating && navigation) {
      // Redirect to login if user is not authenticated
      setIsNavigating(true);
      navigation.replace('Login');
    }
  }, [user, navigation, isNavigating]);

  // Don't render children if user is not authenticated
  if (!user) {
    return null;
  }

  return <>{children}</>;
};

export default AuthGuard;
