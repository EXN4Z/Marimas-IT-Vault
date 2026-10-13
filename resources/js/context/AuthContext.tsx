import { createContext, useContext, useRef, useState, type ReactNode } from 'react';
import type { User } from '../types/user';
import api from '../api/axios';
import { queryClient } from '../lib/queryClient';
import { disconnectEcho } from '../lib/echo';
import { unsubscribeThisDevice } from '../api/pushNotifications';

interface AuthContextType {
  user: User | null;
  setUser: (user: User | null) => void;
  logout: () => Promise<{ password_direset?: boolean } | undefined>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// initialUser = auth.user dari shared props Inertia halaman pertama (session cookie). Setelah itu
// InertiaAuthSync (di dalam layout) menyamakannya tiap navigasi, jadi sumber kebenaran = server.
// Tidak ada lagi token / user di localStorage dan tidak ada GET /user.
export function AuthProvider({ children, initialUser }: { children: ReactNode; initialUser: User | null }) {
  const [user, setUser] = useState<User | null>(initialUser);
  const lastUserId = useRef<number | string | null>(initialUser?.id ?? null);

  const handleSetUser = (u: User | null) => {
    // ganti user (login akun lain) atau logout -> buang semua cache react-query, supaya data
    // user sebelumnya tidak sempat kelihatan.
    if (lastUserId.current !== null && (u?.id ?? null) !== lastUserId.current) {
      queryClient.clear();
    }
    lastUserId.current = u?.id ?? null;
    setUser(u);
  };

  // Urutan: unsubscribe push DULU (DELETE /push-subscriptions butuh sesi yang masih valid),
  // baru POST /api/logout (mengakhiri sesi). Redirect ke /login = tugas pemanggil (layout).
  const logout = async (): Promise<{ password_direset?: boolean } | undefined> => {
    let response: { password_direset?: boolean } | undefined;

    await unsubscribeThisDevice();

    try {
      const res = await api.post('/logout');
      response = res.data;
    } catch {
      // best-effort, tetap lanjut bersihin state lokal
    }

    disconnectEcho();
    queryClient.clear();
    lastUserId.current = null;
    setUser(null);

    return response;
  };

  return (
    <AuthContext.Provider value={{ user, setUser: handleSetUser, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
