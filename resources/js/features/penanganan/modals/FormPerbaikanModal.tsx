import { useState } from 'react';
import { X, Wrench } from 'lucide-react';
import Select from '../../../components/form/Select';
import { router } from '@inertiajs/react';
import { toastFormErrors } from '../../../lib/toastErrors';
import { InlineError } from '../../../components/form/FormControls';
import type { InventoryPenanganan } from '../types';
import { formatJenisKerusakan } from '../../inventory/inventoryHelpers';
import { todayIso } from '../helpers';

// Modal Form Selesai Perbaikan
export default function FormPerbaikanModal({
  penanganan,
  onClose,
  onSuccess,
}: {
  penanganan: InventoryPenanganan;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [tanggalSelesai, setTanggalSelesai] = useState(todayIso());
  const [hasil, setHasil] = useState<'diperbaiki' | 'rusak_berat'>('diperbaiki');
  const [biayaKomponen, setBiayaKomponen] = useState('');
  const [hargaJasa, setHargaJasa] = useState('');
  const [catatan, setCatatan] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const clearError = (key: string) => {
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: '' }));
  };
  const errCls = (key: string) => (errors[key] ? ' !border-red-400 focus:!ring-red-400' : '');

  const isRusakBerat = hasil === 'rusak_berat';

  const handleHasilChange = (value: 'diperbaiki' | 'rusak_berat') => {
    setHasil(value);
    if (value === 'rusak_berat') {
      setErrors({});
      setBiayaKomponen('');
      setHargaJasa('');
    }
  };

  const handleSubmit = () => {
    // sama dengan aturan server: biaya komponen & jasa wajib kalau hasilnya diperbaiki
    if (!isRusakBerat) {
      const clientErrors: Record<string, string> = {};
      if (!biayaKomponen.trim()) clientErrors.biaya_komponen = 'Biaya komponen wajib diisi kalau hasilnya diperbaiki.';
      if (!hargaJasa.trim()) clientErrors.harga_jasa = 'Biaya jasa wajib diisi kalau hasilnya diperbaiki.';
      if (Object.keys(clientErrors).length > 0) {
        setErrors(clientErrors);
        toastFormErrors(clientErrors);
        return;
      }
    }
    setErrors({});
    setSubmitting(true);
    // [F6-INERTIA] router.put ke /penanganan-inventory/{id}. Sukses -> toast dari flash server (FlashToaster) + modal ditutup parent;
    // gagal validasi -> pesan tampil di dalam modal ini.
    router.put(`/penanganan-inventory/${penanganan.id}`, {
      tanggal_selesai: tanggalSelesai,
      biaya_komponen: biayaKomponen.trim() ? Number(biayaKomponen) : null,
      harga_jasa: hargaJasa.trim() ? Number(hargaJasa) : null,
      hasil,
      catatan: catatan.trim() || null,
    }, {
      preserveScroll: true,
      preserveState: true,
      onSuccess: () => onSuccess(),
      onError: (serverErrors) => {
        setErrors(serverErrors);
        toastFormErrors(serverErrors, 'Gagal menyimpan perbaikan.');
      },
      onFinish: () => setSubmitting(false),
    });
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4 animate-[fadeIn_150ms_ease-out]"
    >
      <div className="bg-white rounded-2xl shadow-xl ring-1 ring-slate-900/5 w-full max-w-md max-h-[90vh] flex flex-col animate-[slideUp_180ms_ease-out]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
              {penanganan.inventory?.kode_inventory} · {formatJenisKerusakan(penanganan.jenis_kerusakan)}
            </p>
            <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
              <Wrench size={18} className="text-emerald-600" />
              Form Perbaikan
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup"
            className="grid h-8 w-8 place-items-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 overflow-y-auto">
          <div className="flex flex-col gap-3 mb-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Tanggal Selesai</label>
              <input
                type="date"
                value={tanggalSelesai}
                onChange={(e) => { setTanggalSelesai(e.target.value); clearError('tanggal_selesai'); }}
                className={`w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900${errCls('tanggal_selesai')}`}
              />
              <InlineError>{errors.tanggal_selesai}</InlineError>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Hasil Penanganan</label>
              <Select
                value={hasil}
                onChange={(v) => handleHasilChange(v as 'diperbaiki' | 'rusak_berat')}
                options={[
                  { value: 'diperbaiki', label: 'Diperbaiki (Kembali Normal)' },
                  { value: 'rusak_berat', label: 'Rusak Berat (Tidak Bisa Diperbaiki)' },
                ]}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Biaya Komponen</label>
                <input
                  type="number"
                  min={0}
                  value={biayaKomponen}
                  onChange={(e) => { setBiayaKomponen(e.target.value); clearError('biaya_komponen'); }}
                  placeholder={isRusakBerat ? '-' : 'Masukkan biaya komponen'}
                  disabled={isRusakBerat}
                  className={`w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed${errCls('biaya_komponen')}`}
                />
                <InlineError>{errors.biaya_komponen}</InlineError>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Biaya Jasa</label>
                <input
                  type="number"
                  min={0}
                  value={hargaJasa}
                  onChange={(e) => { setHargaJasa(e.target.value); clearError('harga_jasa'); }}
                  placeholder={isRusakBerat ? '-' : 'Masukkan biaya jasa'}
                  disabled={isRusakBerat}
                  className={`w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed${errCls('harga_jasa')}`}
                />
                <InlineError>{errors.harga_jasa}</InlineError>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Catatan Hasil Pengerjaan</label>
              <textarea
                value={catatan}
                onChange={(e) => { setCatatan(e.target.value); clearError('catatan'); }}
                rows={3}
                placeholder="Tulis catatan hasil pengerjaan"
                className={`w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 resize-none${errCls('catatan')}`}
              />
              <InlineError>{errors.catatan}</InlineError>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="px-4 py-2 text-sm rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors inline-flex items-center gap-2"
          >
            {submitting && (
              <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.25" />
                <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
              </svg>
            )}
            {submitting ? 'Menyimpan...' : 'Simpan & Tandai Selesai'}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(8px) scale(.98) } to { opacity: 1; transform: translateY(0) scale(1) } }
      `}</style>
    </div>
  );
}
