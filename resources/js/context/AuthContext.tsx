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
  logout: (opts?: { skipServerRevoke?: boolean }) => Promise<{ password_direset?: boolean } | undefined>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// initialUser: dipakai HANYA oleh entry Inertia (inertia-app.tsx). Kalau diisi (termasuk
// null), provider masuk "mode Inertia": user diambil dari shared props server (session
// cookie), BUKAN dari token localStorage + GET /user. SPA lama tidak mengirim prop ini,
// jadi perilakunya tidak berubah.
export function AuthProvider({ children, initialUser }: { children: ReactNode; initialUser?: User | null }) {
  const inertiaMode = initialUser !== undefined;
  const [user, setUser] = useState<User | null>(initialUser ?? null);
  const [isLoading, setIsLoading] = useState(!inertiaMode);
  const lastUserId = useRef<number | string | null>(initialUser?.id ?? null);

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
    if (inertiaMode) return; // mode Inertia: sumber kebenaran = shared props, bukan localStorage
    if (u) {
      localStorage.setItem('user', JSON.stringify(u));
    } else {
      localStorage.removeItem('user');
    }
  };

  const logout = async (opts?: { skipServerRevoke?: boolean }): Promise<{ password_direset?: boolean } | undefined> => {
    let response: { password_direset?: boolean } | undefined;
    // Mode Inertia: autentikasi lewat session cookie, jadi tidak ada token yang harus
    // dicek -- tetap jalankan urutan yang sama (unsubscribe push dulu, baru logout server).
    // Redirect ke /login SENGAJA tidak dilakukan di sini; itu tugas pemanggil (layout).
    const hasToken = inertiaMode || !!localStorage.getItem('token');

    // PENTING: unsubscribe push HARUS jalan SEBELUM token di-revoke -- endpoint
    // DELETE /push-subscriptions butuh token yang masih valid (auth:sanctum).
    // Kalau dibalik (revoke dulu baru unsubscribe), request unsubscribe-nya
    // bakal 401 & gagal diam-diam, dan subscription lama gak pernah kehapus
    // dari DB (masalah device-sharing yang coba dicegah fitur ini).
    if (hasToken) {
      await unsubscribeThisDevice();
    }

    // best-effort revoke token di server. Skip kalau token udah gak ada
    // (misal interceptor 401 udah bersihin duluan), atau kalau caller udah
    // revoke sendiri (skipServerRevoke) -- dua-duanya bikin request
    // tanpa/token-invalid yang cuma balik 401 sia-sia.
    if (!opts?.skipServerRevoke && hasToken) {
      try {
        const res = await api.post('/logout');
        response = res.data;
      } catch {
        // best-effort, tetep lanjut clear session lokal
      }
    }

    disconnectEcho();
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    queryClient.clear();
    lastUserId.current = null;
    setUser(null);

    return response;
  };

  // Validasi token ke backend setiap kali app dibuka/refresh
  useEffect(() => {
    if (inertiaMode) return; // user sudah datang dari server lewat props

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