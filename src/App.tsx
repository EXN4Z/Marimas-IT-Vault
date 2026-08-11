import { BrowserRouter, Routes, Route, Navigate, useLocation, type Location } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { Toaster } from 'react-hot-toast';
import AdminRoute from './components/shared/AdminRoute';
import RoleRoute from './components/shared/RoleRoute';
import AppLayout from './components/shared/AppLayout';
import Login from './pages/Login';
import VerifyOtp from './pages/VerifyOtp';
import Dashboard from './pages/Dashboard';
import Inventaris from './pages/Inventaris';
import Karyawan from './pages/Karyawan';
import KaryawanEdit from './pages/KaryawanEdit';
import KaryawanCreate from './pages/KaryawanCreate';
import Settings from './pages/Settings';
import AuditLog from './pages/AuditLog';
import Laporan from './pages/Laporan';
import MasterData from './pages/MasterData';
import CabangPage from './pages/CabangPage';

interface LocationState {
  backgroundLocation?: Location;
}

function AppRoutes() {
  const location = useLocation();
  // Kalau route ini dibuka lewat state.backgroundLocation (lihat navigate() di
  // Karyawan.tsx), <Routes> utama tetap merender halaman LAMA
  // (backgroundLocation), jadi dia tidak pernah unmount/loading ulang. Route
  // create/edit-nya sendiri dirender terpisah di bawah sebagai layer overlay
  // absolute di atasnya (mirip ScanQrModal), lalu ditutup dengan navigate(-1).
  const state = location.state as LocationState | null;
  const backgroundLocation = state?.backgroundLocation;

  return (
    <>
      <Toaster position='top-center' />
      <Routes location={backgroundLocation || location}>
        {/* Route TANPA sidebar/chrome -- di luar AppLayout */}
        <Route path="/login" element={<Login />} />
        <Route path="/verify-otp" element={<VerifyOtp />} />
        <Route path="/" element={<Login />} />

        {/* PENAMBAHAN: semua route yang butuh sidebar dikelompokkan di sini
            sebagai child dari AppLayout (layout route). AppLayout dirender
            SEKALI dan tetap satu instance yang sama selama kamu pindah-pindah
            di antara route-route di bawah ini -- makanya scroll sidebar,
            dropdown yang lagi kebuka, dll gak reset tiap ganti halaman. */}
        <Route element={<AppLayout />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/inventaris" element={<Inventaris />} />
          <Route path="/aset" element={<Navigate to="/inventaris" replace />} />
          <Route path="/karyawan" element={<Karyawan />} />
          {/* Dashboard Analytics sekarang jadi tab di dalam /dashboard, bukan halaman sendiri.
              Redirect ini cuma buat jaga-jaga kalau ada bookmark/link lama ke /dashboard-analytics. */}
          <Route path="/dashboard-analytics" element={<Navigate to="/dashboard?tab=analytics" replace />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/audit-log" element={<AuditLog />} />
          {/* /laporan cuma boleh diakses staff (admin/hr/manajer/cabang) --
              karyawan biasa di-redirect balik ke /dashboard, bukan cuma
              ditampilin pesan "tidak punya akses" di dalam halamannya. */}
          <Route
            path="/laporan"
            element={
              <RoleRoute roles={['admin']}>
                <Laporan />
              </RoleRoute>
            }
          />
          <Route path="/master-data" element={<MasterData />} />
          <Route path="/cabang" element={<CabangPage />} />

          {/* Fallback: kalau /karyawan/create atau /karyawan/:id/edit diakses langsung
              (refresh browser / paste link / belum ada backgroundLocation), route ini
              tetap harus ada di sini juga supaya tidak 404 -- dan tetap butuh sidebar
              karena dirender sebagai halaman penuh, bukan overlay, dalam kasus ini. */}
          <Route
            path="/karyawan/:id/edit"
            element={
              <AdminRoute>
                <KaryawanEdit />
              </AdminRoute>
            }
          />
          <Route
            path="/karyawan/create"
            element={
              <AdminRoute>
                <KaryawanCreate />
              </AdminRoute>
            }
          />
        </Route>
      </Routes>

      {/* Layer overlay: hanya dirender kalau ada backgroundLocation, artinya halaman
          ini dibuka sebagai "child route" absolute di atas halaman sebelumnya.
          SENGAJA TIDAK dibungkus AppLayout -- halaman background di belakangnya
          (dirender oleh <Routes> di atas) sudah punya sidebar/chrome sendiri,
          jadi overlay ini cukup jadi modal polos yang numpuk di atasnya. */}
      {backgroundLocation && (
        <Routes>
          <Route
            path="/karyawan/:id/edit"
            element={
              <AdminRoute>
                <KaryawanEdit />
              </AdminRoute>
            }
          />
          <Route
            path="/karyawan/create"
            element={
              <AdminRoute>
                <KaryawanCreate />
              </AdminRoute>
            }
          />
        </Routes>
      )}
    </>
  );
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;