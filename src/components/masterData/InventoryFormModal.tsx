import { useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import {
  createInventory,
  getInventory,
  getInventoryById,
  updateInventory,
  pasangPenggantiKelengkapanInventory,
  type Inventory,
  type InventoryFormValues,
  type InventoryStatus,
} from '../../api/masterData/inventory';
import { getKategori, type Kategori } from '../../api/masterData/kategori';
import { getSupplier, type Supplier } from '../../api/masterData/supplier';
import InventoryKelengkapanPicker, { type StagedKelengkapan } from './InventoryKelengkapanPicker';
import { ButtonCancel, ButtonSubmit, Field, SelectField, inputClass, inputErrorClass } from '../shared/FormControls';

const KETERANGAN_MAX = 255;
const MAX_FOTO_MB = 4;
const ACCEPTED_FOTO_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];

// REFACTOR KATEGORI BEBAS (Fase 3): form ini dulu punya 2 mode terpisah total
// (barang_utama vs kelengkapan, dipilih lewat prop kategoriKode) dengan 2 set
// state & 2 render tree yang nyaris gak overlap. Sejak kategori jadi bebas
// (lihat CHECKLIST_REFACTOR_KATEGORI.md Fase 1-2, backend sudah murni pakai
// parent_id, gak ada lagi makna "tipe" di kategori), form ini digabung jadi
// SATU: kategori cuma label buat dipilih dari dropdown, semua field & section
// berlaku sama buat kategori apapun. Yang menentukan bentuk UI sekarang cuma
// parent_id (item ini nempel ke sesuatu atau enggak) & apakah item ini punya
// children (kalau ya, gak boleh dikasih parent_id -- aturan dari backend
// InventoryController::validasiParent()).

// Form ini nangani status secara lokal aja -- InventoryFormValues (create/update)
// TIDAK punya field status, karena perubahan status dilakuin lewat endpoint aksi
// khusus (pinjam/kembalikan/lapor rusak/dst), bukan lewat create/update langsung.
// 'status' di sini cuma dipakai buat UI (badge read-only pas edit) & mode staged
// (dibawa ke pemanggil di InventoryKelengkapanPicker), DIBUANG sebelum dikirim
// ke createInventory/updateInventory.
export type KelengkapanFormValues = InventoryFormValues & { status: InventoryStatus };

const STATUS_OPTIONS: { value: InventoryStatus; label: string; dot: string; ring: string }[] = [
  { value: 'tersedia', label: 'Tersedia', dot: 'bg-emerald-500', ring: 'ring-emerald-100 border-emerald-400 bg-emerald-50/60' },
  { value: 'dipakai', label: 'Dipakai', dot: 'bg-blue-500', ring: 'ring-blue-100 border-blue-400 bg-blue-50/60' },
];

interface InventoryFormModalProps {
  inventory: Inventory | null; // null = mode tambah
  // Dipakai kalau pemanggil sudah punya daftar supplier ter-load (mis.
  // TabInventory) -- biar gak fetch dobel. Kalau dikosongin ('[]', dipakai
  // satu-satunya oleh InventoryKelengkapanPicker), form fetch sendiri lewat
  // getSupplier().
  supplierOptions: Supplier[];
  onClose: () => void;
  onSaved: (inventory: Inventory, warning?: string) => void;
  // --- Prop di bawah ini dipakai InventoryKelengkapanPicker (dari section
  // "Kelengkapan" di form inventory lain) buat nambah item baru yang
  // langsung nempel ke inventory tertentu ---
  // Kalau diisi, field "Inventory Induk" dikunci ke inventory ini (gak bisa diubah manual).
  presetInventoryId?: number;
  presetInventoryLabel?: string; // label tampilan, mis. "AST-0012 — Dell Latitude"
  // Paksa tampilan field "Inventory Induk" ke mode terkunci (pakai
  // presetInventoryLabel) walau presetInventoryId belum keisi angka beneran -- dipakai
  // pas inventory induknya baru dalam proses dibuat (mode create) jadi belum
  // punya id sama sekali. parent_id yang beneran akan ditimpa pemanggil
  // setelah inventory induknya kesimpen (lihat InventoryKelengkapanPicker).
  lockInventoryField?: boolean;
  // Mode staged: dipakai kalau form ini dibuka DI DALAM form inventory induk yang
  // belum tentu punya id (mis. lagi mode create). Kalau diisi, submit TIDAK
  // langsung panggil API create/update -- cuma validasi lalu balikin form
  // values ke pemanggil buat ditahan (staged) dan diproses belakangan
  // setelah inventory induknya kesimpen. onSaved tidak dipanggil sama sekali di
  // mode ini, cuma onStage lalu onClose.
  onStage?: (values: KelengkapanFormValues) => void;
}

