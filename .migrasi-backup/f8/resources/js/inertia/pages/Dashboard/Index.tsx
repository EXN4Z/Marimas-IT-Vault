import DashboardAdmin from '../../../pages/dashboard/DashboardAdmin';
import DashboardUser from '../../../pages/dashboard/DashboardUser';
import { useSharedProps } from '../../../hooks/useSharedProps';

// Role yang dapet DashboardAdmin (full analytics + inventaris). Sama persis dengan
// pages/dashboard/index.tsx yang lama: cuma 'admin'; semua role lain (user, cabang) dapet DashboardUser.
// Role dibaca dari shared props (dari server), jadi tidak ada kedip DashboardUser sebelum role ketahuan.
const REVIEWER_ROLES = ['admin'];

// Tahap P8: SHELL doang. Data tetap lewat react-query (useDashboardData) ke /api.
// DashboardAdmin / DashboardUser / widgets / useDashboardData TETAP di pages/dashboard/ dan di-import dari sini.
export default function DashboardIndex() {
  const { auth } = useSharedProps();
  const role = auth?.user?.role ?? '';

  if (REVIEWER_ROLES.includes(role)) return <DashboardAdmin />;
  return <DashboardUser />;
}
