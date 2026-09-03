import { Children, isValidElement, type ReactElement, type ReactNode } from 'react';
import { AlertCircle, Loader2 } from 'lucide-react';
import Select, { type SelectOption } from './Select';

export const inputClass =
  'w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 shadow-sm outline-none transition-all duration-200 hover:border-slate-400 focus:border-slate-900 focus:ring-4 focus:ring-slate-900/[0.08]';

// `!` (important) dipakai di border-nya karena class ini SELALU digabung
// bareng inputClass yang udah punya border-slate-300 unprefixed duluan.
// Tanpa `!`, menang-kalahnya cuma soal urutan compile Tailwind (bukan urutan
// class di JSX), jadi bordernya bisa kalah dan gak kelihatan merah.
export const inputErrorClass =
  '!border-red-400 bg-red-50/20 text-slate-900 placeholder:text-red-300 focus:!border-red-500 focus:ring-4 focus:ring-red-500/15';

export const textareaClass = `${inputClass} resize-none`;

interface FieldProps {
  label: string;
  error?: string;
  required?: boolean;
  hint?: string;
  className?: string;
  children: ReactNode;
}

// Label + error text pembungkus satu field dengan visual warning interaktif
export function Field({ label, error, required, hint, className = '', children }: FieldProps) {
  return (
    <label className={`block text-sm ${className}`}>
      <div className="flex items-center justify-between mb-1.5">
        <span className="font-medium text-slate-700 select-none flex items-center gap-1">
          {label}
          {required && (
            <span className="text-red-500 font-semibold" title="Field ini wajib diisi">
              *
            </span>
          )}
        </span>
        {required && !error && (
          <span className="text-[11px] font-normal text-slate-400">Wajib diisi</span>
        )}
      </div>

      {children}

      {error ? (
        <span
          className="flex items-center gap-1.5 mt-1.5 text-xs font-medium text-red-600 animate-[fadeIn_150ms_ease-out]"
          role="alert"
        >
          <AlertCircle size={13} className="shrink-0 text-red-500" />
          {error}
        </span>
      ) : hint ? (
        <span className="block mt-1.5 text-xs text-slate-400">{hint}</span>
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
      className={`${inputClass} disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400 ${
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
      className={`${textareaClass} disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400 ${
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
  children: ReactNode;
}

export function SelectField({ value, onChange, disabled, error, children }: SelectFieldProps) {
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
      className="px-4 py-2.5 text-sm font-medium rounded-xl border border-slate-200 text-slate-700 bg-white hover:bg-slate-50 active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100 transition-all duration-150 shadow-sm"
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
      ? 'bg-red-600 hover:bg-red-700 focus:ring-red-500/20 shadow-red-500/20'
      : tone === 'success'
      ? 'bg-emerald-600 hover:bg-emerald-700 focus:ring-emerald-500/20 shadow-emerald-500/20'
      : 'bg-slate-900 hover:bg-slate-800 focus:ring-slate-900/20 shadow-slate-900/20';

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
