import { type ReactNode } from 'react';
import { AlertTriangle, Trash2, X, AlertCircle } from 'lucide-react';
import { ButtonCancel, ButtonSubmit } from './FormControls';

interface ConfirmDeleteModalProps {
  title?: string;
  itemName: string;
  itemType?: string;
  itemCode?: string;
  description?: string;
  warningMessage?: string;
  errorMessage?: string;
  isOpen: boolean;
  loading?: boolean;
  forceAvailable?: boolean;
  onClose: () => void;
  onConfirm: (force?: boolean) => void;
  children?: ReactNode;
}

export default function ConfirmDeleteModal({
  title,
  itemName,
  itemType = 'data',
  itemCode,
  description,
  warningMessage,
  errorMessage,
  isOpen,
  loading = false,
  forceAvailable = false,
  onClose,
  onConfirm,
  children,
}: ConfirmDeleteModalProps) {
  if (!isOpen) return null;

  const modalTitle = title || `Hapus ${itemType}?`;

  return (
    <div
      className="fixed inset-0 bg-slate-950/50 backdrop-blur-[2px] z-[80] flex items-center justify-center p-4 animate-[fadeIn_150ms_ease-out]"
      onClick={(e) => {
        if (e.target === e.currentTarget && !loading) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-delete-title"
    >
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200/80 w-full max-w-md overflow-hidden transform transition-all animate-[slideUp_200ms_cubic-bezier(0.16,1,0.3,1)]">
        {/* Header with Icon badge and Close */}
        <div className="flex items-start justify-between p-6 pb-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-red-50 border border-red-100 flex items-center justify-center text-red-600 shadow-sm shrink-0">
              <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center">
                <Trash2 size={20} className="text-red-600" />
              </div>
            </div>
            <div>
              <h3 id="confirm-delete-title" className="text-lg font-semibold text-slate-900 leading-tight">
                {modalTitle}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">Konfirmasi tindakan penghapusan</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            aria-label="Tutup modal"
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition disabled:opacity-40"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content Body */}
        <div className="px-6 py-2 space-y-4">
          {/* Target Card Highlight */}
          <div className="bg-slate-50/80 border border-slate-200/80 rounded-xl p-3.5">
            <div className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-1">
              Target yang akan dihapus
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-bold text-slate-900 break-words">{itemName}</span>
              {itemCode && (
                <span className="font-mono text-xs font-semibold px-2 py-0.5 bg-slate-200/70 text-slate-700 rounded-md shrink-0">
                  {itemCode}
                </span>
              )}
            </div>
          </div>

          <p className="text-sm text-slate-600 leading-relaxed">
            {description || (
              <>
                Apakah Anda yakin ingin menghapus data ini? Tindakan ini bersifat{' '}
                <span className="font-semibold text-red-600">permanen</span> dan data yang telah dihapus tidak dapat
                dipulihkan kembali.
              </>
            )}
          </p>

          {/* Warning Banner */}
          {warningMessage && (
            <div className="flex items-start gap-2.5 p-3 bg-amber-50 border border-amber-200/80 rounded-xl text-xs text-amber-800">
              <AlertTriangle size={16} className="shrink-0 mt-0.5 text-amber-600" />
              <div className="leading-snug">{warningMessage}</div>
            </div>
          )}

          {/* Error Banner */}
          {errorMessage && (
            <div className="flex items-start gap-2.5 p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 animate-[fadeIn_150ms_ease-out]">
              <AlertCircle size={16} className="shrink-0 mt-0.5 text-red-600" />
              <div className="leading-snug">{errorMessage}</div>
            </div>
          )}

          {children}
        </div>

        {/* Action Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 bg-slate-50/60 border-t border-slate-100 mt-4">
          <ButtonCancel onClick={onClose} disabled={loading}>
            Batal
          </ButtonCancel>

          {forceAvailable && (
            <ButtonSubmit
              onClick={() => onConfirm(true)}
              loading={loading}
              tone="danger"
              loadingLabel="Menghapus paksa..."
            >
              Hapus Paksa
            </ButtonSubmit>
          )}

          <ButtonSubmit
            onClick={() => onConfirm(false)}
            loading={loading}
            tone="danger"
            loadingLabel="Menghapus..."
          >
            Ya, Hapus
          </ButtonSubmit>
        </div>
      </div>
    </div>
  );
}
