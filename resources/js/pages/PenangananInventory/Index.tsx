import PenangananPage from '../../features/penanganan/PenangananPage';

// [F6-INERTIA] SHELL: komponen halaman (features/penanganan/PenangananPage) membaca props server sendiri lewat usePage()
// (props.penanganan / props.penangananExport dari PenangananInventoryPageController), jadi tidak ada props yang diteruskan.
export default function PenangananInventoryPage() {
  return <PenangananPage />;
}
