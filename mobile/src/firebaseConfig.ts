import { initializeApp, getApps, getApp } from 'firebase/app';
import { initializeFirestore, getFirestore, CACHE_SIZE_UNLIMITED } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY || 'AIzaSyC57TfyLD_-0PqJa1_rLiX49sSIMJ3XNI4',
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || 'afoodoo.firebaseapp.com',
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || 'afoodoo',
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || 'afoodoo.firebasestorage.app',
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '897988707530',
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID || '1:897988707530:web:187e1980f9cb7876266033',
};

// Initialize Firebase App once
const isFirstInit = !getApps().length;
export const app = isFirstInit ? initializeApp(firebaseConfig) : getApp();

// Firestore with Force Long-Polling for Android emulator compatibility
export const firestore = isFirstInit
  ? initializeFirestore(app, {
      experimentalForceLongPolling: true,
      cacheSizeBytes: CACHE_SIZE_UNLIMITED,
    })
  : getFirestore(app);

// NOTE: Firebase Auth is NOT initialized here.
// Auth is initialized lazily inside AuthScreen.tsx to avoid
// the "Component auth has not been registered yet" error that occurs
// when auth SDK loads before Firebase app is fully ready.
