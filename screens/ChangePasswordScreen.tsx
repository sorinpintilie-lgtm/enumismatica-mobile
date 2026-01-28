import React, { useMemo, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { z } from 'zod';
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword } from 'firebase/auth';
import { auth } from '@shared/firebaseConfig';
import type { RootStackParamList } from '../navigationTypes';
import { sharedStyles, colors } from '../styles/sharedStyles';
import { useToast } from '../context/ToastContext';
import InlineBackButton from '../components/InlineBackButton';

const schema = z
  .object({
    currentPassword: z.string().min(6, 'Parola curentă este obligatorie'),
    newPassword: z.string().min(6, 'Parola nouă trebuie să aibă cel puțin 6 caractere'),
    confirmPassword: z.string().min(6, 'Confirmă parola nouă'),
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Parolele nu coincid',
  });

const ChangePasswordScreen: React.FC = () => {
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  const { showToast } = useToast();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const disabled = useMemo(() => {
    return loading || !currentPassword || !newPassword || !confirmPassword;
  }, [loading, currentPassword, newPassword, confirmPassword]);

  const onSubmit = async () => {
    setLoading(true);
    try {
      schema.parse({ currentPassword, newPassword, confirmPassword });
      const user = auth.currentUser;
      if (!user?.email)      throw new Error('Sesiune invalidă. Autentificați-vă din nou.');

      const cred = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(user, cred);
      await updatePassword(user, newPassword);

      showToast({ type: 'success', title: 'Succes', message: 'Parola a fost schimbată.' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      navigation.goBack();
    } catch (err: any) {
      const message = err?.issues?.[0]?.message || err?.message || 'Nu s-a putut schimba parola.';
      showToast({ type: 'error', title: 'Eroare', message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={{ marginBottom: 16 }}>
        <InlineBackButton />
        <Text style={[styles.title, { marginTop: 12 }]}>Schimbă parola</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.helpText}>Pentru siguranță, confirmă parola curentă.</Text>

        <TextInput
          style={sharedStyles.input}
          placeholder="Parola curentă"
          placeholderTextColor={colors.textSecondary}
          secureTextEntry
          value={currentPassword}
          onChangeText={setCurrentPassword}
        />
        <TextInput
          style={sharedStyles.input}
          placeholder="Parola nouă"
          placeholderTextColor={colors.textSecondary}
          secureTextEntry
          value={newPassword}
          onChangeText={setNewPassword}
        />
        <TextInput
          style={sharedStyles.input}
          placeholder="Confirmă parola nouă"
          placeholderTextColor={colors.textSecondary}
          secureTextEntry
          value={confirmPassword}
          onChangeText={setConfirmPassword}
        />

        <TouchableOpacity style={[sharedStyles.button, disabled && styles.buttonDisabled]} onPress={onSubmit} disabled={disabled}>
          <Text style={sharedStyles.buttonText}>{loading ? 'Se salvează...' : 'Salvează'}</Text>
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
    marginBottom: 12,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});

export default ChangePasswordScreen;

