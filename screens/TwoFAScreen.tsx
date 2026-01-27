import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Image } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { doc, getDoc } from 'firebase/firestore';
import { EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { RootStackParamList } from '../navigationTypes';
import { sharedStyles, colors } from '../styles/sharedStyles';
import { useToast } from '../context/ToastContext';
import { apiGet, apiPost } from '../services/apiClient';
import { auth, db } from '@shared/firebaseConfig';
import InlineBackButton from '../components/InlineBackButton';

type SetupResponse = { secret: string; qrCode: string };

const TwoFAScreen: React.FC = () => {
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  const { showToast } = useToast();

  const [loading, setLoading] = useState(false);
  const [twoFactorEnabled, setTwoFactorEnabled] = useState<boolean>(false);
  const [secret, setSecret] = useState<string>('');
  const [qrCode, setQrCode] = useState<string>('');
  const [code, setCode] = useState('');

  const [backupCodes, setBackupCodes] = useState<string[] | null>(null);

  // Step-up (disable) inputs
  const [password, setPassword] = useState('');
  const [useBackup, setUseBackup] = useState(false);
  const [stepUpCode, setStepUpCode] = useState('');

  const canEnable = useMemo(() => !!secret && code.trim().length >= 6, [secret, code]);
  const canDisable = useMemo(() => !!password && stepUpCode.trim().length >= (useBackup ? 8 : 6), [password, stepUpCode, useBackup]);

  const loadFlag = async () => {
    const user = auth.currentUser;
    if (!user?.uid) return;
    try {
      const snap = await getDoc(doc(db, 'users', user.uid));
      const enabled = snap.exists() ? Boolean((snap.data() as any)?.twoFactorEnabled) : false;
      setTwoFactorEnabled(enabled);
    } catch (err) {
      console.warn('Failed to load 2FA status:', err);
    }
  };

  useEffect(() => {
    loadFlag();
  }, []);

  const setup = async () => {
    setLoading(true);
    try {
      const data = await apiPost<SetupResponse>('/api/auth/2fa/setup');
      setSecret(data.secret);
      setQrCode(data.qrCode);
      showToast({ type: 'info', title: '2FA', message: 'Scanează codul QR în aplicația de autentificare.' });
    } catch (err: any) {
      showToast({ type: 'error', title: 'Eroare', message: err.message || 'Nu s-a putut genera secretul.' });
    } finally {
      setLoading(false);
    }
  };

  const enable = async () => {
    setLoading(true);
    try {
      await apiPost('/api/auth/2fa/enable', { secret, code: code.trim() });
      setCode('');
      showToast({ type: 'success', title: 'Succes', message: '2FA a fost activat.' });
      await loadFlag();
    } catch (err: any) {
      showToast({ type: 'error', title: 'Eroare', message: err.message || 'Nu s-a putut activa 2FA.' });
    } finally {
      setLoading(false);
    }
  };

  const generateBackupCodes = async () => {
    setLoading(true);
    try {
      const res = await apiPost<{ codes: string[] }>('/api/auth/2fa/backup-codes/generate');
      setBackupCodes(res.codes);
      showToast({ type: 'success', title: 'Coduri de rezervă', message: 'Codurile au fost generate.' });
    } catch (err: any) {
      showToast({ type: 'error', title: 'Eroare', message: err.message || 'Nu s-a putut genera codurile.' });
    } finally {
      setLoading(false);
    }
  };

  const issueStepUp = async (actions: string[]) => {
    const res = await apiPost<{ stepUpToken: string }>('/api/auth/step-up/issue', {
      method: useBackup ? 'backup' : 'totp',
      code: stepUpCode.trim().toUpperCase(),
      actions,
    });
    return res.stepUpToken;
  };

  const disable = async () => {
    setLoading(true);
    try {
      const user = auth.currentUser;
      if (!user?.email) throw new Error('Sesiune invalidă.');

      // Ensure recent login (auth_time) for step-up token issuance.
      await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, password));
      const stepUpToken = await issueStepUp(['2fa_disable']);
      await apiPost('/api/auth/2fa/disable', {}, { stepUpToken });

      // Clear login gate (if present)
      await AsyncStorage.removeItem(`enumismatica_2fa_ok_${user.uid}`).catch(() => null);

      showToast({ type: 'success', title: 'Succes', message: '2FA a fost dezactivat.' });
      setPassword('');
      setStepUpCode('');
      setBackupCodes(null);
      await loadFlag();
    } catch (err: any) {
      showToast({ type: 'error', title: 'Eroare', message: err.message || 'Nu s-a putut dezactiva 2FA.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={{ marginBottom: 16 }}>
        <InlineBackButton />
        <Text style={[styles.title, { marginTop: 12 }]}>2FA</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Status</Text>
        <Text style={styles.helpText}>{twoFactorEnabled ? 'Activat' : 'Dezactivat'}</Text>

        <TouchableOpacity
          style={[styles.smallButton, loading && styles.buttonDisabled]}
          onPress={loadFlag}
          disabled={loading}
        >
          <Text style={styles.smallButtonText}>Reîncarcă</Text>
        </TouchableOpacity>
      </View>

      {!twoFactorEnabled ? (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Configurare</Text>
          <Text style={styles.helpText}>Generează un secret, scanează QR-ul, apoi confirmă cu un cod.</Text>

          <TouchableOpacity style={[sharedStyles.button, loading && styles.buttonDisabled]} onPress={setup} disabled={loading}>
            <Text style={sharedStyles.buttonText}>{loading ? 'Se generează...' : 'Generează QR'}</Text>
          </TouchableOpacity>

          {qrCode ? (
            <View style={{ gap: 10 }}>
              <Image source={{ uri: qrCode }} style={styles.qr} />
              <Text style={styles.monoLabel}>Secret (base32)</Text>
              <Text style={styles.mono}>{secret}</Text>
            </View>
          ) : null}

          <TextInput
            style={sharedStyles.input}
            placeholder="Cod 2FA (000000)"
            placeholderTextColor={colors.textSecondary}
            keyboardType="number-pad"
            value={code}
            onChangeText={setCode}
            maxLength={6}
          />

          <TouchableOpacity
            style={[sharedStyles.button, (!canEnable || loading) && styles.buttonDisabled]}
            onPress={enable}
            disabled={!canEnable || loading}
          >
            <Text style={sharedStyles.buttonText}>{loading ? 'Se activează...' : 'Activează 2FA'}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.smallButton, loading && styles.buttonDisabled]}
            onPress={generateBackupCodes}
            disabled={loading}
          >
            <Text style={styles.smallButtonText}>Generează coduri de rezervă</Text>
          </TouchableOpacity>

          {backupCodes ? (
            <View style={{ marginTop: 12 }}>
              <Text style={styles.helpText}>Salvează aceste coduri într-un loc sigur (sunt afișate o singură dată).</Text>
              <View style={{ gap: 6 }}>
                {backupCodes.map((c) => (
                  <Text key={c} style={styles.mono}>{c}</Text>
                ))}
              </View>
            </View>
          ) : null}
        </View>
      ) : (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Dezactivează 2FA</Text>
          <Text style={styles.helpText}>Necesită reautentificare + cod 2FA (step-up).</Text>

          <TextInput
            style={sharedStyles.input}
            placeholder="Parola curentă"
            placeholderTextColor={colors.textSecondary}
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />

          <View style={styles.toggleRow}>
            <TouchableOpacity
              style={[styles.toggleBtn, !useBackup ? styles.toggleActive : styles.toggleInactive]}
              onPress={() => {
                setUseBackup(false);
                setStepUpCode('');
              }}
            >
              <Text style={!useBackup ? styles.toggleTextActive : styles.toggleTextInactive}>Cod 2FA</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.toggleBtn, useBackup ? styles.toggleActive : styles.toggleInactive]}
              onPress={() => {
                setUseBackup(true);
                setStepUpCode('');
              }}
            >
              <Text style={useBackup ? styles.toggleTextActive : styles.toggleTextInactive}>Backup</Text>
            </TouchableOpacity>
          </View>

          <TextInput
            style={sharedStyles.input}
            placeholder={useBackup ? 'ABCD-EF12' : '000000'}
            placeholderTextColor={colors.textSecondary}
            value={stepUpCode}
            onChangeText={setStepUpCode}
            autoCapitalize="characters"
            maxLength={useBackup ? 9 : 6}
          />

          <TouchableOpacity
            style={[styles.dangerButton, (!canDisable || loading) && styles.buttonDisabled]}
            onPress={disable}
            disabled={!canDisable || loading}
          >
            <Text style={styles.dangerButtonText}>{loading ? 'Se dezactivează...' : 'Dezactivează 2FA'}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.smallButton, loading && styles.buttonDisabled]}
            onPress={generateBackupCodes}
            disabled={loading}
          >
            <Text style={styles.smallButtonText}>Regenerează coduri de rezervă</Text>
          </TouchableOpacity>

          {backupCodes ? (
            <View style={{ marginTop: 12 }}>
              <Text style={styles.helpText}>Salvează aceste coduri într-un loc sigur.</Text>
              <View style={{ gap: 6 }}>
                {backupCodes.map((c) => (
                  <Text key={c} style={styles.mono}>{c}</Text>
                ))}
              </View>
            </View>
          ) : null}
        </View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: 16,
    paddingBottom: 96,
    gap: 12,
  },
  title: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: '800',
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.borderColor,
    backgroundColor: colors.cardBackground,
    padding: 16,
  },
  sectionTitle: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 8,
  },
  helpText: {
    color: colors.textSecondary,
    fontSize: 12,
    marginBottom: 12,
  },
  smallButton: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.borderColor,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  smallButtonText: {
    color: colors.textPrimary,
    fontWeight: '700',
    fontSize: 12,
  },
  qr: {
    width: 200,
    height: 200,
    borderRadius: 12,
    backgroundColor: 'white',
    alignSelf: 'center',
  },
  monoLabel: {
    color: colors.textSecondary,
    fontSize: 11,
  },
  mono: {
    color: colors.textPrimary,
    fontFamily: 'monospace',
  },
  toggleRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  toggleBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  toggleActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  toggleInactive: {
    backgroundColor: 'transparent',
    borderColor: colors.borderColor,
  },
  toggleTextActive: {
    color: colors.primaryText,
    fontSize: 12,
    fontWeight: '800',
  },
  toggleTextInactive: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '800',
  },
  dangerButton: {
    width: '100%',
    backgroundColor: colors.error,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 6,
  },
  dangerButtonText: {
    color: 'white',
    textAlign: 'center',
    fontWeight: '800',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});

export default TwoFAScreen;

