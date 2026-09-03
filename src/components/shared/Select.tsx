import { useEffect, useId, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';

// Dropdown custom biar tampilan konsisten di semua browser/OS (select native
// bawaan browser gak bisa di-style: ada scrollbar bawaan, warna hover beda-
// beda tiap OS). Props dibikin mirip select native (value/onChange/options)
// biar gampang nge-ganti pemakaian <select> lama.

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

interface SelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  error?: boolean;
  /** 'default' dipakai form field biasa, 'compact' buat kontrol kecil kayak sort dropdown */
  size?: 'default' | 'compact';
  className?: string;
}

export default function Select({
  value,
  onChange,
  options,
  placeholder = 'Pilih',
  disabled,
  error,
  size = 'default',
  className = '',
}: SelectProps) {
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const buttonId = useId();
  const listId = useId();

  const selected = options.find((o) => o.value === value) || null;

  function requestClose() {
    setClosing(true);
    window.setTimeout(() => {
      setOpen(false);
      setClosing(false);
    }, 120);
  }

  function openList() {
    if (disabled) return;
    setOpen(true);
    const currentIdx = options.findIndex((o) => o.value === value);
    setActiveIndex(currentIdx >= 0 ? currentIdx : 0);
  }

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        if (open) requestClose();
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (open && activeIndex >= 0 && listRef.current) {
      const el = listRef.current.children[activeIndex] as HTMLElement | undefined;
      if (el) el.scrollIntoView({ block: 'nearest' });
    }
  }, [activeIndex, open]);

  function selectOption(opt: SelectOption) {
    if (opt.disabled) return;
    onChange(opt.value);
    requestClose();
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!open) {
      if (['Enter', ' ', 'ArrowDown', 'ArrowUp'].includes(e.key)) {
        e.preventDefault();
        openList();
      }
      return;
    }
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setActiveIndex((i) => Math.min(i + 1, options.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setActiveIndex((i) => Math.max(i - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (activeIndex >= 0) selectOption(options[activeIndex]);
        break;
      case 'Escape':
        e.preventDefault();
        requestClose();
        break;
      default:
        break;
    }
  }

  const isCompact = size === 'compact';

  const triggerClass = isCompact
    ? 'w-full flex items-center justify-between gap-2 text-xs font-semibold text-[#171633] bg-[#F7F8FC] rounded-lg pl-3 pr-2.5 py-2 cursor-pointer transition-colors'
    : `w-full flex items-center justify-between gap-2 rounded-lg border bg-white px-3 py-2 text-sm text-left shadow-sm outline-none transition-all duration-150 cursor-pointer disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400 ${
        error
          ? 'border-red-400'
          : open
            ? 'border-slate-900 hover:border-slate-900'
            : 'border-slate-300 hover:border-slate-400'
      }`;

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      <button
        id={buttonId}
        type="button"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-haspopup="listbox"
        disabled={disabled}
        onClick={() => (open ? requestClose() : openList())}
        onKeyDown={handleKeyDown}
        className={triggerClass}
      >
        <span
          className={`truncate ${
            isCompact ? '' : selected ? 'text-slate-800' : 'text-slate-400'
          }`}
        >
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown
          size={isCompact ? 12 : 15}
          className={`shrink-0 transition-transform duration-200 ${
            isCompact ? 'text-[#A9A9C6]' : 'text-slate-400'
          } ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <ul
          id={listId}
          ref={listRef}
          role="listbox"
          aria-activedescendant={activeIndex >= 0 ? `${listId}-opt-${activeIndex}` : undefined}
          className="absolute z-20 mt-1.5 max-h-60 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white p-1 shadow-lg [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
          style={{
            transformOrigin: 'top',
            animation: closing
              ? 'select-out 120ms ease-in forwards'
              : 'select-in 140ms cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        >
          <style>{`
            @keyframes select-in {
              from { opacity: 0; transform: translateY(-4px) scale(0.98); }
              to { opacity: 1; transform: translateY(0) scale(1); }
            }
            @keyframes select-out {
              from { opacity: 1; transform: translateY(0) scale(1); }
              to { opacity: 0; transform: translateY(-4px) scale(0.98); }
            }
          `}</style>
          {options.map((opt, idx) => {
            const isSelected = opt.value === value;
            const isActive = idx === activeIndex;
            return (
              <li
                key={opt.value}
                id={`${listId}-opt-${idx}`}
                role="option"
                aria-selected={isSelected}
                aria-disabled={opt.disabled}
                onMouseEnter={() => !opt.disabled && setActiveIndex(idx)}
                onClick={() => selectOption(opt)}
                className={`flex items-center justify-between gap-2 rounded-md px-2.5 py-2 text-sm transition-colors duration-75 ${
                  opt.disabled
                    ? 'cursor-not-allowed text-slate-300'
                    : 'cursor-pointer text-slate-700'
                } ${isActive && !opt.disabled ? 'bg-slate-100' : ''}`}
              >
                <span className={`truncate ${isSelected ? 'font-medium text-slate-900' : ''}`}>
                  {opt.label}
                </span>
                {isSelected && <Check size={14} className="shrink-0 text-slate-900" />}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}