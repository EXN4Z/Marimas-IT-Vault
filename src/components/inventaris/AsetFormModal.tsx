import { useState } from 'react';
import { createAset, updateAset, type Aset } from '../../api/aset';
import type { Supplier } from '../../api/supplier';

interface AsetFormModalProps {
  aset: Aset | null; // null = mode tambah
  supplierOptions: Supplier[];
  onClose: () => void;
  onSaved: (aset: Aset) => void;
}

interface FormState {
  merek: string;
  tipe: string;
  warna: string;
  serial_number: string;
  jumlah: string;
  tanggal_garansi: string;
  perusahaan: string;
  keterangan: string;
  supplier_id: string;
  tanggal_pembelian: string;
  no_surat_jalan: string;
  no_good_receive: string;
}

export default function AsetFormModal({
  aset,
  supplierOptions,
  onClose,
  onSaved,
}: AsetFormModalProps) {
  const [form, setForm] = useState<FormState>({
    merek: aset?.merek || '',
    tipe: aset?.tipe || '',
    warna: aset?.warna || '',
    serial_number: aset?.serial_number || '',
    jumlah: aset?.jumlah ? String(aset.jumlah) : '1',
    tanggal_garansi: aset?.tanggal_garansi ? aset.tanggal_garansi.slice(0, 10) : '',
    perusahaan: aset?.perusahaan || '',
    keterangan: aset?.keterangan || '',
    supplier_id: aset?.supplier_id ? String(aset.supplier_id) : '',
    tanggal_pembelian: aset?.tanggal_pembelian ? aset.tanggal_pembelian.slice(0, 10) : '',
    no_surat_jalan: aset?.no_surat_jalan || '',
    no_good_receive: aset?.no_good_receive || '',
  });
  const [foto, setFoto] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const set = (key: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleSubmit = async () => {
    setSubmitting(true);
    setError('');
    try {
      const values = {
        merek: form.merek.trim() || undefined,
        tipe: form.tipe.trim() || undefined,
        warna: form.warna.trim() || undefined,
        serial_number: form.serial_number.trim() || undefined,
        jumlah: form.jumlah ? Number(form.jumlah) : undefined,
        tanggal_garansi: form.tanggal_garansi || undefined,
        perusahaan: form.perusahaan.trim() || undefined,
        keterangan: form.keterangan.trim() || undefined,
        foto,
        supplier_id: form.supplier_id ? Number(form.supplier_id) : null,
        tanggal_pembelian: form.tanggal_pembelian || undefined,
        no_surat_jalan: form.no_surat_jalan.trim() || undefined,
        no_good_receive: form.no_good_receive.trim() || undefined,
      };

      const saved = aset ? await updateAset(aset.id, values) : await createAset(values);
      onSaved(saved);
    } catch (err: any) {
      const msg =
        err.response?.data?.errors?.serial_number?.[0] ||
        err.response?.data?.message ||
        'Gagal menyimpan aset. Coba lagi.';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-[fadeIn_150ms_ease-out]"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-2xl shadow-xl ring-1 ring-slate-900/5 w-full max-w-lg max-h-[90vh] flex flex-col animate-[slideUp_180ms_ease-out]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
              {aset ? 'Ubah data' : 'Data baru'}
            </p>
            <h3 className="text-lg font-semibold text-slate-900">
              {aset ? `Edit Aset ${aset.kode_aset}` : 'Tambah Aset'}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup"
            className="grid h-8 w-8 place-items-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M1 1L15 15M15 1L1 15" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 overflow-y-auto">
        <div className="flex flex-col gap-3 mb-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Nama/Merek</label>
              <input
                value={form.merek}
                onChange={set('merek')}
                placeholder="cth. HP"
                className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Tipe</label>
              <input
                value={form.tipe}
                onChange={set('tipe')}
                placeholder="cth. 14s-dq5001TU"
                className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Warna</label>
              <input
                value={form.warna}
                onChange={set('warna')}
                className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Serial Number</label>
              <input
                value={form.serial_number}
                onChange={set('serial_number')}
                className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Jumlah</label>
            <input
              type="number"
              min={1}
              value={form.jumlah}
              onChange={set('jumlah')}
              placeholder="1"
              className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
            <p className="text-xs text-slate-400 mt-1">Default 1. Isi lebih dari 1 kalau barang non-serialized (mis. kabel, adaptor) dicatat dalam 1 baris.</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Tanggal Garansi</label>
            <input
              type="date"
              value={form.tanggal_garansi}
              onChange={set('tanggal_garansi')}
              className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Perusahaan</label>
            <input
              value={form.perusahaan}
              onChange={set('perusahaan')}
              placeholder="cth. mpk, uth"
              className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Keterangan</label>
            <textarea
              value={form.keterangan}
              onChange={set('keterangan')}
              rows={2}
              placeholder="cth. keadaan baik"
              className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Foto {aset?.foto ? '(ganti, opsional)' : '(opsional)'}</label>
            <input
              type="file"
              accept="image/png,image/jpeg,image/jpg"
              onChange={(e) => setFoto(e.target.files?.[0] || null)}
              className="w-full text-sm file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-slate-100 file:text-slate-700 file:text-sm file:font-medium hover:file:bg-slate-200"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Supplier</label>
            <select
              value={form.supplier_id}
              onChange={set('supplier_id')}
              className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
            >
              <option value="">Tanpa supplier</option>
              {supplierOptions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nama}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">No. Surat Jalan</label>
              <input
                value={form.no_surat_jalan}
                onChange={set('no_surat_jalan')}
                className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">No. Good Receive</label>
              <input
                value={form.no_good_receive}
                onChange={set('no_good_receive')}
                className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Tanggal Pembelian</label>
            <input
              type="date"
              value={form.tanggal_pembelian}
              onChange={set('tanggal_pembelian')}
              className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
          </div>

          {!aset && (
            <p className="text-xs text-slate-400">Kode aset (IT-tahun-nomor urut) akan dibuat otomatis oleh sistem.</p>
          )}
        </div>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-3">{error}</p>
        )}
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
            onClick={handleSubmit}
            disabled={submitting}
            className="px-4 py-2 text-sm rounded-lg bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-50 transition-colors inline-flex items-center gap-2"
          >
            {submitting && (
              <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.25" />
                <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
              </svg>
            )}
            {submitting ? 'Menyimpan...' : aset ? 'Simpan Perubahan' : 'Tambah Aset'}
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