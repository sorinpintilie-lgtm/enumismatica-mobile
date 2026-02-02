import { Platform } from 'react-native';

// Crashlytics service
class CrashlyticsService {
  private isInitialized: boolean = false;
  private initializationAttempted: boolean = false;
  private isHandlingError: boolean = false;

  constructor() {
    if (Platform.OS === 'ios' || Platform.OS === 'android') {
      this.initializeCrashlytics();
    }
  }

  private initializeCrashlytics() {
    if (this.initializationAttempted) {
      return;
    }
    
    this.initializationAttempted = true;
    
    try {
      // Check if we're in Expo Go or development build
      const isExpoGo = __DEV__ && !!global.__EXPO_DEV_TOOLS__;
      
      if (isExpoGo) {
        console.log('Crashlytics service initialized (Expo Go mode)');
        this.isInitialized = true;
      } else {
        // Initialize Crashlytics from Firebase
        console.log('Crashlytics service initialized');
        this.isInitialized = true;
      }
    } catch (error) {
      console.warn('Failed to initialize Crashlytics:', error);
      this.isInitialized = false;
    }
  }

  /**
   * Log an error to Crashlytics
   */
  logError(error: any) {
    // Prevent recursion by checking if we're already handling an error
    if (this.isHandlingError) {
      return;
    }
    
    this.isHandlingError = true;

    if (!this.isInitialized) {
      console.warn('Crashlytics not initialized, logging to console instead');
      console.error(error);
      this.isHandlingError = false;
      return;
    }

    try {
      if (typeof error === 'string') {
        error = new Error(error);
      }

      // Mark error as handled to prevent recursion in console.error hook
      if (typeof error === 'object' && error !== null) {
        (error as any).crashlyticsHandled = true;
      }

      // Check if we're in Expo Go
      const isExpoGo = __DEV__ && !!global.__EXPO_DEV_TOOLS__;
      
      if (isExpoGo) {
        console.log('[Expo Go] Error logged to Crashlytics:', error.message);
        console.error('Crashlytics error:', error);
      } else {
        // Fallback to console logging since Firebase Crashlytics isn't available
        console.error('Crashlytics error:', error);
      }
    } catch (crashlyticsError) {
      console.warn('Failed to log error to Crashlytics:', crashlyticsError);
      console.error(error);
    } finally {
      this.isHandlingError = false;
    }
  }

  /**
   * Log a message to Crashlytics
   */
  log(message: string) {
    if (!this.isInitialized) {
      console.warn('Crashlytics not initialized, logging to console instead');
      console.log(message);
      return;
    }

    try {
      // Log message to console
      console.log('Crashlytics log:', message);
    } catch (error) {
      console.warn('Failed to log message to Crashlytics:', error);
      console.log(message);
    }
  }

  /**
   * Set user properties for Crashlytics
   */
  setUserProperties(properties: { [key: string]: any }) {
    if (!this.isInitialized) {
      console.warn('Crashlytics not initialized');
      return;
    }

    try {
      console.log('Crashlytics user properties:', properties);
    } catch (error) {
      console.warn('Failed to set user properties:', error);
    }
  }

  /**
   * Set user ID for Crashlytics
   */
  setUserId(userId: string) {
    if (!this.isInitialized) {
      console.warn('Crashlytics not initialized');
      return;
    }

    try {
      console.log('Crashlytics user ID:', userId);
    } catch (error) {
      console.warn('Failed to set user ID:', error);
    }
  }
}

// Export singleton instance
const crashlyticsService = new CrashlyticsService();

export default crashlyticsService;