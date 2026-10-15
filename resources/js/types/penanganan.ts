export interface InventoryPenanganan {
    id: number;
    inventory_id: number;
    jenis_kerusakan: string;
    keluhan: string;
    tanggal_lapor: string;
    status: string;
    foto_lapor: string[] | null;
}
