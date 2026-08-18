import { useEffect, useMemo, useRef, useState } from 'react';
import type { AsetKelengkapan, AsetKelengkapanFormValues, AsetKelengkapanStatus } from '../../api/asetKelengkapan';
import { createAsetKelengkapan, updateAsetKelengkapan } from '../../api/asetKelengkapan';
import { getSupplier, type Supplier } from '../../api/supplier';
import { getAset, type Aset } from '../../api/aset';
import { getLokasiKantor, type LokasiKantor } from '../../api/lokasiKantor';

const STATUS_OPTIONS: { value: AsetKelengkapanStatus; label: string; dot: string; ring: string }[] = [
  { value: 'tersedia', label: 'Tersedia', dot: 'bg-emerald-500', ring: 'ring-emerald-100 border-emerald-400 bg-emerald-50/60' },
  { value: 'dipakai', label: 'Dipakai', dot: 'bg-blue-500', ring: 'ring-blue-100 border-blue-400 bg-blue-50/60' },
  { value: 'rusak', label: 'Rusak', dot: 'bg-red-500', ring: 'ring-red-100 border-red-400 bg-red-50/60' },
  { value: 'diperbaiki', label: 'Diperbaiki', dot: 'bg-amber-500', ring: 'ring-amber-100 border-amber-400 bg-amber-50/60' },
];

const MAX_FOTO_MB = 4;
const ACCEPTED_FOTO_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
const KETERANGAN_MAX = 500;

const inputClass =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 shadow-sm outline-none transition-all duration-150 hover:border-slate-400 focus:border-slate-900 focus:ring-4 focus:ring-slate-900/[0.06]';
const inputErrorClass = 'border-red-400 focus:border-red-500 focus:ring-red-500/10';

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  editing?: AsetKelengkapan | null; // null/undefined = mode tambah
}

