import { BrowserRouter, Routes, Route, useLocation, type Location } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ChatProvider } from './context/ChatContext';
import AdminRoute from './components/AdminRoute';
import Login from './pages/Login';
import Register from './pages/Register';
import VerifyOtp from './pages/VerifyOtp';
import Dashboard from './pages/Dashboard';
import Inventaris from './pages/Inventaris';
import Karyawan from './pages/Karyawan';
import KaryawanEdit from './pages/KaryawanEdit';
import KaryawanCreate from './pages/KaryawanCreate';
import Absensi from './pages/Absensi';
import AiAssistant from './pages/AiAssistant';
import Ticketing from './pages/Ticketing';
import Settings from './pages/Settings';
import AuditLog from './pages/AuditLog';
import PengajuanIzin from './pages/PengajuanIzin';
import IzinForm from './pages/IzinPageForm';
import Analytics from './pages/DashboardAnalytics';
import Agenda from './pages/Agenda';
import Laporan from './pages/Laporan';
import Payroll from './pages/Payroll';
import MasterData from './pages/MasterData';

interface LocationState {
  backgroundLocation?: Location;
}

function AppRoutes() {
  const location = useLocation();
  // Kalau route ini dibuka lewat state.backgroundLocation (lihat navigate() di
  // Karyawan.tsx / PengajuanIzin.tsx), <Routes> utama tetap merender halaman LAMA
  // (backgroundLocation), jadi dia tidak pernah unmount/loading ulang. Route
  // create/edit-nya sendiri dirender terpisah di bawah sebagai layer overlay
  // absolute di atasnya (mirip ScanQrModal), lalu ditutup dengan navigate(-1).
  const state = location.state as LocationState | null;
  const backgroundLocation = state?.backgroundLocation;

  return (
    <>
      <Routes location={backgroundLocation || location}>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/verify-otp" element={<VerifyOtp />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/inventaris" element={<Inventaris />} />
        <Route path="/karyawan" element={<Karyawan />} />
        <Route path="/izin" element={<PengajuanIzin />} />
        <Route path="/dashboard-analytics" element={<Analytics />} />
        <Route path="/absensi" element={<Absensi />} />
        <Route path="/ticketing" element={<Ticketing />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/ai-assistant" element={<AiAssistant />} />
        <Route path="/audit-log" element={<AuditLog />} />
        <Route path="/agenda" element={<Agenda />} />
        <Route path="/laporan" element={<Laporan />} />
        <Route path="/payroll" element={<Payroll />} />
        <Route path="/master-data" element={<MasterData />} />

        {/* Fallback: kalau /karyawan/create atau /karyawan/:id/edit diakses langsung
            (refresh browser / paste link / belum ada backgroundLocation), route ini
            tetap harus ada di sini juga supaya tidak 404 — dia akan render sebagai
            modal overlay yang fallback ke halaman listnya sendiri (lihat RouteModal). */}
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
        <Route path="/izin/create" element={<IzinForm />} />

        <Route path="/" element={<Login />} />
      </Routes>

      {/* Layer overlay: hanya dirender kalau ada backgroundLocation, artinya halaman
          ini dibuka sebagai "child route" absolute di atas halaman sebelumnya. */}
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
          <Route path="/izin/create" element={<IzinForm />} />
        </Routes>
      )}
    </>
  );
}

function App() {
  return (
    <AuthProvider>
      <ChatProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </ChatProvider>
    </AuthProvider>
  );
}

export default App;
