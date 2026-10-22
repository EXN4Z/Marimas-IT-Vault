import { useState } from 'react';
import { RotateCcw, X } from 'lucide-react';
import toast from 'react-hot-toast';
import type { Inventory } from '../types/inventory';
import { router } from '@inertiajs/react';
import type { InventoryPemakai } from '../types/inventoryPemakai';
import type { Flash } from '../../../types/inertia';
import { namaPemakai } from '../inventoryHelpers';
import InventoryFotoUpload from '../form/InventoryFotoUpload';
import { ButtonCancel, ButtonSubmit, Field, TextInput, Textarea } from '../../../components/form/FormControls';
import { toastFormErrors } from '../../../lib/toastErrors';

interface InventoryPengembalianModalProps {
  inventory: Inventory;
  pemakai: InventoryPemakai;
  isAdmin: boolean;
  onClose: () => void;
  onSuccess: (pemakai: InventoryPemakai) => void;
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

// minimal foto bukti; batas maksimalnya sengaja disamakan dengan minimal
const MIN_FOTO = 3;

export default function InventoryPengembalianModal({ inventory, pemakai, isAdmin, onClose, onSuccess }: InventoryPengembalianModalProps) {
  const [kodeStruk, setKodeStruk] = useState('');
  const [tanggalPengembalian, setTanggalPengembalian] = useState(todayIso());
  const [catatan, setCatatan] = useState('');
  const [fotoPengembalian, setFotoPengembalian] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<{ kodeStruk?: string; foto?: string }>({});
  const [serverError, setServerError] = useState('');

  const handleSubmit = () => {
    const newErrors: { kodeStruk?: string; foto?: string } = {};
    if (!kodeStruk.trim()) {
      newErrors.kodeStruk = 'Kode struk penerimaan fisik wajib diisi sebagai bukti sah.';
    }
    if (fotoPengembalian.length < MIN_FOTO) {
      newErrors.foto = `Wajib melampirkan minimal ${MIN_FOTO} foto kondisi unit saat ini (saat ini: ${fotoPengembalian.length} foto).`;
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      toastFormErrors(newErrors);
      return;
    }

    setSubmitting(true);
    setErrors({});
    setServerError('');
    // [F5-INERTIA] router.post + forceFormData (ada file foto). Sukses -> toast dari flash server (FlashToaster) + data struk
    // pengembalian di flash.struk buat dicetak parent. Gagal validasi -> pesan tampil di dalam modal ini.
    const data: Record<string, string | File[]> = {
      no_struk_penerimaan: kodeStruk.trim(),
      tanggal_pengembalian: tanggalPengembalian,
      foto_pengembalian: fotoPengembalian,
    };
    if (catatan.trim()) data.catatan_pengembalian = catatan.trim();

    router.post(`/master-data/inventory-pemakai/${pemakai.id}/kembalikan`, data, {
      forceFormData: true,
      preserveScroll: true,
      preserveState: true,
      onSuccess: (page) => {
        const struk = (page.props as { flash?: Flash }).flash?.struk;
        onSuccess(struk?.tipe === 'pengembalian' ? struk.pemakai : pemakai);
      },
      onError: (errors) => {
        const msg =
          errors.no_struk_penerimaan ||
          errors.foto_pengembalian ||
          Object.values(errors)[0] ||
          'Gagal memproses pengembalian.';
        setServerError(msg);
        toast.error(msg);
      },
      onFinish: () => setSubmitting(false),
    });
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
            <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 shadow-sm shrink-0">
              <RotateCcw size={20} className="text-emerald-600" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-900 leading-tight">
                {isAdmin ? 'Terima Kembali Inventory' : 'Kembalikan Inventory'}
              </h3>
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
          <div className="bg-slate-50 border border-slate-100 rounded-xl px-3.5 py-3 text-sm flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold">
                {isAdmin ? 'Peminjam / Pemegang Unit' : 'Status Pengguna Saat Ini'}
              </p>
              <p className="text-sm text-slate-900 font-semibold mt-0.5">{namaPemakai(pemakai)}</p>
            </div>
          </div>

          <Field label="Kode Struk Penerimaan" error={errors.kodeStruk} required>
            <TextInput
              value={kodeStruk}
              onChange={(v) => {
                setKodeStruk(v);
                if (errors.kodeStruk) setErrors((prev) => ({ ...prev, kodeStruk: '' }));
              }}
              autoFocus
              placeholder="Masukkan kode struk penerimaan"
              error={!!errors.kodeStruk}
            />
          </Field>

          <Field label="Tanggal Pengembalian" required>
            <TextInput
              type="date"
              value={tanggalPengembalian}
              onChange={setTanggalPengembalian}
            />
          </Field>

          <Field label="Catatan Kondisi Unit">
            <Textarea
              value={catatan}
              onChange={setCatatan}
              rows={2}
              placeholder="Tulis catatan kondisi unit saat dikembalikan"
            />
          </Field>

          <div>
            <InventoryFotoUpload
              files={fotoPengembalian}
              onChange={(files) => {
                setFotoPengembalian(files);
                if (errors.foto) setErrors((prev) => ({ ...prev, foto: '' }));
              }}
              min={MIN_FOTO}
              max={MIN_FOTO}
              label="Foto Bukti Kondisi Inventory"
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
            tone="success"
            loadingLabel="Memproses..."
          >
            {isAdmin ? 'Terima Kembali' : 'Kembalikan Unit'}
          </ButtonSubmit>
        </div>
      </div>
    </div>
  );
}