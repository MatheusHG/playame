import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

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
  user: User | null;
  session: Session | null;
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
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [affiliate, setAffiliate] = useState<AffiliateData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAffiliateData = useCallback(async (userId: string) => {
    try {
      // Fetch affiliate linked to this user
      const { data: affiliateData, error: affError } = await (supabase as any)
        .from('affiliates')
        .select(`
          *,
          company:companies(id, name, slug, logo_url, primary_color, secondary_color),
          permission_profile:permission_profiles(permissions)
        `)
        .eq('user_id', userId)
        .eq('is_active', true)
        .is('deleted_at', null)
        .single();

      if (affError) {
        if (affError.code === 'PGRST116') {
          // Not an affiliate
          setAffiliate(null);
          setError('Usuário não é um afiliado');
        } else {
          throw affError;
        }
      } else if (affiliateData) {
        setAffiliate({
          ...affiliateData,
          permissions: affiliateData.permission_profile?.permissions || {},
        });
        setError(null);
      }
    } catch (err) {
      console.error('Error fetching affiliate data:', err);
      setError('Erro ao carregar dados do afiliado');
      setAffiliate(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          setTimeout(() => {
            fetchAffiliateData(session.user.id);
          }, 0);
        } else {
          setAffiliate(null);
          setLoading(false);
        }
      }
    );

    // Check existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        fetchAffiliateData(session.user.id);
      } else {
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, [fetchAffiliateData]);

  const hasPermission = useCallback((permission: string): boolean => {
    if (!affiliate) return false;
    if (affiliate.is_sales_paused) return false;
    return affiliate.permissions[permission] === true;
  }, [affiliate]);

  const signIn = async (email: string, password: string) => {
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setLoading(false);
      return { error: new Error(error.message) };
    }
    return { error: null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setAffiliate(null);
  };

  const refetch = useCallback(() => {
    if (user) {
      setLoading(true);
      fetchAffiliateData(user.id);
    }
  }, [user, fetchAffiliateData]);

  return (
    <AffiliateContext.Provider value={{
      user,
      session,
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
