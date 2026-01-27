import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Image,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import type { RootStackParamList } from '../navigationTypes';
import { colors } from '../styles/sharedStyles';
import { parseCnp, validCnp } from '@shared/cnpValidator';
import InlineBackButton from '../components/InlineBackButton';

type Step = 1 | 2 | 3 | 4 | 5;

interface PronumismaticaForm {
  lastName: string;
  firstName: string;
  cnp: string;
  country: string;
  county: string;
  city: string;
  address: string;
  idType: 'CI' | 'BI' | 'Pasaport' | '';
  idSeries: string;
  phone: string;
  email: string;
}

const initialForm: PronumismaticaForm = {
  lastName: '',
  firstName: '',
  cnp: '',
  country: '',
  county: '',
  city: '',
  address: '',
  idType: '',
  idSeries: '',
  phone: '',
  email: '',
};

export default function PronumismaticaScreen() {
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  const [step, setStep] = useState<Step>(1);
  const [form, setForm] = useState<PronumismaticaForm>(initialForm);
  const [idFront, setIdFront] = useState<File | null>(null);
  const [idBack, setIdBack] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [idFrontUri, setIdFrontUri] = useState<string | null>(null);
  const [idBackUri, setIdBackUri] = useState<string | null>(null);

  const handleChange = (name: keyof PronumismaticaForm, value: string) => {
    const sanitizedValue = name === 'cnp' ? value.replace(/\D+/g, '') : value;
    setForm((prev) => ({ ...prev, [name]: sanitizedValue }));
  };

  const cnpStatus = form.cnp.trim().length > 0 ? parseCnp(form.cnp) : null;

  // Auto-fill relevant form fields when the CNP becomes valid
  useEffect(() => {
    const cnp = form.cnp.trim();
    if (cnp.length !== 13) return;
    const parsed = parseCnp(cnp);
    if (!parsed.valid) return;

    setForm((prev) => {
      let changed = false;
      const next = { ...prev };

      // Convenience: if country is empty, default to Romania
      if (!prev.country.trim()) {
        next.country = 'România';
        changed = true;
      }

      // Convenience: if address county is empty, use the county decoded from the CNP
      // Skip if it's "Străinătate"
      if (!prev.county.trim() && parsed.parsed.county_of_birth !== 'Străinătate') {
        next.county = parsed.parsed.county_of_birth;
        changed = true;
      }

      return changed ? next : prev;
    });
  }, [form.cnp]);

  const handleFileChange = (name: 'idFront' | 'idBack', uri: string) => {
    if (name === 'idFront') {
      setIdFrontUri(uri);
    } else {
      setIdBackUri(uri);
    }
    setError(null);
  };

  const canGoNext = () => {
    if (step === 1) {
      return form.lastName.trim() !== '' && form.firstName.trim() !== '' && validCnp(form.cnp);
    }
    if (step === 2) {
      return form.country.trim() !== '' && form.county.trim() !== '' && form.city.trim() !== '' && form.address.trim() !== '';
    }
    if (step === 3) {
      return form.idType !== '' && form.idSeries.trim() !== '';
    }
    if (step === 4) {
      return form.phone.trim() !== '' && form.email.trim() !== '';
    }
    if (step === 5) {
      return !!idFrontUri && !!idBackUri;
    }
    return false;
  };

  const nextStep = () => {
    if (step < 5 && canGoNext()) {
      setStep((prev) => (prev + 1) as Step);
    }
  };

  const prevStep = () => {
    if (step > 1) {
      setStep((prev) => (prev - 1) as Step);
    }
  };

  const handleSubmit = async () => {
    if (!canGoNext() || step !== 5) {
      setError('Te rugăm să completezi toate câmpurile obligatorii.');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      setSuccess(null);

      // Create FormData
      const formData = new FormData();
      (Object.keys(form) as Array<keyof PronumismaticaForm>).forEach((key) => {
        formData.append(key, String(form[key] ?? ''));
      });

      // Add files if available
      if (idFrontUri) {
        const uriParts = idFrontUri.split('.');
        const fileType = uriParts[uriParts.length - 1];
        const name = `id-front.${fileType}`;
        
        formData.append('idFront', {
          uri: idFrontUri,
          name: name,
          type: `image/${fileType}`,
        } as any);
      }

      if (idBackUri) {
        const uriParts = idBackUri.split('.');
        const fileType = uriParts[uriParts.length - 1];
        const name = `id-back.${fileType}`;
        
        formData.append('idBack', {
          uri: idBackUri,
          name: name,
          type: `image/${fileType}`,
        } as any);
      }

      // Send to API
      const response = await fetch(`${process.env.EXPO_PUBLIC_API_URL || 'https://enumismatica.ro'}/api/pronumismatica`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Cererea nu a putut fi trimisă. Încearcă din nou mai târziu.');
      }

      setSuccess('Formularul a fost trimis cu succes. Vei fi contactat în curând.');
      setForm(initialForm);
      setIdFrontUri(null);
      setIdBackUri(null);
      setStep(1);
    } catch (err: any) {
      console.error('Pronumismatica form submit error:', err);
      setError(
        err?.message ||
          'A apărut o eroare la trimiterea formularului. Te rugăm să încerci din nou.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={{ marginBottom: 16 }}>
        <InlineBackButton />
        <Text style={[styles.title, { marginTop: 12, textAlign: 'left' }]}>Asociația Pronumismatica</Text>
      </View>

      {/* Stepper indicator */}
      <View style={styles.stepperContainer}>
        <View style={styles.stepperTextContainer}>
          <Text style={styles.stepperText}>
            Pasul {step} din 5: {['Identitate', 'Adresă', 'Act de identitate', 'Contact', 'Încarcă acte'][step - 1]}
          </Text>
          <View style={styles.stepperBar}>
            <View
              style={[
                styles.stepperProgress,
                { width: `${(step / 5) * 100}%` }
              ]}
            />
          </View>
        </View>
      </View>

      {/* Form */}
      <View style={styles.formContainer}>
        {step === 1 && (
          <View style={styles.stepContainer}>
            <Text style={styles.label}>Nume *</Text>
            <TextInput
              style={styles.input}
              value={form.lastName}
              onChangeText={(text) => handleChange('lastName', text)}
              placeholder="Introduceți numele"
              autoCapitalize="words"
            />

            <Text style={styles.label}>Prenume *</Text>
            <TextInput
              style={styles.input}
              value={form.firstName}
              onChangeText={(text) => handleChange('firstName', text)}
              placeholder="Introduceți prenumele"
              autoCapitalize="words"
            />

            <Text style={styles.label}>CNP *</Text>
            <TextInput
              style={styles.input}
              value={form.cnp}
              onChangeText={(text) => handleChange('cnp', text)}
              placeholder="13 cifre"
              keyboardType="numeric"
              maxLength={13}
            />
            {form.cnp.trim().length > 0 && form.cnp.trim().length < 13 && (
              <Text style={styles.errorText}>CNP trebuie să conțină 13 cifre.</Text>
            )}
            {form.cnp.trim().length === 13 && cnpStatus && !cnpStatus.valid && (
              <Text style={styles.errorText}>CNP invalid.</Text>
            )}
            {form.cnp.trim().length === 13 && cnpStatus && cnpStatus.valid && (
              <Text style={styles.successText}>
                CNP valid • Născut(ă): {cnpStatus.parsed.date_of_birth} • Județ: {cnpStatus.parsed.county_of_birth}
              </Text>
            )}
          </View>
        )}

        {step === 2 && (
          <View style={styles.stepContainer}>
            <Text style={styles.label}>Țara *</Text>
            <TextInput
              style={styles.input}
              value={form.country}
              onChangeText={(text) => handleChange('country', text)}
              placeholder="Introduceți țara"
              autoCapitalize="words"
            />

            <Text style={styles.label}>Județ *</Text>
            <TextInput
              style={styles.input}
              value={form.county}
              onChangeText={(text) => handleChange('county', text)}
              placeholder="Introduceți județul"
              autoCapitalize="words"
            />

            <Text style={styles.label}>Oraș *</Text>
            <TextInput
              style={styles.input}
              value={form.city}
              onChangeText={(text) => handleChange('city', text)}
              placeholder="Introduceți orașul"
              autoCapitalize="words"
            />

            <Text style={styles.label}>Adresă *</Text>
            <TextInput
              style={styles.input}
              value={form.address}
              onChangeText={(text) => handleChange('address', text)}
              placeholder="Introduceți adresă"
              autoCapitalize="sentences"
            />
          </View>
        )}

        {step === 3 && (
          <View style={styles.stepContainer}>
            <Text style={styles.label}>Tip act de identitate *</Text>
            <View style={styles.radioContainer}>
              {(['CI', 'BI', 'Pasaport'] as const).map((type) => (
                <TouchableOpacity
                  key={type}
                  style={[
                    styles.radioButton,
                    form.idType === type && styles.radioButtonSelected,
                  ]}
                  onPress={() => handleChange('idType', type)}
                >
                  <Text style={[
                    styles.radioText,
                    form.idType === type && styles.radioTextSelected,
                  ]}>
                    {type}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>Serie / număr document identitate *</Text>
            <TextInput
              style={styles.input}
              value={form.idSeries}
              onChangeText={(text) => handleChange('idSeries', text)}
              placeholder="Introduceți seria și numărul"
              autoCapitalize="characters"
            />
          </View>
        )}

        {step === 4 && (
          <View style={styles.stepContainer}>
            <Text style={styles.label}>Număr de telefon *</Text>
            <TextInput
              style={styles.input}
              value={form.phone}
              onChangeText={(text) => handleChange('phone', text)}
              placeholder="Introduceți numărul de telefon"
              keyboardType="phone-pad"
            />

            <Text style={styles.label}>Email *</Text>
            <TextInput
              style={styles.input}
              value={form.email}
              onChangeText={(text) => handleChange('email', text)}
              placeholder="Introduceți emailul"
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>
        )}

        {step === 5 && (
          <View style={styles.stepContainer}>
            <View style={styles.infoBox}>
              <Text style={styles.infoText}>
                Încarcă poze clare ale actului selectat ({form.idType || 'act'}):{' '}
                <Text style={styles.bold}>față</Text> și <Text style={styles.bold}>verso</Text>.
              </Text>
            </View>

            <Text style={styles.label}>Act identitate - Față *</Text>
            <TouchableOpacity
              style={styles.uploadButton}
              onPress={() => {
                // In a real app, you would use ImagePicker to select an image
                Alert.alert('Funcție în dezvoltare', 'Selectarea imaginii va fi disponibilă în viitoarele versiuni');
              }}
            >
              <Text style={styles.uploadButtonText}>
                {idFrontUri ? 'Schimbă imaginea' : 'Încarcă imagine'}
              </Text>
            </TouchableOpacity>
            {idFrontUri && (
              <View style={styles.imagePreviewContainer}>
                <Image
                  source={{ uri: idFrontUri }}
                  style={styles.imagePreview}
                  resizeMode="contain"
                />
              </View>
            )}

            <Text style={styles.label}>Act identitate - Verso *</Text>
            <TouchableOpacity
              style={styles.uploadButton}
              onPress={() => {
                // In a real app, you would use ImagePicker to select an image
                Alert.alert('Funcție în dezvoltare', 'Selectarea imaginii va fi disponibilă în viitoarele versiuni');
              }}
            >
              <Text style={styles.uploadButtonText}>
                {idBackUri ? 'Schimbă imaginea' : 'Încarcă imagine'}
              </Text>
            </TouchableOpacity>
            {idBackUri && (
              <View style={styles.imagePreviewContainer}>
                <Image
                  source={{ uri: idBackUri }}
                  style={styles.imagePreview}
                  resizeMode="contain"
                />
              </View>
            )}
          </View>
        )}

        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {success && (
          <View style={styles.successContainer}>
            <Text style={styles.successText}>{success}</Text>
          </View>
        )}

        {/* Navigation buttons */}
        <View style={styles.navigationButtonsContainer}>
          <TouchableOpacity
            style={[styles.navButton, styles.backButton, step === 1 && styles.disabledButton]}
            onPress={prevStep}
            disabled={step === 1 || submitting}
          >
            <Text style={styles.navButtonText}>Înapoi</Text>
          </TouchableOpacity>

          {step < 5 ? (
            <TouchableOpacity
              style={[
                styles.navButton,
                styles.nextButton,
                (!canGoNext() || submitting) && styles.disabledButton,
              ]}
              onPress={nextStep}
              disabled={!canGoNext() || submitting}
            >
              <Text style={styles.navButtonText}>Următorul pas</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[
                styles.navButton,
                styles.submitButton,
                (!canGoNext() || submitting) && styles.disabledButton,
              ]}
              onPress={handleSubmit}
              disabled={!canGoNext() || submitting}
            >
              <Text style={styles.navButtonText}>
                {submitting ? 'Se trimite...' : 'Trimite formularul'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
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
  stepperContainer: {
    marginBottom: 16,
  },
  stepperTextContainer: {
    alignItems: 'center',
    marginBottom: 4,
  },
  stepperText: {
    fontSize: 14,
    color: '#9ca3af',
    fontWeight: '500',
  },
  stepperBar: {
    width: '100%',
    height: 2,
    backgroundColor: '#334155',
    borderRadius: 1,
    marginTop: 2,
  },
  stepperProgress: {
    height: 2,
    backgroundColor: '#e7b73c',
    borderRadius: 1,
  },
  formContainer: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.borderColor,
    backgroundColor: colors.cardBackground,
    padding: 16,
  },
  stepContainer: {
    marginBottom: 16,
  },
  label: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderWidth: 1,
    borderColor: colors.borderColor,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.textPrimary,
    marginBottom: 16,
  },
  errorText: {
    color: '#ef4444',
    fontSize: 12,
    marginBottom: 16,
  },
  successText: {
    color: '#10b981',
    fontSize: 12,
    marginBottom: 16,
  },
  radioContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  radioButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.borderColor,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    marginHorizontal: 4,
  },
  radioButtonSelected: {
    backgroundColor: 'rgba(231, 183, 60, 0.2)',
    borderColor: colors.primary,
  },
  radioText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  radioTextSelected: {
    color: colors.primary,
  },
  infoBox: {
    backgroundColor: 'rgba(231, 183, 60, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(231, 183, 60, 0.3)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  infoText: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 16,
  },
  bold: {
    fontWeight: '700',
  },
  uploadButton: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    marginBottom: 16,
  },
  uploadButtonText: {
    color: colors.primaryText,
    fontSize: 14,
    fontWeight: '600',
  },
  imagePreviewContainer: {
    marginBottom: 16,
  },
  imagePreview: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  navigationButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  navButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginHorizontal: 4,
  },
  backButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: colors.borderColor,
  },
  nextButton: {
    backgroundColor: colors.primary,
  },
  submitButton: {
    backgroundColor: colors.primary,
  },
  disabledButton: {
    opacity: 0.5,
  },
  navButtonText: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '600',
  },
  errorContainer: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  successContainer: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
});
