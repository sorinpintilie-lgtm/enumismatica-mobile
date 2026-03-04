import React, { Component, ErrorInfo, ReactNode } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import crashlyticsService from '@shared/crashlyticsService';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

/**
 * User-friendly error messages mapped from common error types
 */
const ERROR_MESSAGES: Record<string, { title: string; message: string }> = {
  // Network errors
  'network': {
    title: 'Conexiune indisponibilă',
    message: 'Nu ai conexiune la internet. Verifică conexiunea și încearcă din nou.',
  },
  'timeout': {
    title: 'Timeout',
    message: 'Serverul a răspuns prea lent. Te rugăm să încerci din nou.',
  },
  'fetch': {
    title: 'Eroare de conexiune',
    message: 'Nu am putut comunica cu serverul. Verifică conexiunea.',
  },
  
  // Firebase errors
  'auth': {
    title: 'Eroare de autentificare',
    message: 'A apărut o problemă la autentificare. Te rugăm să încerci din nou.',
  },
  'permission': {
    title: 'Acces interzis',
    message: 'Nu ai permisiunea necesară pentru această acțiune.',
  },
  'firestore': {
    title: 'Eroare de date',
    message: 'Nu am putut încărca datele. Te rugăm să încerci din nou.',
  },
  
  // Storage errors
  'storage': {
    title: 'Eroare de stocare',
    message: 'Nu am putut salva datele. Verifică spațiul disponibil.',
  },
  
  // Default fallback
  'default': {
    title: 'Ceva nu a mers bine',
    message: 'Ne pare rău, a apărut o eroare neașteptată. Te rugăm să încerci din nou.',
  },
};

/**
 * Maps error objects to user-friendly message keys
 */
function getErrorType(error: Error | null): string {
  if (!error) return 'default';
  
  const errorMessage = (error.message || '').toLowerCase();
  const errorName = (error.name || '').toLowerCase();
  
  // Network-related errors
  if (
    errorMessage.includes('network') ||
    errorMessage.includes('internet') ||
    errorMessage.includes('socket') ||
    errorMessage.includes('connection')
  ) {
    return 'network';
  }
  
  // Timeout errors
  if (
    errorMessage.includes('timeout') ||
    errorMessage.includes('timed out') ||
    errorMessage.includes('request timeout')
  ) {
    return 'timeout';
  }
  
  // Fetch/API errors
  if (
    errorMessage.includes('fetch') ||
    errorMessage.includes('api') ||
    errorMessage.includes('http')
  ) {
    return 'fetch';
  }
  
  // Auth errors
  if (
    errorName.includes('auth') ||
    errorMessage.includes('auth') ||
    errorMessage.includes('login') ||
    errorMessage.includes('signin') ||
    errorMessage.includes('credential')
  ) {
    return 'auth';
  }
  
  // Permission errors
  if (
    errorMessage.includes('permission') ||
    errorMessage.includes('denied') ||
    errorMessage.includes('forbidden') ||
    errorMessage.includes('unauthorized')
  ) {
    return 'permission';
  }
  
  // Firestore errors
  if (
    errorMessage.includes('firestore') ||
    errorMessage.includes('database') ||
    errorMessage.includes('document')
  ) {
    return 'firestore';
  }
  
  // Storage errors
  if (
    errorMessage.includes('storage') ||
    errorMessage.includes('upload') ||
    errorMessage.includes('download')
  ) {
    return 'storage';
  }
  
  return 'default';
}

/**
 * Get localized error messages (Romanian)
 */
function getLocalizedError(error: Error | null): { title: string; message: string } {
  const errorType = getErrorType(error);
  return ERROR_MESSAGES[errorType] || ERROR_MESSAGES.default;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Log the error to Crashlytics for debugging
    crashlyticsService.logError(error);
    
    // Also log the component stack for better debugging
    if (__DEV__) {
      console.error('[ErrorBoundary] Caught error:', error);
      console.error('[ErrorBoundary] Component stack:', errorInfo.componentStack);
    }
    
    this.setState({
      error,
      errorInfo,
    });
  }

  handleRetry = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  handleGoHome = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
    // Navigation will be handled by the parent component
  };

  render(): ReactNode {
    if (this.state.hasError) {
      // If a custom fallback is provided, use it
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default user-friendly error UI
      const { title, message } = getLocalizedError(this.state.error);

      return (
        <View style={styles.container}>
          <View style={styles.content}>
            <View style={styles.iconContainer}>
              <Ionicons 
                name="warning-outline" 
                size={64} 
                color="#e7b73c" 
              />
            </View>
            
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.message}>{message}</Text>
            
            <View style={styles.buttonContainer}>
              <TouchableOpacity
                style={styles.primaryButton}
                onPress={this.handleRetry}
                activeOpacity={0.8}
              >
                <Text style={styles.primaryButtonText}>Încearcă din nou</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={this.handleGoHome}
                activeOpacity={0.8}
              >
                <Text style={styles.secondaryButtonText}>Înapoi la start</Text>
              </TouchableOpacity>
            </View>
            
            {/* Only show technical details in development */}
            {__DEV__ && this.state.error && (
              <View style={styles.devInfo}>
                <Text style={styles.devTitle}>Informații tehnice (doar dezvoltare):</Text>
                <Text style={styles.devText} numberOfLines={3}>
                  {this.state.error.toString()}
                </Text>
                {this.state.errorInfo?.componentStack && (
                  <Text style={styles.devText} numberOfLines={3}>
                    {this.state.errorInfo.componentStack}
                  </Text>
                )}
              </View>
            )}
          </View>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#00020d',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  content: {
    alignItems: 'center',
    maxWidth: 400,
  },
  iconContainer: {
    marginBottom: 24,
    padding: 16,
    backgroundColor: 'rgba(231, 183, 60, 0.1)',
    borderRadius: 50,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#f9fafb',
    textAlign: 'center',
    marginBottom: 12,
  },
  message: {
    fontSize: 16,
    color: '#94a3b8',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  buttonContainer: {
    width: '100%',
    gap: 12,
  },
  primaryButton: {
    backgroundColor: '#e7b73c',
    paddingVertical: 16,
    paddingHorizontal: 32,
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
    paddingVertical: 16,
    paddingHorizontal: 32,
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
  devInfo: {
    marginTop: 32,
    padding: 12,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderRadius: 8,
    width: '100%',
  },
  devTitle: {
    fontSize: 12,
    color: '#ef4444',
    fontWeight: '600',
    marginBottom: 8,
  },
  devText: {
    fontSize: 11,
    color: '#fca5a5',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
});

export default ErrorBoundary;
