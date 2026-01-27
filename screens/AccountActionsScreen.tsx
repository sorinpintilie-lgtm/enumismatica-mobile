import React, { useMemo, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import { auth } from '@shared/firebaseConfig';
import { logout } from '@shared/auth';
import type { RootStackParamList } from '../navigationTypes';
import { sharedStyles, colors } from '../styles/sharedStyles';
import { useToast } from '../context/ToastContext';
import { apiPost } from '../services/apiClient';
import InlineBackButton from '../components/InlineBackButton';

const AccountActionsScreen: React.FC = () => {
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  const { showToast } = useToast();

  const [loading, setLoading] = useState(false);
  const [password, setPassword] = useState('');
  const [useBackup, setUseBackup] = useState(false);
  const [code, setCode] = useState('');

  const canSubmit = useMemo(() => {
    return !!password && code.trim().length >= (useBackup ? 8 : 6);
  }, [password, code, useBackup]);

  const issueStepUp = async (actions: string[]) => {
    const res = await apiPost<{ stepUpToken: string }>('/api/auth/step-up/issue', {
      method: useBackup ? 'backup' : 'totp',
      code: code.trim().toUpperCase(),
      actions,
    });
    return res.stepUpToken;
  };

  const reauth = async () => {
    const user = auth.currentUser;
    if (!user?.email) throw new Error('Sesiune invalidă.');
    await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, password));
  };

  const doDeactivate = async () => {
    setLoading(true);
    try {
      if (!canSubmit) throw new Error('Completează parola și codul.');
      await reauth();
      const stepUpToken = await issueStepUp(['account_deactivate']);
      await apiPost('/api/account/deactivate', {}, { stepUpToken });

      showToast({ type: 'success', title: 'Cont dezactivat', message: 'Contul a fost dezactivat.' });
      await logout();
      navigation.navigate('Login');
    } catch (err: any) {
      showToast({ type: 'error', title: 'Eroare', message: err.message || 'Nu s-a putut dezactiva contul.' });
    } finally {
      setLoading(false);
    }
  };

  const doDelete = async () => {
    setLoading(true);
    try {
      if (!canSubmit) throw new Error('Completează parola și codul.');
      await reauth();
      const stepUpToken = await issueStepUp(['account_delete']);
      await apiPost('/api/auth/delete-account', {}, { stepUpToken });

      showToast({ type: 'success', title: 'Cont șters', message: 'Contul a fost șters.' });
      await logout();
      navigation.navigate('Login');
    } catch (err: any) {
      showToast({ type: 'error', title: 'Eroare', message: err.message || 'Nu s-a putut șterge contul.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={{ marginBottom: 16 }}>
        <InlineBackButton />
        <Text style={[styles.title, { marginTop: 12 }]}>Acțiuni cont</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.helpText}>
          Pentru acțiuni sensibile este necesară verificare suplimentară (step-up): parola + cod 2FA/backup.
        </Text>

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
              setCode('');
            }}
          >
            <Text style={!useBackup ? styles.toggleTextActive : styles.toggleTextInactive}>Cod 2FA</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleBtn, useBackup ? styles.toggleActive : styles.toggleInactive]}
            onPress={() => {
              setUseBackup(true);
              setCode('');
            }}
          >
            <Text style={useBackup ? styles.toggleTextActive : styles.toggleTextInactive}>Backup</Text>
          </TouchableOpacity>
        </View>

        <TextInput
          style={sharedStyles.input}
          placeholder={useBackup ? 'ABCD-EF12' : '000000'}
          placeholderTextColor={colors.textSecondary}
          value={code}
          onChangeText={setCode}
          autoCapitalize="characters"
          maxLength={useBackup ? 9 : 6}
        />
      </View>

      <View style={[styles.card, styles.warningCard]}>
        <Text style={styles.sectionTitle}>Dezactivează contul</Text>
        <Text style={styles.helpText}>
          Dezactivarea oprește listările tale și marchează contul ca dezactivat.
        </Text>
        <TouchableOpacity
          style={[styles.warningButton, (!canSubmit || loading) && styles.buttonDisabled]}
          onPress={doDeactivate}
          disabled={!canSubmit || loading}
        >
          <Text style={styles.warningButtonText}>{loading ? 'Se procesează...' : 'Dezactivează contul'}</Text>
        </TouchableOpacity>
      </View>

      <View style={[styles.card, styles.dangerCard]}>
        <Text style={styles.sectionTitle}>Șterge contul</Text>
        <Text style={styles.helpText}>
          Ștergerea este permanentă și va elimina datele asociate contului.
        </Text>
        <TouchableOpacity
          style={[styles.dangerButton, (!canSubmit || loading) && styles.buttonDisabled]}
          onPress={doDelete}
          disabled={!canSubmit || loading}
        >
          <Text style={styles.dangerButtonText}>{loading ? 'Se procesează...' : 'Șterge contul'}</Text>
        </TouchableOpacity>
      </View>
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
  helpText: {
    color: colors.textSecondary,
    fontSize: 12,
    marginBottom: 10,
  },
  sectionTitle: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '900',
    marginBottom: 8,
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
    fontWeight: '900',
  },
  toggleTextInactive: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '900',
  },
  warningCard: {
    borderColor: 'rgba(245, 158, 11, 0.6)',
  },
  dangerCard: {
    borderColor: 'rgba(239, 68, 68, 0.6)',
  },
  warningButton: {
    borderRadius: 12,
    backgroundColor: '#F59E0B',
    paddingVertical: 12,
  },
  warningButtonText: {
    color: '#000940',
    textAlign: 'center',
    fontWeight: '900',
  },
  dangerButton: {
    borderRadius: 12,
    backgroundColor: colors.error,
    paddingVertical: 12,
  },
  dangerButtonText: {
    color: 'white',
    textAlign: 'center',
    fontWeight: '900',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});

export default AccountActionsScreen;

