import { auth } from './firebaseConfig';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  User,
  onAuthStateChanged,
  sendEmailVerification,
} from 'firebase/auth';
import { createUserProfileAfterSignup } from './creditService';
import { logActivity } from './activityLogService';
import { sendWelcomeEmail } from './emailService';

const googleProvider = new GoogleAuthProvider();

 export const signInWithEmail = async (email: string, password: string) => {
  console.log('[Auth] signInWithEmail called with:', email);
  
  try {
    // Sanitize inputs
    const sanitizedEmail = email.trim().toLowerCase();
    const sanitizedPassword = password.trim();

    // Basic validation
    if (!sanitizedEmail || !sanitizedPassword) {
      console.log('[Auth] Empty email or password');
      return { user: null, error: 'Email and password are required' };
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(sanitizedEmail)) {
      console.log('[Auth] Invalid email format');
      return { user: null, error: 'Invalid email format' };
    }

    console.log('[Auth] Attempting sign in with email:', sanitizedEmail);
    const userCredential = await signInWithEmailAndPassword(auth, sanitizedEmail, sanitizedPassword);
    console.log('[Auth] Sign in successful:', userCredential.user?.uid);

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
    console.error('[Auth] Sign in error:', {
      code: error?.code,
      message: error?.message,
      name: error?.name,
      stack: error?.stack,
    });
    return { user: null, error: error.message };
  }
};

export const signUpWithEmail = async (
  email: string,
  password: string,
  referralCode?: string,
  idDocumentData?: {
    type?: 'ci' | 'passport';
    series?: string;
    number?: string;
    frontPhoto?: File;
    backPhoto?: File;
  },
  cnp?: string,
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

    // Send Firebase verification email (non-blocking)
    sendEmailVerification(userCredential.user).catch((verificationError) => {
      console.warn('Failed to send Firebase verification email:', verificationError);
    });

    const documentNumber = idDocumentData?.number?.trim();
    const normalizedCnp = (cnp || '').trim().replace(/[\s-]+/g, '');

    const extraProfileData: any = {};

    if (documentNumber) {
      extraProfileData.idDocumentType = idDocumentData?.type || 'ci';
      extraProfileData.idDocumentNumber = documentNumber;
      if (idDocumentData?.series) {
        extraProfileData.idDocumentSeries = idDocumentData.series;
      }
      extraProfileData.idVerificationStatus = 'pending' as const;
    }

    if (normalizedCnp) {
      // Validation happens in the caller (web/mobile UI). Here we only store.
      extraProfileData.cnp = normalizedCnp;
    }

    const hasExtraProfileData = Object.keys(extraProfileData).length > 0;

    // Handle ID document photo uploads
    if (idDocumentData?.frontPhoto || idDocumentData?.backPhoto) {
      const { uploadIdDocumentPhoto } = await import('./storageService');
      const documentPhotos: string[] = [];
      
      if (idDocumentData.frontPhoto) {
        const frontPhotoUrl = await uploadIdDocumentPhoto(
          idDocumentData.frontPhoto,
          userCredential.user.uid,
          idDocumentData.type || 'ci'
        );
        documentPhotos.push(frontPhotoUrl);
      }
      
      if (idDocumentData.backPhoto) {
        const backPhotoUrl = await uploadIdDocumentPhoto(
          idDocumentData.backPhoto,
          userCredential.user.uid,
          idDocumentData.type || 'ci'
        );
        documentPhotos.push(backPhotoUrl);
      }
      
      if (documentPhotos.length > 0) {
        extraProfileData.idDocumentPhotos = documentPhotos;
      }
    }

    // Create Firestore profile and apply referral bonuses (if any)
    await createUserProfileAfterSignup(
      userCredential.user,
      referralCode || null,
      hasExtraProfileData ? extraProfileData : undefined,
    );

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
