import { useEffect, useRef, useState } from 'react';
import { Search, Check, Send, X } from 'lucide-react';
import toast from 'react-hot-toast';
import type { Inventory } from '../../api/masterData/inventory';
import { serahTerimaInventory, searchKaryawan, type InventoryPemakai, type KaryawanUser } from '../../api/transaksi/inventoryPemakai';
import InventoryFotoUpload from './InventoryFotoUpload';
import { ButtonCancel, ButtonSubmit, Field, TextInput, Textarea } from '../shared/FormControls';

interface InventorySerahTerimaModalProps {
  inventory: Inventory; // inventory utama yang mau diserahkan (mis. laptop) -- diklik dari tabel/detail
  onClose: () => void;
  // dikirim SETELAH semua item (inventory utama + kelengkapan yang dicentang)
  // berhasil diserahkan. Array selalu berisi minimal 1 elemen (inventory utama).
  onSuccess: (results: { inventory: Inventory; pemakai: InventoryPemakai }[]) => void;
}

type PenerimaMode = 'karyawan' | 'cabang';

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export default function InventorySerahTerimaModal({ inventory, onClose, onSuccess }: InventorySerahTerimaModalProps) {
  const [mode, setMode] = useState<PenerimaMode>('karyawan');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<KaryawanUser[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<KaryawanUser | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [tanggalPenerimaan, setTanggalPenerimaan] = useState(todayIso());
  const [catatan, setCatatan] = useState('');
  const [fotoPenerimaan, setFotoPenerimaan] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<{ penerima?: string; foto?: string }>({});
  const [serverError, setServerError] = useState('');

  // Kelengkapan (tas, charger, dst) TIDAK bisa dipinjam sendiri lagi -- dia
  // wajib nempel & ikut status inventory induknya. Begitu inventory ini diserahkan,
  // backend otomatis ikut serahkan semua kelengkapan miliknya yang masih
  // 'tersedia' (satu struk & foto yang sama). Di sini kita cuma tampilkan
  // daftarnya sebagai info, tidak ada checklist/pilihan manual lagi.
  const kelengkapanTersedia = (inventory.children ?? []).filter((k) => k.status === 'tersedia');

  function handleModeChange(next: PenerimaMode) {
    setMode(next);
    // reset pencarian tiap ganti mode biar nggak ketuker antara akun karyawan & cabang
    setQuery('');
    setResults([]);
    setSelected(null);
    setErrors((prev) => ({ ...prev, penerima: '' }));
    setServerError('');
  }

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim() || selected) {
      setResults([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const data = await searchKaryawan(query.trim(), mode === 'cabang' ? 'cabang' : undefined);
        setResults(Array.isArray(data) ? data : []);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, selected, mode]);

  const pick = (u: KaryawanUser) => {
    setSelected(u);
    setQuery(u.name);
    setResults([]);
    if (errors.penerima) setErrors((prev) => ({ ...prev, penerima: '' }));
  };

  const handleSubmit = async () => {
    const newErrors: { penerima?: string; foto?: string } = {};

    if (mode === 'karyawan' && !selected?.nik) {
      newErrors.penerima = selected
        ? 'Karyawan yang dipilih belum memiliki data NIK lengkap.'
        : 'Wajib memilih karyawan penerima unit.';
    } else if (mode === 'cabang' && !selected?.id) {
      newErrors.penerima = 'Wajib memilih akun cabang penerima unit.';
    }

    if (fotoPenerimaan.length !== 3) {
      newErrors.foto = `Wajib melampirkan tepat 3 foto bukti serah terima (saat ini: ${fotoPenerimaan.length} foto).`;
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      toast.error('Mohon lengkapi seluruh syarat serah-terima.');
      return;
    }

    setSubmitting(true);
    setErrors({});
    setServerError('');

    // Cuma inventory utama yang diserahkan lewat sini -- kelengkapan yang masih
    // 'tersedia' otomatis ikut diserahkan di backend (satu struk & foto yang
    // sama), gak perlu request terpisah dari sini lagi.
    try {
      const formData = new FormData();
      formData.append('user_id', String(selected!.id));
      formData.append('tanggal_penerimaan', tanggalPenerimaan);
      if (catatan.trim()) formData.append('catatan_penerimaan', catatan.trim());
      fotoPenerimaan.forEach((file) => formData.append('foto_penerimaan[]', file));

      const pemakai = await serahTerimaInventory(inventory.id, formData);
      toast.success('Serah terima inventory berhasil dicatat.');
      onSuccess([{ inventory, pemakai }]);
    } catch (err: any) {
      const msg =
        err.response?.data?.errors?.foto_penerimaan?.[0] ||
        err.response?.data?.message ||
        'Gagal mencatat serah-terima. Coba lagi.';
      setServerError(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/50 backdrop-blur-[2px] p-4 animate-[fadeIn_150ms_ease-out]"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !submitting) onClose();
      }}
    >
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200/80 w-full max-w-md max-h-[90vh] flex flex-col animate-[slideUp_200ms_cubic-bezier(0.16,1,0.3,1)]">
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-4 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 shadow-sm shrink-0">
              <Send size={20} className="text-blue-600" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-900 leading-tight">Serah Terima Inventory</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                <span className="font-mono font-medium text-slate-700">{inventory.kode_inventory}</span> · {inventory.nama || '-'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            aria-label="Tutup"
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition disabled:opacity-40"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 overflow-y-auto space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
              Kategori Penerima <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleModeChange('karyawan')}
                className={`text-sm font-semibold py-2 px-3 rounded-xl border transition ${
                  mode === 'karyawan'
                    ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
              >
                Karyawan
              </button>
              <button
                type="button"
                onClick={() => handleModeChange('cabang')}
                className={`text-sm font-semibold py-2 px-3 rounded-xl border transition ${
                  mode === 'cabang'
                    ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
              >
                Cabang
              </button>
            </div>
          </div>

          <Field
            label={mode === 'karyawan' ? 'Cari Karyawan Penerima' : 'Cari Akun Cabang Penerima'}
            error={errors.penerima}
            required
          >
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setSelected(null);
                  if (errors.penerima) setErrors((prev) => ({ ...prev, penerima: '' }));
                }}
                autoFocus
                placeholder={mode === 'karyawan' ? 'Ketik nama / NIK karyawan...' : 'Ketik nama cabang...'}
                className={`w-full pl-9 pr-8 py-2.5 border rounded-xl text-sm transition focus:outline-none focus:ring-2 ${
                  errors.penerima
                    ? 'border-red-300 bg-red-50/30 text-red-900 focus:ring-red-400 focus:border-red-400'
                    : 'border-slate-300 bg-white text-slate-900 focus:ring-slate-900 focus:border-slate-900'
                }`}
              />
              {selected && <Check className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-600" />}

              {!selected && query.trim() !== '' && (
                <div className="absolute z-20 mt-1.5 w-full bg-white border border-slate-200 rounded-xl shadow-xl max-h-48 overflow-y-auto divide-y divide-slate-100">
                  {searching && <p className="text-xs text-slate-400 px-3.5 py-3">Mencari data...</p>}
                  {!searching &&
                    results.map((u) => {
                      const disabled = mode === 'karyawan' && !u.nik;
                      return (
                        <button
                          key={u.id}
                          type="button"
                          onClick={() => pick(u)}
                          disabled={disabled}
                          className="w-full text-left text-sm px-3.5 py-2.5 hover:bg-slate-50 transition disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-between"
                        >
                          <div>
                            <p className="font-medium text-slate-900">{u.name}</p>
                            {u.nik && <p className="text-xs text-slate-500 font-mono">NIK: {u.nik}</p>}
                          </div>
                          {disabled && <span className="text-xs text-amber-600 font-medium">Belum ada NIK</span>}
                        </button>
                      );
                    })}
                  {!searching && results.length === 0 && (
                    <p className="text-xs text-slate-400 px-3.5 py-3">
                      {mode === 'karyawan' ? 'Karyawan tidak ditemukan.' : 'Cabang tidak ditemukan.'}
                    </p>
                  )}
                </div>
              )}
            </div>
          </Field>

          <Field label="Tanggal Penerimaan" required>
            <TextInput
              type="date"
              value={tanggalPenerimaan}
              onChange={setTanggalPenerimaan}
            />
          </Field>

          <Field label="Catatan Serah Terima">
            <Textarea
              value={catatan}
              onChange={setCatatan}
              rows={2}
              placeholder="cth. Diterima dalam kondisi fisik mulus & charger berfungsi normal."
            />
          </Field>

          {kelengkapanTersedia.length > 0 && (
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
              <p className="text-xs font-semibold text-slate-700 mb-1.5">
                Kelengkapan Otomatis Ikut Terserah-Terima ({kelengkapanTersedia.length}):
              </p>
              <div className="flex flex-wrap gap-1.5">
                {kelengkapanTersedia.map((k) => (
                  <span
                    key={k.id}
                    className="text-[11px] font-medium bg-white border border-slate-200 text-slate-700 px-2 py-0.5 rounded-md shadow-2xs"
                  >
                    {k.kode_inventory} · {k.nama}
                  </span>
                ))}
              </div>
              <p className="text-[11px] text-slate-400 mt-2">
                Item di atas ikut berstatus "dipakai" otomatis bersamaan dengan unit utama.
              </p>
            </div>
          )}

          <div>
            <InventoryFotoUpload
              files={fotoPenerimaan}
              onChange={(files) => {
                setFotoPenerimaan(files);
                if (errors.foto) setErrors((prev) => ({ ...prev, foto: '' }));
              }}
              max={3}
              label="Foto Bukti Serah Terima (Wajib 3 Foto)"
            />
            {errors.foto && (
              <p className="mt-1.5 text-xs text-red-600 font-medium">{errors.foto}</p>
            )}
          </div>

          {serverError && (
            <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg p-3 animate-[fadeIn_150ms_ease-out]">
              {serverError}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100 shrink-0 bg-slate-50/60">
          <ButtonCancel onClick={onClose} disabled={submitting} />
          <ButtonSubmit
            onClick={handleSubmit}
            loading={submitting}
            loadingLabel="Memproses..."
          >
            {kelengkapanTersedia.length > 0
              ? `Serahkan Unit + ${kelengkapanTersedia.length} Kelengkapan`
              : 'Serahkan Unit'}
          </ButtonSubmit>
        </div>
      </div>
    </div>
  );
}