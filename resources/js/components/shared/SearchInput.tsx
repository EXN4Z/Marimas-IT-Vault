import { Search } from 'lucide-react';

// Search bar seragam dipakai di semua tab Inventaris (Aset, Penanganan Aset,
// Foto Aset) biar gak ada lagi style yang nyimpang antar file kalau nanti
// ada yang ubah salah satu doang.

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export default function SearchInput({ value, onChange, placeholder, className = '' }: SearchInputProps) {
  return (
    <div className={`relative ${className}`}>
      <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full pl-9 pr-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
      />
    </div>
  );
}