import { useAppNavigate } from '../../../../hooks/useAppNavigate';
import type { InventoryPerhatian } from '../../types';
import { Panel } from './primitives';

export function PerluTindakan({ perhatian, dijual }: { perhatian: InventoryPerhatian; dijual: number }) {
  const navigate = useAppNavigate();
  const items = [
    { label: `${perhatian?.rusak ?? 0} aset rusak berat`, sub: 'Status rusak berat, belum ditindaklanjuti', n: perhatian?.rusak ?? 0, to: '/master-data?tab=inventory&status=rusak_berat' },
    { label: `${perhatian?.dalamPenanganan ?? 0} aset dalam penanganan`, sub: 'Menunggu perbaikan atau sedang diperbaiki', n: perhatian?.dalamPenanganan ?? 0, to: '/penanganan-inventory' },
    { label: `${perhatian?.garansiSegeraHabis ?? 0} garansi habis < 30 hari`, sub: 'Cek sebelum garansi berakhir', n: perhatian?.garansiSegeraHabis ?? 0, to: '/master-data?tab=inventory' },
    { label: `${dijual} aset sudah dijual`, sub: 'Tidak lagi dihitung sebagai aset aktif', n: dijual, to: '/master-data?tab=inventory&status=dijual' },
  ];
  return (
    <Panel title="Perlu tindakan" subtitle="Klik untuk membuka daftar yang sudah terfilter.">
      {items.map((it) => (
        <button key={it.sub} type="button" className="dv-row" onClick={() => navigate(it.to)}>
          <span>
            <b>{it.label}</b>
            <br />
            {it.sub}
          </span>
          <span className="dv-link">Buka</span>
        </button>
      ))}
    </Panel>
  );
}
