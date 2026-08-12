import { useEffect, useState } from 'react';
import type { AsetKelengkapan, AsetKelengkapanFormValues, AsetKelengkapanStatus } from '../../api/asetKelengkapan';
import { createAsetKelengkapan, updateAsetKelengkapan } from '../../api/asetKelengkapan';
import { getJenisAset, type JenisAset } from '../../api/jenisAset';
import { getSupplier, type Supplier } from '../../api/supplier';

const STATUS_OPTIONS: AsetKelengkapanStatus[] = ['tersedia', 'dipakai', 'rusak', 'diperbaiki'];

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  editing?: AsetKelengkapan | null; // null/undefined = mode tambah
}

const EMPTY_FORM: AsetKelengkapanFormValues = {
  jenis_id: null,
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
  const [jenisOptions, setJenisOptions] = useState<JenisAset[]>([]);
  const [supplierOptions, setSupplierOptions] = useState<Supplier[]>([]);
  const [fotoPreview, setFotoPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open) return;
    Promise.all([getJenisAset(), getSupplier()])
      .then(([jenis, supplier]) => {
        setJenisOptions(jenis);
        setSupplierOptions(supplier);
      })
      .catch(console.error);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setForm({
        jenis_id: editing.jenis_id,
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

  function validate(): boolean {
    const next: Record<string, string> = {};
    if (!form.jenis_id) next.jenis_id = 'Jenis wajib dipilih';
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="bg-white rounded-xl shadow-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h3 className="text-base font-semibold text-slate-900">
            {editing ? 'Edit Kelengkapan Aset' : 'Tambah Kelengkapan Aset'}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 text-xl leading-none"
            aria-label="Tutup"
          >
            &times;
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {errors._general && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
              {errors._general}
            </p>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Jenis" error={errors.jenis_id} required>
              <select
                className="input"
                value={form.jenis_id ?? ''}
                onChange={(e) => setField('jenis_id', e.target.value ? Number(e.target.value) : null)}
              >
                <option value="">Pilih jenis</option>
                {jenisOptions.map((j) => (
                  <option key={j.id} value={j.id}>{j.nama}</option>
                ))}
              </select>
            </Field>

            <Field label="Status" error={errors.status} required>
              <select
                className="input"
                value={form.status}
                onChange={(e) => setField('status', e.target.value as AsetKelengkapanStatus)}
              >
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </Field>

            <Field label="Merek" error={errors.merek} required>
              <input className="input" value={form.merek} onChange={(e) => setField('merek', e.target.value)} />
            </Field>

            <Field label="Tipe">
              <input className="input" value={form.tipe} onChange={(e) => setField('tipe', e.target.value)} />
            </Field>

            <Field label="Warna">
              <input className="input" value={form.warna} onChange={(e) => setField('warna', e.target.value)} />
            </Field>

            <Field label="Serial Number">
              <input
                className="input"
                value={form.serial_number}
                onChange={(e) => setField('serial_number', e.target.value)}
              />
            </Field>

            <Field label="Tanggal Garansi">
              <input
                type="date"
                className="input"
                value={form.tanggal_garansi || ''}
                onChange={(e) => setField('tanggal_garansi', e.target.value)}
              />
            </Field>

            <Field label="Perusahaan">
              <input
                className="input"
                value={form.perusahaan}
                onChange={(e) => setField('perusahaan', e.target.value)}
              />
            </Field>

            <Field label="Supplier">
              <select
                className="input"
                value={form.supplier_id ?? ''}
                onChange={(e) => setField('supplier_id', e.target.value ? Number(e.target.value) : null)}
              >
                <option value="">Pilih supplier</option>
                {supplierOptions.map((s) => (
                  <option key={s.id} value={s.id}>{s.nama}</option>
                ))}
              </select>
            </Field>

            <Field label="Tanggal Pembelian">
              <input
                type="date"
                className="input"
                value={form.tanggal_pembelian || ''}
                onChange={(e) => setField('tanggal_pembelian', e.target.value)}
              />
            </Field>

            <Field label="No Surat Jalan">
              <input
                className="input"
                value={form.no_surat_jalan}
                onChange={(e) => setField('no_surat_jalan', e.target.value)}
              />
            </Field>

            <Field label="No Good Receive">
              <input
                className="input"
                value={form.no_good_receive}
                onChange={(e) => setField('no_good_receive', e.target.value)}
              />
            </Field>
          </div>

          <Field label="Keterangan">
            <textarea
              className="input min-h-[80px]"
              value={form.keterangan}
              onChange={(e) => setField('keterangan', e.target.value)}
            />
          </Field>

          <Field label="Foto">
            <input type="file" accept="image/*" onChange={handleFotoChange} />
            {fotoPreview && (
              <img src={fotoPreview} alt="Preview" className="mt-2 h-24 w-24 object-cover rounded-lg border border-slate-200" />
            )}
          </Field>

          <div className="flex justify-end gap-3 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-sm rounded-lg bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-50"
            >
              {saving ? 'Menyimpan...' : editing ? 'Simpan Perubahan' : 'Tambah'}
            </button>
          </div>
        </form>
      </div>
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
      <span className="block mb-1 font-medium text-slate-700">
        {label} {required && <span className="text-red-500">*</span>}
      </span>
      {children}
      {error && <span className="block mt-1 text-xs text-red-600">{error}</span>}
    </label>
  );
}