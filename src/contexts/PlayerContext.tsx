import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface Player {
  id: string;
  name: string;
  cpf_last4: string;
  city: string | null;
  phone?: string | null;
}

interface PlayerContextType {
  player: Player | null;
  companyId: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (companyId: string, cpf: string, password: string) => Promise<{ error?: string }>;
  register: (companyId: string, data: { cpf: string; password: string; name: string; city?: string; phone?: string }) => Promise<{ error?: string }>;
  updatePlayer: (patch: Partial<Player>) => void;
  logout: () => void;
}

const PlayerContext = createContext<PlayerContextType | undefined>(undefined);

const STORAGE_KEY = 'player_session';

export function PlayerProvider({ children }: { children: React.ReactNode }) {
  const [player, setPlayer] = useState<Player | null>(null);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Restore session on mount
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const { player, companyId, sessionToken } = JSON.parse(stored);
        if (player && companyId && sessionToken) {
          setPlayer(player);
          setCompanyId(companyId);
        }
      } catch {
        localStorage.removeItem(STORAGE_KEY);
      }
    }
    setIsLoading(false);
  }, []);

  const login = useCallback(async (companyId: string, cpf: string, password: string): Promise<{ error?: string }> => {
    try {
      const { data, error } = await supabase.functions.invoke('player-auth', {
        body: { action: 'login', companyId, cpf, password },
      });

      if (error) throw new Error(error.message);
      if (data.error) throw new Error(data.error);

      setPlayer(data.player);
      setCompanyId(companyId);
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        player: data.player,
        companyId,
        sessionToken: data.sessionToken,
      }));

      return {};
    } catch (err) {
      return { error: err instanceof Error ? err.message : 'Erro ao fazer login' };
    }
  }, []);

  const register = useCallback(async (
    companyId: string,
    data: { cpf: string; password: string; name: string; city?: string; phone?: string }
  ): Promise<{ error?: string }> => {
    try {
      const { data: response, error } = await supabase.functions.invoke('player-auth', {
        body: { action: 'register', companyId, ...data },
      });

      if (error) throw new Error(error.message);
      if (response.error) throw new Error(response.error);

      setPlayer(response.player);
      setCompanyId(companyId);
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        player: response.player,
        companyId,
        sessionToken: response.sessionToken,
      }));

      return {};
    } catch (err) {
      return { error: err instanceof Error ? err.message : 'Erro ao cadastrar' };
    }
  }, []);

  const updatePlayer = useCallback((patch: Partial<Player>) => {
    setPlayer((prev) => {
      if (!prev) return prev;
      const next = { ...prev, ...patch };
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify({
              ...parsed,
              player: next,
            })
          );
        }
      } catch {
        // ignore storage issues
      }
      return next;
    });
  }, []);

  const logout = useCallback(() => {
    setPlayer(null);
    setCompanyId(null);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  return (
    <PlayerContext.Provider value={{
      player,
      companyId,
      isAuthenticated: !!player,
      isLoading,
      login,
      register,
      updatePlayer,
      logout,
    }}>
      {children}
    </PlayerContext.Provider>
  );
}

export function usePlayer() {
  const context = useContext(PlayerContext);
  if (context === undefined) {
    throw new Error('usePlayer must be used within a PlayerProvider');
  }
  return context;
}
