import React, { createContext, useContext, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { AuthContextType, UserRole, AffiliateInfo } from '@/types/database.types';

interface AuthUser {
  id: string;
  email: string;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [roles, setRoles] = useState<UserRole[]>([]);
  const [affiliateInfo, setAffiliateInfo] = useState<AffiliateInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check for existing token
    const token = localStorage.getItem('auth_token');
    if (token) {
      restoreSession();
    } else {
      setLoading(false);
    }
  }, []);

  // Maps backend role objects ({ role, companyId }) to frontend UserRole format ({ role, company_id })
  const mapRoles = (rawRoles: any[]): UserRole[] => {
    if (!rawRoles || !Array.isArray(rawRoles)) return [];
    return rawRoles.map((r: any) => ({
      id: r.id || '',
      user_id: r.user_id || '',
      role: r.role,
      company_id: r.companyId ?? r.company_id ?? null,
      created_at: r.created_at || '',
    }));
  };

  const extractAffiliateInfo = (data: any): AffiliateInfo | null => {
    if (data.affiliate && data.affiliate.company?.slug) {
      return {
        id: data.affiliate.id,
        companySlug: data.affiliate.company.slug,
        type: data.affiliate.type,
      };
    }
    return null;
  };

  const restoreSession = async () => {
    try {
      // GET /auth/me returns { id, email, roles: [{role, companyId, company}], affiliate }
      const data = await api.get<any>('/auth/me');

      setUser({ id: data.id, email: data.email });
      setRoles(mapRoles(data.roles));
      setAffiliateInfo(extractAffiliateInfo(data));
    } catch {
      localStorage.removeItem('auth_token');
      setUser(null);
      setRoles([]);
      setAffiliateInfo(null);
    } finally {
      setLoading(false);
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      // POST /auth/login returns { token, user: { userId, email, roles: [{role, companyId}] } }
      const loginData = await api.post<any>('/auth/login', { email, password });
      localStorage.setItem('auth_token', loginData.token);

      // Fetch full profile to get affiliate info BEFORE setting state
      // so all state updates are batched in one render
      let affInfo: AffiliateInfo | null = null;
      try {
        const me = await api.get<any>('/auth/me');
        affInfo = extractAffiliateInfo(me);
      } catch {
        // Continue without affiliate info
      }

      // Set all state synchronously so React batches into single render
      const u = loginData.user;
      const mappedRoles = mapRoles(u.roles || loginData.roles);
      setUser({ id: u.userId || u.id, email: u.email });
      setRoles(mappedRoles);
      setAffiliateInfo(affInfo);

      return { error: null, roles: mappedRoles, affiliateInfo: affInfo };
    } catch (err) {
      return { error: err instanceof Error ? err : new Error('Login failed'), roles: [] as UserRole[], affiliateInfo: null };
    }
  };

  const signUp = async (email: string, password: string) => {
    try {
      // POST /auth/register returns { token, user: { userId, email, roles } }
      const data = await api.post<any>('/auth/register', { email, password });

      localStorage.setItem('auth_token', data.token);
      const u = data.user;
      setUser({ id: u.userId || u.id, email: u.email });
      setRoles(mapRoles(u.roles || data.roles));
      return { error: null };
    } catch (err) {
      return { error: err instanceof Error ? err : new Error('Registration failed') };
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
    setRoles([]);
    setAffiliateInfo(null);
  };

  const isSuperAdmin = roles.some(r => r.role === 'SUPER_ADMIN');

  const isAdminEmpresa = (companyId?: string) => {
    if (isSuperAdmin) return true;
    if (!companyId) return roles.some(r => r.role === 'ADMIN_EMPRESA');
    return roles.some(r => r.role === 'ADMIN_EMPRESA' && r.company_id === companyId);
  };

  const isColaborador = (companyId?: string) => {
    if (isSuperAdmin || isAdminEmpresa(companyId)) return true;
    if (!companyId) return roles.some(r => r.role === 'COLABORADOR');
    return roles.some(r => r.role === 'COLABORADOR' && r.company_id === companyId);
  };

  const value: AuthContextType = {
    user,
    session: user ? { token: localStorage.getItem('auth_token') } : null,
    roles,
    affiliateInfo,
    loading,
    signIn,
    signUp,
    signOut,
    isSuperAdmin,
    isAdminEmpresa,
    isColaborador,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
