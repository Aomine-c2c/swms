import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000/api/v1';

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('swms_access_token');
      if (token && config.headers) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        const refresh = typeof window !== 'undefined' ? localStorage.getItem('swms_refresh_token') : null;
        if (refresh) {
          const res = await axios.post(`${API_BASE_URL}/auth/token/refresh/`, {
            refresh,
          });
          const newAccess = res.data.access;
          if (newAccess && typeof window !== 'undefined') {
            localStorage.setItem('swms_access_token', newAccess);
            if (originalRequest.headers) {
              originalRequest.headers.Authorization = `Bearer ${newAccess}`;
            }
            return api(originalRequest);
          }
        }
      } catch {
        if (typeof window !== 'undefined') {
          localStorage.removeItem('swms_access_token');
          localStorage.removeItem('swms_refresh_token');
          localStorage.removeItem('swms_user');
          window.location.href = '/login';
        }
      }
    }
    return Promise.reject(error);
  }
);
