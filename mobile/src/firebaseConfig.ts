import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY ?? 'YOUR_API_KEY',
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN ?? 'YOUR_PROJECT_ID.firebaseapp.com',
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID ?? 'YOUR_PROJECT_ID',
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET ?? 'YOUR_PROJECT_ID.appspot.com',
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? 'YOUR_SENDER_ID',
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID ?? 'YOUR_APP_ID',
};

export const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

export const auth = new Proxy({ currentUser: null } as any, {
  get(target, prop) {
    try {
      const instance = getAuth(app);
      const val = (instance as any)[prop];
      return typeof val === 'function' ? val.bind(instance) : val;
    } catch (e) {
      return (target as any)[prop];
    }
  }
});

export const firestore = new Proxy({} as any, {
  get(target, prop) {
    try {
      const instance = getFirestore(app);
      const val = (instance as any)[prop];
      return typeof val === 'function' ? val.bind(instance) : val;
    } catch (e) {
      return (target as any)[prop];
    }
  }
});
