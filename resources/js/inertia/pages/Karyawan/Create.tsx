import AdminRoute from '../../../components/layout/AdminRoute';
import { ForcedSearch } from '../../../lib/router';
import MasterData from '../../../pages/masterData/MasterData';
import KaryawanCreate from '../../../pages/masterData/karyawan/KaryawanCreate';

// Pengganti pola backgroundLocation di App.tsx lama: tab Data User tetap
// dirender di belakang, modal KaryawanCreate ditumpuk di atasnya.
export default function KaryawanCreatePage() {
  return (
    <>
      <ForcedSearch search="?tab=karyawan">
        <MasterData />
      </ForcedSearch>
      <AdminRoute>
        <KaryawanCreate />
      </AdminRoute>
    </>
  );
}
