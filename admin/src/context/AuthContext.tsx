'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { signInAnonymously } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { AdminRole, AdminUser } from '../types';

interface AuthContextType {
  user: AdminUser | null;
  loading: boolean;
  login: (email: string, role: AdminRole) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  login: () => {},
  logout: () => {},
});

const DEFAULT_SUPER_ADMIN: AdminUser = {
  uid: 'super-admin-seed-id',
  email: 'admin@afoodoo.com',
  name: 'Super Administrator',
  role: 'super_admin',
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Authenticate with Firebase Web Auth so request.auth is valid for Firestore rules
    try {
      if (!auth.currentUser) {
        signInAnonymously(auth).catch(() => console.log('Firebase auth fallback'));
      }
    } catch (e) {
      console.log('Firebase auth init');
    }

    // Check localStorage for persisted session
    const stored = localStorage.getItem('afoodoo_admin_user');
    if (stored) {
      try {
        setUser(JSON.parse(stored));
      } catch (e) {
        setUser(DEFAULT_SUPER_ADMIN);
      }
    } else {
      setUser(DEFAULT_SUPER_ADMIN);
      localStorage.setItem('afoodoo_admin_user', JSON.stringify(DEFAULT_SUPER_ADMIN));
    }
    setLoading(false);
  }, []);

  const login = (email: string, role: AdminRole) => {
    try {
      if (!auth.currentUser) {
        signInAnonymously(auth).catch(() => console.log('Firebase auth login fallback'));
      }
    } catch (e) {
      console.log('Firebase login fallback');
    }

    const roleNames: Record<AdminRole, string> = {
      super_admin: 'Super Administrator',
      kitchen_staff: 'Head Chef / Kitchen Ops',
      delivery_manager: 'Fleet & Zone Dispatcher',
    };
    const newUser: AdminUser = {
      uid: `admin_${Date.now()}`,
      email: email || 'admin@afoodoo.com',
      name: roleNames[role] || 'AFoodoo Operational Staff',
      role: role || 'super_admin',
    };
    setUser(newUser);
    localStorage.setItem('afoodoo_admin_user', JSON.stringify(newUser));
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('afoodoo_admin_user');
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
