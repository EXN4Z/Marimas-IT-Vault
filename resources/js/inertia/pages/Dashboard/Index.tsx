import DashboardAdmin from '../../../pages/dashboard/DashboardAdmin';
import DashboardUser from '../../../pages/dashboard/DashboardUser';
import { useSharedProps } from '../../../hooks/useSharedProps';

// Role yang dapet DashboardAdmin (full analytics + inventaris). Sama persis dengan
// pages/dashboard/index.tsx yang lama: cuma 'admin'; semua role lain (user, cabang) dapet DashboardUser.
// Role dibaca dari shared props (dari server), jadi tidak ada kedip DashboardUser sebelum role ketahuan.
const REVIEWER_ROLES = ['admin'];

// [F8-INERTIA] SHELL: pilih DashboardAdmin / DashboardUser dari role. Data masing-masing = deferred props server
// (analitik / pribadi) yang dibaca komponennya lewat usePage(); tidak ada react-query/axios untuk data dashboard
// (notifikasi baru pindah di F9). Komponen & widgets masih di pages/dashboard/.
export default function DashboardIndex() {
  const { auth } = useSharedProps();
  const role = auth?.user?.role ?? '';

  if (REVIEWER_ROLES.includes(role)) return <DashboardAdmin />;
  return <DashboardUser />;
}