const EMPTY_FORM: AsetKelengkapanFormValues = {
  aset_id: null,
  lokasi_kantor_id: null,
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
  const [lokasiOptions, setLokasiOptions] = useState<LokasiKantor[]>([]);
  const [asetSearch, setAsetSearch] = useState('');
  const [asetDropdownOpen, setAsetDropdownOpen] = useState(false);
  const [fotoPreview, setFotoPreview] = useState<string | null>(null);
  const [isDraggingFoto, setIsDraggingFoto] = useState(false);
  const [loadingRefs, setLoadingRefs] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const asetFieldRef = useRef<HTMLDivElement>(null);
  const fotoObjectUrl = useRef<string | null>(null);
  const firstFieldRef = useRef<HTMLInputElement>(null);
  const dragCounter = useRef(0);

  // ---- load reference data tiap kali modal dibuka ----
  useEffect(() => {
    if (!open) return;
    setLoadingRefs(true);
    Promise.allSettled([getSupplier(), getAset(), getLokasiKantor()]).then(([sup, aset, lokasi]) => {
      if (sup.status === 'fulfilled') setSupplierOptions(sup.value);
      if (aset.status === 'fulfilled') setAsetOptions(aset.value);
      if (lokasi.status === 'fulfilled') setLokasiOptions(lokasi.value);
      if (sup.status === 'rejected' || aset.status === 'rejected' || lokasi.status === 'rejected') {
        setErrors((prev) => ({ ...prev, _general: 'Sebagian data referensi gagal dimuat. Coba buka ulang form ini.' }));
      }
      setLoadingRefs(false);
    });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setForm({
        aset_id: editing.aset_id ?? null,
        lokasi_kantor_id: editing.lokasi_kantor_id ?? null,
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
    setAsetSearch('');
    setAsetDropdownOpen(false);
    setErrors({});
    requestAnimationFrame(() => firstFieldRef.current?.focus());
  }, [open, editing]);

  // ---- tutup dropdown aset kalau klik di luar ----
  useEffect(() => {
    if (!asetDropdownOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (asetFieldRef.current && !asetFieldRef.current.contains(e.target as Node)) {
        setAsetDropdownOpen(false);
        setAsetSearch('');
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [asetDropdownOpen]);

  // ---- tutup modal / dropdown dengan tombol Esc ----
  useEffect(() => {
    if (!open) return;
    function handleEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        if (asetDropdownOpen) {
          setAsetDropdownOpen(false);
          setAsetSearch('');
        } else if (!saving) {
          onClose();
        }
      }
    }
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [open, asetDropdownOpen, saving, onClose]);

  // ---- bersihkan object URL foto biar nggak leak memory ----
  useEffect(() => {
    return () => {
      if (fotoObjectUrl.current) URL.revokeObjectURL(fotoObjectUrl.current);
    };
  }, []);

  const asetTerpilih = useMemo(
    () => asetOptions.find((a) => a.id === form.aset_id) || null,
    [asetOptions, form.aset_id]
  );

  const asetFiltered = useMemo(() => {
    const q = asetSearch.trim().toLowerCase();
    if (!q) return asetOptions;
    return asetOptions.filter((a) =>
      [a.kode_aset, a.merek, a.tipe].filter(Boolean).join(' ').toLowerCase().includes(q)
    );
  }, [asetOptions, asetSearch]);

  if (!open) return null;

  function setField<K extends keyof AsetKelengkapanFormValues>(key: K, value: AsetKelengkapanFormValues[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: '' }));
  }

  // Aset induk & lokasi kantor saling meniadakan — kelengkapan yang nempel
  // ke aset induk ikut lokasi aset itu, jadi begitu pilih aset induk,
  // lokasi manual yang sempat diisi otomatis dikosongkan (dan sebaliknya).
  function pilihAsetInduk(id: number | null) {
    setForm((prev) => ({ ...prev, aset_id: id, lokasi_kantor_id: id ? null : prev.lokasi_kantor_id }));
    if (errors.aset_id) setErrors((prev) => ({ ...prev, aset_id: '' }));
  }

  function pilihLokasiKantor(id: number | null) {
    setForm((prev) => ({ ...prev, lokasi_kantor_id: id, aset_id: id ? null : prev.aset_id }));
    if (errors.lokasi_kantor_id) setErrors((prev) => ({ ...prev, lokasi_kantor_id: '' }));
  }

  function applyFoto(file: File | null) {
    if (!file) return;
    if (!ACCEPTED_FOTO_TYPES.includes(file.type)) {
      setErrors((prev) => ({ ...prev, foto: 'Format harus PNG, JPG, atau WEBP.' }));
      return;
    }
    if (file.size > MAX_FOTO_MB * 1024 * 1024) {
      setErrors((prev) => ({ ...prev, foto: `Ukuran foto maksimal ${MAX_FOTO_MB}MB.` }));
      return;
    }
    setErrors((prev) => ({ ...prev, foto: '' }));
    if (fotoObjectUrl.current) URL.revokeObjectURL(fotoObjectUrl.current);
    const url = URL.createObjectURL(file);
    fotoObjectUrl.current = url;
    setField('foto', file);
    setFotoPreview(url);
  }

  function handleFotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    applyFoto(e.target.files?.[0] || null);
  }

  function handleFotoDrop(e: React.DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    dragCounter.current = 0;
    setIsDraggingFoto(false);
    applyFoto(e.dataTransfer.files?.[0] || null);
  }

  function handleFotoDragEnter(e: React.DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    dragCounter.current += 1;
    setIsDraggingFoto(true);
  }

  function handleFotoDragLeave(e: React.DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    dragCounter.current -= 1;
    if (dragCounter.current <= 0) setIsDraggingFoto(false);
  }

  function removeFoto() {
    if (fotoObjectUrl.current) URL.revokeObjectURL(fotoObjectUrl.current);
    fotoObjectUrl.current = null;
    setField('foto', null);
    setFotoPreview(null);
  }

  function validate(): boolean {
    const next: Record<string, string> = {};
    if (!form.merek?.trim()) next.merek = 'Merek wajib diisi';
    if (!form.status) next.status = 'Status wajib dipilih';
    if (form.tanggal_pembelian && form.tanggal_garansi && form.tanggal_garansi < form.tanggal_pembelian) {
      next.tanggal_garansi = 'Tanggal garansi tidak boleh sebelum tanggal pembelian';
    }
    setErrors((prev) => ({ ...prev, ...next }));
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;
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
        setErrors({ _general: err?.response?.data?.message || 'Gagal menyimpan data. Coba lagi.' });
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-[fadeIn_150ms_ease-out]"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !saving) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="aset-kelengkapan-form-title"
    >
      <div className="bg-white rounded-2xl shadow-2xl shadow-slate-900/10 ring-1 ring-slate-900/5 w-full max-w-2xl max-h-[90vh] flex flex-col animate-[slideUp_200ms_cubic-bezier(0.16,1,0.3,1)]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
              {editing ? 'Ubah data' : 'Data baru'}
            </p>
            <h3 id="aset-kelengkapan-form-title" className="text-lg font-semibold text-slate-900">
              {editing ? 'Edit Kelengkapan Aset' : 'Tambah Kelengkapan Aset'}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            aria-label="Tutup"
            className="group grid h-8 w-8 place-items-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:opacity-40 disabled:pointer-events-none transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="transition-transform duration-200 group-hover:rotate-90">
              <path d="M1 1L15 15M15 1L1 15" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <form id="aset-kelengkapan-form" onSubmit={handleSubmit} className="px-6 py-5 space-y-7 overflow-y-auto">
          {errors._general && (
            <p className="flex items-center gap-2 text-sm text-red-700 bg-red-50 border border-red-100 rounded-lg px-3 py-2.5 animate-[fadeIn_150ms_ease-out]" role="alert">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="shrink-0">
                <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.4" />
                <path d="M8 5v3.5M8 11h.01" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
              </svg>
              {errors._general}
            </p>
          )}

          {loadingRefs && (
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <svg className="animate-spin" width="12" height="12" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.25" />
                <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
              </svg>
              Memuat data aset & supplier…
            </div>
          )}

          {/* Section: Informasi Umum */}
          <Section
            index={0}
            title="Informasi Umum"
            subtitle="Nama, status, dan ciri fisik barang"
            icon={
              <path d="M8 1.5a6.5 6.5 0 100 13 6.5 6.5 0 000-13zM8 5v3.5M8 10.8h.01" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
            }
          >
            <div className="sm:col-span-2" ref={asetFieldRef}>
              <Field label="Aset Induk" error={errors.aset_id}>
                <div className="relative">
                  <div className="relative">
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                      <circle cx="7" cy="7" r="5.2" stroke="currentColor" strokeWidth="1.4" />
                      <path d="M14.5 14.5L11 11" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                    </svg>
                    <input
                      className={`${inputClass} pl-8`}
                      placeholder="Cari kode aset, merek, atau tipe…"
                      value={asetSearch}
                      onChange={(e) => {
                        setAsetSearch(e.target.value);
                        setAsetDropdownOpen(true);
                      }}
                      onFocus={() => setAsetDropdownOpen(true)}
                    />
                  </div>
                  {asetTerpilih && !asetDropdownOpen && (
                    <div className="mt-1.5 flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm animate-[fadeIn_120ms_ease-out]">
                      <span className="text-slate-700">
                        <span className="font-mono text-[13px]">{asetTerpilih.kode_aset}</span>
                        {(asetTerpilih.merek || asetTerpilih.tipe) && (
                          <span className="text-slate-400"> — {[asetTerpilih.merek, asetTerpilih.tipe].filter(Boolean).join(' ')}</span>
                        )}
                      </span>
                      <button
                        type="button"
                        onClick={() => pilihAsetInduk(null)}
                        className="text-slate-400 hover:text-slate-600 transition-colors"
                        aria-label="Hapus pilihan aset induk"
                      >
                        <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                          <path d="M1 1L15 15M15 1L1 15" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                        </svg>
                      </button>
                    </div>
                  )}
                  {asetDropdownOpen && (
                    <div className="absolute z-10 mt-1.5 max-h-48 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg animate-[dropIn_140ms_ease-out]">
                      <button
                        type="button"
                        onClick={() => {
                          pilihAsetInduk(null);
                          setAsetSearch('');
                          setAsetDropdownOpen(false);
                        }}
                        className="block w-full px-3 py-2 text-left text-sm text-slate-400 hover:bg-slate-50 transition-colors"
                      >
                        Tanpa aset induk
                      </button>
                      {loadingRefs && (
                        <p className="px-3 py-2 text-sm text-slate-400">Memuat…</p>
                      )}
                      {!loadingRefs && asetFiltered.length === 0 && (
                        <p className="px-3 py-2 text-sm text-slate-400">Tidak ada aset yang cocok</p>
                      )}
                      {asetFiltered.map((a) => (
                        <button
                          key={a.id}
                          type="button"
                          onClick={() => {
                            pilihAsetInduk(a.id);
                            setAsetSearch('');
                            setAsetDropdownOpen(false);
                          }}
                          className={`block w-full px-3 py-2 text-left text-sm hover:bg-slate-50 transition-colors ${
                            form.aset_id === a.id ? 'bg-slate-50 text-slate-900' : 'text-slate-700'
                          }`}
                        >
                          <span className="font-mono text-[13px]">{a.kode_aset}</span>
                          {(a.merek || a.tipe) && (
                            <span className="text-slate-400"> — {[a.merek, a.tipe].filter(Boolean).join(' ')}</span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <p className="mt-1 text-xs text-slate-400">
                  Opsional — pilih kalau kelengkapan ini menempel ke aset tertentu (mis. mouse ini punya laptop yang mana).
                </p>
              </Field>
            </div>

            <div className="sm:col-span-2">
              <Field label="Lokasi Kantor" error={errors.lokasi_kantor_id}>
                <SelectField
                  value={form.lokasi_kantor_id ?? ''}
                  onChange={(v) => pilihLokasiKantor(v ? Number(v) : null)}
                  disabled={!!form.aset_id}
                >
                  <option value="">Tidak diisi</option>
                  {lokasiOptions.map((l) => (
                    <option key={l.id} value={l.id}>{l.nama}</option>
                  ))}
                </SelectField>
                <p className="mt-1 text-xs text-slate-400">
                  {form.aset_id
                    ? 'Nonaktif — kelengkapan ini ikut lokasi aset induknya.'
                    : 'Opsional — isi kalau kelengkapan ini berdiri sendiri (tanpa aset induk) supaya tetap ketahuan lokasi fisiknya.'}
                </p>
              </Field>
            </div>

            <Field label="Nama" error={errors.nama}>
              <input
                ref={firstFieldRef}
                className={inputClass}
                value={form.nama}
                onChange={(e) => setField('nama', e.target.value)}
                placeholder="cth. Charger Laptop"
              />
            </Field>

            <Field label="Status" error={errors.status} required>
              <div className="grid grid-cols-2 gap-2">
                {STATUS_OPTIONS.map((s) => {
                  const active = form.status === s.value;
                  return (
                    <label
                      key={s.value}
                      className={`flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm cursor-pointer transition-all duration-150 active:scale-[0.98] ${
                        active
                          ? `${s.ring} ring-4 text-slate-900 font-medium`
                          : 'border-slate-200 text-slate-500 hover:border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="status"
                          className="sr-only"
                          checked={active}
                          onChange={() => setField('status', s.value)}
                        />
                        <span className={`h-1.5 w-1.5 rounded-full ${s.dot} transition-transform duration-150 ${active ? 'scale-125' : ''}`} />
                        {s.label}
                      </span>
                      {active && (
                        <svg width="13" height="13" viewBox="0 0 16 16" fill="none" className="text-slate-900 animate-[fadeIn_120ms_ease-out]">
                          <path d="M3 8.5l3 3 7-7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </label>
                  );
                })}
              </div>
            </Field>

            <Field label="Merek" error={errors.merek} required>
              <input
                className={`${inputClass} ${errors.merek ? inputErrorClass : ''}`}
                value={form.merek}
                onChange={(e) => setField('merek', e.target.value)}
                placeholder="cth. Dell, HP, Logitech"
              />
            </Field>

            <Field label="Tipe">
              <input className={inputClass} value={form.tipe} onChange={(e) => setField('tipe', e.target.value)} placeholder="cth. 65W USB-C" />
            </Field>

            <Field label="Warna">
              <input className={inputClass} value={form.warna} onChange={(e) => setField('warna', e.target.value)} placeholder="cth. Hitam" />
            </Field>

            <Field label="Serial Number" error={errors.serial_number}>
              <input
                className={`${inputClass} font-mono text-[13px]`}
                value={form.serial_number}
                onChange={(e) => setField('serial_number', e.target.value)}
                placeholder="Kosongkan kalau tidak ada"
              />
            </Field>
          </Section>

          {/* Section: Pembelian & Garansi */}
          <Section
            index={1}
            title="Pembelian & Garansi"
            subtitle="Sumber barang dan dokumen terkait"
            icon={
              <path d="M3 5h10l-.8 7.2a1.5 1.5 0 01-1.49 1.3H5.29a1.5 1.5 0 01-1.49-1.3L3 5zM5.5 5V3.5a2.5 2.5 0 015 0V5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
            }
          >
            <Field label="Supplier">
              <SelectField
                value={form.supplier_id ?? ''}
                onChange={(v) => setField('supplier_id', v ? Number(v) : null)}
              >
                <option value="">Pilih supplier</option>
                {supplierOptions.map((s) => (
                  <option key={s.id} value={s.id}>{s.nama}</option>
                ))}
              </SelectField>
            </Field>

            <Field label="Perusahaan">
              <input className={inputClass} value={form.perusahaan} onChange={(e) => setField('perusahaan', e.target.value)} />
            </Field>

            <Field label="Tanggal Pembelian">
              <input
                type="date"
                className={inputClass}
                value={form.tanggal_pembelian || ''}
                onChange={(e) => setField('tanggal_pembelian', e.target.value)}
              />
            </Field>

            <Field label="Tanggal Garansi" error={errors.tanggal_garansi}>
              <input
                type="date"
                className={`${inputClass} ${errors.tanggal_garansi ? inputErrorClass : ''}`}
                value={form.tanggal_garansi || ''}
                onChange={(e) => setField('tanggal_garansi', e.target.value)}
              />
            </Field>

            <Field label="No Surat Jalan">
              <input className={`${inputClass} font-mono text-[13px]`} value={form.no_surat_jalan} onChange={(e) => setField('no_surat_jalan', e.target.value)} />
            </Field>

            <Field label="No Good Receive">
              <input className={`${inputClass} font-mono text-[13px]`} value={form.no_good_receive} onChange={(e) => setField('no_good_receive', e.target.value)} />
            </Field>
          </Section>

          {/* Section: Detail Tambahan */}
          <Section
            index={2}
            title="Detail Tambahan"
            subtitle="Catatan dan foto barang"
            icon={
              <path d="M2 12.5l3.3-3.3a1.4 1.4 0 012 0L10 11.9M8.7 10.6l1.6-1.6a1.4 1.4 0 012 0L14 10.7M2.5 3h11v10h-11V3z" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
            }
          >
            <div className="sm:col-span-2">
              <Field label="Keterangan">
                <div className="relative">
                  <textarea
                    className={`${inputClass} min-h-[80px] resize-none`}
                    value={form.keterangan ?? ''}
                    maxLength={KETERANGAN_MAX}
                    onChange={(e) => setField('keterangan', e.target.value)}
                    placeholder="Catatan tambahan tentang kondisi atau riwayat barang…"
                  />
                  <span className="pointer-events-none absolute bottom-2 right-2.5 text-[11px] text-slate-300">
                    {(form.keterangan ?? '').length}/{KETERANGAN_MAX}
                  </span>
                </div>
              </Field>
            </div>

            <div className="sm:col-span-2">
              <span className="block mb-1.5 text-sm font-medium text-slate-700">Foto</span>
              <label
                onDragOver={(e) => e.preventDefault()}
                onDragEnter={handleFotoDragEnter}
                onDragLeave={handleFotoDragLeave}
                onDrop={handleFotoDrop}
                className={`flex items-center gap-4 rounded-xl border border-dashed p-3 cursor-pointer transition-all duration-150 ${
                  isDraggingFoto
                    ? 'border-slate-900 bg-slate-900/[0.03] scale-[1.01]'
                    : 'border-slate-300 hover:border-slate-400 bg-slate-50/50'
                }`}
              >
                <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={handleFotoChange} />
                {fotoPreview ? (
                  <img src={fotoPreview} alt="Preview foto kelengkapan" className="h-16 w-16 object-cover rounded-lg border border-slate-200 shrink-0 shadow-sm" />
                ) : (
                  <div className={`grid h-16 w-16 place-items-center rounded-lg bg-slate-100 text-slate-400 shrink-0 transition-transform duration-150 ${isDraggingFoto ? 'scale-110' : ''}`}>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                      <path d="M4 16l4.6-4.6a2 2 0 0 1 2.8 0L16 16M13 13l1.6-1.6a2 2 0 0 1 2.8 0L20 14M4 6h16v14H4V6z" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                )}
                <div className="text-sm flex-1">
                  <p className="font-medium text-slate-700">
                    {isDraggingFoto ? 'Lepas untuk unggah' : fotoPreview ? 'Ganti foto' : 'Unggah foto'}
                  </p>
                  <p className="text-slate-400 text-xs mt-0.5">Klik atau seret file ke sini · PNG/JPG/WEBP · maks {MAX_FOTO_MB}MB</p>
                </div>
                {fotoPreview && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      removeFoto();
                    }}
                    className="text-xs text-red-600 hover:text-red-700 shrink-0 transition-colors"
                  >
                    Hapus
                  </button>
                )}
              </label>
              {errors.foto && <span className="block mt-1 text-xs text-red-600 animate-[fadeIn_120ms_ease-out]">{errors.foto}</span>}
            </div>
          </Section>
        </form>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100 shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 text-sm rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition-colors"
          >
            Batal
          </button>
          <button
            type="submit"
            form="aset-kelengkapan-form"
            disabled={saving}
            className="px-4 py-2 text-sm rounded-lg bg-slate-900 text-white hover:bg-slate-800 active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100 transition-all duration-150 inline-flex items-center gap-2"
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
        @keyframes slideUp { from { opacity: 0; transform: translateY(10px) scale(.98) } to { opacity: 1; transform: translateY(0) scale(1) } }
        @keyframes dropIn { from { opacity: 0; transform: translateY(-4px) } to { opacity: 1; transform: translateY(0) } }
        @keyframes fadeInUp { from { opacity: 0; transform: translateY(6px) } to { opacity: 1; transform: translateY(0) } }
      `}</style>
    </div>
  );
}

function Section({
  title,
  subtitle,
  icon,
  index,
  children,
}: {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  index?: number;
  children: React.ReactNode;
}) {
  return (
    <div
      className="animate-[fadeInUp_260ms_ease-out_backwards]"
      style={{ animationDelay: `${(index ?? 0) * 50}ms` }}
    >
      <div className="mb-3 flex items-center gap-2">
        {icon && (
          <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-slate-100 text-slate-500">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              {icon}
            </svg>
          </span>
        )}
        <div>
          <h4 className="text-sm font-semibold text-slate-900">{title}</h4>
          {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
        </div>
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
      {error && <span className="block mt-1 text-xs text-red-600 animate-[fadeIn_120ms_ease-out]">{error}</span>}
    </label>
  );
}

function SelectField({
  value,
  onChange,
  disabled,
  children,
}: {
  value: string | number;
  onChange: (value: string) => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="relative">
      <select
        className={`${inputClass} appearance-none pr-9 cursor-pointer disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400`}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      >
        {children}
      </select>
      <svg
        width="12"
        height="12"
        viewBox="0 0 16 16"
        fill="none"
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
      >
        <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}