import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, TouchableWithoutFeedback } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useErrorHandler, ErrorDisplayConfig } from '../hooks/useErrorHandler';
import { useToast } from '../context/ToastContext';

interface UserFriendlyErrorProps {
  error: ErrorDisplayConfig | null;
  visible: boolean;
  onDismiss: () => void;
  onRetry?: () => void;
}

/**
 * Modal component that displays user-friendly error messages
 * Use this for important errors that need user attention
 */
export const UserFriendlyError: React.FC<UserFriendlyErrorProps> = ({
  error,
  visible,
  onDismiss,
  onRetry,
}) => {
  if (!error) return null;

  const handleRetry = () => {
    if (onRetry) {
      onRetry();
    }
    onDismiss();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onDismiss}
    >
      <TouchableWithoutFeedback onPress={onDismiss}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <View style={styles.container}>
              <View style={styles.iconContainer}>
                <Ionicons 
                  name="alert-circle" 
                  size={56} 
                  color="#e7b73c" 
                />
              </View>
              
              <Text style={styles.title}>{error.title}</Text>
              <Text style={styles.message}>{error.message}</Text>
              
              <View style={styles.buttonContainer}>
                {error.retryable && onRetry && (
                  <TouchableOpacity
                    style={styles.primaryButton}
                    onPress={handleRetry}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.primaryButtonText}>Încearcă din nou</Text>
                  </TouchableOpacity>
                )}
                
                <TouchableOpacity
                  style={styles.secondaryButton}
                  onPress={onDismiss}
                  activeOpacity={0.8}
                >
                  <Text style={styles.secondaryButtonText}>
                    {error.retryable ? 'Închide' : 'OK'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

/**
 * Hook wrapper that automatically shows errors via toast or modal
 * Use this for async operations that need graceful error handling
 */
export function useErrorAlert() {
  const { error, isVisible, handleError, dismissError } = useErrorHandler();
  const { showToast } = useToast();

  /**
   * Show error as a toast notification (for non-critical errors)
   */
  const showErrorToast = (err: unknown, customMessage?: string) => {
    const errorConfig = handleError(err, customMessage);
    showToast({ type: 'error', message: errorConfig.message });
    return errorConfig;
  };

  /**
   * Show error as a modal (for critical errors that need attention)
   */
  const showErrorModal = (err: unknown, customMessage?: string) => {
    const errorConfig = handleError(err, customMessage);
    return errorConfig;
  };

  return {
    error,
    isVisible,
    showErrorToast,
    showErrorModal,
    dismissError,
  };
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  container: {
    backgroundColor: '#020617',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    maxWidth: 340,
    width: '100%',
    borderWidth: 1,
    borderColor: 'rgba(231, 183, 60, 0.3)',
  },
  iconContainer: {
    marginBottom: 16,
    padding: 12,
    backgroundColor: 'rgba(231, 183, 60, 0.1)',
    borderRadius: 40,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#f9fafb',
    textAlign: 'center',
    marginBottom: 12,
  },
  message: {
    fontSize: 15,
    color: '#94a3b8',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  buttonContainer: {
    width: '100%',
    gap: 12,
  },
  primaryButton: {
    backgroundColor: '#e7b73c',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#020617',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#374151',
  },
  secondaryButtonText: {
    color: '#9ca3af',
    fontSize: 16,
    fontWeight: '500',
  },
});

export default UserFriendlyError;
