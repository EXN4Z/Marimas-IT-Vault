import { createContext, useContext, useState, type ReactNode } from 'react';
import { router } from '@inertiajs/react';
import type { User } from '../types/user';
import { disconnectEcho } from '../lib/echo';
import { unsubscribeThisDevice } from '../lib/pushNotifications';

interface AuthContextType {
  user: User | null;
  setUser: (user: User | null) => void;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// initialUser = auth.user dari shared props Inertia halaman pertama (session cookie). Setelah itu
// InertiaAuthSync (di dalam layout) menyamakannya tiap navigasi, jadi sumber kebenaran = server.
// Tidak ada lagi token / user di localStorage dan tidak ada GET /user.
export function AuthProvider({ children, initialUser }: { children: ReactNode; initialUser: User | null }) {
  const [user, setUser] = useState<User | null>(initialUser);

  // Urutan: unsubscribe push DULU (DELETE /push-subscriptions butuh sesi yang masih valid), baru POST /logout
  // (route web, WebAuthController::logout -> Inertia::location('/login')). Redirect ke /login = tugas pemanggil (layout).
  const logout = async (): Promise<void> => {
    await unsubscribeThisDevice();
    disconnectEcho();

    await new Promise<void>((resolve) => {
      // 'httpException' (Inertia v3) = respons non-Inertia (mis. 419 karena sesi sudah habis): jangan tampilkan modal error,
      // tujuannya sama saja (balik ke /login).
      const stopInvalid = router.on('httpException', (event) => event.preventDefault());
      router.post(
        '/logout',
        {},
        {
          onFinish: () => {
            stopInvalid();
            resolve();
          },
        },
      );
    });

    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, setUser, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
