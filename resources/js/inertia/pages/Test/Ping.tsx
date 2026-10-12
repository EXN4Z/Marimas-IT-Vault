import InertiaAuthSync from '../../../components/layout/InertiaAuthSync';
import { useAuth } from '../../../context/AuthContext';
import { useSharedProps } from '../../../hooks/useSharedProps';

// HALAMAN TES SEMENTARA (P1/P2) -- hapus setelah infrastruktur Inertia terbukti jalan.
export default function Ping() {
  const { auth } = useSharedProps();
  const { user, isLoading } = useAuth();

  return (
    <div style={{ padding: 24, fontFamily: 'sans-serif' }}>
      <InertiaAuthSync />
      <h1>Inertia OK</h1>
      <p>Shared props: {auth.user ? `${auth.user.name} (role: ${auth.user.role})` : '(tidak ada user -- session belum ke-set)'}</p>
      <p>AuthContext: {isLoading ? 'loading...' : user ? `${user.name} (role: ${user.role})` : '(null)'}</p>
    </div>
  );
}
