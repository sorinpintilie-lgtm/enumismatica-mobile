import { auth } from './firebaseConfig';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  User,
  onAuthStateChanged,
} from 'firebase/auth';
import { createUserProfileAfterSignup } from './creditService';
import { logActivity } from './activityLogService';
import { sendWelcomeEmail } from './emailService';

const googleProvider = new GoogleAuthProvider();

export const signInWithEmail = async (email: string, password: string) => {
  try {
    // Sanitize inputs
    const sanitizedEmail = email.trim().toLowerCase();
    const sanitizedPassword = password.trim();

    // Basic validation
    if (!sanitizedEmail || !sanitizedPassword) {
      return { user: null, error: 'Email and password are required' };
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(sanitizedEmail)) {
      return { user: null, error: 'Invalid email format' };
    }

    const userCredential = await signInWithEmailAndPassword(auth, sanitizedEmail, sanitizedPassword);

    // Ensure Firestore user profile exists (idempotent, no referral on login)
    await createUserProfileAfterSignup(userCredential.user, null);

    // Log the login (non-blocking)
    try {
      await logActivity(
        userCredential.user.uid,
        'user_login',
        { method: 'email' },
        userCredential.user.email || undefined,
        userCredential.user.displayName || undefined
      );
    } catch (logError) {
      console.warn('Failed to log login activity:', logError);
    }

    return { user: userCredential.user, error: null };
  } catch (error: any) {
    return { user: null, error: error.message };
  }
};

export const signUpWithEmail = async (
  email: string,
  password: string,
  referralCode?: string,
  idDocumentData?: { type?: 'ci' | 'passport'; number?: string },
) => {
  try {
    // Sanitize inputs
    const sanitizedEmail = email.trim().toLowerCase();
    const sanitizedPassword = password.trim();

    // Basic validation
    if (!sanitizedEmail || !sanitizedPassword) {
      return { user: null, error: 'Email and password are required' };
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(sanitizedEmail)) {
      return { user: null, error: 'Invalid email format' };
    }

    if (sanitizedPassword.length < 6) {
      return { user: null, error: 'Password must be at least 6 characters' };
    }

    const userCredential = await createUserWithEmailAndPassword(auth, sanitizedEmail, sanitizedPassword);

    const documentNumber = idDocumentData?.number?.trim();
    const extraProfileData = documentNumber
      ? {
          idDocumentType: idDocumentData?.type || 'ci',
          idDocumentNumber: documentNumber,
          idVerificationStatus: 'pending' as const,
        }
      : undefined;

    // Create Firestore profile and apply referral bonuses (if any)
    await createUserProfileAfterSignup(userCredential.user, referralCode || null, extraProfileData);

    // Send welcome email (non-blocking)
    sendWelcomeEmail(
      userCredential.user.email || sanitizedEmail,
      userCredential.user.displayName || 'Utilizator'
    ).catch(error => {
      console.error('Failed to send welcome email:', error);
    });

    // Log the registration (non-blocking)
    try {
      await logActivity(
        userCredential.user.uid,
        'user_register',
        { method: 'email', referralCode: referralCode || undefined },
        userCredential.user.email || undefined,
        userCredential.user.displayName || undefined
      );
    } catch (logError) {
      console.warn('Failed to log registration activity:', logError);
    }

    return { user: userCredential.user, error: null };
  } catch (error: any) {
    return { user: null, error: error.message };
  }
};

export const signInWithGoogle = async (referralCode?: string) => {
  try {
    const result = await signInWithPopup(auth, googleProvider);

    // Check if this is a new user (first time signup)
    const isNewUser = result.user.metadata.creationTime === result.user.metadata.lastSignInTime;

    // Ensure profile exists and apply referral only on first signup
    await createUserProfileAfterSignup(result.user, referralCode || null);

    // Send welcome email for new users (non-blocking)
    if (isNewUser) {
      sendWelcomeEmail(
        result.user.email || '',
        result.user.displayName || 'Utilizator'
      ).catch(error => {
        console.error('Failed to send welcome email:', error);
      });
    }

    // Log the login/register (non-blocking)
    try {
      await logActivity(
        result.user.uid,
        isNewUser ? 'user_register' : 'user_login',
        { method: 'google', referralCode: referralCode || undefined },
        result.user.email || undefined,
        result.user.displayName || undefined
      );
    } catch (logError) {
      console.warn('Failed to log Google auth activity:', logError);
    }

    return { user: result.user, error: null };
  } catch (error: any) {
    return { user: null, error: error.message };
  }
};

export const logout = async () => {
  const user = auth.currentUser;

  // Never block sign-out on logging errors
  if (user) {
    try {
      await logActivity(
        user.uid,
        'user_logout',
        {},
        user.email || undefined,
        user.displayName || undefined
      );
    } catch (error) {
      console.warn('Failed to log logout activity:', error);
    }
  }

  try {
    await signOut(auth);
    return { error: null };
  } catch (error: any) {
    return { error: error.message };
  }
};

export const onAuthStateChange = (callback: (user: User | null) => void) => {
  return onAuthStateChanged(auth, callback);
};
