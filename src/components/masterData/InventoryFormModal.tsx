import { useEffect, useMemo, useRef, useState } from 'react';
import {
  createInventory,
  getInventory,
  getInventoryById,
  updateInventory,
  type Inventory,
  type InventoryFormValues,
  type InventoryStatus,
} from '../../api/masterData/inventory';
import { pasangPenggantiKelengkapan } from '../../api/transaksi/inventoryKelengkapan';
import { getSupplier, type Supplier } from '../../api/masterData/supplier';
import { getLokasiKantor, type LokasiKantor } from '../../api/lokasiKantor';
import InventoryKelengkapanPicker, { type StagedKelengkapan } from './InventoryKelengkapanPicker';

const KETERANGAN_MAX = 255;
const MAX_FOTO_MB = 4;
const ACCEPTED_FOTO_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];

// Form ini nangani status secara lokal aja (mode kelengkapan) --
// InventoryFormValues (create/update) TIDAK punya field status, karena di
// skema baru perubahan status dilakuin lewat endpoint aksi khusus
// (laporRusakKelengkapan, dst), bukan lewat create/update langsung. 'status'
// di sini cuma dipakai buat UI & validasi tampilan mode kelengkapan, DIBUANG
// sebelum dikirim ke createInventory/updateInventory.
export type KelengkapanFormValues = InventoryFormValues & { status: InventoryStatus };

const STATUS_OPTIONS: { value: InventoryStatus; label: string; dot: string; ring: string }[] = [
  { value: 'tersedia', label: 'Tersedia', dot: 'bg-emerald-500', ring: 'ring-emerald-100 border-emerald-400 bg-emerald-50/60' },
  { value: 'dipakai', label: 'Dipakai', dot: 'bg-blue-500', ring: 'ring-blue-100 border-blue-400 bg-blue-50/60' },
  { value: 'rusak', label: 'Rusak', dot: 'bg-red-500', ring: 'ring-red-100 border-red-400 bg-red-50/60' },
];

const inputClass =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 shadow-sm outline-none transition-all duration-150 hover:border-slate-400 focus:border-slate-900 focus:ring-4 focus:ring-slate-900/[0.06]';
const inputErrorClass = 'border-red-400 focus:border-red-500 focus:ring-red-500/10';

