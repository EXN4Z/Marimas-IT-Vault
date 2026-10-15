export interface InventoryPemakai {
    id: number;
    inventory_id: number;
    user_id: number;
    cabang_id: number | null;
    tanggal_mulai: string;
    tanggal_selesai: string | null;
    foto_penerimaan: string[] | null;
}
export interface FotoPemakaiEntry {
    id: number;
    foto: string;
}
export interface RiwayatInventoryEvent {
    id: number;
    jenis: string;
    deskripsi: string;
    tanggal: string;
}
