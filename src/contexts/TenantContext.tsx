import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import { TenantContextType, Company } from '@/types/database.types';

const TenantContext = createContext<TenantContextType | undefined>(undefined);

export function TenantProvider({ children }: { children: React.ReactNode }) {
  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const resolveTenant = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // The backend resolves the tenant from the Host header automatically.
      // GET /tenant/resolve returns the company for the current domain.
      const data = await api.get<Company>('/tenant/resolve');

      if (!data || !data.id) {
        setError('Empresa não encontrada');
        setCompany(null);
      } else {
        setCompany(data);
        setError(null);
      }
    } catch (err: any) {
      // 404 means no tenant for this domain — could be platform domain or unknown
      if (err?.status === 404) {
        // Not an error on platform domain (super-admin, auth pages)
        setCompany(null);
        setError(null);
      } else {
        console.error('Error resolving tenant:', err);
        setError('Erro ao carregar empresa');
        setCompany(null);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  // Resolve tenant once on mount (domain doesn't change during session)
  useEffect(() => {
    resolveTenant();
  }, [resolveTenant]);

  // Backwards compatibility: setCompanySlug now fetches by identifier
  const setCompanySlug = useCallback(async (slug: string) => {
    if (!slug) return;
    // If company is already resolved from domain and matches, skip
    if (company?.slug === slug) return;

    setLoading(true);
    setError(null);
    try {
      const data = await api.get<Company>(`/companies/${encodeURIComponent(slug)}`);
      if (data) {
        setCompany(data);
        setError(null);
      }
    } catch {
      setError('Empresa não encontrada');
      setCompany(null);
    } finally {
      setLoading(false);
    }
  }, [company?.slug]);

  const refetchCompany = useCallback(async () => {
    await resolveTenant();
  }, [resolveTenant]);

  const value: TenantContextType = {
    company,
    loading,
    error,
    setCompanySlug,
    refetchCompany,
  };

  return <TenantContext.Provider value={value}>{children}</TenantContext.Provider>;
}

export function useTenant() {
  const context = useContext(TenantContext);
  if (context === undefined) {
    throw new Error('useTenant must be used within a TenantProvider');
  }
  return context;
}

// Hook para aplicar branding dinâmico
export function useCompanyBranding() {
  const { company } = useTenant();

  useEffect(() => {
    if (company) {
      document.documentElement.style.setProperty('--company-primary', company.primary_color);
      document.documentElement.style.setProperty('--company-secondary', company.secondary_color);
    } else {
      document.documentElement.style.removeProperty('--company-primary');
      document.documentElement.style.removeProperty('--company-secondary');
    }

    return () => {
      document.documentElement.style.removeProperty('--company-primary');
      document.documentElement.style.removeProperty('--company-secondary');
    };
  }, [company]);

  return company;
}
