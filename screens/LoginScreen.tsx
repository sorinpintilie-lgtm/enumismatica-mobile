import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, StyleSheet, Modal, Switch, Platform, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { z } from 'zod';
import { signInWithEmail, signInWithGoogle } from '@shared/auth';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../navigationTypes';
import { auth, db } from '@shared/firebaseConfig';
import { doc, getDoc } from 'firebase/firestore';
import { sendLoginSuccessEmail, sendLoginAttemptEmail } from '@shared/emailService';
import AsyncStorage from '@react-native-async-storage/async-storage';

const loginSchema = z.object({
  email: z.string().email('Adresă de email invalidă'),
  password: z.string().min(6, 'Parola trebuie să aibă cel puțin 6 caractere'),
});

// Move styles outside the component to avoid re-creating StyleSheet on every render,
// which can cause focus issues for TextInput on web.
// Move styles outside the component to avoid re-creating StyleSheet on every render,
// which can cause focus issues for TextInput on web.
const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'flex-start',
    alignItems: 'center',
    padding: 24,
    paddingTop: 80,
    backgroundColor: '#00020d',
  },
  formContainer: {
    width: '100%',
    maxWidth: 400,
  },
  header: {
    marginBottom: 32,
  },
  logo: {
    width: 250,
    height: 80,
    marginBottom: 16,
    alignSelf: 'center',
  },
  title: {
    fontSize: 30,
    fontWeight: 'bold',
    textAlign: 'center',
    color: 'white',
    marginBottom: 8,
  },
  subtitle: {
    textAlign: 'center',
    color: '#94a3b8',
    fontSize: 14,
  },
  formCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(231, 183, 60, 0.3)',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 10,
  },
  input: {
    width: '100%',
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(231, 183, 60, 0.3)',
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    color: 'white',
  },
  inputPlaceholder: {
    color: '#94a3b8',
  },
  errorText: {
    color: '#ef4444',
    textAlign: 'center',
    marginBottom: 16,
  },
  button: {
    width: '100%',
    backgroundColor: '#e7b73c',
    paddingVertical: 12,
    borderRadius: 12,
    marginBottom: 16,
    shadowColor: '#e7b73c',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 5,
  },
  buttonText: {
    color: '#000940',
    textAlign: 'center',
    fontWeight: '600',
  },
  secondaryButton: {
    width: '100%',
    borderWidth: 2,
    borderColor: '#e7b73c',
    paddingVertical: 12,
    borderRadius: 12,
    marginBottom: 24,
  },
  secondaryButtonText: {
    color: '#e7b73c',
    textAlign: 'center',
    fontWeight: '600',
  },
  linkContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  linkText: {
    color: '#e7b73c',
    fontSize: 14,
  },
  // Modal styles
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  modalContent: {
    width: '90%',
    maxWidth: 400,
    backgroundColor: 'rgba(2, 6, 23, 0.95)',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(231, 183, 60, 0.3)',
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white',
  },
  closeButton: {
    padding: 8,
  },
  closeButtonText: {
    color: '#94a3b8',
    fontSize: 20,
  },
  // 2FA specific styles
  twoFactorToggleContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  twoFactorToggle: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  twoFactorToggleActive: {
    backgroundColor: '#e7b73c',
    borderColor: '#e7b73c',
  },
  twoFactorToggleInactive: {
    backgroundColor: 'transparent',
    borderColor: 'rgba(231, 183, 60, 0.3)',
  },
  twoFactorToggleTextActive: {
    color: '#000940',
    fontSize: 12,
    fontWeight: '600',
  },
  twoFactorToggleTextInactive: {
    color: '#e7b73c',
    fontSize: 12,
    fontWeight: '600',
  },
  twoFactorInput: {
    width: '100%',
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(231, 183, 60, 0.3)',
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    color: 'white',
    textAlign: 'center',
    fontSize: 18,
    letterSpacing: 4,
  },
  switchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  switchLabel: {
    color: 'white',
    marginLeft: 8,
    fontSize: 14,
  },
});

