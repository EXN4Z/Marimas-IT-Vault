import { useAuth } from '../../context/AuthContext';
import DashboardUser from './DashboardUser';
import DashboardAdmin from './DashboardAdmin';
import DashboardCabang from './DashboardCabang';

// Role yang dapet DashboardAdmin (full analytics + inventaris).
const REVIEWER_ROLES = ['admin', 'hr', 'manajer', 'manager'];
// Role yang dapet DashboardCabang (analytics scoped ke cabang).
const CABANG_ROLE = 'cabang';

// Entry point /dashboard. File ini sengaja dinamai index.tsx supaya
// `import Dashboard from './pages/Dashboard'` di App.tsx (dan file lain)
// TETAP JALAN tanpa perlu diubah — cuma jadi "switch" yang milih salah satu
// dari DashboardUser / DashboardAdmin / DashboardCabang sesuai role user
// yang login.
export default function Dashboard() {
  const { user: cachedUser, isLoading: authLoading } = useAuth();

  // Nunggu AuthContext kelar validasi token dulu, biar gak sempet nge-render
  // DashboardUser (default) sekilas sebelum ketauan role aslinya admin/cabang.
  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <p className="text-slate-500 text-sm">Memuat dashboard...</p>
      </div>
    );
  }

  const role = cachedUser?.role ?? '';

  if (REVIEWER_ROLES.includes(role)) return <DashboardAdmin />;
  if (role === CABANG_ROLE) return <DashboardCabang />;
  return <DashboardUser />;
}