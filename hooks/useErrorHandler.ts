import { useCallback, useState } from 'react';
import crashlyticsService from '@shared/crashlyticsService';

/**
 * Maps technical errors to user-friendly messages (Romanian)
 */
export interface ErrorDisplayConfig {
  title: string;
  message: string;
  retryable: boolean;
}

const ERROR_MAP: Record<string, ErrorDisplayConfig> = {
  // Network errors
  'network': {
    title: 'Conexiune indisponibilă',
    message: 'Nu ai conexiune la internet. Verifică conexiunea și încearcă din nou.',
    retryable: true,
  },
  'NETWORK_ERROR': {
    title: 'Eroare de rețea',
    message: 'Nu am putut comunica cu serverul. Verifică conexiunea la internet.',
    retryable: true,
  },
  
  // Timeout errors  
  'timeout': {
    title: 'Serverul nu răspunde',
    message: 'Serverul a răspuns prea lent. Te rugăm să încerci din nou.',
    retryable: true,
  },
  'TIMEOUT': {
    title: 'Timpul de așteptare a expirat',
    message: 'Operația a durat prea mult. Te rugăm să încerci din nou.',
    retryable: true,
  },
  
  // Firebase Auth errors
  'auth/user-not-found': {
    title: 'Utilizator negăsit',
    message: 'Nu există un cont cu această adresă de email.',
    retryable: false,
  },
  'auth/wrong-password': {
    title: 'Parolă incorectă',
    message: 'Parola introdusă este incorectă. Încearcă din nou.',
    retryable: false,
  },
  'auth/email-already-in-use': {
    title: 'Email deja folosit',
    message: 'Există deja un cont cu această adresă de email.',
    retryable: false,
  },
  'auth/weak-password': {
    title: 'Parolă prea slabă',
    message: 'Parola trebuie să aibă cel puțin 6 caractere.',
    retryable: false,
  },
  'auth/invalid-email': {
    title: 'Email invalid',
    message: 'Adresa de email introdusă nu este validă.',
    retryable: false,
  },
  'auth/network-request-failed': {
    title: 'Eroare de conexiune',
    message: 'Nu am putut comunica cu serverul de autentificare. Încearcă din nou.',
    retryable: true,
  },
  'auth/too-many-requests': {
    title: 'Prea multe încercări',
    message: 'Ai încercat de prea multe ori. Așteaptă câteva minute și încearcă din nou.',
    retryable: true,
  },
  'auth/user-disabled': {
    title: 'Cont dezactivat',
    message: 'Acest cont a fost dezactivat. Contactează suportul pentru asistență.',
    retryable: false,
  },
  
  // Firestore errors
  'firestore/permission-denied': {
    title: 'Acces interzis',
    message: 'Nu ai permisiunea necesară pentru această acțiune.',
    retryable: false,
  },
  'firestore/not-found': {
    title: 'Date negăsite',
    message: 'Informația căutată nu există sau a fost ștearsă.',
    retryable: false,
  },
  'firestore/cancelled': {
    title: 'Operație anulată',
    message: 'Operația a fost anulată. Te rugăm să încerci din nou.',
    retryable: true,
  },
  'firestore/unavailable': {
    title: 'Serviciu indisponibil',
    message: 'Baza de date nu este disponibilă momentan. Te rugăm să încerci din nou.',
    retryable: true,
  },
  
  // Storage errors
  'storage/unauthorized': {
    title: 'Acces interzis',
    message: 'Nu ai permisiunea de a încărca fișiere.',
    retryable: false,
  },
  'storage/canceled': {
    title: 'Încărcare anulată',
    message: 'Încărcarea fișierului a fost anulată.',
    retryable: true,
  },
  'storage/unknown': {
    title: 'Eroare de stocare',
    message: 'A apărut o eroare la procesarea fișierului. Te rugăm să încerci din nou.',
    retryable: true,
  },
  'storage/quota-exceeded': {
    title: 'Spațiu insuficient',
    message: 'Nu ai suficient spațiu de stocare. Șterge fișiere pentru a continua.',
    retryable: false,
  },
  
  // Default fallback
  'default': {
    title: 'Ceva nu a mers bine',
    message: 'Ne pare rău, a apărut o eroare neașteptată. Te rugăm să încerci din nou.',
    retryable: true,
  },
};

/**
 * Extract error code from various error formats
 */
function extractErrorCode(error: unknown): string {
  if (!error) return 'default';
  
  // Handle string errors
  if (typeof error === 'string') {
    return error.toLowerCase();
  }
  
  // Handle Error objects
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    
    // Check for Firebase auth error codes
    if (message.includes('auth/')) {
      const match = message.match(/auth\/([^)]+)/);
      if (match) return `auth/${match[1]}`;
    }
    
    // Check for Firebase firestore error codes
    if (message.includes('firestore/')) {
      const match = message.match(/firestore\/([^)]+)/);
      if (match) return `firestore/${match[1]}`;
    }
    
    // Check for Firebase storage error codes
    if (message.includes('storage/')) {
      const match = message.match(/storage\/([^)]+)/);
      if (match) return `storage/${match[1]}`;
    }
    
    // Check for common error keywords
    if (message.includes('network') || message.includes('internet')) return 'network';
    if (message.includes('timeout')) return 'timeout';
    
    return 'default';
  }
  
  // Handle Firebase error objects with code property
  if (typeof error === 'object' && error !== null) {
    const err = error as { code?: string; message?: string };
    if (err.code) return err.code;
    if (err.message) return extractErrorCode(err.message);
  }
  
  return 'default';
}

/**
 * Hook for handling errors gracefully with user-friendly messages
 * Use this in components to catch and display user-friendly errors
 */
export function useErrorHandler() {
  const [error, setError] = useState<ErrorDisplayConfig | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  /**
   * Handle an error and show user-friendly message
   */
  const handleError = useCallback((err: unknown, customMessage?: string) => {
    // Log to crashlytics for debugging
    if (err instanceof Error) {
      crashlyticsService.logError(err);
    } else {
      crashlyticsService.logError(new Error(String(err)));
    }

    // Get error code and look up user-friendly message
    const errorCode = extractErrorCode(err);
    const errorConfig = ERROR_MAP[errorCode] || ERROR_MAP.default;
    
    // Allow custom message override
    const displayConfig: ErrorDisplayConfig = customMessage
      ? { ...errorConfig, message: customMessage }
      : errorConfig;
    
    setError(displayConfig);
    setIsVisible(true);
    
    return displayConfig;
  }, []);

  /**
   * Dismiss the error message
   */
  const dismissError = useCallback(() => {
    setIsVisible(false);
    setError(null);
  }, []);

  /**
   * Clear the error state
   */
  const clearError = useCallback(() => {
    setError(null);
    setIsVisible(false);
  }, []);

  return {
    error,
    isVisible,
    handleError,
    dismissError,
    clearError,
    isRetryable: error?.retryable ?? false,
  };
}

/**
 * Helper function to get user-friendly error config from any error
 * Useful for one-off error handling without the hook
 */
export function getUserFriendlyError(error: unknown): ErrorDisplayConfig {
  const errorCode = extractErrorCode(error);
  return ERROR_MAP[errorCode] || ERROR_MAP.default;
}

export default useErrorHandler;
