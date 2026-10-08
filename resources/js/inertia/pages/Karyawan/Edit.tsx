import AdminRoute from '../../../components/layout/AdminRoute';
import { ForcedSearch } from '../../../lib/router';
import MasterData from '../../../pages/masterData/MasterData';
import KaryawanEdit from '../../../pages/masterData/karyawan/KaryawanEdit';

// Pengganti pola backgroundLocation di App.tsx lama: tab Data User tetap
// dirender di belakang, modal KaryawanEdit ditumpuk di atasnya.
export default function KaryawanEditPage() {
  return (
    <>
      <ForcedSearch search="?tab=karyawan">
        <MasterData />
      </ForcedSearch>
      <AdminRoute>
        <KaryawanEdit />
      </AdminRoute>
    </>
  );
}
