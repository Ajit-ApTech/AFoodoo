import admin from 'firebase-admin';
import path from 'path';
import fs from 'fs';

// Load service account key JSON
let serviceAccount: admin.ServiceAccount | undefined;

if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  const credPath = path.resolve(process.env.GOOGLE_APPLICATION_CREDENTIALS);
  if (fs.existsSync(credPath)) {
    serviceAccount = require(credPath);
  }
}

if (!serviceAccount) {
  const fallbackPath = path.resolve(__dirname, '../serviceAccountKey.json');
  if (fs.existsSync(fallbackPath)) {
    serviceAccount = require(fallbackPath);
  }
}

if (!admin.apps.length) {
  if (serviceAccount) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  } else {
    admin.initializeApp({
      projectId: process.env.GCP_PROJECT || 'afoodoo-dev-app',
    });
  }
}

export const firestore = admin.firestore();
export const auth = admin.auth();
export const fcm = admin.messaging();
export const firebaseApp = admin.app();
