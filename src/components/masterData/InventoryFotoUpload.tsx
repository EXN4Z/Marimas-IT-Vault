import { useEffect, useMemo, useRef } from 'react';
import { Camera, X } from 'lucide-react';

interface InventoryFotoUploadProps {
  files: File[];
  onChange: (files: File[]) => void;
  max?: number;
  label?: string;
}

export default function InventoryFotoUpload({ files, onChange, max = 3, label = 'Foto Bukti' }: InventoryFotoUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  // preview URL dibuat sekali per file (bukan tiap render), dan di-revoke
  // pas komponen unmount / files berubah biar gak numpuk memory leak
  const previews = useMemo(() => files.map((f) => URL.createObjectURL(f)), [files]);
  useEffect(() => {
    return () => previews.forEach((url) => URL.revokeObjectURL(url));
  }, [previews]);

  const handlePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files || []);
    const combined = [...files, ...picked].slice(0, max);
    onChange(combined);
    if (inputRef.current) inputRef.current.value = '';
  };

  const removeAt = (idx: number) => {
    onChange(files.filter((_, i) => i !== idx));
  };

  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1">
        {label} <span className="text-red-500">*</span>
        <span className="text-xs text-slate-400 font-normal"> (maks. {max} foto)</span>
      </label>
      <div className="flex flex-wrap gap-2">
        {files.map((_, idx) => (
          <div key={idx} className="relative w-20 h-20 rounded-lg overflow-hidden border border-slate-200 group flex-shrink-0">
            <img src={previews[idx]} alt={`foto-${idx}`} className="w-full h-full object-cover" />
            <button
              type="button"
              onClick={() => removeAt(idx)}
              className="absolute top-0.5 right-0.5 bg-black/60 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition"
              title="Hapus foto"
            >
              <X size={12} />
            </button>
          </div>
        ))}
        {files.length < max && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="w-20 h-20 rounded-lg border-2 border-dashed border-slate-300 flex flex-col items-center justify-center text-slate-400 hover:border-slate-400 hover:text-slate-500 transition flex-shrink-0"
          >
            <Camera size={18} />
            <span className="text-[10px] mt-1">Tambah</span>
          </button>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handlePick}
        className="hidden"
      />
    </div>
  );
}