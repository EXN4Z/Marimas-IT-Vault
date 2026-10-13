import type { ReactNode } from 'react';
import { usePage } from '@inertiajs/react';
import { useAuth } from '../../context/AuthContext';
import { useAppNavigate } from '../../hooks/useAppNavigate';
import AppLayoutShell, { type ShellNavigateOptions } from './AppLayoutShell';
import InertiaAuthSync from './InertiaAuthSync';
import FlashToaster from './FlashToaster';

// Adapter Inertia untuk AppLayoutShell. Dipasang sebagai persistent layout di
// inertia-app.tsx, jadi sidebar/header TIDAK di-remount (scroll & state-nya awet)
// saat pindah antar halaman Inertia.
export default function InertiaAppLayout({ children }: { children: ReactNode }) {
  const { url } = usePage();
  const { logout } = useAuth();
  const navigate = useAppNavigate();

  // usePage().url = path + query (mis. '/master-data?tab=kategori'), kadang ada hash.
  const clean = url.split('#')[0];
  const q = clean.indexOf('?');
  const pathname = q === -1 ? clean : clean.slice(0, q);
  const search = q === -1 ? '' : clean.slice(q);

  const onNavigate = (to: string, opts?: ShellNavigateOptions) => {
    navigate(to, opts?.replace ? { replace: true } : undefined);
  };

  const onLogout = async () => {
    // logout() (AuthContext, mode Inertia): unsubscribe push -> POST /api/logout -> bersihin state.
    // Redirect sengaja di sini, bukan di AuthContext.
    await logout();
    window.location.href = '/login';
  };

  return (
    <AppLayoutShell pathname={pathname} search={search} onNavigate={onNavigate} onLogout={onLogout}>
      <InertiaAuthSync />
      <FlashToaster />
      {children}
    </AppLayoutShell>
  );
}
