import type { FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { useForm } from '@inertiajs/react';
import toast from 'react-hot-toast';
import { KeyRound, X } from 'lucide-react';
import { Field, TextInput, ButtonCancel, ButtonSubmit } from '../../../components/form/FormControls';

interface Props {
  userId: number;
  userName: string;
  onClose: () => void;
}

// [F3-INERTIA] Modal admin menentukan sendiri password baru untuk karyawan (dulu SetPasswordModal di Edit.tsx).
// Submit lewat Inertia (PUT /master-data/karyawan/{id}/password); sukses -> toast dari flash server (FlashToaster).
export default function KaryawanPasswordModal({ userId, userName, onClose }: Props) {
  const { data, setData, put, processing, errors, setError, clearErrors } = useForm({
    password: '',
    password_confirmation: '',
  });

  function handleClose() {
    if (processing) return;
    onClose();
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();

    const clientErrors: { password?: string; password_confirmation?: string } = {};
    if (!data.password.trim()) {
      clientErrors.password = 'Password baru tidak boleh kosong!';
    }
    if (!data.password_confirmation.trim()) {
      clientErrors.password_confirmation = 'Konfirmasi password tidak boleh kosong!';
    } else if (data.password && data.password !== data.password_confirmation) {
      clientErrors.password_confirmation = 'Konfirmasi password tidak cocok.';
    }

    if (Object.keys(clientErrors).length > 0) {
      setError(clientErrors);
      toast.error('Mohon periksa kembali isian password.');
      return;
    }

    put(`/master-data/karyawan/${userId}/password`, {
      preserveScroll: true,
      preserveState: true,
      onSuccess: () => onClose(),
      onError: (errs) => toast.error(errs.password || 'Password tidak memenuhi kriteria.'),
    });
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 animate-[fadeIn_150ms_ease-out]"
    >
      <div
        className="w-full max-w-md rounded-2xl bg-surface shadow-2xl border border-line-200-a80 overflow-hidden animate-[slideUp_200ms_cubic-bezier(0.16,1,0.3,1)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between p-6 pb-4 border-b border-line-100">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-tint-blue-50 border border-edge-blue-100 flex items-center justify-center text-blue-600 shadow-sm shrink-0">
              <KeyRound size={22} className="text-blue-600" />
            </div>
            <div className="min-w-0">
              <h3 className="text-lg font-semibold text-ink-900 leading-tight">Ubah Password</h3>
              <p className="text-xs text-ink-500 mt-0.5 truncate">Untuk {userName}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            disabled={processing}
            aria-label="Tutup"
            className="text-ink-400 hover:text-ink-600 p-1.5 rounded-lg hover:bg-hover-100 transition disabled:opacity-40"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <Field label="Password Baru" error={errors.password} required>
            <TextInput
              type="password"
              autoFocus
              placeholder="Masukkan password baru"
              value={data.password}
              onChange={(v) => {
                setData('password', v);
                if (errors.password) clearErrors('password');
              }}
              error={!!errors.password}
            />
          </Field>

          <Field label="Konfirmasi Password Baru" error={errors.password_confirmation} required>
            <TextInput
              type="password"
              placeholder="Ketik ulang password baru"
              value={data.password_confirmation}
              onChange={(v) => {
                setData('password_confirmation', v);
                if (errors.password_confirmation) clearErrors('password_confirmation');
              }}
              error={!!errors.password_confirmation}
            />
          </Field>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-line-100 mt-6">
            <ButtonCancel onClick={handleClose} disabled={processing} />
            <ButtonSubmit type="submit" loading={processing} loadingLabel="Menyimpan...">
              Simpan Password
            </ButtonSubmit>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
