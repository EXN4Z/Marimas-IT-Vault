import { BrowserRouter, Routes, Route, useLocation, type Location } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { Toaster } from 'react-hot-toast';
import AdminRoute from './components/layout/AdminRoute';
import AppLayout from './components/layout/AppLayout';
import Login from './pages/auth/Login';
import VerifyOtp from './pages/auth/VerifyOtp';
import KaryawanEdit from './pages/masterData/karyawan/KaryawanEdit';
import KaryawanCreate from './pages/masterData/karyawan/KaryawanCreate';
import KaryawanDetail from './pages/masterData/karyawan/KaryawanDetail';

interface LocationState {
  backgroundLocation?: Location;
}

function AppRoutes() {
  const location = useLocation();
  // Kalau route ini dibuka lewat state.backgroundLocation (lihat navigate() di
  // components/masterData/TabKaryawan.tsx), <Routes> utama tetap merender halaman LAMA
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
            path="/karyawan/:id"
            element={
              <AdminRoute>
                <KaryawanDetail />
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
            path="/karyawan/:id"
            element={
              <AdminRoute>
                <KaryawanDetail />
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
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;