const LoginScreen: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetSuccess, setResetSuccess] = useState('');
  const [resetError, setResetError] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  
  // 2FA state
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [twoFactorError, setTwoFactorError] = useState('');
  const [pendingUserId, setPendingUserId] = useState<string | null>(null);
  const [rememberDevice, setRememberDevice] = useState(true);
  const [useBackupCode, setUseBackupCode] = useState(false);
  
  // Stepper state
  const [currentStep, setCurrentStep] = useState(0);
  const [showStepper, setShowStepper] = useState(false);
  
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();

  // If the user is already authenticated but required to complete 2FA (gate redirects here),
  // show the 2FA prompt automatically.
  useEffect(() => {
    const init2FAIfNeeded = async () => {
      try {
        const current = auth.currentUser;
        if (!current?.uid) return;

        const okKey = `enumismatica_2fa_ok_${current.uid}`;
        const sessionValue = await AsyncStorage.getItem(okKey);
        if (sessionValue === '1') return;

        const userDoc = await getDoc(doc(db, 'users', current.uid));
        if (!userDoc.exists()) return;
        const data = userDoc.data() as any;
        if (!data.twoFactorEnabled) return;

        setEmail(current.email || '');
        setPendingUserId(current.uid);
        setShowStepper(true);
        setCurrentStep(1);
      } catch (err) {
        console.warn('Failed to init 2FA on login page:', err);
      }
    };

    init2FAIfNeeded();
  }, []);

  const sendLoginSuccessNotification = async (email: string) => {
    try {
      const location = 'Unknown location';
      const dateTime = new Date().toISOString();
      const device = 'Mobile device';
      const actionLink = 'https://enumismatica.ro/settings';
      
      await sendLoginSuccessEmail(email, location, dateTime, device, actionLink);
    } catch (emailError) {
      console.warn('Failed to send login success email:', emailError);
    }
  };

  const sendLoginAttemptNotification = async (email: string) => {
    try {
      const location = 'Unknown location';
      const dateTime = new Date().toISOString();
      const device = 'Mobile device';
      const actionLink = 'https://enumismatica.ro/settings';
      
      await sendLoginAttemptEmail(email, location, dateTime, device, actionLink);
    } catch (emailError) {
      console.warn('Failed to send login attempt email:', emailError);
    }
  };

  const startSessionOnServer = async () => {
    try {
      const current = auth.currentUser;
      if (!current) return;
      const token = await current.getIdToken();

      const res = await fetch('https://enumismatica.ro/api/auth/sessions/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          deviceLabel: 'mobile',
        }),
      });

      if (!res.ok) return;
      const data = await res.json().catch(() => null);
      if (data?.sessionId) {
        // Store session ID so "Revoke other sessions" can preserve the current device.
        await AsyncStorage.setItem('enumismatica_current_session_id', String(data.sessionId));
      }
    } catch (err) {
      console.warn('Failed to start session on server:', err);
    }
  };

  const handleEmailLogin = async () => {
    setLoading(true);
    setError('');

    try {
      loginSchema.parse({ email, password });
    } catch (validationError) {
      if (validationError instanceof z.ZodError) {
        setError(validationError.issues[0].message);
      }
      setLoading(false);
      return;
    }

    const { user, error } = await signInWithEmail(email, password);
    setLoading(false);
    
    if (error) {
      setError(error);
      return;
    }
    
    if (user) {
      // Check if user has 2FA enabled
      try {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists() && userDoc.data().twoFactorEnabled) {
          // Check trusted device first
          // For mobile, we'll use a simplified approach
          
          // User has 2FA enabled, show 2FA step
          await sendLoginAttemptNotification(user.email || email);
          setShowStepper(true);
          setCurrentStep(1);
          setPendingUserId(user.uid);
        } else {
          // No 2FA, send login success email and proceed to dashboard
          await sendLoginSuccessNotification(user.email || email);
          await startSessionOnServer();
          // Navigation will be handled by AuthContext
        }
      } catch (err) {
        console.error('Error checking 2FA status:', err);
        await startSessionOnServer();
        // Navigation will be handled by AuthContext
      }
    }
  };

  const handleVerify2FA = async () => {
    setLoading(true);
    setTwoFactorError('');

    if (!pendingUserId || !twoFactorCode) {
      setTwoFactorError('Cod invalid');
      setLoading(false);
      return;
    }

    try {
      if (!auth.currentUser) {
        throw new Error('Sesiune invalidă. Te rugăm să te autentifici din nou.');
      }

      const token = await auth.currentUser.getIdToken();
      const res = await fetch('https://enumismatica.ro/api/auth/2fa/verify-login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          method: useBackupCode ? 'backup' : 'totp',
          code: twoFactorCode,
        }),
      });
      if (!res.ok) throw new Error(useBackupCode ? 'Cod de rezervă invalid.' : 'Cod invalid');

      // Remember device (trusted device) if enabled
      if (rememberDevice) {
        const token = await auth.currentUser.getIdToken();
        let deviceId = await AsyncStorage.getItem('enumismatica_device_id');
        if (!deviceId) {
          deviceId = `dev_${Date.now()}_${Math.random().toString(36).slice(2)}`;
          await AsyncStorage.setItem('enumismatica_device_id', deviceId);
        }

        await fetch('https://enumismatica.ro/api/auth/2fa/trusted-devices/add', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            deviceId,
            label: 'mobile',
            days: 30,
          }),
        }).catch((err) => console.warn('Failed to remember device:', err));
      }

      // Mark 2FA as verified for this session
      if (pendingUserId) {
        await AsyncStorage.setItem(`enumismatica_2fa_ok_${pendingUserId}`, '1');
      }

      // Send login success email after successful 2FA
      const currentUser = auth.currentUser;
      if (currentUser) {
        await sendLoginSuccessNotification(currentUser.email || '');
      }

      await startSessionOnServer();
      // Navigation will be handled by AuthContext
    } catch (err: any) {
      setTwoFactorError(err.message || 'Cod invalid. Te rugăm să încerci din nou.');
      // Send login attempt notification on failed 2FA
      const currentUser = auth.currentUser;
      if (currentUser) {
        await sendLoginAttemptNotification(currentUser.email || '');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleBackToLogin = async () => {
    // Send login attempt notification when user goes back from 2FA
    const currentUser = auth.currentUser;
    if (currentUser) {
      await sendLoginAttemptNotification(currentUser.email || '');
    }
    setShowStepper(false);
    setCurrentStep(0);
    setTwoFactorCode('');
    setTwoFactorError('');
    setPendingUserId(null);
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    const { user, error } = await signInWithGoogle();
    setLoading(false);
    if (error) {
      setError(error);
    } else if (user) {
      // Navigation will be handled by AuthContext
    }
  };

  const handlePasswordReset = async () => {
    setResetError('');
    setResetSuccess('');

    if (!resetEmail) {
      setResetError('Te rugăm să introduci adresa de email.');
      return;
    }

    try {
      z.string().email().parse(resetEmail);
    } catch {
      setResetError('Adresă de email invalidă.');
      return;
    }

    setResetLoading(true);

    try {
      const res = await fetch('https://enumismatica.ro/api/auth/password-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: resetEmail }),
      });

      // For security we treat 200 as success even if the user doesn't exist.
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || 'Nu s-a putut trimite emailul de resetare.');
      }

      setResetSuccess(
        'Dacă există un cont cu această adresă de email, vei primi un email cu instrucțiuni pentru resetarea parolei.',
      );
      setResetEmail('');
      
      // Close modal after 3 seconds
      setTimeout(() => {
        setShowResetPassword(false);
        setResetSuccess('');
      }, 3000);
    } catch (err: any) {
      console.error('Password reset error:', err);
      if (err.code === 'auth/user-not-found') {
        setResetError('Nu există niciun cont cu această adresă de email.');
      } else {
        setResetError(err.message || 'Nu s-a putut trimite emailul de resetare.');
      }
    } finally {
      setResetLoading(false);
    }
  };

  const renderLoginForm = () => (
    <View style={styles.formContainer}>
      {/* Header with Logo */}
      <View style={styles.header}>
        <Image
          source={require('../assets/eNumismatica.ro_logo.png')}
          style={styles.logo}
          resizeMode="contain"
        />
        <Text style={styles.title}>
          Autentificare
        </Text>
        <Text style={styles.subtitle}>
          Conectează-te la contul tău eNumismatica
        </Text>
      </View>

      {/* Login Form */}
      <View style={styles.formCard}>
        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor="#94a3b8"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoFocus={true}
          blurOnSubmit={false}
          returnKeyType="next"
        />

        <TextInput
          style={styles.input}
          placeholder="Parolă"
          placeholderTextColor="#94a3b8"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoFocus={false}
          blurOnSubmit={false}
        />

        {error ? (
          <Text style={styles.errorText}>
            {error}
          </Text>
        ) : null}

        <TouchableOpacity
          style={styles.button}
          onPress={handleEmailLogin}
          disabled={loading}
        >
          <Text style={styles.buttonText}>
            {loading ? 'Se conectează...' : 'Conectare'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={handleGoogleLogin}
          disabled={loading}
        >
          <Text style={styles.secondaryButtonText}>
            Continuă cu Google
          </Text>
        </TouchableOpacity>

        <View style={styles.linkContainer}>
          <TouchableOpacity onPress={() => setShowResetPassword(true)}>
            <Text style={styles.linkText}>Ai uitat parola?</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.navigate('Register' as never)}>
            <Text style={styles.linkText}>Înregistrează-te</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  const renderTwoFactorForm = () => (
    <View style={{ width: '100%', maxWidth: 400 }}>
      <View style={{ marginBottom: 32 }}>
        <Text style={{ fontSize: 24, fontWeight: 'bold', textAlign: 'center', color: 'white', marginBottom: 8 }}>
          Autentificare cu Doi Factori
        </Text>
        <Text style={{ textAlign: 'center', color: '#94a3b8', fontSize: 14 }}>
          Introdu codul din aplicația ta de autentificare
        </Text>
      </View>

      <View style={{
        borderRadius: 16,
        borderWidth: 1,
        borderColor: 'rgba(231, 183, 60, 0.3)',
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        padding: 24,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.5,
        shadowRadius: 20,
        elevation: 10
      }}>
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
          <TouchableOpacity
            style={{
              paddingHorizontal: 12,
              paddingVertical: 8,
              borderRadius: 8,
              borderWidth: 1,
              borderColor: !useBackupCode ? '#e7b73c' : 'rgba(231, 183, 60, 0.3)',
              backgroundColor: !useBackupCode ? '#e7b73c' : 'transparent'
            }}
            onPress={() => {
              setUseBackupCode(false);
              setTwoFactorCode('');
              setTwoFactorError('');
            }}
          >
            <Text style={{ color: !useBackupCode ? '#000940' : '#e7b73c', fontSize: 12, fontWeight: '600' }}>
              Cod 2FA
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={{
              paddingHorizontal: 12,
              paddingVertical: 8,
              borderRadius: 8,
              borderWidth: 1,
              borderColor: useBackupCode ? '#e7b73c' : 'rgba(231, 183, 60, 0.3)',
              backgroundColor: useBackupCode ? '#e7b73c' : 'transparent'
            }}
            onPress={() => {
              setUseBackupCode(true);
              setTwoFactorCode('');
              setTwoFactorError('');
            }}
          >
            <Text style={{ color: useBackupCode ? '#000940' : '#e7b73c', fontSize: 12, fontWeight: '600' }}>
              Cod de rezervă
            </Text>
          </TouchableOpacity>
        </View>

        <TextInput
          style={{
            width: '100%',
            paddingHorizontal: 16,
            paddingVertical: 12,
            marginBottom: 24,
            borderWidth: 1,
            borderColor: 'rgba(231, 183, 60, 0.3)',
            borderRadius: 12,
            backgroundColor: 'rgba(255, 255, 255, 0.05)',
            color: 'white',
            textAlign: 'center',
            fontSize: 18,
            letterSpacing: 4
          }}
          placeholder={useBackupCode ? 'ABCD-EF12' : '000000'}
          placeholderTextColor="#94a3b8"
          value={twoFactorCode}
          onChangeText={setTwoFactorCode}
          maxLength={useBackupCode ? 9 : 6}
        />

        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 24 }}>
          <Switch
            value={rememberDevice}
            onValueChange={setRememberDevice}
            trackColor={{ false: '#475569', true: '#e7b73c' }}
            thumbColor={rememberDevice ? '#000940' : '#f1f5f9'}
          />
          <Text style={{ color: 'white', marginLeft: 8, fontSize: 14 }}>
            Ține minte acest dispozitiv (30 zile)
          </Text>
        </View>

        {twoFactorError ? (
          <Text style={{ color: '#ef4444', textAlign: 'center', marginBottom: 16 }}>
            {twoFactorError}
          </Text>
        ) : null}

        <TouchableOpacity
          style={{
            width: '100%',
            backgroundColor: '#e7b73c',
            paddingVertical: 12,
            borderRadius: 12,
            marginBottom: 16,
            shadowColor: '#e7b73c',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.4,
            shadowRadius: 8,
            elevation: 5
          }}
          onPress={handleVerify2FA}
          disabled={loading || (useBackupCode ? twoFactorCode.trim().length < 8 : twoFactorCode.trim().length !== 6)}
        >
          <Text style={{ color: '#000940', textAlign: 'center', fontWeight: '600' }}>
            {loading ? 'Se verifică...' : 'Verifică Codul'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={{
            width: '100%',
            borderWidth: 2,
            borderColor: '#e7b73c',
            paddingVertical: 12,
            borderRadius: 12,
          }}
          onPress={handleBackToLogin}
          disabled={loading}
        >
          <Text style={{ color: '#e7b73c', textAlign: 'center', fontWeight: '600' }}>
            Înapoi la Autentificare
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderPasswordResetModal = () => (
    <Modal
      animationType="slide"
      transparent={true}
      visible={showResetPassword}
      onRequestClose={() => {
        setShowResetPassword(false);
        setResetError('');
        setResetSuccess('');
        setResetEmail('');
      }}
    >
      <View style={{
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.7)'
      }}>
        <View style={{
          width: '90%',
          maxWidth: 400,
          backgroundColor: 'rgba(2, 6, 23, 0.95)',
          borderRadius: 24,
          borderWidth: 1,
          borderColor: 'rgba(231, 183, 60, 0.3)',
          padding: 24,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 10 },
          shadowOpacity: 0.5,
          shadowRadius: 20,
          elevation: 10
        }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <Text style={{ fontSize: 20, fontWeight: 'bold', color: 'white' }}>Resetează Parola</Text>
            <TouchableOpacity
              onPress={() => {
                setShowResetPassword(false);
                setResetError('');
                setResetSuccess('');
                setResetEmail('');
              }}
            >
              <Text style={{ color: '#94a3b8', fontSize: 20 }}>×</Text>
            </TouchableOpacity>
          </View>

          <Text style={{ color: '#94a3b8', marginBottom: 24, fontSize: 14 }}>
            Introdu adresa ta de email și îți vom trimite instrucțiuni pentru resetarea parolei.
          </Text>

          <TextInput
            style={{
              width: '100%',
              paddingHorizontal: 16,
              paddingVertical: 12,
              marginBottom: 16,
              borderWidth: 1,
              borderColor: 'rgba(231, 183, 60, 0.3)',
              borderRadius: 12,
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
              color: 'white'
            }}
            placeholder="Email"
            placeholderTextColor="#94a3b8"
            value={resetEmail}
            onChangeText={setResetEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />

          {resetError ? (
            <Text style={{ color: '#ef4444', marginBottom: 16 }}>
              {resetError}
            </Text>
          ) : null}

          {resetSuccess ? (
            <Text style={{ color: '#10b981', marginBottom: 16 }}>
              {resetSuccess}
            </Text>
          ) : null}

          <TouchableOpacity
            style={{
              width: '100%',
              backgroundColor: '#e7b73c',
              paddingVertical: 12,
              borderRadius: 12,
              shadowColor: '#e7b73c',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.4,
              shadowRadius: 8,
              elevation: 5
            }}
            onPress={handlePasswordReset}
            disabled={resetLoading}
          >
            <Text style={{ color: '#000940', textAlign: 'center', fontWeight: '600' }}>
              {resetLoading ? 'Se trimite...' : 'Trimite Email de Resetare'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );

  return (
    <View style={styles.container}>
      {showStepper ? renderTwoFactorForm() : renderLoginForm()}
      {renderPasswordResetModal()}
    </View>
  );
};


export default LoginScreen;
