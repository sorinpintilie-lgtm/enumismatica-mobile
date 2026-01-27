import React, { createContext, useCallback, useContext, useState, ReactNode } from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet } from 'react-native';

type ToastType = 'success' | 'error' | 'info';

interface Toast {
  id: number;
  type: ToastType;
  title?: string;
  message: string;
}

interface ToastContextValue {
  showToast: (toast: { type?: ToastType; title?: string; message: string }) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return ctx;
}

export default function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    ({ type = 'info', title, message }: { type?: ToastType; title?: string; message: string }) => {
      const id = Date.now() + Math.random();
      setToasts((prev) => [...prev, { id, type, title, message }]);
      // Auto-dismiss after 5 seconds
      setTimeout(() => removeToast(id), 5000);
    },
    [removeToast],
  );

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {/* Toast stack */}
      <View style={styles.toastContainer} pointerEvents="none">
        {toasts.map((toast) => {
          const baseStyles = [styles.toastBase];
          const typeStyles = 
            toast.type === 'success'
              ? styles.toastSuccess
              : toast.type === 'error'
              ? styles.toastError
              : styles.toastInfo;

          return (
            <View key={toast.id} style={[baseStyles, typeStyles]} pointerEvents="auto">
              <View style={styles.toastContent}>
                {toast.type === 'success' && (
                  <View style={styles.toastIconSuccess}>
                    <Text style={styles.toastIconText}>✓</Text>
                  </View>
                )}
                {toast.type === 'error' && (
                  <View style={styles.toastIconError}>
                    <Text style={styles.toastIconText}>!</Text>
                  </View>
                )}
                {toast.type === 'info' && (
                  <View style={styles.toastIconInfo}>
                    <Text style={styles.toastIconText}>i</Text>
                  </View>
                )}
                <View style={styles.toastTextContainer}>
                  {toast.title && <Text style={styles.toastTitle}>{toast.title}</Text>}
                  <Text style={styles.toastMessage}>{toast.message}</Text>
                </View>
                <TouchableOpacity
                  onPress={() => removeToast(toast.id)}
                  style={styles.toastCloseButton}
                >
                  <Text style={styles.toastCloseText}>×</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        })}
      </View>
    </ToastContext.Provider>
  );
}

const styles = StyleSheet.create({
  toastContainer: {
    position: 'absolute',
    top: 60,
    right: 20,
    left: 20,
    zIndex: 100,
  },
  toastBase: {
    padding: 12,
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
  },
  toastSuccess: {
    backgroundColor: 'rgba(21, 128, 61, 0.8)',
    borderColor: 'rgba(110, 231, 183, 0.5)',
  },
  toastError: {
    backgroundColor: 'rgba(185, 28, 28, 0.8)',
    borderColor: 'rgba(248, 113, 113, 0.6)',
  },
  toastInfo: {
    backgroundColor: 'rgba(30, 41, 59, 0.9)',
    borderColor: 'rgba(231, 183, 60, 0.4)',
  },
  toastContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  toastIconSuccess: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(110, 231, 183, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  toastIconError: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(248, 113, 113, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  toastIconInfo: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(231, 183, 60, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  toastIconText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  toastTextContainer: {
    flex: 1,
  },
  toastTitle: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  toastMessage: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 12,
  },
  toastCloseButton: {
    marginLeft: 8,
    padding: 4,
  },
  toastCloseText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 16,
  },
});