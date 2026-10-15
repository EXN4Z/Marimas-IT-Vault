import { Wrench, Clock, CheckCircle2, AlertTriangle } from 'lucide-react';
import type { InventoryPenanganan } from '../../../api/transaksi/inventoryPenanganan';
import type { TabStatus } from './helpers';

interface PenangananKpiCardsProps {
  handleTabChange: (tab: TabStatus) => void;
  activeTab: TabStatus;
  menungguList: InventoryPenanganan[];
  diperbaikiList: InventoryPenanganan[];
  diperbaikiSelesaiList: InventoryPenanganan[];
  rusakBeratList: InventoryPenanganan[];
}

export default function PenangananKpiCards({ handleTabChange, activeTab, menungguList, diperbaikiList, diperbaikiSelesaiList, rusakBeratList }: PenangananKpiCardsProps) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <button
        type="button"
        onClick={() => handleTabChange('menunggu')}
        className={`p-4 rounded-xl border text-left transition-all ${
          activeTab === 'menunggu'
            ? 'bg-amber-50/70 border-amber-300 ring-2 ring-amber-500/20 shadow-xs'
            : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/50 shadow-xs'
        }`}
      >
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Menunggu Review</span>
          <span className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center font-bold">
            <Clock size={16} />
          </span>
        </div>
        <div className="text-2xl font-bold text-slate-900">{menungguList.length}</div>
        <p className="text-xs text-slate-500 mt-1">Laporan perlu verifikasi</p>
      </button>

      <button
        type="button"
        onClick={() => handleTabChange('diperbaiki')}
        className={`p-4 rounded-xl border text-left transition-all ${
          activeTab === 'diperbaiki'
            ? 'bg-blue-50/70 border-blue-300 ring-2 ring-blue-500/20 shadow-xs'
            : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/50 shadow-xs'
        }`}
      >
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Sedang Dikerjakan</span>
          <span className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
            <Wrench size={16} />
          </span>
        </div>
        <div className="text-2xl font-bold text-slate-900">{diperbaikiList.length}</div>
        <p className="text-xs text-slate-500 mt-1">Dalam proses teknisi</p>
      </button>

      <button
        type="button"
        onClick={() => handleTabChange('diperbaiki_selesai')}
        className={`p-4 rounded-xl border text-left transition-all ${
          activeTab === 'diperbaiki_selesai'
            ? 'bg-emerald-50/70 border-emerald-300 ring-2 ring-emerald-500/20 shadow-xs'
            : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/50 shadow-xs'
        }`}
      >
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Selesai Normal</span>
          <span className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
            <CheckCircle2 size={16} />
          </span>
        </div>
        <div className="text-2xl font-bold text-slate-900">{diperbaikiSelesaiList.length}</div>
        <p className="text-xs text-slate-500 mt-1">Siap pakai kembali</p>
      </button>

      <button
        type="button"
        onClick={() => handleTabChange('rusak_berat')}
        className={`p-4 rounded-xl border text-left transition-all ${
          activeTab === 'rusak_berat'
            ? 'bg-red-50/70 border-red-300 ring-2 ring-red-500/20 shadow-xs'
            : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/50 shadow-xs'
        }`}
      >
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Rusak Berat</span>
          <span className="w-8 h-8 rounded-lg bg-red-100 text-red-700 flex items-center justify-center font-bold">
            <AlertTriangle size={16} />
          </span>
        </div>
        <div className="text-2xl font-bold text-slate-900">{rusakBeratList.length}</div>
        <p className="text-xs text-slate-500 mt-1">Afkir / write-off aset</p>
      </button>
    </div>
  );
}
