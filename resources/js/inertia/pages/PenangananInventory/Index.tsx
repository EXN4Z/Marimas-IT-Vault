import PenangananInventory from '../../../pages/transaksi/PenangananInventory';

// Tahap P11: SHELL doang. Isi halaman (usePenangananData: axios + polling 10 detik, modal, tabel) TETAP di
// pages/transaksi/PenangananInventory/. Props Inertia sengaja tidak diteruskan (halaman lama punya prop
// `onCount` sendiri, tidak ada hubungannya dengan props server).
export default function PenangananInventoryPage() {
  return <PenangananInventory />;
}
