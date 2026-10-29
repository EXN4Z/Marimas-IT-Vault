import { AlertTriangle, Wrench, ShieldCheck, Tag, ChevronRight } from 'lucide-react';
import { useAppNavigate } from '../../../../hooks/useAppNavigate';
import type { InventoryPerhatian } from '../../types';

// Strip "Perlu tindakan": 4 kartu kecil (klik = buka daftar terfilter) + kartu ajakan ke laporan.
export function PerluTindakan({ perhatian, dijual }: { perhatian: InventoryPerhatian; dijual: number }) {
  const navigate = useAppNavigate();
  const items = [
    { label: 'Inventory rusak berat', sub: 'belum ditindaklanjuti', n: perhatian?.rusak ?? 0, to: '/master-data?tab=inventory&status=rusak_berat', Icon: AlertTriangle, tone: 'alert' },
    { label: 'Dalam penanganan', sub: 'menunggu / diperbaiki', n: perhatian?.dalamPenanganan ?? 0, to: '/penanganan-inventory', Icon: Wrench, tone: 'primary' },
    { label: 'Garansi < 30 hari', sub: 'cek sebelum berakhir', n: perhatian?.garansiSegeraHabis ?? 0, to: '/master-data?tab=inventory', Icon: ShieldCheck, tone: 'yellow' },
    { label: 'Inventory sudah dijual', sub: 'bukan inventory aktif', n: dijual, to: '/master-data?tab=inventory&status=dijual', Icon: Tag, tone: 'green' },
  ];
  return (
    <section aria-label="Perlu tindakan" className="dd-strip">
      <div className="dd-strip-h">
        <h2 className="dv-g">Perlu tindakan</h2>
        <p>Klik kartu untuk membuka daftar yang sudah terfilter.</p>
      </div>
      {items.map((it) => (
        <button key={it.label} type="button" className="dd-sc" onClick={() => navigate(it.to)}>
          <span className={`dd-sc-ico t-${it.tone}`}>
            <it.Icon size={19} />
          </span>
          <small>{it.label}</small>
          <b className="dv-g">{it.n}</b>
          <em>{it.sub}</em>
        </button>
      ))}
      <button type="button" className="dd-cta" onClick={() => navigate('/laporan?tab=riwayat_inventory')}>
        <span className="r1" aria-hidden="true" />
        <span className="r2" aria-hidden="true" />
        <h3 className="dv-g">
          Semua
          <br />
          Laporan
        </h3>
        <span className="a">
          <ChevronRight size={16} />
        </span>
      </button>
    </section>
  );
}
