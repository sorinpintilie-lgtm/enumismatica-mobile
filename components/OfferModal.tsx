import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Modal, StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { createOffer } from '../../shared/offerService';
import { useToast } from '../context/ToastContext';
import { formatEUR } from '../utils/currency';

interface OfferModalProps {
  isOpen: boolean;
  onClose: () => void;
  itemType: 'product' | 'auction';
  itemId: string;
  itemName: string;
  currentPrice?: number;
  buyerId: string;
}

export default function OfferModal({
  isOpen,
  onClose,
  itemType,
  itemId,
  itemName,
  currentPrice,
  buyerId
}: OfferModalProps) {
  const [offerAmount, setOfferAmount] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { showToast } = useToast();

  const handleSubmit = async () => {
    const amount = parseFloat(offerAmount);
    if (!amount || amount <= 0) {
      showToast({
        type: 'error',
        title: 'Sumă invalidă',
        message: 'Introdu o sumă validă mai mare decât 0.',
      });
      return;
    }

    if (currentPrice && amount < currentPrice * 0.5) {
      showToast({
        type: 'info',
        title: 'Ofertă mică',
        message: 'Oferta ta este semnificativ mai mică decât prețul actual. Consideră o sumă mai mare.',
      });
      // Don't return, allow the offer anyway
    }

    try {
      setSubmitting(true);
      await createOffer(itemType, itemId, buyerId, amount, message.trim() || undefined);

      showToast({
        type: 'success',
        title: 'Ofertă trimisă',
        message: 'Oferta ta a fost trimisă vânzătorului.',
      });

      onClose();
      setOfferAmount('');
      setMessage('');
    } catch (error: any) {
      console.error('Failed to create offer:', error);
      showToast({
        type: 'error',
        title: 'Eroare',
        message: error.message || 'A apărut o eroare la trimiterea ofertei.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      visible={isOpen}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        <TouchableOpacity
          style={styles.overlay}
          activeOpacity={1}
          onPress={onClose}
        >
          <TouchableOpacity
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}
            style={styles.modal}
          >
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.header}>
                <Text style={styles.title}>Transmite o ofertă</Text>
                <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                  <Text style={styles.closeButtonText}>✕</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.itemInfo}>
                <Text style={styles.itemName}>{itemName}</Text>
                {typeof currentPrice === 'number' && currentPrice > 0 && (
                  <Text style={styles.currentPrice}>
                    Preț actual: <Text style={styles.priceValue}>{formatEUR(currentPrice)}</Text>
                  </Text>
                )}
              </View>

              <View style={styles.form}>
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Suma ofertei (EUR) *</Text>
                  <TextInput
                    style={styles.input}
                    value={offerAmount}
                    onChangeText={setOfferAmount}
                    placeholder="Ex: 150.00"
                    placeholderTextColor="#64748b"
                    keyboardType="decimal-pad"
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Mesaj (opțional)</Text>
                  <TextInput
                    style={[styles.input, styles.textArea]}
                    value={message}
                    onChangeText={setMessage}
                    placeholder="Adaugă un mesaj pentru vânzător..."
                    placeholderTextColor="#64748b"
                    multiline
                    numberOfLines={3}
                    textAlignVertical="top"
                  />
                </View>

                <View style={styles.buttonGroup}>
                  <TouchableOpacity
                    onPress={onClose}
                    style={[styles.button, styles.cancelButton]}
                  >
                    <Text style={styles.cancelButtonText}>Anulează</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={handleSubmit}
                    disabled={submitting}
                    style={[styles.button, styles.submitButton, submitting && styles.buttonDisabled]}
                  >
                    <Text style={styles.submitButtonText}>
                      {submitting ? 'Se trimite...' : 'Trimite oferta'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </ScrollView>
          </TouchableOpacity>
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modal: {
    width: '100%',
    maxWidth: 500,
    backgroundColor: '#1a2332',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.4)',
    padding: 24,
    maxHeight: '90%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  closeButton: {
    padding: 4,
  },
  closeButtonText: {
    fontSize: 24,
    color: '#94a3b8',
  },
  itemInfo: {
    marginBottom: 16,
  },
  itemName: {
    fontSize: 14,
    color: '#ffffff',
    fontWeight: '500',
  },
  currentPrice: {
    fontSize: 14,
    color: '#94a3b8',
    marginTop: 4,
  },
  priceValue: {
    color: '#D4AF37',
    fontWeight: '600',
  },
  form: {
    gap: 16,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#cbd5e1',
    marginBottom: 8,
  },
  input: {
    width: '100%',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.4)',
    backgroundColor: 'rgba(30, 41, 59, 0.8)',
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#ffffff',
  },
  textArea: {
    height: 80,
    paddingTop: 10,
  },
  buttonGroup: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    backgroundColor: '#334155',
  },
  cancelButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  submitButton: {
    backgroundColor: '#D4AF37',
  },
  submitButtonText: {
    color: '#1a2332',
    fontSize: 14,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});
