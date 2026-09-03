import { useAuth } from '../../context/AuthContext';
import DashboardUser from './DashboardUser';
import DashboardAdmin from './DashboardAdmin';
import { DashboardSkeleton } from './Shared';

// Role yang dapet DashboardAdmin (full analytics + inventaris).
const REVIEWER_ROLES = ['admin', 'hr', 'manajer', 'manager'];

// Entry point /dashboard. File ini sengaja dinamai index.tsx supaya
// `import Dashboard from './pages/Dashboard'` di App.tsx (dan file lain)
// TETAP JALAN tanpa perlu diubah — cuma jadi "switch" yang milih salah satu
// dari DashboardUser / DashboardAdmin sesuai role user yang login.
//
// DashboardCabang udah digabung ke DashboardUser (dihapus) -- backend
// nge-scope 'cabang' PERSIS sama kayak role non-admin lainnya (karyawan/
// manajer/hr) di semua endpoint terkait (InventoryController::index(),
// InventoryPemakaiController::riwayat(), dst -- keduanya cuma cek
// `$user->role === 'admin'`), jadi gak ada alasan buat dua komponen dashboard
// yang isinya beda tipis.
export default function Dashboard() {
  const { user: cachedUser, isLoading: authLoading } = useAuth();

  // Nunggu AuthContext kelar validasi token dulu, biar gak sempet nge-render
  // DashboardUser (default) sekilas sebelum ketauan role aslinya admin.
  // Role belum ketahuan di titik ini, jadi dipakai skeleton "simple" (generik)
  // -- begitu role kebaca, dashboard yang sesuai punya skeleton sendiri lagi.
  if (authLoading) {
    return <DashboardSkeleton variant="simple" />;
  }

  const role = cachedUser?.role ?? '';

  if (REVIEWER_ROLES.includes(role)) return <DashboardAdmin />;
  return <DashboardUser />;
}