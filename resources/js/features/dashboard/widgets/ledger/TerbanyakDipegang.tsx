import type { PemegangTeratas } from '../../types';
import { Panel, EmptyNote, DotMeter } from './primitives';

// [DASHBOARD-V3] Karyawan yang saat ini memegang inventory terbanyak (data: DashboardQuery::terbanyakDipegang).
export function TerbanyakDipegang({ data = [] }: { data?: PemegangTeratas[] }) {
  const rows = Array.isArray(data) ? data : [];
  const max = Math.max(1, ...rows.map((r) => r.jumlah));

  return (
    <Panel title="Barang terbanyak di pegang" subtitle="Karyawan dengan inventory aktif terbanyak.">
      {rows.length === 0 ? (
        <EmptyNote>Belum ada inventory yang sedang dipegang.</EmptyNote>
      ) : (
        <div>
          {rows.map((r) => (
            <div key={r.id} className="dd-hl">
              <span className="dd-hl-n" title={r.nama}>
                {r.nama}
              </span>
              <DotMeter pct={(r.jumlah / max) * 100} cols={10} rows={2} label={`${r.jumlah} inventory`} />
              <b className="dv-g">{r.jumlah} Inventory</b>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}
