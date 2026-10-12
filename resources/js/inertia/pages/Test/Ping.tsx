import { usePage } from '@inertiajs/react';

// HALAMAN TES SEMENTARA (P1) -- hapus setelah infrastruktur Inertia terbukti jalan.
export default function Ping() {
  const { props } = usePage() as unknown as { props: { auth?: { user?: { name?: string } | null } } };
  const name = props.auth?.user?.name;

  return (
    <div style={{ padding: 24, fontFamily: 'sans-serif' }}>
      <h1>Inertia OK</h1>
      <p>Login sebagai: {name ?? '(tidak ada user -- session belum ke-set)'}</p>
    </div>
  );
}
