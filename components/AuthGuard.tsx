import React, { useState } from 'react';
import { View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../navigationTypes';
import { useAuth } from '../context/AuthContext';
import AuthPromptModal from './AuthPromptModal';

interface AuthGuardProps {
  children: React.ReactNode;
}

const AuthGuard: React.FC<AuthGuardProps> = ({ children }) => {
  const { user } = useAuth();
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  const [promptVisible, setPromptVisible] = useState(true);

  if (!user) {
    return (
      <View style={{ flex: 1, backgroundColor: '#00020d' }}>
        <AuthPromptModal
          visible={promptVisible}
          title="Autentificare necesară"
          message="Pentru acces la această secțiune este necesar un cont. Autentificarea sau crearea unui cont nou permite continuarea."
          benefits={[
            'Acces complet la funcții și colecții',
            'Mesaje și notificări în timp real',
            'Comenzi și licitații salvate',
          ]}
          onClose={() => {
            setPromptVisible(false);
            if (navigation.canGoBack()) {
              navigation.goBack();
            } else {
              navigation.navigate('MainTabs', { screen: 'Dashboard' });
            }
          }}
          onLogin={() => {
            setPromptVisible(false);
            navigation.navigate('Login');
          }}
          onRegister={() => {
            setPromptVisible(false);
            navigation.navigate('Register');
          }}
        />
      </View>
    );
  }

  return <>{children}</>;
};

export default AuthGuard;
