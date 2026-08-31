import type { ReactNode } from 'react';

// Style dasar dipatok dari InventoryFormModal (paling lengkap: shadow-sm +
// hover border + ring-4 pas fokus). Semua form/modal lain sebaiknya pindah
// pakai komponen di file ini biar look-and-feel konsisten, daripada
// nulis ulang className border/ring/padding masing-masing.

export const inputClass =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 shadow-sm outline-none transition-all duration-150 hover:border-slate-400 focus:border-slate-900 focus:ring-4 focus:ring-slate-900/[0.06]';

export const inputErrorClass = 'border-red-400 focus:border-red-500 focus:ring-red-500/10';

export const textareaClass = `${inputClass} resize-none`;

interface FieldProps {
  label: string;
  error?: string;
  required?: boolean;
  children: ReactNode;
}

// Label + error text pembungkus satu field. Pakai buat input/select/textarea apa aja.
export function Field({ label, error, required, children }: FieldProps) {
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

interface TextInputProps {
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
  disabled?: boolean;
  error?: boolean;
  autoFocus?: boolean;
}

export function TextInput({ value, onChange, type = 'text', placeholder, disabled, error, autoFocus }: TextInputProps) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      autoFocus={autoFocus}
      className={`${inputClass} disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400 ${error ? inputErrorClass : ''}`}
    />
  );
}

interface TextareaProps {
  value: string;
  onChange: (value: string) => void;
  rows?: number;
  placeholder?: string;
  error?: boolean;
}

export function Textarea({ value, onChange, rows = 4, placeholder, error }: TextareaProps) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      rows={rows}
      placeholder={placeholder}
      className={`${textareaClass} ${error ? inputErrorClass : ''}`}
    />
  );
}

interface SelectFieldProps {
  value: string | number;
  onChange: (value: string) => void;
  disabled?: boolean;
  error?: boolean;
  children: ReactNode;
}

export function SelectField({ value, onChange, disabled, error, children }: SelectFieldProps) {
  return (
    <div className="relative">
      <select
        className={`${inputClass} appearance-none pr-9 cursor-pointer disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400 ${error ? inputErrorClass : ''}`}
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

// Tombol Batal standar (footer modal, kiri).
export function ButtonCancel({
  onClick,
  disabled,
  children = 'Batal',
}: {
  onClick: () => void;
  disabled?: boolean;
  children?: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="px-4 py-2 text-sm rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition-colors"
    >
      {children}
    </button>
  );
}

// Tombol submit standar (footer modal, kanan) + spinner otomatis pas loading.
// `tone` biar bisa dipakai buat aksi destructive (mis. Lapor Kerusakan -> merah).
export function ButtonSubmit({
  onClick,
  type = 'button',
  form,
  loading,
  disabled,
  tone = 'default',
  loadingLabel = 'Memproses...',
  children,
}: {
  onClick?: () => void;
  type?: 'button' | 'submit';
  form?: string;
  loading?: boolean;
  disabled?: boolean;
  tone?: 'default' | 'danger';
  loadingLabel?: string;
  children: ReactNode;
}) {
  const toneClass =
    tone === 'danger' ? 'bg-red-600 hover:bg-red-700' : 'bg-slate-900 hover:bg-slate-800';
  return (
    <button
      type={type}
      form={form}
      onClick={onClick}
      disabled={disabled || loading}
      className={`px-4 py-2 text-sm rounded-lg text-white active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100 transition-all duration-150 inline-flex items-center gap-2 ${toneClass}`}
    >
      {loading && (
        <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.25" />
          <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        </svg>
      )}
      {loading ? loadingLabel : children}
    </button>
  );
}