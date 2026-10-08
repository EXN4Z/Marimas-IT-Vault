import AdminRoute from '../../components/layout/AdminRoute';
import Laporan from '../../pages/laporan/Laporan';

// /laporan admin-only (sama seperti App.tsx lama).
export default function LaporanPage() {
  return (
    <AdminRoute>
      <Laporan />
    </AdminRoute>
  );
}
