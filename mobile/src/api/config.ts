import { Platform } from 'react-native';

const envUrl = process.env.EXPO_PUBLIC_BACKEND_URL;

let computedUrl = envUrl || 'http://localhost:8080/api';

if (Platform.OS === 'android' && computedUrl.includes('localhost')) {
  computedUrl = computedUrl.replace('localhost', '10.0.2.2');
}

export const API_BASE_URL = computedUrl;