interface InventoryFormModalProps {
  inventory: Inventory | null; // null = mode tambah
  // Cuma dipakai mode 'barang_utama' -- mode 'kelengkapan' fetch supplier-nya
  // sendiri secara internal, jadi boleh dikosongin ('[]') dari pemanggil.
  supplierOptions: Supplier[];
  onClose: () => void;
  onSaved: (inventory: Inventory, warning?: string) => void;
  // 'barang_utama' (default) = form lama InventoryFormModal: field inventory utama +
  // section Kelengkapan (picker) buat staged. 'kelengkapan' = form lama
  // InventoryKelengkapanForm: field inventory utama + Nama/Status/Inventory Induk/Lokasi
  // Kantor, TANPA section Kelengkapan (kelengkapan gak boleh punya
  // kelengkapan lagi).
  kategoriKode?: 'barang_utama' | 'kelengkapan';
  // --- Prop di bawah ini cuma dipakai kalau kategoriKode === 'kelengkapan' ---
  // Dipakai dari section "Kelengkapan" di form inventory utama — kalau diisi,
  // field "Inventory Induk" dikunci ke inventory ini (gak bisa diubah manual).
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

// FormState barang utama (tetap seperti sebelumnya)
interface BarangUtamaFormState {
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

const EMPTY_KELENGKAPAN_FORM: KelengkapanFormValues = {
  parent_id: null,
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

export default function InventoryFormModal({
  inventory,
  supplierOptions,
  onClose,
  onSaved,
  kategoriKode = 'barang_utama',
  presetInventoryId,
  presetInventoryLabel,
  lockInventoryField,
  onStage,
}: InventoryFormModalProps) {
  const isKelengkapan = kategoriKode === 'kelengkapan';

  // ================= Mode barang_utama (state & logic asli) =================
  const [form, setForm] = useState<BarangUtamaFormState>({
    merek: inventory?.merek || '',
    tipe: inventory?.tipe || '',
    warna: inventory?.warna || '',
    serial_number: inventory?.serial_number || '',
    jumlah: inventory?.jumlah ? String(inventory.jumlah) : '1',
    tanggal_garansi: inventory?.tanggal_garansi ? inventory.tanggal_garansi.slice(0, 10) : '',
    perusahaan: inventory?.perusahaan || '',
    keterangan: inventory?.keterangan || '',
    supplier_id: inventory?.supplier_id ? String(inventory.supplier_id) : '',
    tanggal_pembelian: inventory?.tanggal_pembelian ? inventory.tanggal_pembelian.slice(0, 10) : '',
    no_surat_jalan: inventory?.no_surat_jalan || '',
    no_good_receive: inventory?.no_good_receive || '',
  });
  const [foto, setFoto] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [stagedKelengkapan, setStagedKelengkapan] = useState<StagedKelengkapan[]>([]);
  const [existingKelengkapan, setExistingKelengkapan] = useState<Inventory[]>([]);

  // Mode edit: fetch ulang detail inventory (list row yang dilempar ke form
  // belum tentu bawa relasi children) biar section Kelengkapan
  // nunjukin apa yang udah beneran nempel. Cuma relevan buat barang_utama.
  useEffect(() => {
    if (!inventory || isKelengkapan) return;
    getInventoryById(inventory.id)
      .then((data) => setExistingKelengkapan(data.children || []))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inventory, isKelengkapan]);

  // Kelengkapan cuma boleh dipasang ke inventory serialized (jumlah 1) -- kalau
  // user ubah jumlah jadi >1 setelah sempat milih kelengkapan, kosongin
  // staged-nya biar gak nyangkut nempel ke inventory yang salah semantiknya.
  const jumlahValid = form.jumlah === '' || Number(form.jumlah) === 1;
  useEffect(() => {
    if (!jumlahValid && stagedKelengkapan.length > 0) setStagedKelengkapan([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jumlahValid]);

  const set = (key: keyof BarangUtamaFormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  // ================= Mode kelengkapan (state & logic asli InventoryKelengkapanForm) =================
  const [kForm, setKForm] = useState<KelengkapanFormValues>(EMPTY_KELENGKAPAN_FORM);
  const [kSupplierOptions, setKSupplierOptions] = useState<Supplier[]>([]);
  const [inventoryOptions, setInventoryOptions] = useState<Inventory[]>([]);
  const [lokasiOptions, setLokasiOptions] = useState<LokasiKantor[]>([]);
  const [inventorySearch, setInventorySearch] = useState('');
  const [inventoryDropdownOpen, setInventoryDropdownOpen] = useState(false);
  const [fotoPreview, setFotoPreview] = useState<string | null>(null);
  const [isDraggingFoto, setIsDraggingFoto] = useState(false);
  const [loadingRefs, setLoadingRefs] = useState(false);
  const [saving, setSaving] = useState(false);
  const [kErrors, setKErrors] = useState<Record<string, string>>({});

  const inventoryFieldRef = useRef<HTMLDivElement>(null);
  const fotoObjectUrl = useRef<string | null>(null);
  const firstFieldRef = useRef<HTMLInputElement>(null);
  const dragCounter = useRef(0);

  // ---- load reference data tiap kali modal dibuka (mode kelengkapan) ----
  useEffect(() => {
    if (!isKelengkapan) return;
    setLoadingRefs(true);
    Promise.allSettled([getSupplier(), getInventory({ kategori: 'barang_utama' }), getLokasiKantor()]).then(([sup, inventoryRes, lokasi]) => {
      if (sup.status === 'fulfilled') setKSupplierOptions(sup.value);
      if (inventoryRes.status === 'fulfilled') setInventoryOptions(inventoryRes.value);
      if (lokasi.status === 'fulfilled') setLokasiOptions(lokasi.value);
      if (sup.status === 'rejected' || inventoryRes.status === 'rejected' || lokasi.status === 'rejected') {
        setKErrors((prev) => ({ ...prev, _general: 'Sebagian data referensi gagal dimuat. Coba buka ulang form ini.' }));
      }
      setLoadingRefs(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isKelengkapan]);

  useEffect(() => {
    if (!isKelengkapan) return;
    if (inventory) {
      setKForm({
        parent_id: inventory.parent_id ?? null,
        lokasi_kantor_id: inventory.lokasi_kantor_id ?? null,
        nama: inventory.nama || '',
        merek: inventory.merek || '',
        tipe: inventory.tipe || '',
        warna: inventory.warna || '',
        serial_number: inventory.serial_number || '',
        tanggal_garansi: inventory.tanggal_garansi || '',
        perusahaan: inventory.perusahaan || '',
        keterangan: inventory.keterangan || '',
        foto: null,
        supplier_id: inventory.supplier_id,
        tanggal_pembelian: inventory.tanggal_pembelian || '',
        no_surat_jalan: inventory.no_surat_jalan || '',
        no_good_receive: inventory.no_good_receive || '',
        status: inventory.status,
      });
      setFotoPreview(inventory.foto || null);
    } else {
      setKForm(presetInventoryId ? { ...EMPTY_KELENGKAPAN_FORM, parent_id: presetInventoryId } : EMPTY_KELENGKAPAN_FORM);
      setFotoPreview(null);
    }
    setInventorySearch('');
    setInventoryDropdownOpen(false);
    setKErrors({});
    requestAnimationFrame(() => firstFieldRef.current?.focus());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isKelengkapan, inventory, presetInventoryId]);

  // ---- tutup dropdown inventory kalau klik di luar ----
  useEffect(() => {
    if (!isKelengkapan || !inventoryDropdownOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (inventoryFieldRef.current && !inventoryFieldRef.current.contains(e.target as Node)) {
        setInventoryDropdownOpen(false);
        setInventorySearch('');
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isKelengkapan, inventoryDropdownOpen]);

  // ---- tutup dropdown inventory dengan tombol Esc (Esc buat nutup modal
  // sepenuhnya sudah ditangani lewat overlay onMouseDown, bukan di sini,
  // biar konsisten dengan mode barang_utama) ----
  useEffect(() => {
    if (!isKelengkapan) return;
    function handleEsc(e: KeyboardEvent) {
      if (e.key === 'Escape' && inventoryDropdownOpen) {
        setInventoryDropdownOpen(false);
        setInventorySearch('');
      }
    }
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [isKelengkapan, inventoryDropdownOpen]);

  // ---- bersihkan object URL foto biar nggak leak memory ----
  useEffect(() => {
    return () => {
      if (fotoObjectUrl.current) URL.revokeObjectURL(fotoObjectUrl.current);
    };
  }, []);

  const inventoryTerpilih = useMemo(
    () => inventoryOptions.find((a) => a.id === kForm.parent_id) || null,
    [inventoryOptions, kForm.parent_id]
  );

  const inventoryFiltered = useMemo(() => {
    const q = inventorySearch.trim().toLowerCase();
    if (!q) return inventoryOptions;
    return inventoryOptions.filter((a) =>
      [a.kode_inventory, a.merek, a.tipe].filter(Boolean).join(' ').toLowerCase().includes(q)
    );
  }, [inventoryOptions, inventorySearch]);

  // Kelengkapan berstatus "tersedia" gak boleh masih nempel ke inventory induk
  // (inventory induk cuma relevan kalau kelengkapan lagi dipakai/menempel ke
  // sesuatu). Dipakai buat nonaktifkan field Inventory Induk di UI.
  const inventoryIndukDisabled = kForm.status === 'tersedia';

  function setKField<K extends keyof KelengkapanFormValues>(key: K, value: KelengkapanFormValues[K]) {
    setKForm((prev) => ({ ...prev, [key]: value }));
    if (kErrors[key]) setKErrors((prev) => ({ ...prev, [key]: '' }));
  }

  // Ganti status kelengkapan. Begitu status jadi "tersedia", parent_id ikut
  // dikosongkan otomatis (lihat inventoryIndukDisabled) — dan dropdown/pencarian
  // inventory induk yang mungkin lagi kebuka juga ditutup.
  function pilihStatus(status: InventoryStatus) {
    setKForm((prev) => ({
      ...prev,
      status,
      parent_id: status === 'tersedia' ? null : prev.parent_id,
    }));
    if (kErrors.status) setKErrors((prev) => ({ ...prev, status: '' }));
    if (status === 'tersedia' && inventoryDropdownOpen) {
      setInventoryDropdownOpen(false);
      setInventorySearch('');
    }
  }

  // Inventory induk & lokasi kantor saling meniadakan — kelengkapan yang nempel
  // ke inventory induk ikut lokasi inventory itu, jadi begitu pilih inventory induk,
  // lokasi manual yang sempat diisi otomatis dikosongkan (dan sebaliknya).
  function pilihInventoryInduk(id: number | null) {
    setKForm((prev) => ({ ...prev, parent_id: id, lokasi_kantor_id: id ? null : prev.lokasi_kantor_id }));
    if (kErrors.parent_id) setKErrors((prev) => ({ ...prev, parent_id: '' }));
  }

  function pilihLokasiKantor(id: number | null) {
    setKForm((prev) => ({ ...prev, lokasi_kantor_id: id, parent_id: id ? null : prev.parent_id }));
    if (kErrors.lokasi_kantor_id) setKErrors((prev) => ({ ...prev, lokasi_kantor_id: '' }));
  }

  function applyFoto(file: File | null) {
    if (!file) return;
    if (!ACCEPTED_FOTO_TYPES.includes(file.type)) {
      setKErrors((prev) => ({ ...prev, foto: 'Format harus PNG, JPG, atau WEBP.' }));
      return;
    }
    if (file.size > MAX_FOTO_MB * 1024 * 1024) {
      setKErrors((prev) => ({ ...prev, foto: `Ukuran foto maksimal ${MAX_FOTO_MB}MB.` }));
      return;
    }
    setKErrors((prev) => ({ ...prev, foto: '' }));
    if (fotoObjectUrl.current) URL.revokeObjectURL(fotoObjectUrl.current);
    const url = URL.createObjectURL(file);
    fotoObjectUrl.current = url;
    setKField('foto', file);
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
    setKField('foto', null);
    setFotoPreview(null);
  }

  function validateKelengkapan(): boolean {
    const next: Record<string, string> = {};
    if (!kForm.merek?.trim()) next.merek = 'Merek wajib diisi';
    if (!kForm.status) next.status = 'Status wajib dipilih';
    if (kForm.tanggal_pembelian && kForm.tanggal_garansi && kForm.tanggal_garansi < kForm.tanggal_pembelian) {
      next.tanggal_garansi = 'Tanggal garansi tidak boleh sebelum tanggal pembelian';
    }
    setKErrors((prev) => ({ ...prev, ...next }));
    return Object.keys(next).length === 0;
  }

  async function handleSubmitKelengkapan(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;
    if (!validateKelengkapan()) return;
    // Mode staged: gak ada inventory induk beneran di backend buat nempelin
    // kelengkapan ini (mis. lagi create inventory baru), jadi cuma balikin form
    // values ke pemanggil -- gak ada API yang dipanggil sama sekali di sini.
    if (onStage) {
      onStage(kForm);
      onClose();
      return;
    }
    setSaving(true);
    try {
      // status TIDAK dikirim -- InventoryFormValues gak punya field ini di
      // skema baru (perubahan status lewat endpoint aksi khusus).
      const { status: _status, ...payload } = kForm;
      const saved = inventory ? await updateInventory(inventory.id, payload) : await createInventory(payload);
      onSaved(saved);
      onClose();
    } catch (err: any) {
      const apiErrors = err?.response?.data?.errors;
      if (apiErrors) {
        const flat: Record<string, string> = {};
        Object.keys(apiErrors).forEach((k) => (flat[k] = apiErrors[k][0]));
        setKErrors(flat);
      } else {
        setKErrors({ _general: err?.response?.data?.message || 'Gagal menyimpan data. Coba lagi.' });
      }
    } finally {
      setSaving(false);
    }
  }

  // ================= Submit barang_utama (logic asli) =================
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

      const saved = inventory ? await updateInventory(inventory.id, values) : await createInventory(values);

      if (stagedKelengkapan.length > 0) {
        try {
          for (const item of stagedKelengkapan) {
            if (item.type === 'stok') {
              await pasangPenggantiKelengkapan(item.item.id, saved.id);
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
      const msg =
        err.response?.data?.errors?.serial_number?.[0] ||
        err.response?.data?.message ||
        'Gagal menyimpan inventory. Coba lagi.';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  // ================= Render: mode kelengkapan =================
  if (isKelengkapan) {
    return (
      <div
        className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-[fadeIn_150ms_ease-out]"
        onMouseDown={(e) => {
          if (e.target === e.currentTarget && !saving) onClose();
        }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="inventory-kelengkapan-form-title"
      >
        <div className="bg-white rounded-2xl shadow-2xl shadow-slate-900/10 ring-1 ring-slate-900/5 w-full max-w-2xl max-h-[90vh] flex flex-col animate-[slideUp_200ms_cubic-bezier(0.16,1,0.3,1)]">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                {inventory ? 'Ubah data' : 'Data baru'}
              </p>
              <h3 id="inventory-kelengkapan-form-title" className="text-lg font-semibold text-slate-900">
                {inventory ? 'Edit Kelengkapan Inventory' : 'Tambah Kelengkapan Inventory'}
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
          <form id="inventory-kelengkapan-form" onSubmit={handleSubmitKelengkapan} className="px-6 py-5 space-y-7 overflow-y-auto">
            {kErrors._general && (
              <p className="flex items-center gap-2 text-sm text-red-700 bg-red-50 border border-red-100 rounded-lg px-3 py-2.5 animate-[fadeIn_150ms_ease-out]" role="alert">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="shrink-0">
                  <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.4" />
                  <path d="M8 5v3.5M8 11h.01" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                </svg>
                {kErrors._general}
              </p>
            )}

            {loadingRefs && (
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <svg className="animate-spin" width="12" height="12" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.25" />
                  <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                </svg>
                Memuat data inventory & supplier…
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
              <div className="sm:col-span-2" ref={inventoryFieldRef}>
                <Field label="Inventory Induk" error={kErrors.parent_id}>
                  {presetInventoryId || lockInventoryField ? (
                    <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" className="shrink-0 text-slate-400">
                        <rect x="2" y="3" width="12" height="9" rx="1.4" stroke="currentColor" strokeWidth="1.4" />
                        <path d="M5.5 14.5h5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                      </svg>
                      <span className="font-medium">{presetInventoryLabel || (presetInventoryId ? `Inventory #${presetInventoryId}` : 'Inventory ini')}</span>
                      <span className="ml-auto text-xs text-slate-400">Nempel ke inventory ini</span>
                    </div>
                  ) : (
                    <div className="relative">
                      <div className="relative">
                        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                          <circle cx="7" cy="7" r="5.2" stroke="currentColor" strokeWidth="1.4" />
                          <path d="M14.5 14.5L11 11" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                        </svg>
                        <input
                          className={`${inputClass} pl-8 ${inventoryIndukDisabled ? 'opacity-50 cursor-not-allowed bg-slate-50' : ''}`}
                          placeholder="Cari kode inventory, merek, atau tipe…"
                          value={inventorySearch}
                          disabled={inventoryIndukDisabled}
                          onChange={(e) => {
                            setInventorySearch(e.target.value);
                            setInventoryDropdownOpen(true);
                          }}
                          onFocus={() => {
                            if (!inventoryIndukDisabled) setInventoryDropdownOpen(true);
                          }}
                        />
                      </div>
                      {inventoryTerpilih && !inventoryDropdownOpen && (
                        <div className="mt-1.5 flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm animate-[fadeIn_120ms_ease-out]">
                          <span className="text-slate-700">
                            <span className="font-mono text-[13px]">{inventoryTerpilih.kode_inventory}</span>
                            {(inventoryTerpilih.merek || inventoryTerpilih.tipe) && (
                              <span className="text-slate-400"> — {[inventoryTerpilih.merek, inventoryTerpilih.tipe].filter(Boolean).join(' ')}</span>
                            )}
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
                      {inventoryDropdownOpen && !inventoryIndukDisabled && (
                        <div className="absolute z-10 mt-1.5 max-h-48 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg animate-[dropIn_140ms_ease-out]">
                          <button
                            type="button"
                            onClick={() => {
                              pilihInventoryInduk(null);
                              setInventorySearch('');
                              setInventoryDropdownOpen(false);
                            }}
                            className="block w-full px-3 py-2 text-left text-sm text-slate-400 hover:bg-slate-50 transition-colors"
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
                                kForm.parent_id === a.id ? 'bg-slate-50 text-slate-900' : 'text-slate-700'
                              }`}
                            >
                              <span className="font-mono text-[13px]">{a.kode_inventory}</span>
                              {(a.merek || a.tipe) && (
                                <span className="text-slate-400"> — {[a.merek, a.tipe].filter(Boolean).join(' ')}</span>
                              )}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                  <p className="mt-1 text-xs text-slate-400">
                    {presetInventoryId || lockInventoryField
                      ? 'Otomatis terisi dari inventory yang lagi diedit/dibuat — kelengkapan baru ini akan langsung nempel ke inventory tersebut.'
                      : inventoryIndukDisabled
                      ? 'Nonaktif — kelengkapan berstatus "Tersedia" tidak bisa terikat ke inventory induk.'
                      : 'Opsional — pilih kalau kelengkapan ini menempel ke inventory tertentu (mis. mouse ini punya laptop yang mana).'}
                  </p>
                </Field>
              </div>

              <div className="sm:col-span-2">
                <Field label="Lokasi Kantor" error={kErrors.lokasi_kantor_id}>
                  <SelectField
                    value={kForm.lokasi_kantor_id ?? ''}
                    onChange={(v) => pilihLokasiKantor(v ? Number(v) : null)}
                    disabled={!!kForm.parent_id}
                  >
                    <option value="">Tidak diisi</option>
                    {lokasiOptions.map((l) => (
                      <option key={l.id} value={l.id}>{l.nama}</option>
                    ))}
                  </SelectField>
                  <p className="mt-1 text-xs text-slate-400">
                    {!kForm.parent_id && 'Opsional — isi kalau kelengkapan ini berdiri sendiri (tanpa inventory induk) supaya tetap ketahuan lokasi fisiknya.'}
                  </p>
                </Field>
              </div>

              <Field label="Nama" error={kErrors.nama}>
                <input
                  ref={firstFieldRef}
                  className={inputClass}
                  value={kForm.nama}
                  onChange={(e) => setKField('nama', e.target.value)}
                  placeholder="cth. Charger Laptop"
                />
              </Field>

              <Field label="Status" error={kErrors.status} required>
                <div className="grid grid-cols-2 gap-2">
                  {STATUS_OPTIONS.map((s) => {
                    const active = kForm.status === s.value;
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
                            onChange={() => pilihStatus(s.value)}
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

              <Field label="Merek" error={kErrors.merek} required>
                <input
                  className={`${inputClass} ${kErrors.merek ? inputErrorClass : ''}`}
                  value={kForm.merek}
                  onChange={(e) => setKField('merek', e.target.value)}
                  placeholder="cth. Dell, HP, Logitech"
                />
              </Field>

              <Field label="Tipe">
                <input className={inputClass} value={kForm.tipe} onChange={(e) => setKField('tipe', e.target.value)} placeholder="cth. 65W USB-C" />
              </Field>

              <Field label="Warna">
                <input className={inputClass} value={kForm.warna} onChange={(e) => setKField('warna', e.target.value)} placeholder="cth. Hitam" />
              </Field>

              <Field label="Serial Number" error={kErrors.serial_number}>
                <input
                  className={`${inputClass} font-mono text-[13px]`}
                  value={kForm.serial_number}
                  onChange={(e) => setKField('serial_number', e.target.value)}
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
                  value={kForm.supplier_id ?? ''}
                  onChange={(v) => setKField('supplier_id', v ? Number(v) : null)}
                >
                  <option value="">Pilih supplier</option>
                  {kSupplierOptions.map((s) => (
                    <option key={s.id} value={s.id}>{s.nama}</option>
                  ))}
                </SelectField>
              </Field>

              <Field label="Perusahaan">
                <input className={inputClass} value={kForm.perusahaan} onChange={(e) => setKField('perusahaan', e.target.value)} />
              </Field>

              <Field label="Tanggal Pembelian">
                <input
                  type="date"
                  className={inputClass}
                  value={kForm.tanggal_pembelian || ''}
                  onChange={(e) => setKField('tanggal_pembelian', e.target.value)}
                />
              </Field>

              <Field label="Tanggal Garansi" error={kErrors.tanggal_garansi}>
                <input
                  type="date"
                  className={`${inputClass} ${kErrors.tanggal_garansi ? inputErrorClass : ''}`}
                  value={kForm.tanggal_garansi || ''}
                  onChange={(e) => setKField('tanggal_garansi', e.target.value)}
                />
              </Field>

              <Field label="No Surat Jalan">
                <input className={`${inputClass} font-mono text-[13px]`} value={kForm.no_surat_jalan} onChange={(e) => setKField('no_surat_jalan', e.target.value)} />
              </Field>

              <Field label="No Good Receive">
                <input className={`${inputClass} font-mono text-[13px]`} value={kForm.no_good_receive} onChange={(e) => setKField('no_good_receive', e.target.value)} />
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
                      value={kForm.keterangan ?? ''}
                      maxLength={KETERANGAN_MAX}
                      onChange={(e) => setKField('keterangan', e.target.value)}
                      placeholder="Catatan tambahan tentang kondisi atau riwayat barang…"
                    />
                    <span className="pointer-events-none absolute bottom-2 right-2.5 text-[11px] text-slate-300">
                      {(kForm.keterangan ?? '').length}/{KETERANGAN_MAX}
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
                {kErrors.foto && <span className="block mt-1 text-xs text-red-600 animate-[fadeIn_120ms_ease-out]">{kErrors.foto}</span>}
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
              form="inventory-kelengkapan-form"
              disabled={saving}
              className="px-4 py-2 text-sm rounded-lg bg-slate-900 text-white hover:bg-slate-800 active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100 transition-all duration-150 inline-flex items-center gap-2"
            >
              {saving && (
                <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.25" />
                  <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                </svg>
              )}
              {saving ? 'Menyimpan...' : inventory ? 'Simpan Perubahan' : 'Tambah'}
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

  // ================= Render: mode barang_utama (asli, tidak berubah) =================
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
              {inventory ? 'Ubah data' : 'Data baru'}
            </p>
            <h3 className="text-lg font-semibold text-slate-900">
              {inventory ? `Edit Inventory ${inventory.kode_inventory}` : 'Tambah Inventory'}
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
                placeholder="cth. Pavilion 14"
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
            <div className="relative">
              <textarea
                value={form.keterangan}
                onChange={set('keterangan')}
                rows={2}
                maxLength={KETERANGAN_MAX}
                placeholder="cth. keadaan baik"
                className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
              <span className="pointer-events-none absolute bottom-2 right-2.5 text-[11px] text-slate-300">
                {(form.keterangan ?? '').length}/{KETERANGAN_MAX}
              </span>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Foto {inventory?.foto ? '(ganti, opsional)' : '(opsional)'}</label>
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

          {!inventory && (
            <p className="text-xs text-slate-400">Kode inventory (IT-tahun-nomor urut) akan dibuat otomatis oleh sistem.</p>
          )}

          <div className="pt-2 border-t border-slate-100">
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Kelengkapan</label>
            {jumlahValid ? (
              <InventoryKelengkapanPicker
                staged={stagedKelengkapan}
                onChange={setStagedKelengkapan}
                existing={existingKelengkapan}
                inventoryLabel={[form.merek, form.tipe].filter(Boolean).join(' ') || undefined}
                presetInventoryId={inventory?.id}
              />
            ) : (
              <p className="text-xs text-slate-400">Kelengkapan cuma bisa dipasang kalau Jumlah = 1 (barang serialized).</p>
            )}
          </div>
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
            {submitting ? 'Menyimpan...' : inventory ? 'Simpan Perubahan' : 'Tambah Inventory'}
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