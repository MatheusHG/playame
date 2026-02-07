import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { TenantContextType, Company } from '@/types/database.types';

const TenantContext = createContext<TenantContextType | undefined>(undefined);

export function TenantProvider({ children }: { children: React.ReactNode }) {
  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentSlug, setCurrentSlug] = useState<string | null>(null);

  const fetchCompanyByIdentifier = useCallback(async (identifier: string) => {
    if (!identifier) {
      setCompany(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const isUuid =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
          identifier
        );

      // Se NÃO for UUID, não consultamos por `id` (evita erro de UUID inválido).
      const { data, error: fetchError } = await supabase
        .from('companies')
        .select('*')
        .eq(isUuid ? 'id' : 'slug', identifier)
        .eq('status', 'active')
        .is('deleted_at', null)
        .maybeSingle();

      if (fetchError) {
        console.error('Error fetching company:', fetchError);
        setError('Erro ao carregar empresa');
        setCompany(null);
      } else if (!data) {
        setError('Empresa não encontrada');
        setCompany(null);
      } else {
        setCompany(data as Company);
        setError(null);
      }
    } catch (err) {
      console.error('Error fetching company:', err);
      setError('Erro ao carregar empresa');
      setCompany(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (currentSlug) {
      fetchCompanyByIdentifier(currentSlug);
    }
  }, [currentSlug, fetchCompanyByIdentifier]);

  const setCompanySlug = useCallback((slug: string) => {
    setCurrentSlug(slug);
  }, []);

  const value: TenantContextType = {
    company,
    loading,
    error,
    setCompanySlug,
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
