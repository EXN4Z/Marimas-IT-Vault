import { useEffect, useState } from 'react';
import type { AsetKelengkapan, AsetKelengkapanFormValues, AsetKelengkapanStatus } from '../../api/asetKelengkapan';
import { createAsetKelengkapan, updateAsetKelengkapan } from '../../api/asetKelengkapan';
import { getSupplier, type Supplier } from '../../api/supplier';
import { getAset, type Aset } from '../../api/aset';

// Style input disamakan dengan form2 lain (AsetFormModal, AsetSerahTerimaModal, dst)
// biar border-nya konsisten di semua form inventaris.
const INPUT_CLASS =
  'w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900';

const STATUS_OPTIONS: { value: AsetKelengkapanStatus; label: string; dot: string }[] = [
  { value: 'tersedia', label: 'Tersedia', dot: 'bg-emerald-500' },
  { value: 'dipakai', label: 'Dipakai', dot: 'bg-blue-500' },
  { value: 'rusak', label: 'Rusak', dot: 'bg-red-500' },
  { value: 'diperbaiki', label: 'Diperbaiki', dot: 'bg-amber-500' },
];

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  editing?: AsetKelengkapan | null; // null/undefined = mode tambah
}

const EMPTY_FORM: AsetKelengkapanFormValues = {
  aset_id: null,
  nama: '',
  merek: '',
  tipe: '',
  warna: '',
  serial_number: '',
  tanggal_garansi: '',
  perusahaan: '',
  keterangan: '',
  foto: null,
  supplier_id: null,
  tanggal_pembelian: '',
  no_surat_jalan: '',
  no_good_receive: '',
  status: 'tersedia',
};

