'use client';

import React from 'react';
import { useAuth } from '@/lib/auth-context';
import { ShieldAlert, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

interface RouteGuardProps {
  children: React.ReactNode;
  permission?: string;
  roles?: string[];
}

export const RouteGuard: React.FC<RouteGuardProps> = ({ children, permission, roles }) => {
  const { user, loading, hasPermission, isRole } = useAuth();

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="w-5 h-5 border-2 border-zinc-900 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  React.useEffect(() => {
    if (!loading && !user) {
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
    }
  }, [loading, user]);

  if (!user) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="w-5 h-5 border-2 border-zinc-900 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const roleAllowed = !roles || roles.some((r) => isRole(r));
  const permAllowed = !permission || hasPermission(permission);

  if (!roleAllowed || !permAllowed) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-center p-6 select-none">
        <div className="p-4 rounded-2xl bg-zinc-100 border border-zinc-200 text-zinc-900 mb-4">
          <ShieldAlert className="w-8 h-8 text-zinc-800" />
        </div>
        <h2 className="text-lg font-bold text-zinc-900">Access Restricted</h2>
        <p className="text-xs text-zinc-500 max-w-sm mt-1 mb-6">
          Your account ({user.role_details?.name || 'Standard User'}) does not have permission to access this module.
        </p>
        <Link
          href="/transactions"
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-xs font-semibold text-white transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Weighbridge Operations</span>
        </Link>
      </div>
    );
  }

  return <>{children}</>;
};
