import { useState } from 'react';
import { X, Plus, Trash2 } from 'lucide-react';
import { createAset, updateAset, type Aset } from '../api/aset';
import type { JenisAset } from '../api/jenisAset';
import type { Supplier } from '../api/supplier';
import type { KelengkapanMaster } from '../api/kelengkapanMaster';

interface AsetFormModalProps {
  aset: Aset | null; // null = mode tambah
  jenisOptions: JenisAset[];
  supplierOptions: Supplier[];
  kelengkapanOptions: KelengkapanMaster[];
  onClose: () => void;
  onSaved: (aset: Aset) => void;
}

interface KelengkapanRow {
  kelengkapan_master_id: string;
  keterangan: string;
}

interface FormState {
  jenis_id: string;
  merek: string;
  tipe: string;
  warna: string;
  serial_number: string;
  perusahaan: string;
  keterangan: string;
  supplier_id: string;
  tanggal_pembelian: string;
  no_surat_jalan: string;
  no_good_receive: string;
}

export default function AsetFormModal({
  aset,
  jenisOptions,
  supplierOptions,
  kelengkapanOptions,
  onClose,
  onSaved,
}: AsetFormModalProps) {
  const [form, setForm] = useState<FormState>({
    jenis_id: aset?.jenis_id ? String(aset.jenis_id) : '',
    merek: aset?.merek || '',
    tipe: aset?.tipe || '',
    warna: aset?.warna || '',
    serial_number: aset?.serial_number || '',
    perusahaan: aset?.perusahaan || '',
    keterangan: aset?.keterangan || '',
    supplier_id: aset?.supplier_id ? String(aset.supplier_id) : '',
    tanggal_pembelian: aset?.tanggal_pembelian ? aset.tanggal_pembelian.slice(0, 10) : '',
    no_surat_jalan: aset?.no_surat_jalan || '',
    no_good_receive: aset?.no_good_receive || '',
  });
  const [kelengkapanRows, setKelengkapanRows] = useState<KelengkapanRow[]>(
    aset?.kelengkapan?.length
      ? aset.kelengkapan.map((k) => ({
          kelengkapan_master_id: String(k.kelengkapan_master_id),
          keterangan: k.keterangan || '',
        }))
      : []
  );
  const [foto, setFoto] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const set = (key: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const addKelengkapanRow = () => setKelengkapanRows((prev) => [...prev, { kelengkapan_master_id: '', keterangan: '' }]);
  const removeKelengkapanRow = (idx: number) => setKelengkapanRows((prev) => prev.filter((_, i) => i !== idx));
  const updateKelengkapanRow = (idx: number, patch: Partial<KelengkapanRow>) =>
    setKelengkapanRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));

  const handleSubmit = async () => {
    setSubmitting(true);
    setError('');
    try {
      const kelengkapanPayload = kelengkapanRows
        .filter((r) => r.kelengkapan_master_id)
        .map((r) => ({
          kelengkapan_master_id: Number(r.kelengkapan_master_id),
          keterangan: r.keterangan.trim() || undefined,
        }));

      const values = {
        jenis_id: form.jenis_id ? Number(form.jenis_id) : null,
        merek: form.merek.trim() || undefined,
        tipe: form.tipe.trim() || undefined,
        warna: form.warna.trim() || undefined,
        serial_number: form.serial_number.trim() || undefined,
        perusahaan: form.perusahaan.trim() || undefined,
        keterangan: form.keterangan.trim() || undefined,
        foto,
        supplier_id: form.supplier_id ? Number(form.supplier_id) : null,
        tanggal_pembelian: form.tanggal_pembelian || undefined,
        no_surat_jalan: form.no_surat_jalan.trim() || undefined,
        no_good_receive: form.no_good_receive.trim() || undefined,
        kelengkapan: kelengkapanPayload,
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
    <div className="fixed inset-0 bg-black/40 z-[60] flex items-center justify-center px-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-slate-900">
            {aset ? `Edit Aset ${aset.kode_aset}` : 'Tambah Aset'}
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={20} />
          </button>
        </div>

        <div className="flex flex-col gap-3 mb-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Jenis Aset</label>
            <select
              value={form.jenis_id}
              onChange={set('jenis_id')}
              className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
            >
              <option value="">Pilih jenis...</option>
              {jenisOptions.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.nama}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Merek</label>
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

          <div className="grid grid-cols-2 gap-3">
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

          <div className="grid grid-cols-2 gap-3">
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

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-medium text-slate-700">Kelengkapan</label>
              <button
                type="button"
                onClick={addKelengkapanRow}
                className="flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-slate-900"
              >
                <Plus size={13} />
                Tambah
              </button>
            </div>
            {kelengkapanRows.length === 0 && (
              <p className="text-xs text-slate-400">Belum ada kelengkapan ditambahkan.</p>
            )}
            <div className="flex flex-col gap-2">
              {kelengkapanRows.map((row, idx) => (
                <div key={idx} className="flex gap-2">
                  <select
                    value={row.kelengkapan_master_id}
                    onChange={(e) => updateKelengkapanRow(idx, { kelengkapan_master_id: e.target.value })}
                    className="flex-1 px-2.5 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
                  >
                    <option value="">Pilih...</option>
                    {kelengkapanOptions.map((k) => (
                      <option key={k.id} value={k.id}>
                        {k.nama}
                      </option>
                    ))}
                  </select>
                  <input
                    value={row.keterangan}
                    onChange={(e) => updateKelengkapanRow(idx, { keterangan: e.target.value })}
                    placeholder="Keterangan (cth. S/N: xxx)"
                    className="flex-[1.4] px-2.5 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                  />
                  <button
                    type="button"
                    onClick={() => removeKelengkapanRow(idx)}
                    className="w-9 flex-shrink-0 rounded-lg bg-red-50 text-red-600 flex items-center justify-center hover:bg-red-100 transition"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {!aset && (
            <p className="text-xs text-slate-400">Kode aset (IT-tahun-nomor urut) akan dibuat otomatis oleh sistem.</p>
          )}
        </div>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-3">{error}</p>
        )}

        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="w-full bg-slate-900 text-white text-sm font-semibold py-3 rounded-lg hover:bg-slate-800 transition disabled:opacity-40"
        >
          {submitting ? 'Menyimpan...' : aset ? 'Simpan Perubahan' : 'Tambah Aset'}
        </button>
      </div>
    </div>
  );
}
