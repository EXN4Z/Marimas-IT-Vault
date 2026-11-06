import { Children, isValidElement, type ReactElement, type ReactNode } from 'react';
import { AlertCircle, Loader2 } from 'lucide-react';
import Select, { type SelectOption } from './Select';

export const inputClass =
  'w-full rounded-xl border border-slate-300 dark:border-[#383842] bg-surface px-3.5 py-2.5 text-sm text-ink-800 placeholder:text-ink-400 shadow-sm outline-none transition-all duration-200 hover:border-slate-400 dark:hover:border-zinc-500 focus:border-slate-900 dark:focus:border-zinc-400 focus:ring-4 focus:ring-slate-900/[0.08] dark:focus:ring-zinc-600/20';

// `!` (important) dipakai di border-nya karena class ini SELALU digabung
// bareng inputClass yang udah punya border-slate-300 unprefixed duluan.
// Tanpa `!`, menang-kalahnya cuma soal urutan compile Tailwind (bukan urutan
// class di JSX), jadi bordernya bisa kalah dan gak kelihatan merah.
export const inputErrorClass =
  '!border-red-400 bg-red-50/20 dark:bg-red-950/20 text-ink-900 placeholder:text-red-300 focus:!border-red-500 focus:ring-4 focus:ring-red-500/15';

const textareaClass = `${inputClass} resize-none`;

interface FieldProps {
  label: string;
  error?: string;
  required?: boolean;
  hint?: string;
  className?: string;
  children: ReactNode;
}

// Pesan error validasi INLINE (di bawah kolom / area form). Satu-satunya style error inline di app ini supaya
// tampilannya konsisten: dipakai <Field error>, error foto, "pilih minimal 1 kolom", dst.
// Error dari server / aksi (simpan, hapus, import) pakai toast, bukan ini.
export function InlineError({ children, className = '' }: { children?: ReactNode; className?: string }) {
  if (!children) return null;
  return (
    <span
      className={`flex items-center gap-1.5 mt-1.5 text-xs font-medium text-tone-red-600 animate-[fadeIn_150ms_ease-out] ${className}`.trim()}
      role="alert"
    >
      <AlertCircle size={13} className="shrink-0 text-red-500" />
      {children}
    </span>
  );
}

// Label + error text pembungkus satu field dengan visual warning interaktif
export function Field({ label, error, required, hint, className = '', children }: FieldProps) {
  return (
    <label className={`block text-sm ${className}`}>
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <span className="font-medium text-ink-700 select-none flex items-center gap-1">
          {label}
          {required && (
            <span className="text-red-500 font-semibold" title="Field ini wajib diisi">
              *
            </span>
          )}
        </span>
        {required && (
          <span className="shrink-0 whitespace-nowrap text-[11px] font-medium text-red-500 dark:text-red-400 select-none">
            wajib diisi
          </span>
        )}
      </div>

      {children}

      {error ? (
        <InlineError>{error}</InlineError>
      ) : hint ? (
        <span className="block mt-1.5 text-xs text-ink-400">{hint}</span>
      ) : null}
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
  className?: string;
  onBlur?: () => void;
  min?: number | string;
  max?: number | string;
}

export function TextInput({
  value,
  onChange,
  type = 'text',
  placeholder,
  disabled,
  error,
  autoFocus,
  className = '',
  onBlur,
  min,
  max,
}: TextInputProps) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onBlur}
      placeholder={placeholder}
      disabled={disabled}
      autoFocus={autoFocus}
      min={min}
      max={max}
      className={`${inputClass} disabled:cursor-not-allowed disabled:bg-surface-50 disabled:text-ink-400 ${
        error ? inputErrorClass : ''
      } ${className}`}
    />
  );
}

interface TextareaProps {
  value: string;
  onChange: (value: string) => void;
  rows?: number;
  placeholder?: string;
  error?: boolean;
  disabled?: boolean;
  className?: string;
  onBlur?: () => void;
}

export function Textarea({
  value,
  onChange,
  rows = 4,
  placeholder,
  error,
  disabled,
  className = '',
  onBlur,
}: TextareaProps) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onBlur}
      rows={rows}
      placeholder={placeholder}
      disabled={disabled}
      className={`${textareaClass} disabled:cursor-not-allowed disabled:bg-surface-50 disabled:text-ink-400 ${
        error ? inputErrorClass : ''
      } ${className}`}
    />
  );
}

interface SelectFieldProps {
  value: string | number;
  onChange: (value: string) => void;
  disabled?: boolean;
  error?: boolean;
  placeholder?: string;
  children: ReactNode;
}

export function SelectField({
  value,
  onChange,
  disabled,
  error,
  placeholder,
  children,
}: SelectFieldProps) {
  const options: SelectOption[] = Children.toArray(children)
    .filter(
      (
        child
      ): child is ReactElement<{
        value?: string | number;
        disabled?: boolean;
        children?: ReactNode;
      }> => isValidElement(child)
    )
    .map((child) => ({
      value: String(child.props.value ?? ''),
      label:
        typeof child.props.children === 'string'
          ? child.props.children
          : String(child.props.children ?? ''),
      disabled: child.props.disabled,
    }));

  return (
    <Select
      value={String(value)}
      onChange={onChange}
      options={options}
      disabled={disabled}
      error={error}
      placeholder={placeholder}
    />
  );
}

// Tombol Batal standar
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
      className="px-4 py-2.5 text-sm font-medium rounded-xl border border-line-200 text-ink-700 bg-surface hover:bg-hover-50 active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100 transition-all duration-150 shadow-sm"
    >
      {children}
    </button>
  );
}

// Tombol submit standar + spinner otomatis pas loading
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
  tone?: 'default' | 'danger' | 'success';
  loadingLabel?: string;
  children: ReactNode;
}) {
  const toneClass =
    tone === 'danger'
      ? 'bg-red-600 hover:bg-red-700 focus:ring-glow-red-500-a20 shadow-red-500/20'
      : tone === 'success'
      ? 'bg-emerald-600 hover:bg-emerald-700 focus:ring-glow-emerald-500-a20 shadow-emerald-500/20'
      : 'bg-solid hover:bg-solid-hover focus:ring-slate-900/20 shadow-slate-900/20';

  return (
    <button
      type={type}
      form={form}
      onClick={onClick}
      disabled={disabled || loading}
      className={`px-5 py-2.5 text-sm font-medium rounded-xl text-white shadow-sm active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100 transition-all duration-150 inline-flex items-center justify-center gap-2 focus:outline-none focus:ring-4 ${toneClass}`}
    >
      {loading && <Loader2 size={16} className="animate-spin" />}
      {loading ? loadingLabel : children}
    </button>
  );
}
