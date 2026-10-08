import AdminRoute from '../../../components/layout/AdminRoute';
import { ForcedSearch } from '../../../lib/router';
import MasterData from '../../../pages/masterData/MasterData';
import KaryawanDetail from '../../../pages/masterData/karyawan/KaryawanDetail';

// Pengganti pola backgroundLocation di App.tsx lama: tab Data User tetap
// dirender di belakang, modal KaryawanDetail ditumpuk di atasnya.
export default function KaryawanDetailPage() {
  return (
    <>
      <ForcedSearch search="?tab=karyawan">
        <MasterData />
      </ForcedSearch>
      <AdminRoute>
        <KaryawanDetail />
      </AdminRoute>
    </>
  );
}
