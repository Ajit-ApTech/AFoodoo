declare global {
  namespace NodeJS {
    interface ProcessEnv {
      PORT?: string;
      NODE_ENV?: 'development' | 'production' | 'test';
      CORS_ORIGIN?: string;
      GOOGLE_APPLICATION_CREDENTIALS?: string;
      GCP_PROJECT?: string;
      FIRESTORE_EMULATOR_HOST?: string;
    }
  }
}

export {};
