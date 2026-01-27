import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, StyleSheet, Platform } from 'react-native';
import { z } from 'zod';
import { signUpWithEmail, signInWithGoogle } from '@shared/auth';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../navigationTypes';
import { sharedStyles, colors } from '../styles/sharedStyles';

const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

const RegisterScreen: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();

  const handleEmailRegister = async () => {
    try {
      registerSchema.parse({ email, password, confirmPassword });
    } catch (validationError) {
      if (validationError instanceof z.ZodError) {
        Alert.alert('Validation Error', validationError.issues[0].message);
      }
      return;
    }

    setLoading(true);
    const { user, error } = await signUpWithEmail(email, password);
    setLoading(false);
    if (error) {
      Alert.alert('Error', error);
    } else if (user) {
      // AuthContext + AppNavigator will automatically move to the authenticated stack.
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    const { user, error } = await signInWithGoogle();
    setLoading(false);
    if (error) {
      Alert.alert('Error', error);
    } else if (user) {
      // AuthContext + AppNavigator will automatically move to the authenticated stack.
    }
  };

  // Web-specific styling adjustments
  const isWeb = Platform.OS === 'web';

  // Web container wrapper
  const WebContainer = ({ children }: { children: React.ReactNode }) => {
    if (isWeb) {
      return (
        <div style={{
          minHeight: '100vh',
          width: '100%',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: colors.background,
          padding: 24,
        }}>
          {children}
        </div>
      );
    }
    return <View style={sharedStyles.container}>{children}</View>;
  };

  return (
    <WebContainer>
      <View style={sharedStyles.formContainer}>
        <View style={sharedStyles.header}>
          <Text style={sharedStyles.title}>
            Înregistrare
          </Text>
          <Text style={sharedStyles.subtitle}>
            Creează un cont nou pe eNumismatica
          </Text>
        </View>

        <View style={sharedStyles.formCard}>
          <TextInput
            style={sharedStyles.input}
            placeholder="Email"
            placeholderTextColor={colors.textSecondary}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />

          <TextInput
            style={sharedStyles.input}
            placeholder="Parolă"
            placeholderTextColor={colors.textSecondary}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          <TextInput
            style={sharedStyles.input}
            placeholder="Confirmă Parola"
            placeholderTextColor={colors.textSecondary}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
          />

          <TouchableOpacity
            style={sharedStyles.button}
            onPress={handleEmailRegister}
            disabled={loading}
          >
            <Text style={sharedStyles.buttonText}>
              {loading ? 'Se creează cont...' : 'Înregistrare'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={sharedStyles.secondaryButton}
            onPress={handleGoogleLogin}
            disabled={loading}
          >
            <Text style={sharedStyles.secondaryButtonText}>
              Continuă cu Google
            </Text>
          </TouchableOpacity>

          <View style={sharedStyles.linkContainer}>
            <TouchableOpacity onPress={() => navigation.navigate('Login' as never)}>
              <Text style={sharedStyles.linkText}>
                Ai deja un cont? Autentifică-te
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </WebContainer>
  );
};

export default RegisterScreen;