import { useEffect, useState } from 'react';
import { Boxes, Users, Loader2, Download } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getAset, type Aset } from '../api/aset';
import { karyawanApi, type Karyawan } from '../api/karyawan';
import AsetExportModal from '../components/inventaris/AsetExportModal';
import KaryawanExportModal from '../components/laporan/KaryawanExportModal';

const STAFF_ROLES = ['admin', 'hr', 'manajer', 'manager', 'cabang'];

export default function Laporan() {
  const { user } = useAuth();
  const isStaff = !!user && STAFF_ROLES.includes(user.role);

  const [asetList, setAsetList] = useState<Aset[]>([]);
  const [asetLoading, setAsetLoading] = useState(true);
  const [exportAsetOpen, setExportAsetOpen] = useState(false);

  const [karyawanList, setKaryawanList] = useState<Karyawan[]>([]);
  const [karyawanLoading, setKaryawanLoading] = useState(true);
  const [exportKaryawanOpen, setExportKaryawanOpen] = useState(false);

  useEffect(() => {
    if (!isStaff) return;
    getAset()
      .then(setAsetList)
      .catch(console.error)
      .finally(() => setAsetLoading(false));

    karyawanApi
      .getAll()
      .then((res) => setKaryawanList(res.data))
      .catch(console.error)
      .finally(() => setKaryawanLoading(false));
  }, [isStaff]);

  if (!isStaff) {
    return (
        <div className="bg-white rounded-xl p-8 shadow-sm border border-slate-200 text-center">
          <p className="text-sm text-slate-500">Anda tidak punya akses ke halaman ini.</p>
        </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200 flex flex-col">
          <div className="w-10 h-10 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center mb-4">
            <Boxes size={18} />
          </div>
          <h3 className="text-sm font-semibold text-slate-900 mb-1">Data Aset</h3>
          <p className="text-xs text-slate-500 leading-relaxed flex-1">
            Export seluruh data aset IT (kode, jenis, status, kelengkapan, dsb) sebagai Excel atau PDF — kolom bisa dipilih sendiri.
          </p>

          <div className="mt-4">
            <button
              onClick={() => setExportAsetOpen(true)}
              disabled={asetLoading}
              className="w-full flex items-center justify-center gap-2 bg-slate-900 text-white text-sm font-medium px-4 py-2.5 rounded-lg hover:bg-slate-800 transition disabled:opacity-40"
            >
              {asetLoading ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
              {asetLoading ? 'Memuat data...' : 'Export'}
            </button>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200 flex flex-col">
          <div className="w-10 h-10 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center mb-4">
            <Users size={18} />
          </div>
          <h3 className="text-sm font-semibold text-slate-900 mb-1">Data Karyawan</h3>
          <p className="text-xs text-slate-500 leading-relaxed flex-1">
            Export data karyawan (NIK, nama, departemen, tanggal masuk, dsb) sebagai Excel atau PDF — kolom bisa dipilih sendiri.
          </p>

          <div className="mt-4">
            <button
              onClick={() => setExportKaryawanOpen(true)}
              disabled={karyawanLoading}
              className="w-full flex items-center justify-center gap-2 bg-slate-900 text-white text-sm font-medium px-4 py-2.5 rounded-lg hover:bg-slate-800 transition disabled:opacity-40"
            >
              {karyawanLoading ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
              {karyawanLoading ? 'Memuat data...' : 'Export'}
            </button>
          </div>
        </div>
      </div>

      <AsetExportModal open={exportAsetOpen} onClose={() => setExportAsetOpen(false)} data={asetList} />
      <KaryawanExportModal open={exportKaryawanOpen} onClose={() => setExportKaryawanOpen(false)} data={karyawanList} />
    </>
  );
}