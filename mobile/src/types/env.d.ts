declare global {
  namespace NodeJS {
    interface ProcessEnv {
      EXPO_PUBLIC_BACKEND_URL?: string;
    }
  }
}

export {};
