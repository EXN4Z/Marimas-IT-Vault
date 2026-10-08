import { Plus, Upload, Loader2, Download } from 'lucide-react';
import type { Inventory } from '../../../../api/masterData/inventory';

interface InventoryHeaderBarProps {
  setExportOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isAdmin: boolean;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  handleFileSelected: (e: React.ChangeEvent<HTMLInputElement>) => void | Promise<void>;
  importLoading: boolean;
  setEditingInventory: React.Dispatch<React.SetStateAction<Inventory | null>>;
  setFormOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

export default function InventoryHeaderBar({ setExportOpen, isAdmin, fileInputRef, handleFileSelected, importLoading, setEditingInventory, setFormOpen }: InventoryHeaderBarProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
      <p className="text-sm text-slate-500">
        Kelola inventory IT — laptop, PC, monitor, printer, dan semua aset perusahaan.
      </p>
      <div className="flex items-center gap-2.5 flex-wrap flex-shrink-0">
        {/* Export -- 1 tombol & 1 modal untuk semua kategori */}
        <button
          type="button"
          onClick={() => setExportOpen(true)}
          className="flex items-center gap-2 bg-white border border-slate-200 text-slate-700 text-sm font-medium px-4 py-2.5 rounded-lg hover:bg-slate-50 transition shadow-xs"
        >
          <Download size={16} />
          Export Excel
        </button>

        {isAdmin && (
          <>
            {/* Import Excel data inventory */}
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileSelected}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={importLoading}
              className="flex items-center gap-2 bg-white border border-slate-200 text-slate-700 text-sm font-medium px-4 py-2.5 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition shadow-xs"
            >
              {importLoading ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Upload size={16} />
              )}
              Import Excel
            </button>
          </>
        )}

        {isAdmin && (
          <button
            type="button"
            onClick={() => {
              setEditingInventory(null);
              setFormOpen(true);
            }}
            className="flex items-center gap-2 bg-slate-900 text-white text-sm font-medium px-4 py-2.5 rounded-lg hover:bg-slate-800 transition shadow-xs"
          >
            <Plus size={16} />
            Tambah Inventory
          </button>
        )}
      </div>
    </div>
  );
}
