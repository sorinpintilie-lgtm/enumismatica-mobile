import React from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../styles/sharedStyles';

type AuthPromptModalProps = {
  visible: boolean;
  title: string;
  message: string;
  benefits?: string[];
  onClose: () => void;
  onLogin: () => void;
  onRegister: () => void;
};

const AuthPromptModal: React.FC<AuthPromptModalProps> = ({
  visible,
  title,
  message,
  benefits = [],
  onClose,
  onLogin,
  onRegister,
}) => {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.headerRow}>
            <View style={styles.headerIcon}>
              <Ionicons name="lock-closed" size={18} color={colors.primary} />
            </View>
            <Text style={styles.title}>{title}</Text>
          </View>

          <Text style={styles.message}>{message}</Text>

          {benefits.length > 0 && (
            <View style={styles.benefitsList}>
              {benefits.map((benefit) => (
                <View key={benefit} style={styles.benefitRow}>
                  <Ionicons name="checkmark-circle" size={16} color={colors.primary} />
                  <Text style={styles.benefitText}>{benefit}</Text>
                </View>
              ))}
            </View>
          )}

          <View style={styles.actions}>
            <TouchableOpacity style={styles.loginButton} onPress={onLogin}>
              <Text style={styles.loginButtonText}>Autentificare</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.registerButton} onPress={onRegister}>
              <Text style={styles.registerButtonText}>Înregistrare</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.dismissButton} onPress={onClose}>
            <Text style={styles.dismissText}>Poate mai târziu</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(2, 6, 23, 0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 18,
    padding: 20,
    backgroundColor: '#0b1220',
    borderWidth: 1,
    borderColor: 'rgba(231, 183, 60, 0.35)',
    shadowColor: '#000',
    shadowOpacity: 0.6,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 12 },
    elevation: 10,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  headerIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(231, 183, 60, 0.15)',
    marginRight: 10,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#f8fafc',
  },
  message: {
    fontSize: 14,
    color: '#cbd5f5',
    lineHeight: 20,
    marginBottom: 12,
  },
  benefitsList: {
    marginBottom: 16,
    gap: 8,
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  benefitText: {
    color: '#e2e8f0',
    fontSize: 13,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
  },
  loginButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
  },
  loginButtonText: {
    color: '#000940',
    fontWeight: '700',
  },
  registerButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#3b82f6',
    alignItems: 'center',
  },
  registerButtonText: {
    color: '#000940',
    fontWeight: '700',
  },
  dismissButton: {
    marginTop: 12,
    alignItems: 'center',
  },
  dismissText: {
    color: '#94a3b8',
    fontSize: 12,
  },
});

export default AuthPromptModal;
