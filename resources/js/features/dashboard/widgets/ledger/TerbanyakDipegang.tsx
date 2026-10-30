import { useAppNavigate } from '../../../../hooks/useAppNavigate';
import type { PemegangTeratas } from '../../types';
import { Panel, EmptyNote, DotBars } from './primitives';

// [DASHBOARD-V4] Karyawan yang saat ini memegang inventory terbanyak (data: DashboardQuery::terbanyakDipegang).
export function TerbanyakDipegang({ data = [] }: { data?: PemegangTeratas[] }) {
  const navigate = useAppNavigate();
  const rows = Array.isArray(data) ? data.slice(0, 5) : [];

  return (
    <Panel
      title="Barang Terbanyak Di Pegang"
      right={
        <button type="button" className="dd-pill" onClick={() => navigate('/master-data?tab=inventory&status=dipakai')}>
          View All
        </button>
      }
    >
      {rows.length === 0 ? (
        <EmptyNote>Belum ada inventory yang sedang dipegang.</EmptyNote>
      ) : (
        <div>
          {rows.map((r, i) => (
            <div key={r.id} className="dd-hl">
              <span className="dd-hl-n" title={r.nama}>
                {r.nama}
              </span>
              <DotBars color="#ef4444" w={60} h={16} seed={i + 5} />
              <b className="dv-g">{r.jumlah} Inventory</b>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}
