import { Eye, Unlink } from 'lucide-react';
import type { Inventory } from '../types/inventory';
import { STATUS_LABEL, STATUS_BAR_CLASS } from '../list/helpers';
import { StatusDot } from './detailUi';

interface InventoryRelasiRowProps {
  item: Inventory;
  onDetail: (id: number) => void | Promise<void>;
  /** Kalau diisi (admin), tombol lepas tampil. Item yang dilepas = yang dikirim ke callback ini. */
  onLepas?: () => void;
}

// Satu baris relasi induk-anak di modal detail: nama · kode · S/N, status, tombol lihat detail, tombol lepas.
// Dipakai untuk "Kelengkapan terpasang" (baris anak, di induk) dan "Terpasang pada induk" (baris induk, di anak)
// supaya bentuknya selalu sama.
export default function InventoryRelasiRow({ item, onDetail, onLepas }: InventoryRelasiRowProps) {
  return (
    <div className="dv-row !items-center">
      <span className="min-w-0 truncate">
        <b>{item.nama || item.kode_inventory}</b>
        <span className="dv-muted">
          {' '}· {item.kode_inventory}
          {item.serial_number ? ` · S/N ${item.serial_number}` : ''}
        </span>
      </span>
      <span className="flex items-center gap-1 shrink-0">
        <span className="inline-flex items-center text-xs mr-2">
          <StatusDot className={STATUS_BAR_CLASS[item.status]} />
          {STATUS_LABEL[item.status] || item.status}
        </span>
        <button type="button" onClick={() => onDetail(item.id)} title="Lihat detail" aria-label="Lihat detail" className="dv-icon-btn">
          <Eye size={14} />
        </button>
        {onLepas && (
          <button type="button" onClick={onLepas} title="Lepas dari induk" aria-label="Lepas dari induk" className="dv-icon-btn is-alert">
            <Unlink size={14} />
          </button>
        )}
      </span>
    </div>
  );
}
