import { useDashboardCore } from './useDashboardData';
import { DepartemenDistribusiCard } from './Shared';

// Dashboard untuk role cabang — TIDAK dapet section Inventaris (itu murni
// buat admin/hr/manajer).
export default function DashboardCabang() {
  const { loading, error, departemen } = useDashboardCore();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <p className="text-slate-500 text-sm">Memuat dashboard...</p>
      </div>
    );
  }

  return (
    <>
      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">{error}</div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <DepartemenDistribusiCard departemen={departemen} />
      </div>
    </>
  );
}