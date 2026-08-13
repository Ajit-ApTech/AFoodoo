import { Platform } from 'react-native';

// Dynamically compute default backend URL if environment variable is missing
const envUrl = process.env.EXPO_PUBLIC_BACKEND_URL;

export const API_BASE_URL = envUrl 
  ? envUrl 
  : Platform.OS === 'android'
    ? 'http://10.0.2.2:8080/api'
    : 'http://localhost:8080/api';