export default function AsetKelengkapanForm({ open, onClose, onSaved, editing }: Props) {
  const [form, setForm] = useState<AsetKelengkapanFormValues>(EMPTY_FORM);
  const [supplierOptions, setSupplierOptions] = useState<Supplier[]>([]);
  const [asetOptions, setAsetOptions] = useState<Aset[]>([]);
  const [fotoPreview, setFotoPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open) return;
    getSupplier()
      .then(setSupplierOptions)
      .catch(console.error);
    getAset()
      .then(setAsetOptions)
      .catch(console.error);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setForm({
        aset_id: editing.aset_id ?? null,
        nama: editing.nama || '',
        merek: editing.merek || '',
        tipe: editing.tipe || '',
        warna: editing.warna || '',
        serial_number: editing.serial_number || '',
        tanggal_garansi: editing.tanggal_garansi || '',
        perusahaan: editing.perusahaan || '',
        keterangan: editing.keterangan || '',
        foto: null,
        supplier_id: editing.supplier_id,
        tanggal_pembelian: editing.tanggal_pembelian || '',
        no_surat_jalan: editing.no_surat_jalan || '',
        no_good_receive: editing.no_good_receive || '',
        status: editing.status,
      });
      setFotoPreview(editing.foto || null);
    } else {
      setForm(EMPTY_FORM);
      setFotoPreview(null);
    }
    setErrors({});
  }, [open, editing]);

  if (!open) return null;

  function setField<K extends keyof AsetKelengkapanFormValues>(key: K, value: AsetKelengkapanFormValues[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleFotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] || null;
    setField('foto', file);
    if (file) setFotoPreview(URL.createObjectURL(file));
  }

  function handleFotoDrop(e: React.DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0] || null;
    if (file) {
      setField('foto', file);
      setFotoPreview(URL.createObjectURL(file));
    }
  }

  function validate(): boolean {
    const next: Record<string, string> = {};
    if (!form.merek?.trim()) next.merek = 'Merek wajib diisi';
    if (!form.status) next.status = 'Status wajib dipilih';
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);
    try {
      if (editing) {
        await updateAsetKelengkapan(editing.id, form);
      } else {
        await createAsetKelengkapan(form);
      }
      onSaved();
      onClose();
    } catch (err: any) {
      const apiErrors = err?.response?.data?.errors;
      if (apiErrors) {
        const flat: Record<string, string> = {};
        Object.keys(apiErrors).forEach((k) => (flat[k] = apiErrors[k][0]));
        setErrors(flat);
      } else {
        console.error(err);
        setErrors({ _general: 'Gagal menyimpan data. Coba lagi.' });
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-[fadeIn_150ms_ease-out]"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-2xl shadow-xl ring-1 ring-slate-900/5 w-full max-w-2xl max-h-[90vh] flex flex-col animate-[slideUp_180ms_ease-out]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
              {editing ? 'Ubah data' : 'Data baru'}
            </p>
            <h3 className="text-lg font-semibold text-slate-900">
              {editing ? 'Edit Kelengkapan Aset' : 'Tambah Kelengkapan Aset'}
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
        <form id="aset-kelengkapan-form" onSubmit={handleSubmit} className="px-6 py-5 space-y-7 overflow-y-auto">
          {errors._general && (
            <p className="flex items-center gap-2 text-sm text-red-700 bg-red-50 border border-red-100 rounded-lg px-3 py-2.5">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="shrink-0">
                <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.4" />
                <path d="M8 5v3.5M8 11h.01" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
              </svg>
              {errors._general}
            </p>
          )}

          {/* Section: Informasi Umum */}
          <Section title="Informasi Umum" subtitle="Nama, status, dan ciri fisik barang">
            <div className="sm:col-span-2">
              <Field label="Aset Induk" error={errors.aset_id}>
                <select
                  className="input"
                  value={form.aset_id ?? ''}
                  onChange={(e) => setField('aset_id', e.target.value ? Number(e.target.value) : null)}
                >
                  <option value="">Tanpa aset induk</option>
                  {asetOptions.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.kode_aset}
                      {(a.merek || a.tipe) ? ` — ${[a.merek, a.tipe].filter(Boolean).join(' ')}` : ''}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-slate-400">
                  Opsional — pilih kalau kelengkapan ini menempel ke aset tertentu (mis. mouse ini punya laptop yang mana).
                </p>
              </Field>
            </div>

            <Field label="Nama" error={errors.nama}>
              <input className={INPUT_CLASS} value={form.nama} onChange={(e) => setField('nama', e.target.value)} />
            </Field>

            <Field label="Status" error={errors.status} required>
              <div className="grid grid-cols-2 gap-2">
                {STATUS_OPTIONS.map((s) => (
                  <label
                    key={s.value}
                    className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm cursor-pointer transition-colors ${
                      form.status === s.value
                        ? 'border-slate-900 bg-slate-900/[0.03] text-slate-900'
                        : 'border-slate-200 text-slate-500 hover:border-slate-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="status"
                      className="sr-only"
                      checked={form.status === s.value}
                      onChange={() => setField('status', s.value)}
                    />
                    <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
                    {s.label}
                  </label>
                ))}
              </div>
            </Field>

            <Field label="Merek" error={errors.merek} required>
              <input className={INPUT_CLASS} value={form.merek} onChange={(e) => setField('merek', e.target.value)} placeholder="cth. Dell, HP, Logitech" />
            </Field>

            <Field label="Tipe">
              <input className={INPUT_CLASS} value={form.tipe} onChange={(e) => setField('tipe', e.target.value)} />
            </Field>

            <Field label="Warna">
              <input className={INPUT_CLASS} value={form.warna} onChange={(e) => setField('warna', e.target.value)} />
            </Field>

            <Field label="Serial Number">
              <input
                className={`${INPUT_CLASS} font-mono text-[13px]`}
                value={form.serial_number}
                onChange={(e) => setField('serial_number', e.target.value)}
              />
            </Field>
          </Section>

          {/* Section: Pembelian & Garansi */}
          <Section title="Pembelian & Garansi" subtitle="Sumber barang dan dokumen terkait">
            <Field label="Supplier">
              <select
                className={`${INPUT_CLASS} bg-white`}
                value={form.supplier_id ?? ''}
                onChange={(e) => setField('supplier_id', e.target.value ? Number(e.target.value) : null)}
              >
                <option value="">Pilih supplier</option>
                {supplierOptions.map((s) => (
                  <option key={s.id} value={s.id}>{s.nama}</option>
                ))}
              </select>
            </Field>

            <Field label="Perusahaan">
              <input
                className={INPUT_CLASS}
                value={form.perusahaan}
                onChange={(e) => setField('perusahaan', e.target.value)}
              />
            </Field>

            <Field label="Tanggal Pembelian">
              <input
                type="date"
                className={INPUT_CLASS}
                value={form.tanggal_pembelian || ''}
                onChange={(e) => setField('tanggal_pembelian', e.target.value)}
              />
            </Field>

            <Field label="Tanggal Garansi">
              <input
                type="date"
                className={INPUT_CLASS}
                value={form.tanggal_garansi || ''}
                onChange={(e) => setField('tanggal_garansi', e.target.value)}
              />
            </Field>

            <Field label="No Surat Jalan">
              <input
                className={INPUT_CLASS}
                value={form.no_surat_jalan}
                onChange={(e) => setField('no_surat_jalan', e.target.value)}
              />
            </Field>

            <Field label="No Good Receive">
              <input
                className={INPUT_CLASS}
                value={form.no_good_receive}
                onChange={(e) => setField('no_good_receive', e.target.value)}
              />
            </Field>
          </Section>

          {/* Section: Detail Tambahan */}
          <Section title="Detail Tambahan" subtitle="Catatan dan foto barang">
            <div className="sm:col-span-2">
              <Field label="Keterangan">
                <textarea
                  className={`${INPUT_CLASS} min-h-[80px] resize-none`}
                  value={form.keterangan}
                  onChange={(e) => setField('keterangan', e.target.value)}
                />
              </Field>
            </div>

            <div className="sm:col-span-2">
              <span className="block mb-1.5 text-sm font-medium text-slate-700">Foto</span>
              <label
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleFotoDrop}
                className="flex items-center gap-4 rounded-xl border border-dashed border-slate-300 hover:border-slate-400 bg-slate-50/50 p-3 cursor-pointer transition-colors"
              >
                <input type="file" accept="image/*" className="sr-only" onChange={handleFotoChange} />
                {fotoPreview ? (
                  <img src={fotoPreview} alt="Preview" className="h-16 w-16 object-cover rounded-lg border border-slate-200 shrink-0" />
                ) : (
                  <div className="grid h-16 w-16 place-items-center rounded-lg bg-slate-100 text-slate-400 shrink-0">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                      <path d="M4 16l4.6-4.6a2 2 0 0 1 2.8 0L16 16M13 13l1.6-1.6a2 2 0 0 1 2.8 0L20 14M4 6h16v14H4V6z" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                )}
                <div className="text-sm">
                  <p className="font-medium text-slate-700">{fotoPreview ? 'Ganti foto' : 'Unggah foto'}</p>
                  <p className="text-slate-400 text-xs mt-0.5">Klik atau seret file ke sini · PNG/JPG</p>
                </div>
              </label>
            </div>
          </Section>
        </form>

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
            type="submit"
            form="aset-kelengkapan-form"
            disabled={saving}
            className="px-4 py-2 text-sm rounded-lg bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-50 transition-colors inline-flex items-center gap-2"
          >
            {saving && (
              <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.25" />
                <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
              </svg>
            )}
            {saving ? 'Menyimpan...' : editing ? 'Simpan Perubahan' : 'Tambah'}
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

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-3">
        <h4 className="text-sm font-semibold text-slate-900">{title}</h4>
        {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">{children}</div>
    </div>
  );
}

function Field({
  label,
  error,
  required,
  children,
}: {
  label: string;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block text-sm">
      <span className="block mb-1.5 font-medium text-slate-700">
        {label} {required && <span className="text-red-500">*</span>}
      </span>
      {children}
      {error && <span className="block mt-1 text-xs text-red-600">{error}</span>}
    </label>
  );
}