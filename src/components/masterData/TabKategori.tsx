import { useEffect, useState } from 'react';
import { Tags } from 'lucide-react';
import { getKategori, type Kategori } from '../../api/masterData/kategori';

// Read-only dengan sengaja: Kategori cuma 2 baris fix ("Barang Utama" &
// "Kelengkapan"), di-seed langsung lewat migration backend. TIDAK ada
// form create/edit/delete di sini — beda dari Master Kategori yang
// dikelola admin lewat CRUD biasa. Lihat catatan di api/masterData/kategori.ts.
export default function TabKategori() {
  const [items, setItems] = useState<Kategori[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    getKategori()
      .then((data) => {
        if (active) setItems(data);
      })
      .catch((err) => {
        if (!active) return;
        if (err.response?.status === 403) {
          setError('Anda tidak punya akses ke halaman ini.');
        } else {
          setError('Gagal memuat data kategori.');
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="px-6 pt-5 pb-1">
        <p className="text-xs text-slate-400">
          Kategori adalah pembagian dasar barang (Barang Utama / Kelengkapan), dipakai buat
          nentuin field mana yang berlaku waktu bikin Inventory. Daftar ini tetap (fixed) dan
          tidak bisa ditambah, diubah, atau dihapus lewat halaman ini.
        </p>
      </div>

      {loading && <p className="text-sm text-slate-400 text-center py-8">Memuat data...</p>}

      {!loading && error && <p className="text-sm text-red-500 text-center py-8">{error}</p>}

      {!loading && !error && items.length === 0 && (
        <p className="text-sm text-slate-400 text-center py-8">Belum ada data kategori.</p>
      )}

      {!loading && !error && items.length > 0 && (
        <div className="overflow-x-auto mt-3">
          <table className="w-full text-sm min-w-[420px]">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs text-slate-400 uppercase tracking-wide">
                <th className="px-6 py-3 font-medium">Nama</th>
                <th className="px-6 py-3 font-medium">Kode</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60 transition">
                  <td className="px-6 py-3 text-slate-800">
                    <div className="flex items-center gap-2">
                      <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-slate-100 text-slate-500">
                        <Tags size={14} />
                      </span>
                      {item.nama}
                    </div>
                  </td>
                  <td className="px-6 py-3">
                    <span className="inline-block px-2.5 py-1 rounded-md bg-slate-100 text-slate-600 text-xs font-mono">
                      {item.kode}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
