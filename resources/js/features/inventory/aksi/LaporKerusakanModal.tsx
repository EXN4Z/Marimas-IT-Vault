import { useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { router } from '@inertiajs/react';
import type { Inventory } from '../types/inventory';
import InventoryFotoUpload from '../form/InventoryFotoUpload';
import { JENIS_KERUSAKAN_OPTIONS } from '../inventoryHelpers';
import { ButtonCancel, ButtonSubmit, Field, SelectField, Textarea } from '../../../components/form/FormControls';
import { toastFormErrors } from '../../../lib/toastErrors';

interface Props {
  inventory: Inventory;
  onClose: () => void;
  onSuccess: () => void;
}

export default function InventoryLaporKerusakanModal({ inventory, onClose, onSuccess }: Props) {
  const [jenisKerusakan, setJenisKerusakan] = useState('');
  const [keluhan, setKeluhan] = useState('');
  const [fotoKerusakan, setFotoKerusakan] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<{ jenis_kerusakan?: string; keluhan?: string; foto?: string }>({});
  const [serverError, setServerError] = useState('');

  const handleSubmit = () => {
    const newErrors: { jenis_kerusakan?: string; keluhan?: string; foto?: string } = {};
    if (!jenisKerusakan.trim()) newErrors.jenis_kerusakan = 'Jenis kerusakan wajib dipilih.';
    if (!keluhan.trim()) newErrors.keluhan = 'Keluhan / kronologi kerusakan tidak boleh kosong!';
    if (fotoKerusakan.length === 0) newErrors.foto = 'Unggah minimal 1 foto bukti kerusakan.';

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      toastFormErrors(newErrors);
      return;
    }

    setSubmitting(true);
    setErrors({});
    setServerError('');
    // [F6-INERTIA] router.post + forceFormData (1 file foto) ke /penanganan-inventory. Sukses -> toast dari flash server (FlashToaster);
    // gagal validasi -> pesan tampil di dalam modal ini.
    router.post('/penanganan-inventory', {
      inventory_id: inventory.id,
      jenis_kerusakan: jenisKerusakan,
      keluhan: keluhan.trim(),
      foto: fotoKerusakan[0], // ambil 1 file pertama, sesuai kolom foto di backend
    }, {
      forceFormData: true,
      preserveScroll: true,
      preserveState: true,
      onSuccess: () => onSuccess(),
      onError: (errors) => {
        const msg =
          errors.jenis_kerusakan ||
          errors.foto ||
          errors.lapor ||
          errors.inventory_id ||
          Object.values(errors)[0] ||
          'Gagal mengirim laporan. Coba lagi.';
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
            <div className="w-10 h-10 rounded-xl bg-red-50 border border-red-100 flex items-center justify-center text-red-600 shadow-sm shrink-0">
              <AlertTriangle size={20} className="text-red-600" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-900 leading-tight">Lapor Kerusakan</h3>
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
          <Field label="Jenis Kerusakan" error={errors.jenis_kerusakan} required>
            <SelectField
              value={jenisKerusakan}
              onChange={(v) => {
                setJenisKerusakan(v);
                if (errors.jenis_kerusakan) setErrors((prev) => ({ ...prev, jenis_kerusakan: '' }));
              }}
              error={!!errors.jenis_kerusakan}
            >
              <option value="">Pilih jenis kerusakan...</option>
              {JENIS_KERUSAKAN_OPTIONS.map((opsi) => (
                <option key={opsi.value} value={opsi.value}>
                  {opsi.label}
                </option>
              ))}
            </SelectField>
          </Field>

          <Field label="Keluhan / Kronologi Kerusakan" error={errors.keluhan} required>
            <Textarea
              value={keluhan}
              onChange={(v) => {
                setKeluhan(v);
                if (errors.keluhan) setErrors((prev) => ({ ...prev, keluhan: '' }));
              }}
              error={!!errors.keluhan}
              placeholder="Jelaskan keluhan dan kronologi kerusakan"
            />
          </Field>

          <div>
            <InventoryFotoUpload
              files={fotoKerusakan}
              onChange={(files) => {
                setFotoKerusakan(files);
                if (errors.foto) setErrors((prev) => ({ ...prev, foto: '' }));
              }}
              max={1}
              label="Foto Bukti Kerusakan"
            />
            {errors.foto && (
              <p className="mt-1 text-xs text-red-600 font-medium">{errors.foto}</p>
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
          <ButtonSubmit onClick={handleSubmit} loading={submitting} tone="danger" loadingLabel="Mengirim...">
            Kirim Laporan
          </ButtonSubmit>
        </div>
      </div>
    </div>
  );
}