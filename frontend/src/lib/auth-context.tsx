'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { api } from './api';
import { User } from '../types';
import { useRouter } from 'next/navigation';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (access: string, refresh: string) => Promise<void>;
  logout: () => void;
  hasPermission: (permission: string) => boolean;
  isRole: (roleName: string) => boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  login: async () => {},
  logout: () => {},
  hasPermission: () => false,
  isRole: () => false,
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const router = useRouter();

  const fetchCurrentUser = async () => {
    try {
      const res = await api.get('/auth/me/');
      setUser(res.data);
      if (typeof window !== 'undefined') {
        localStorage.setItem('swms_user', JSON.stringify(res.data));
      }
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('swms_access_token') : null;
    if (token) {
      fetchCurrentUser();
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (access: string, refresh: string) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('swms_access_token', access);
      localStorage.setItem('swms_refresh_token', refresh);
    }
    await fetchCurrentUser();
  };

  const logout = async () => {
    try {
      const refresh = typeof window !== 'undefined' ? localStorage.getItem('swms_refresh_token') : null;
      if (refresh) {
        await api.post('/auth/logout/', { refresh }).catch(() => {});
      }
    } finally {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('swms_access_token');
        localStorage.removeItem('swms_refresh_token');
        localStorage.removeItem('swms_user');
      }
      setUser(null);
      router.push('/login');
    }
  };

  const hasPermission = (permission: string): boolean => {
    if (!user) return false;
    if (user.is_superuser) return true;
    return user.permissions?.includes(permission) ?? false;
  };

  const isRole = (roleName: string): boolean => {
    if (!user) return false;
    if (user.is_superuser) return true;
    return user.role_details?.name.toLowerCase() === roleName.toLowerCase();
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, hasPermission, isRole }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
