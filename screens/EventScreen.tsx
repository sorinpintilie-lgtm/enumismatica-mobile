import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, TextInput, Switch } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import type { RootStackParamList } from '../navigationTypes';
import { colors } from '../styles/sharedStyles';
import InlineBackButton from '../components/InlineBackButton';
import { createEventRegistration } from '@shared/eventRegistrationService';

export default function EventScreen() {
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [marketingOptIn, setMarketingOptIn] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    const trimmedEmail = email.trim();
    if (!trimmedEmail || !trimmedEmail.includes('@')) {
      setError('Te rugăm să introduci o adresă de email validă.');
      return;
    }

    try {
      setIsSubmitting(true);
      await createEventRegistration({
        email: trimmedEmail,
        fullName: fullName.trim() || undefined,
        eventKey: 'app-launch-2025',
        source: 'qr-event',
        marketingOptIn,
      });
      setSuccess(true);
      setFullName('');
      setEmail('');
    } catch (err) {
      console.error('Failed to register for event', err);
      setError('A apărut o eroare la înregistrare. Încearcă din nou în câteva momente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={{ marginBottom: 16 }}>
        <InlineBackButton />
        <Text style={[styles.title, { marginTop: 12, textAlign: 'left' }]}>Eveniment</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Lansarea eNumismatica</Text>
        <Text style={styles.cardText}>
          Înregistrează-te pentru acces anticipat la aplicație și pentru noutăți despre lansare.
        </Text>

        {success ? (
          <View style={styles.successBox}>
            <Text style={styles.successTitle}>Îți mulțumim!</Text>
            <Text style={styles.successText}>
              Ți-am înregistrat adresa de email. Vei primi un mesaj când suntem gata.
            </Text>
          </View>
        ) : (
          <>
            {error ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <Text style={styles.label}>Nume complet (opțional)</Text>
            <TextInput
              value={fullName}
              onChangeText={setFullName}
              placeholder="Ex: Ion Popescu"
              placeholderTextColor={colors.textSecondary}
              style={styles.input}
            />

            <Text style={styles.label}>Email *</Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="exemplu@domeniu.ro"
              placeholderTextColor={colors.textSecondary}
              style={styles.input}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />

            <View style={styles.switchRow}>
              <Switch value={marketingOptIn} onValueChange={setMarketingOptIn} />
              <Text style={styles.switchText}>
                Da, vreau să primesc pe email noutăți despre lansare și oferte pentru colecționari.
              </Text>
            </View>

            <TouchableOpacity
              style={[styles.primaryBtn, isSubmitting && { opacity: 0.7 }]}
              activeOpacity={0.9}
              onPress={submit}
              disabled={isSubmitting}
            >
              <Text style={styles.primaryBtnText}>{isSubmitting ? 'Se înregistrează...' : 'Rezervă-mi locul'}</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </ScrollView>
  );
}

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
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'center',
    flex: 1,
    marginHorizontal: 10,
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.borderColor,
    backgroundColor: colors.cardBackground,
    padding: 16,
  },
  cardTitle: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 10,
  },
  cardText: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 14,
  },
  label: {
    color: colors.textPrimary,
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.borderColor,
    borderRadius: 12,
    backgroundColor: colors.inputBackground,
    color: colors.textPrimary,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
  },
  switchRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  switchText: {
    flex: 1,
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 16,
    marginTop: 2,
  },
  primaryBtn: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    alignItems: 'center',
  },
  primaryBtnText: {
    color: colors.primaryText,
    fontWeight: '800',
  },
  errorBox: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.5)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  errorText: {
    color: '#fecaca',
    fontSize: 12,
    fontWeight: '600',
  },
  successBox: {
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.5)',
    borderRadius: 12,
    padding: 14,
  },
  successTitle: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 6,
  },
  successText: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 16,
  },
});

