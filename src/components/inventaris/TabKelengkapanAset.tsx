import { useEffect, useState } from 'react';
import { getAset, type Aset } from '../../api/aset';
import { getKelengkapanMaster, type KelengkapanMaster } from '../../api/kelengkapanMaster';
import { kelengkapanLevel, kelengkapanLevelStyle, kelengkapanLevelLabel } from './asetHelpers';

export default function TabKelengkapanAset() {
  const [asetList, setAsetList] = useState<Aset[]>([]);
  const [kelengkapanOptions, setKelengkapanOptions] = useState<KelengkapanMaster[]>([]);
  const [loading, setLoading] = useState(true);
  const totalKelengkapanMaster = kelengkapanOptions.length || 3;

  useEffect(() => {
    setLoading(true);
    Promise.all([getAset(), getKelengkapanMaster()])
      .then(([asetData, kelengkapanData]) => {
        setAsetList(asetData);
        setKelengkapanOptions(kelengkapanData);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

    const laptopList = asetList.filter((a) =>
  (a.jenis?.nama || '').toLowerCase().includes('laptop')
  );

  const levels = new Map<number, Aset[]>();
  laptopList.forEach((a) => {
    const level = kelengkapanLevel(a, totalKelengkapanMaster);
    if (!levels.has(level)) levels.set(level, []);
    levels.get(level)!.push(a);
  });
  const kelengkapanSummary = Array.from({ length: totalKelengkapanMaster + 1 }, (_, i) => totalKelengkapanMaster - i).map(
    (level) => ({ level, items: levels.get(level) || [] })
  );


  if (loading) {
    return <p className="text-sm text-slate-500">Memuat data kelengkapan aset...</p>;
  }

  return (
    <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
      <h3 className="text-base font-semibold text-slate-900 mb-1">Tabel Kelengkapan Aset</h3>
      <p className="text-sm text-slate-500 mb-4">
        Level kelengkapan dihitung dari jumlah item kelengkapan (charger, tas, mouse, dst) yang tercatat
        per unit. Lengkap semua → level {totalKelengkapanMaster}, kurang 1 → level {totalKelengkapanMaster - 1}, kurang 2 → level {Math.max(totalKelengkapanMaster - 2, 0)}, dst.
      </p>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {kelengkapanSummary.map(({ level, items }) => (
          <div key={level} className="border border-slate-200 rounded-lg p-4 text-center">
            <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium mb-2 ${kelengkapanLevelStyle(level, totalKelengkapanMaster)}`}>
              Level {level}
            </span>
            <p className="text-2xl font-bold text-slate-900">{items.length}</p>
            <p className="text-xs text-slate-400">unit</p>
          </div>
        ))}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[640px]">
          <thead>
            <tr className="border-b border-slate-100 text-left text-xs text-slate-400 uppercase tracking-wide">
              <th className="px-4 py-3 font-medium">Kode Aset</th>
              <th className="px-4 py-3 font-medium">Jenis / Merek</th>
              <th className="px-4 py-3 font-medium">Kelengkapan Tercatat</th>
              <th className="px-4 py-3 font-medium">Level</th>
            </tr>
          </thead>
          <tbody>
            {laptopList.map((a) => {
              const level = kelengkapanLevel(a, totalKelengkapanMaster);
              return (
                <tr key={a.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60 transition">
                  <td className="px-4 py-3 font-medium text-slate-800">{a.kode_aset}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {a.jenis?.nama || '-'} · {[a.merek, a.tipe].filter(Boolean).join(' ') || '-'}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {(a.kelengkapan || []).map((k) => k.kelengkapan_master?.nama).filter(Boolean).join(', ') || '-'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium ${kelengkapanLevelStyle(level, totalKelengkapanMaster)}`}>
                      {kelengkapanLevelLabel(level, totalKelengkapanMaster)}
                    </span>
                  </td>
                </tr>
              );
            })}
            {laptopList.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-sm text-slate-400">
                  Belum ada aset laptop tercatat.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}