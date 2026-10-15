import PenangananInventory from '../../../pages/transaksi/PenangananInventory';

// [F6-INERTIA] SHELL: komponen halaman (pages/transaksi/PenangananInventory/) membaca props server sendiri lewat usePage()
// (props.penanganan / props.penangananExport dari PenangananInventoryPageController), jadi tidak ada props yang diteruskan.
export default function PenangananInventoryPage() {
  return <PenangananInventory />;
}
