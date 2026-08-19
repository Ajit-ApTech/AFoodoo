import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || 'AIzaSyC57TfyLD_-0PqJa1_rLiX49sSIMJ3XNI4',
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || 'afoodoo.firebaseapp.com',
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL || 'https://afoodoo-default-rtdb.asia-southeast1.firebasedatabase.app',
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'afoodoo',
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || 'afoodoo.firebasestorage.app',
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '897988707530',
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || '1:897988707530:web:187e1980f9cb7876266033',
};

// 1. Initialize Web Firebase App
export const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// 2. Export Auth, Firestore, and Cloud Firebase Storage
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
