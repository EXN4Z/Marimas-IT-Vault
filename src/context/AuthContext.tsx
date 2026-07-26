import { createContext, useContext, useState, useEffect, useRef, type ReactNode } from 'react';
import type { User } from '../types/user';
import api from '../api/axios';
import { queryClient } from '../lib/queryClient';
import { disconnectEcho } from '../lib/echo';
import { unsubscribeThisDevice } from '../api/pushNotifications';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  setUser: (user: User | null) => void;
  logout: (opts?: { skipServerRevoke?: boolean }) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const lastUserId = useRef<number | string | null>(null);

  const handleSetUser = (u: User | null) => {
    // ganti user (login akun lain) atau logout -> buang semua cache
    // react-query. Tanpa ini, dashboard/stats/dll punya user sebelumnya
    // masih keliatan sesaat (atau sampai staleTime lewat) karena query key
    // gak dibedain per-user, kesannya "harus refresh manual baru update".
    if (lastUserId.current !== null && (u?.id ?? null) !== lastUserId.current) {
      queryClient.clear();
    }
    lastUserId.current = u?.id ?? null;

    setUser(u);
    if (u) {
      localStorage.setItem('user', JSON.stringify(u));
    } else {
      localStorage.removeItem('user');
    }
  };

  const logout = async (opts?: { skipServerRevoke?: boolean }) => {
    // best-effort revoke token di server, gak perlu nunggu hasilnya.
    // Skip kalau token udah gak ada (misal interceptor 401 udah bersihin
    // duluan), atau kalau caller udah revoke sendiri (skipServerRevoke) --
    // dua-duanya bikin request tanpa/token-invalid yang cuma balik 401 sia-sia.
    if (!opts?.skipServerRevoke && localStorage.getItem('token')) {
      api.post('/logout').catch(() => {});
    }
    unsubscribeThisDevice();
    disconnectEcho();
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    queryClient.clear();
    lastUserId.current = null;
    setUser(null);
  };

  // Validasi token ke backend setiap kali app dibuka/refresh
  useEffect(() => {
    const token = localStorage.getItem('token');

    if (!token) {
      setIsLoading(false);
      return;
    }

    api
      .get('/user')
      .then((res) => {
        handleSetUser(res.data);
      })
      .catch(() => {
        // token invalid/expired di server -> bersihkan
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setUser(null);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  return (
    <AuthContext.Provider value={{ user, isLoading, setUser: handleSetUser, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}