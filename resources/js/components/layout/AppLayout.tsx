import type { ReactNode } from 'react';
import { useLocation, Outlet } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useAppNavigate } from '../../hooks/useAppNavigate';
import AppLayoutShell, { type ShellNavigateOptions } from './AppLayoutShell';

interface AppLayoutProps {
  title?: string;
  children?: ReactNode;
}

// Adapter react-router untuk SPA lama. Semua UI ada di AppLayoutShell.
export default function AppLayout({ title, children }: AppLayoutProps = {}) {
  const { logout } = useAuth();
  const location = useLocation();
  const navigate = useAppNavigate();

  const onNavigate = (to: string, opts?: ShellNavigateOptions) => {
    if (opts?.overlay) {
      // Route overlay (RouteModal) wajib bawa backgroundLocation supaya halaman di belakangnya tetap mounted.
      navigate(to, { replace: opts.replace, state: { backgroundLocation: location } });
    } else if (opts?.replace) {
      navigate(to, { replace: true });
    } else {
      navigate(to);
    }
  };

  const onLogout = async () => {
    // NOTE: revoke token, unsubscribe push, & bersih-bersih localStorage semua ada di logout()
    // (AuthContext), urutannya sudah benar. Jangan panggil api.post('/logout') terpisah.
    const res = await logout();
    navigate('/login', {
      replace: true,
      state: res?.password_direset ? { passwordReset: true } : undefined,
    });
  };

  return (
    <AppLayoutShell
      pathname={location.pathname}
      search={location.search}
      onNavigate={onNavigate}
      onLogout={onLogout}
      title={title}
    >
      {children ?? <Outlet />}
    </AppLayoutShell>
  );
}
