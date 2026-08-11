import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import type { User } from '../../types/user';

interface RoleRouteProps {
  roles: User['role'][];
  children: React.ReactNode;
  /** Kemana redirect kalau role gak diizinkan. Default: /dashboard */
  redirectTo?: string;
}

/**
 * Guard untuk route yang cuma boleh diakses role tertentu (bisa lebih dari
 * satu, beda dengan AdminRoute yang cuma cek 'admin'). Kalau belum login,
 * lempar ke /login. Kalau login tapi role-nya gak termasuk yang diizinkan,
 * lempar ke `redirectTo` (default /dashboard) alih-alih nampilin halaman
 * kosong/pesan "tidak punya akses" di dalam halamannya sendiri.
 */
export default function RoleRoute({ roles, children, redirectTo = '/inventaris?tab=aset' }: RoleRouteProps) {
  const { user, isLoading } = useAuth();

  // Tunggu status auth selesai dicek dulu -- kalau langsung diputuskan
  // sebelum isLoading selesai, user yang sebenarnya sah bisa keburu
  // ke-redirect gara-gara `user` masih null sesaat.
  if (isLoading) return null;
  if (!user) return <Navigate to="/login" replace />;

  if (!roles.includes(user.role)) {
    return <Navigate to={redirectTo} replace />;
  }

  return <>{children}</>;
}