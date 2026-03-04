import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { api } from '@/lib/api';

interface Player {
  id: string;
  name: string;
  cpf_last4: string;
  cpf_encrypted?: string | null;
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
        const { player, companyId, token } = JSON.parse(stored);
        if (player && companyId && token) {
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
      const data = await api.post<{
        player: Player;
        token: string;
      }>('/players/auth', { action: 'login', companyId, cpf, password });

      setPlayer(data.player);
      setCompanyId(companyId);
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        player: data.player,
        companyId,
        token: data.token,
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
      const response = await api.post<{
        player: Player;
        token: string;
      }>('/players/auth', { action: 'register', companyId, ...data });

      setPlayer(response.player);
      setCompanyId(companyId);
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        player: response.player,
        companyId,
        token: response.token,
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
