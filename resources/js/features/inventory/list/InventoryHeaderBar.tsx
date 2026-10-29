import { Plus, Upload, Loader2, Download } from 'lucide-react';
import type { Inventory } from '../types/inventory';

interface InventoryHeaderBarProps {
  setExportOpen: React.Dispatch<React.SetStateAction<boolean>>;
  /** [F4-INERTIA] true selama data export diambil dari server (tombol Export dinonaktifkan). */
  exportLoading?: boolean;
  isAdmin: boolean;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  handleFileSelected: (e: React.ChangeEvent<HTMLInputElement>) => void | Promise<void>;
  importLoading: boolean;
  setEditingInventory: React.Dispatch<React.SetStateAction<Inventory | null>>;
  setFormOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

// [INVENTORY-V2] Gaya sama dengan halaman Penanganan (.pn-head, .dd-btn, .pn-cta di index.css).
export default function InventoryHeaderBar({ setExportOpen, exportLoading = false, isAdmin, fileInputRef, handleFileSelected, importLoading, setEditingInventory, setFormOpen }: InventoryHeaderBarProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
      <p className="text-sm text-slate-500">
        Kelola inventory IT — laptop, PC, monitor, printer, dan semua inventory perusahaan.
      </p>
      <div className="flex items-center gap-2.5 flex-wrap flex-shrink-0">
        {/* Export -- 1 tombol & 1 modal untuk semua kategori */}
        <button
          type="button"
          onClick={() => setExportOpen(true)}
          disabled={exportLoading}
          className="flex items-center gap-2 bg-white border border-slate-200 text-slate-700 text-sm font-medium px-4 py-2.5 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition shadow-xs"
        >
          {exportLoading ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
          Export Excel
        </button>

        {isAdmin && (
          <>
            {/* Import Excel data inventory */}
            <input ref={fileInputRef} type="file" accept=".xlsx,.xls" onChange={handleFileSelected} className="hidden" />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={importLoading}
              className="flex items-center gap-2 bg-white border border-slate-200 text-slate-700 text-sm font-medium px-4 py-2.5 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition shadow-xs"
            >
              {importLoading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
              Import Excel
            </button>

            {/* Tombol Tambah Inventory */}
            <button
              type="button"
              onClick={() => {
                setEditingInventory(null);
                setFormOpen(true);
              }}
              className="flex items-center gap-2 bg-slate-900 text-white text-sm font-medium px-4 py-2.5 rounded-lg hover:bg-slate-800 transition shadow-xs dark:!bg-white dark:!text-slate-900 dark:hover:!bg-gray-100"
            >
              <Plus size={16} />
              Tambah Inventory
            </button>
          </>
        )}
      </div>
    </div>
  );
}
