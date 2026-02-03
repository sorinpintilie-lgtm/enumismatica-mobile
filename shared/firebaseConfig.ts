import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import { getAuth, initializeAuth, type Auth } from 'firebase/auth';
import type { Persistence } from 'firebase/auth';
import * as rnAuth from '@firebase/auth/dist/rn/index.js';
import { getFirestore, type Firestore } from 'firebase/firestore';
import { getAnalytics, type Analytics } from 'firebase/analytics';
import { getStorage, type FirebaseStorage } from 'firebase/storage';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const getReactNativePersistence = (rnAuth as unknown as { getReactNativePersistence: (storage: typeof AsyncStorage) => Persistence })
  .getReactNativePersistence;

// Global flag to disable Firebase in React Native
export const FIREBASE_DISABLED = false;

const firebaseConfig = {
  apiKey: "AIzaSyBbIZjstBI9an8Qnff6MEdraZErMzVjw1M",
  authDomain: "e-numismatica-ro.firebaseapp.com",
  projectId: "e-numismatica-ro",
  storageBucket: "e-numismatica-ro.firebasestorage.app",
  messagingSenderId: "686515512350",
  appId: "1:686515512350:web:c281556b58e08bcb167a0f",
  measurementId: "G-4BBCPEDX0G"
};

// Initialize Firebase - this will work on both client and server
// The Firebase SDK handles SSR automatically
let app: FirebaseApp;
let auth: Auth;
let db: Firestore;
let storage: FirebaseStorage;

// Initialize Firebase app (shared single instance across web & mobile)
if (getApps().length === 0) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApp();
}

if (Platform.OS === 'ios' || Platform.OS === 'android') {
  try {
    auth = initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage),
    });
    console.log('[Firebase] Auth initialized with React Native persistence');
  } catch (err) {
    console.error('[Firebase] Failed to initialize auth with React Native persistence, falling back to default:', err);
    auth = getAuth(app);
  }
} else {
  auth = getAuth(app);
}
db = getFirestore(app);
storage = getStorage(app);

console.log('Firebase initialized - app:', !!app, 'auth:', !!auth, 'db:', !!db, 'db type:', typeof db, 'db constructor:', db?.constructor?.name);
console.log('Firebase config:', {
  apiKey: firebaseConfig.apiKey ? 'SET' : 'NOT SET',
  authDomain: firebaseConfig.authDomain,
  projectId: firebaseConfig.projectId,
  storageBucket: firebaseConfig.storageBucket,
  messagingSenderId: firebaseConfig.messagingSenderId,
  appId: firebaseConfig.appId,
  measurementId: firebaseConfig.measurementId,
});

// Initialize Analytics (only in real browser environment – NOT React Native)
let analytics: Analytics | null = null;
if (typeof window !== 'undefined' && typeof document !== 'undefined' && typeof navigator !== 'undefined') {
  try {
    analytics = getAnalytics(app);

    // Debug logging
    console.log('Firebase initialized (Web):', {
      app: !!app,
      auth: !!auth,
      db: !!db,
      storage: !!storage,
      analytics: !!analytics,
      dbType: typeof db,
      dbConstructor: db?.constructor?.name,
    });
  } catch (err) {
    // Analytics is not supported in some environments (e.g. React Native).
    console.log('Firebase analytics not initialized in this environment:', err);
  }
} else {
  // Web environment
  console.log('Firebase initialized (Web):', {
    app: !!app,
    auth: !!auth,
    db: !!db,
    storage: !!storage,
    analytics: !!analytics,
    dbType: typeof db,
    dbConstructor: db?.constructor?.name,
  });
}

// Re-export Firestore helpers from the SAME firebase instance that created `db`.
// This avoids "Expected first argument to collection() to be a CollectionReference,\n" +
// "a DocumentReference or FirebaseFirestore" errors caused by multiple firebase installs.
export {
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  doc,
  getDoc,
  onSnapshot,
  startAfter,
  addDoc,
  deleteDoc,
  serverTimestamp,
  Timestamp,
  updateDoc,
  setDoc,
} from 'firebase/firestore';

export type { QueryDocumentSnapshot, DocumentData } from 'firebase/firestore';

export { app, auth, db, storage, analytics };
export default { app, auth, db, storage, analytics };