// State form lokal -- superset dari KelengkapanFormValues, cuma `jumlah`
// ditahan sebagai string (biar input number kosong/parsial gak maksa jadi 0).
interface FormState extends Omit<KelengkapanFormValues, 'jumlah'> {
  jumlah: string;
}

const EMPTY_FORM: FormState = {
  kategori_id: null,
  parent_id: null,
  nama: '',
  warna: '',
  serial_number: '',
  merk: '',
  type: '',
  jumlah: '1',
  tanggal_garansi: '',
  perusahaan: '',
  keterangan: '',
  foto: null,
  supplier_id: null,
  tanggal_input: '',
  tanggal_invoice: '',
  no_surat_jalan: '',
  no_good_receive: '',
  status: 'tersedia',
};

export default function InventoryFormModal({
  inventory,
  supplierOptions,
  onClose,
  onSaved,
  presetInventoryId,
  presetInventoryLabel,
  lockInventoryField,
  onStage,
}: InventoryFormModalProps) {
  // ================= Referensi: kategori, supplier, inventory induk, lokasi =================
  const [daftarKategori, setDaftarKategori] = useState<Kategori[]>([]);
  const [loadingKategori, setLoadingKategori] = useState(true);
  useEffect(() => {
    let active = true;
    setLoadingKategori(true);
    getKategori()
      .then((data) => {
        if (active) setDaftarKategori(data);
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoadingKategori(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const [fetchedSupplierOptions, setFetchedSupplierOptions] = useState<Supplier[]>([]);
  useEffect(() => {
    // Kalau pemanggil sudah kasih daftar supplier (TabInventory), gak perlu fetch lagi.
    if (supplierOptions.length > 0) return;
    getSupplier()
      .then(setFetchedSupplierOptions)
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supplierOptions.length]);
  const effectiveSupplierOptions = supplierOptions.length > 0 ? supplierOptions : fetchedSupplierOptions;

  const [inventoryOptions, setInventoryOptions] = useState<Inventory[]>([]);
  const [loadingRefs, setLoadingRefs] = useState(false);
  useEffect(() => {
    setLoadingRefs(true);
    // Kandidat "Inventory Induk" = item apapun (kategori bebas) yang lagi
    // berdiri sendiri (parent_id null) -- posisi=induk sudah nyaring itu di
    // backend, independen dari kategori_id (lihat InventoryController::index()).
    getInventory({ posisi: 'induk' })
      .then((data) => {
        // Item gak boleh jadi induk buat dirinya sendiri.
        setInventoryOptions(data.filter((a) => a.id !== inventory?.id));
      })
      .catch(() => {})
      .finally(() => setLoadingRefs(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inventory?.id]);

  // ================= Form state =================
  const [form, setForm] = useState<FormState>(() =>
    inventory
      ? {
          kategori_id: inventory.kategori_id ?? null,
          parent_id: inventory.parent_id ?? null,
          nama: inventory.nama || '',
          warna: inventory.warna || '',
          serial_number: inventory.serial_number || '',
          merk: inventory.merk || '',
          type: inventory.type || '',
          jumlah: inventory.jumlah ? String(inventory.jumlah) : '1',
          tanggal_garansi: inventory.tanggal_garansi ? inventory.tanggal_garansi.slice(0, 10) : '',
          perusahaan: inventory.perusahaan || '',
          keterangan: inventory.keterangan || '',
          foto: null,
          supplier_id: inventory.supplier_id ?? null,
          tanggal_input: inventory.tanggal_input ? inventory.tanggal_input.slice(0, 10) : '',
          tanggal_invoice: inventory.tanggal_invoice ? inventory.tanggal_invoice.slice(0, 10) : '',
          no_surat_jalan: inventory.no_surat_jalan || '',
          no_good_receive: inventory.no_good_receive || '',
          status: inventory.status,
        }
      : presetInventoryId
        ? { ...EMPTY_FORM, parent_id: presetInventoryId }
        : EMPTY_FORM
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [stagedKelengkapan, setStagedKelengkapan] = useState<StagedKelengkapan[]>([]);
  const [existingKelengkapan, setExistingKelengkapan] = useState<Inventory[]>([]);

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: '' }));
  }

  // Mode edit: fetch ulang detail inventory (list row yang dilempar ke form
  // belum tentu bawa relasi children) biar section Kelengkapan nunjukin apa
  // yang udah beneran nempel ke item ini.
  useEffect(() => {
    if (!inventory) return;
    getInventoryById(inventory.id)
      .then((data) => setExistingKelengkapan(data.children || []))
      .catch(() => {});
  }, [inventory]);

  // Item yang sudah punya children gak boleh dikasih parent_id (dicek juga
  // di backend, validasiParent()) -- kalau ini terjadi (mis. item lama dari
  // sebelum refactor), kunci field Inventory Induk & jelasin kenapa.
  const sudahPunyaChildren = existingKelengkapan.length > 0;

  function pilihInventoryInduk(id: number | null) {
    setForm((prev) => ({ ...prev, parent_id: id }));
    if (errors.parent_id) setErrors((prev) => ({ ...prev, parent_id: '' }));
  }


  const [inventorySearch, setInventorySearch] = useState('');
  const [inventoryDropdownOpen, setInventoryDropdownOpen] = useState(false);
  const inventoryFieldRef = useRef<HTMLDivElement>(null);
  const firstFieldRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    requestAnimationFrame(() => firstFieldRef.current?.focus());
  }, []);

  useEffect(() => {
    if (!inventoryDropdownOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (inventoryFieldRef.current && !inventoryFieldRef.current.contains(e.target as Node)) {
        setInventoryDropdownOpen(false);
        setInventorySearch('');
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [inventoryDropdownOpen]);

  useEffect(() => {
    function handleEsc(e: KeyboardEvent) {
      if (e.key === 'Escape' && inventoryDropdownOpen) {
        setInventoryDropdownOpen(false);
        setInventorySearch('');
      }
    }
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [inventoryDropdownOpen]);

  const inventoryTerpilih = useMemo(
    () => inventoryOptions.find((a) => a.id === form.parent_id) || null,
    [inventoryOptions, form.parent_id]
  );

  const inventoryFiltered = useMemo(() => {
    const q = inventorySearch.trim().toLowerCase();
    if (!q) return inventoryOptions;
    return inventoryOptions.filter((a) =>
      [a.kode_inventory, a.nama].filter(Boolean).join(' ').toLowerCase().includes(q)
    );
  }, [inventoryOptions, inventorySearch]);

  // Kelengkapan (children) cuma bisa dipasang kalau item ini SEDANG jadi
  // induk (belum/gak nempel ke apapun) & jumlahnya 1 (barang serialized) --
  // item non-serialized (jumlah > 1) gak punya identitas fisik tunggal buat
  // ditempeli barang lain, dan item yang sendiri nempel ke induk lain gak
  // boleh punya children-nya sendiri (hierarki 1 level: induk <-> menempel).
  const jumlahValid = form.jumlah === '' || Number(form.jumlah) === 1;
  const bisaPunyaKelengkapan = !form.parent_id && jumlahValid;
  useEffect(() => {
    if (!bisaPunyaKelengkapan && stagedKelengkapan.length > 0) setStagedKelengkapan([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bisaPunyaKelengkapan]);

  // ================= Foto (drag & drop + preview) =================
  const [fotoPreview, setFotoPreview] = useState<string | null>(inventory?.foto || null);
  const [isDraggingFoto, setIsDraggingFoto] = useState(false);
  const [fotoError, setFotoError] = useState('');
  const fotoObjectUrl = useRef<string | null>(null);
  const dragCounter = useRef(0);

  useEffect(() => {
    return () => {
      if (fotoObjectUrl.current) URL.revokeObjectURL(fotoObjectUrl.current);
    };
  }, []);

  function applyFoto(file: File | null) {
    if (!file) return;
    if (!ACCEPTED_FOTO_TYPES.includes(file.type)) {
      setFotoError('Format harus PNG, JPG, atau WEBP.');
      return;
    }
    if (file.size > MAX_FOTO_MB * 1024 * 1024) {
      setFotoError(`Ukuran foto maksimal ${MAX_FOTO_MB}MB.`);
      return;
    }
    setFotoError('');
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

  // ================= Validasi & submit =================
  function validate(): boolean {
    const next: Record<string, string> = {};
    if (!form.nama?.trim()) next.nama = 'Nama inventory wajib diisi.';
    if (!inventory && form.kategori_id == null) next.kategori_id = 'Kategori barang wajib dipilih.';
    setErrors((prev) => ({ ...prev, ...next }));
    const hasErrors = Object.keys(next).length > 0;
    if (hasErrors) {
      toast.error('Mohon lengkapi kolom yang bertanda bintang (*).');
    }
    return !hasErrors;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    if (!validate()) return;

    // status TIDAK dikirim -- InventoryFormValues gak punya field ini
    // (perubahan status lewat endpoint aksi khusus).
    const { status: _status, jumlah, ...rest } = form;
    const payload: InventoryFormValues = {
      ...rest,
      jumlah: jumlah ? Number(jumlah) : undefined,
    };

    // Mode staged: gak ada inventory induk beneran di backend buat nempelin
    // item ini (mis. lagi create inventory induknya juga baru), jadi cuma
    // balikin form values ke pemanggil -- gak ada API yang dipanggil di sini.
    if (onStage) {
      onStage({ ...payload, status: form.status } as KelengkapanFormValues);
      onClose();
      return;
    }

    setSubmitting(true);
    try {
      const saved = inventory ? await updateInventory(inventory.id, payload) : await createInventory(payload);

      if (stagedKelengkapan.length > 0) {
        try {
          for (const item of stagedKelengkapan) {
            if (item.type === 'stok') {
              await pasangPenggantiKelengkapanInventory(item.item.id, saved.id);
            } else {
              await createInventory({ ...item.values, parent_id: saved.id });
            }
          }
        } catch (kelengkapanErr: any) {
          // Inventory-nya sendiri udah kesimpen -- jangan diulang, cuma kasih
          // tau kalau ada kelengkapan yang gagal nempel (modal ini bakal
          // ditutup sama pemanggil begitu onSaved dipanggil, jadi warning-nya
          // dilempar ke atas buat ditampilin di sana, mis. lewat toast).
          onSaved(
            saved,
            kelengkapanErr.response?.data?.message ||
              'Inventory berhasil disimpan, tapi ada kelengkapan yang gagal ditambahkan. Coba lagi lewat edit inventory ini.'
          );
          setSubmitting(false);
          return;
        }
      }

      onSaved(saved);
    } catch (err: any) {
      const apiErrors = err?.response?.data?.errors;
      if (apiErrors) {
        const flat: Record<string, string> = {};
        Object.keys(apiErrors).forEach((k) => (flat[k] = apiErrors[k][0]));
        setErrors((prev) => ({ ...prev, ...flat }));
      } else {
        setErrors((prev) => ({ ...prev, _general: err?.response?.data?.message || 'Gagal menyimpan data. Coba lagi.' }));
      }
    } finally {
      setSubmitting(false);
    }
  }

  // ================= Render =================
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-[fadeIn_150ms_ease-out]"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !submitting) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="inventory-form-title"
    >
      <div className="bg-white rounded-2xl shadow-2xl shadow-slate-900/10 ring-1 ring-slate-900/5 w-full max-w-2xl max-h-[90vh] flex flex-col animate-[slideUp_200ms_cubic-bezier(0.16,1,0.3,1)]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
              {inventory ? 'Ubah data' : 'Data baru'}
            </p>
            <h3 id="inventory-form-title" className="text-lg font-semibold text-slate-900">
              {inventory ? `Edit Inventory ${inventory.kode_inventory}` : 'Tambah Inventory'}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            aria-label="Tutup"
            className="group grid h-8 w-8 place-items-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:opacity-40 disabled:pointer-events-none transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="transition-transform duration-200 group-hover:rotate-90">
              <path d="M1 1L15 15M15 1L1 15" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <form id="inventory-form" onSubmit={handleSubmit} className="px-6 py-5 space-y-7 overflow-y-auto">
          {errors._general && (
            <p className="flex items-center gap-2 text-sm text-red-700 bg-red-50 border border-red-100 rounded-lg px-3 py-2.5 animate-[fadeIn_150ms_ease-out]" role="alert">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="shrink-0">
                <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.4" />
                <path d="M8 5v3.5M8 11h.01" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
              </svg>
              {errors._general}
            </p>
          )}

          {/* Section: Informasi Umum */}
          <Section
            index={0}
            title="Informasi Umum"
            subtitle="Kategori, nama, dan ciri fisik barang"
            icon={
              <path d="M8 1.5a6.5 6.5 0 100 13 6.5 6.5 0 000-13zM8 5v3.5M8 10.8h.01" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
            }
          >
            {/* Kategori bebas -- semua kategori sama, gak ada cabang UI beda
                lagi berdasar kategori. Cuma bisa dipilih pas mode tambah;
                ganti kategori item yang sudah ada bukan hal yang aman
                dilakukan diam-diam lewat form edit biasa. */}
            <div className="sm:col-span-2">
              <Field label="Kategori" required={!inventory} error={errors.kategori_id}>
                {inventory ? (
                  <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                    <span className="font-medium">
                      {daftarKategori.find((k) => k.id === form.kategori_id)?.nama ?? (loadingKategori ? 'Memuat…' : '-')}
                    </span>
                    <span className="ml-auto text-xs text-slate-400">Kategori gak bisa diganti dari sini</span>
                  </div>
                ) : (
                  <SelectField
                    value={form.kategori_id ?? ''}
                    disabled={loadingKategori}
                    error={!!errors.kategori_id}
                    onChange={(v) => setField('kategori_id', v ? Number(v) : null)}
                  >
                    <option value="">{loadingKategori ? 'Memuat kategori…' : 'Pilih kategori'}</option>
                    {daftarKategori.map((k) => (
                      <option key={k.id} value={k.id}>
                        {k.nama}
                      </option>
                    ))}
                  </SelectField>
                )}
              </Field>
            </div>

            <div className="sm:col-span-2">
              <Field label="Nama" error={errors.nama} required>
                <input
                  ref={firstFieldRef}
                  className={`${inputClass} ${errors.nama ? inputErrorClass : ''}`}
                  value={form.nama}
                  onChange={(e) => setField('nama', e.target.value)}
                  placeholder="cth. Laptop Lenovo ThinkPad E14, Charger Dell 65W"
                />
                <p className="mt-1 text-xs text-slate-400">Sertakan merek/tipe di dalam nama, mis. "Laptop Lenovo".</p>
              </Field>
            </div>
            <Field label="Merk">
              <input className={inputClass} value={form.merk} onChange={(e) => setField('merk', e.target.value)} placeholder="cth. Lenovo, HP, WD" />
            </Field>

            <Field label="Type">
              <input className={inputClass} value={form.type} onChange={(e) => setField('type', e.target.value)} placeholder="cth. Ideapad 3 13ADA05" />
            </Field>
            {/* Status BUKAN field yang bisa diisi manual di sini -- perubahan
                status (tersedia/dipakai/dst) selalu lewat transaksi
                (pinjamkan, kembalikan, lapor rusak), gak pernah lewat form
                create/update ini. Waktu create, status awal SELALU 'tersedia'
                (default kolom di DB). Waktu edit, tampilin status saat-ini
                sebagai info read-only aja. */}
            {inventory && (
              <div className="sm:col-span-2">
                <Field label="Status saat ini">
                  {(() => {
                    const s = STATUS_OPTIONS.find((o) => o.value === form.status);
                    return (
                      <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                        <span className={`h-1.5 w-1.5 rounded-full ${s?.dot || 'bg-slate-400'}`} />
                        <span className="font-medium">{s?.label || form.status}</span>
                        <span className="ml-auto text-xs text-slate-400">Ubah lewat pinjam/kembalikan/lapor rusak</span>
                      </div>
                    );
                  })()}
                </Field>
              </div>
            )}

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

            <Field label="Jumlah">
              <input
                type="number"
                min={1}
                className={inputClass}
                value={form.jumlah}
                onChange={(e) => setField('jumlah', e.target.value)}
                placeholder="1"
              />
              <p className="mt-1 text-xs text-slate-400">
                Default 1. Isi lebih dari 1 kalau barang non-serialized (mis. kabel, adaptor) dicatat dalam 1 baris —
                item non-serialized gak bisa dipasangi/dipasang jadi kelengkapan.
              </p>
            </Field>

            <Field label="Tanggal Garansi" error={errors.tanggal_garansi}>
              <input
                type="date"
                className={`${inputClass} ${errors.tanggal_garansi ? inputErrorClass : ''}`}
                value={form.tanggal_garansi}
                onChange={(e) => setField('tanggal_garansi', e.target.value)}
              />
            </Field>
          </Section>

          {/* Section: Struktur (Pasang ke Induk) */}
          <Section
            index={1}
            title="Struktur"
            subtitle="Hubungan fisik dengan item lain (opsional)"
            icon={
              <path d="M3 6.5L8 3l5 3.5v5L8 15l-5-3.5v-5z" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
            }
          >
            <div className="sm:col-span-2" ref={inventoryFieldRef}>
              <Field label="Pasang ke Induk" error={errors.parent_id}>
                {presetInventoryId || lockInventoryField ? (
                  <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" className="shrink-0 text-slate-400">
                      <rect x="2" y="3" width="12" height="9" rx="1.4" stroke="currentColor" strokeWidth="1.4" />
                      <path d="M5.5 14.5h5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                    </svg>
                    <span className="font-medium">{presetInventoryLabel || (presetInventoryId ? `Inventory #${presetInventoryId}` : 'Inventory ini')}</span>
                    <span className="ml-auto text-xs text-slate-400">Nempel ke inventory ini</span>
                  </div>
                ) : sudahPunyaChildren ? (
                  <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" className="shrink-0">
                      <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.4" />
                      <path d="M8 5v3.5M8 11h.01" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                    </svg>
                    Item ini punya {existingKelengkapan.length} kelengkapan menempel, jadi gak bisa dipasang ke induk lain.
                  </div>
                ) : (
                  <div className="relative">
                    <div className="relative">
                      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                        <circle cx="7" cy="7" r="5.2" stroke="currentColor" strokeWidth="1.4" />
                        <path d="M14.5 14.5L11 11" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                      </svg>
                      <input
                        className={`${inputClass} pl-8`}
                        placeholder="Cari kode inventory atau nama…"
                        value={inventorySearch}
                        onChange={(e) => {
                          setInventorySearch(e.target.value);
                          setInventoryDropdownOpen(true);
                        }}
                        onFocus={() => setInventoryDropdownOpen(true)}
                      />
                    </div>
                    {inventoryTerpilih && !inventoryDropdownOpen && (
                      <div className="mt-1.5 flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm animate-[fadeIn_120ms_ease-out]">
                        <span className="text-slate-700">
                          <span className="font-mono text-[13px]">{inventoryTerpilih.kode_inventory}</span>
                          {inventoryTerpilih.nama && <span className="text-slate-400"> — {inventoryTerpilih.nama}</span>}
                        </span>
                        <button
                          type="button"
                          onClick={() => pilihInventoryInduk(null)}
                          className="text-slate-400 hover:text-slate-600 transition-colors"
                          aria-label="Hapus pilihan inventory induk"
                        >
                          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                            <path d="M1 1L15 15M15 1L1 15" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                          </svg>
                        </button>
                      </div>
                    )}
                    {inventoryDropdownOpen && (
                      <div className="absolute z-10 mt-1.5 w-full max-h-52 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg animate-[dropIn_120ms_ease-out]">
                        <button
                          type="button"
                          onClick={() => {
                            pilihInventoryInduk(null);
                            setInventorySearch('');
                            setInventoryDropdownOpen(false);
                          }}
                          className="block w-full px-3 py-2 text-left text-sm text-slate-400 hover:bg-slate-50 transition-colors border-b border-slate-100"
                        >
                          Tanpa inventory induk
                        </button>
                        {loadingRefs && <p className="px-3 py-2 text-sm text-slate-400">Memuat…</p>}
                        {!loadingRefs && inventoryFiltered.length === 0 && (
                          <p className="px-3 py-2 text-sm text-slate-400">Tidak ada inventory yang cocok</p>
                        )}
                        {inventoryFiltered.map((a) => (
                          <button
                            key={a.id}
                            type="button"
                            onClick={() => {
                              pilihInventoryInduk(a.id);
                              setInventorySearch('');
                              setInventoryDropdownOpen(false);
                            }}
                            className={`block w-full px-3 py-2 text-left text-sm hover:bg-slate-50 transition-colors ${
                              form.parent_id === a.id ? 'bg-slate-50 text-slate-900' : 'text-slate-700'
                            }`}
                          >
                            <span className="font-mono text-[13px]">{a.kode_inventory}</span>
                            {a.nama && <span className="text-slate-400"> — {a.nama}</span>}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                <p className="mt-1 text-xs text-slate-400">
                  {presetInventoryId || lockInventoryField
                    ? 'Otomatis terisi dari inventory yang lagi diedit/dibuat — item baru ini akan langsung nempel ke inventory tersebut.'
                    : 'Opsional — pilih kalau item ini menempel ke inventory tertentu (mis. mouse ini punya laptop yang mana). Boleh diisi walau statusnya masih Tersedia; begitu induknya dipinjamkan, ini bakal ikut otomatis.'}
                </p>
              </Field>
            </div>

          </Section>

          {/* Section: Pembelian & Garansi */}
          <Section
            index={2}
            title="Pembelian & Garansi"
            subtitle="Sumber barang dan dokumen terkait"
            icon={
              <path d="M3 5h10l-.8 7.2a1.5 1.5 0 01-1.49 1.3H5.29a1.5 1.5 0 01-1.49-1.3L3 5zM5.5 5V3.5a2.5 2.5 0 015 0V5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
            }
          >
            <Field label="Supplier">
              <SelectField value={form.supplier_id ?? ''} onChange={(v) => setField('supplier_id', v ? Number(v) : null)}>
                <option value="">Tanpa supplier</option>
                {effectiveSupplierOptions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nama}
                  </option>
                ))}
              </SelectField>
            </Field>

            <Field label="Perusahaan">
              <input className={inputClass} value={form.perusahaan} onChange={(e) => setField('perusahaan', e.target.value)} placeholder="cth. mpk, uth" />
            </Field>

            <Field label="Tanggal Pembelian">
              <input type="date" className={inputClass} value={form.tanggal_invoice || ''} onChange={(e) => setField('tanggal_invoice', e.target.value)} />
            </Field>

            <Field label="Tanggal Input">
              <input type="date" className={inputClass} value={form.tanggal_input || ''} onChange={(e) => setField('tanggal_input', e.target.value)} />
            </Field>

            <Field label="No Surat Jalan">
              <input className={`${inputClass} font-mono text-[13px]`} value={form.no_surat_jalan} onChange={(e) => setField('no_surat_jalan', e.target.value)} />
            </Field>

            <Field label="No Good Receive">
              <input className={`${inputClass} font-mono text-[13px]`} value={form.no_good_receive} onChange={(e) => setField('no_good_receive', e.target.value)} />
            </Field>

            {!inventory && (
              <div className="sm:col-span-2">
                <p className="text-xs text-slate-400">Kode inventory (IT-tahun-nomor urut) akan dibuat otomatis oleh sistem.</p>
              </div>
            )}
          </Section>

          {/* Section: Detail Tambahan */}
          <Section
            index={3}
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
                    placeholder="cth. keadaan baik"
                  />
                  <span className="pointer-events-none absolute bottom-2 right-2.5 text-[11px] text-slate-300">
                    {(form.keterangan ?? '').length}/{KETERANGAN_MAX}
                  </span>
                </div>
              </Field>
            </div>

            <div className="sm:col-span-2">
              <span className="block mb-1.5 text-sm font-medium text-slate-700">
                Foto {inventory?.foto ? '(ganti, opsional)' : '(opsional)'}
              </span>
              <label
                onDragOver={(e) => e.preventDefault()}
                onDragEnter={handleFotoDragEnter}
                onDragLeave={handleFotoDragLeave}
                onDrop={handleFotoDrop}
                className={`flex items-center gap-4 rounded-xl border border-dashed p-3 cursor-pointer transition-all duration-150 ${
                  isDraggingFoto ? 'border-slate-900 bg-slate-900/[0.03] scale-[1.01]' : 'border-slate-300 hover:border-slate-400 bg-slate-50/50'
                }`}
              >
                <input type="file" accept="image/png,image/jpeg,image/jpg,image/webp" className="sr-only" onChange={handleFotoChange} />
                {fotoPreview ? (
                  <img src={fotoPreview} alt="Preview foto inventory" className="h-16 w-16 object-cover rounded-lg border border-slate-200 shrink-0 shadow-sm" />
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
              {fotoError && <span className="block mt-1 text-xs text-red-600 animate-[fadeIn_120ms_ease-out]">{fotoError}</span>}
            </div>
          </Section>

          {/* Section: Kelengkapan (children) -- cuma relevan buat item yang
              SEDANG jadi induk (parent_id null) & serialized (jumlah 1).
              Item yang lagi dipasang ke induk lain gak boleh punya
              children-nya sendiri. */}
          <Section
            index={4}
            title="Kelengkapan"
            subtitle="Aksesoris yang menempel ke barang ini"
            icon={
              <path d="M3 6.5L8 3l5 3.5v5L8 15l-5-3.5v-5z" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
            }
          >
            <div className="sm:col-span-2">
              {bisaPunyaKelengkapan ? (
                <InventoryKelengkapanPicker
                  staged={stagedKelengkapan}
                  onChange={setStagedKelengkapan}
                  existing={existingKelengkapan}
                  inventoryLabel={form.nama || undefined}
                  presetInventoryId={inventory?.id}
                />
              ) : form.parent_id ? (
                <p className="text-xs text-slate-400">Item yang menempel ke induk lain gak bisa punya kelengkapannya sendiri.</p>
              ) : (
                <p className="text-xs text-slate-400">Kelengkapan cuma bisa dipasang kalau Jumlah = 1 (barang serialized).</p>
              )}
            </div>
          </Section>
        </form>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100 shrink-0">
          <ButtonCancel onClick={onClose} disabled={submitting} />
          <ButtonSubmit type="submit" form="inventory-form" loading={submitting} loadingLabel="Menyimpan...">
            {inventory ? 'Simpan Perubahan' : 'Tambah Inventory'}
          </ButtonSubmit>
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