import { useAppNavigate } from '../../../../hooks/useAppNavigate';
import type { InventoryDipegang } from '../../types';
import { Panel, EmptyNote } from './primitives';

function lamaHari(sejak: string | null): { teks: string } | null {
  if (!sejak) return null;
  const d = new Date(sejak);
  if (isNaN(d.getTime())) return null;
  const hari = Math.max(0, Math.floor((Date.now() - d.getTime()) / 86400000));
  const tgl = d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long' });
  return { teks: hari === 0 ? `Sejak hari ini (${tgl})` : `Sejak ${tgl}, sudah ${hari} hari` };
}

// Inventory yang sedang dipegang user. `items` datang dari props pribadi.sedangDipegang;
// kalau server lama belum mengirimnya tapi jumlahnya > 0, tampilkan ringkasan saja.
export function DiTanganmu({ items, jumlah }: { items?: InventoryDipegang[]; jumlah: number }) {
  const navigate = useAppNavigate();
  const list = Array.isArray(items) ? items : [];

  return (
    <Panel title="Di tanganmu" subtitle="Diserahkan oleh admin IT.">
      {list.length > 0 ? (
        list.map((it) => {
          const lama = lamaHari(it.sejak);
          return (
            <div key={it.id} className="dd-hold">
              <div className="min-w-0">
                <div className="dv-g text-[22px] font-bold leading-tight">{it.kode_inventory ?? '-'}</div>
                <div className="text-sm mt-0.5">{it.nama ?? ''}</div>
                {lama && <div className="dv-sub" style={{ margin: '4px 0 0' }}>{lama.teks}</div>}
              </div>
              <button type="button" className="dd-btn dd-btn-sm" onClick={() => navigate('/master-data?tab=inventory')}>
                Lapor kerusakan
              </button>
            </div>
          );
        })
      ) : jumlah > 0 ? (
        <div className="dd-hold">
          <div className="text-sm">Kamu memegang {jumlah} inventory.</div>
          <button type="button" className="dd-btn dd-btn-sm" onClick={() => navigate('/master-data?tab=inventory')}>
            Lihat inventory
          </button>
        </div>
      ) : (
        <EmptyNote>Kamu belum memegang inventory. Hubungi admin IT untuk serah terima.</EmptyNote>
      )}
    </Panel>
  );
}
