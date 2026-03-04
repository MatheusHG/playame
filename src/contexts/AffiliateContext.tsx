import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';

interface AuthUser {
  id: string;
  email: string;
}

interface AffiliateData {
  id: string;
  company_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  type: 'manager' | 'cambista';
  commission_percent: number;
  link_code: string;
  is_sales_paused: boolean;
  parent_affiliate_id: string | null;
  permission_profile_id: string | null;
  permissions: Record<string, boolean>;
  company: {
    id: string;
    name: string;
    slug: string;
    logo_url: string | null;
    primary_color: string;
    secondary_color: string;
  };
}

interface AffiliateContextType {
  user: AuthUser | null;
  session: { token: string | null } | null;
  affiliate: AffiliateData | null;
  loading: boolean;
  error: string | null;
  hasPermission: (permission: string) => boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  refetch: () => void;
}

const AffiliateContext = createContext<AffiliateContextType | undefined>(undefined);

export function AffiliateProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [affiliate, setAffiliate] = useState<AffiliateData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAffiliateData = useCallback(async () => {
    try {
      // /auth/me returns { id, email, roles, affiliate? } (user fields at top level)
      const data = await api.get<any>('/auth/me');

      setUser({ id: data.id, email: data.email });

      if (data.affiliate) {
        // Ensure permissions are available at the affiliate level
        // Backend now returns them, but also handle legacy responses
        const permissions = data.affiliate.permissions
          ?? (data.affiliate.permission_profile?.permissions as Record<string, boolean>)
          ?? {};
        setAffiliate({ ...data.affiliate, permissions });
        setError(null);
      } else {
        setAffiliate(null);
        setError(null);
      }
    } catch (err) {
      console.error('Error fetching affiliate data:', err);
      setError('Erro ao carregar dados do afiliado');
      setAffiliate(null);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const token = localStorage.getItem('auth_token');
    if (token) {
      fetchAffiliateData();
    } else {
      setLoading(false);
    }
  }, [fetchAffiliateData]);

  const hasPermission = useCallback((permission: string): boolean => {
    if (!affiliate) return false;
    if (affiliate.is_sales_paused) return false;
    return affiliate.permissions[permission] === true;
  }, [affiliate]);

  const signIn = async (email: string, password: string) => {
    setLoading(true);
    try {
      const data = await api.post<{
        token: string;
        user: AuthUser;
        roles: any[];
      }>('/auth/login', { email, password });

      localStorage.setItem('auth_token', data.token);
      setUser(data.user);

      // Fetch affiliate data after login
      await fetchAffiliateData();
      return { error: null };
    } catch (err) {
      setLoading(false);
      return { error: err instanceof Error ? err : new Error('Login failed') };
    }
  };

  const signOut = async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // Ignore errors on logout
    }
    localStorage.removeItem('auth_token');
    setUser(null);
    setAffiliate(null);
  };

  const refetch = useCallback(() => {
    // Allow refetch when there's a token (even if user isn't set yet)
    // This handles the case where login happens via AuthContext's signIn
    const token = localStorage.getItem('auth_token');
    if (user || token) {
      setLoading(true);
      fetchAffiliateData();
    }
  }, [user, fetchAffiliateData]);

  return (
    <AffiliateContext.Provider value={{
      user,
      session: user ? { token: localStorage.getItem('auth_token') } : null,
      affiliate,
      loading,
      error,
      hasPermission,
      signIn,
      signOut,
      refetch,
    }}>
      {children}
    </AffiliateContext.Provider>
  );
}

export function useAffiliate() {
  const context = useContext(AffiliateContext);
  if (context === undefined) {
    throw new Error('useAffiliate must be used within an AffiliateProvider');
  }
  return context;
}
