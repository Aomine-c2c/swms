'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Scale, Lock, User, AlertCircle, ArrowRight } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const router = useRouter();
  const { login } = useAuth();

  const loginWithCredentials = async (u: string, p: string) => {
    setError(null);
    setLoading(true);

    try {
      const response = await api.post('/auth/token/', {
        username: u,
        password: p,
      });

      const { access, refresh } = response.data;
      await login(access, refresh);
      router.push('/transactions');
    } catch (err: any) {
      if (err.response?.data?.detail) {
        setError(err.response.data.detail);
      } else if (err.response?.data?.non_field_errors) {
        setError(err.response.data.non_field_errors.join(' '));
      } else {
        setError('Authentication failed. Please check credentials or backend status.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await loginWithCredentials(username, password);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f4f4f5] p-4 select-none">
      <div className="w-full max-w-sm bg-white border border-zinc-200 rounded-2xl shadow-xl p-8">
        <div className="flex flex-col items-center mb-6">
          <div className="w-12 h-12 rounded-xl bg-black text-white flex items-center justify-center mb-3">
            <Scale className="w-6 h-6" />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-zinc-900">Smart-Weigh</h1>
          <p className="text-[11px] text-zinc-500 uppercase tracking-wider font-semibold">
            Weighbridge Desktop Terminal
          </p>
        </div>

        {error && (
          <div className="mb-5 p-3 rounded-lg bg-zinc-100 border border-zinc-300 flex items-start gap-2.5 text-zinc-800 text-xs">
            <AlertCircle className="w-4 h-4 shrink-0 text-zinc-700 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[11px] font-bold text-zinc-700 mb-1 uppercase tracking-wider">
              Operator ID / Username
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-zinc-400 absolute left-3 top-3" />
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="operator1 or admin"
                className="w-full bg-zinc-50 border border-zinc-200 rounded-lg pl-9 pr-3 py-2 text-xs text-zinc-900 placeholder-zinc-400 focus:outline-none focus:bg-white focus:border-zinc-800 transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-zinc-700 mb-1 uppercase tracking-wider">
              Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-zinc-400 absolute left-3 top-3" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full bg-zinc-50 border border-zinc-200 rounded-lg pl-9 pr-3 py-2 text-xs text-zinc-900 placeholder-zinc-400 focus:outline-none focus:bg-white focus:border-zinc-800 transition-colors"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 py-2.5 px-4 rounded-lg bg-zinc-900 hover:bg-black text-white font-semibold text-xs flex items-center justify-center gap-2 transition-all shadow-sm disabled:opacity-50"
          >
            {loading ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <span>Sign In</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </>
            )}
          </button>
        </form>

        {/* Preconfigured Demo Accounts */}
        <div className="mt-5 pt-4 border-t border-zinc-100">
          <p className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider text-center mb-2.5">
            Quick-Login Demo Accounts
          </p>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              disabled={loading}
              onClick={() => {
                setUsername('operator1');
                setPassword('password123');
                loginWithCredentials('operator1', 'password123');
              }}
              className="py-1.5 px-2 rounded-lg border border-zinc-200 bg-zinc-50 hover:bg-zinc-100 text-zinc-800 text-[11px] font-semibold text-center transition-colors disabled:opacity-50"
            >
              Operator
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={() => {
                setUsername('supervisor1');
                setPassword('password123');
                loginWithCredentials('supervisor1', 'password123');
              }}
              className="py-1.5 px-2 rounded-lg border border-zinc-200 bg-zinc-50 hover:bg-zinc-100 text-zinc-800 text-[11px] font-semibold text-center transition-colors disabled:opacity-50"
            >
              Supervisor
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={() => {
                setUsername('admin');
                setPassword('admin');
                loginWithCredentials('admin', 'admin');
              }}
              className="py-1.5 px-2 rounded-lg border border-zinc-200 bg-zinc-50 hover:bg-zinc-100 text-zinc-800 text-[11px] font-semibold text-center transition-colors disabled:opacity-50"
            >
              Admin
            </button>
          </div>
        </div>

        <div className="mt-6 pt-4 border-t border-zinc-100 text-center">
          <p className="text-[10px] text-zinc-400">
            Smart-Weigh System v1.0.0 • Production Build
          </p>
        </div>
      </div>
    </div>
  );
}
